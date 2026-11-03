import { readScannerDocument } from "./src/shared/scanner-store.js";
import { createAlertPresenter, websiteOrigin, presentationKey } from "./src/shared/alert-presentation.js";
import { getSettings } from "./src/shared/storage.js";
import { syncMcpBridge } from "./src/shared/mcp-bridge.js";
import { MONITOR_ALARM, startScannerMonitor, stopScannerMonitor, updateScannerMonitorInterval, ensureMonitorAlarm, runMonitorTick, deliverMonitorAlerts } from "./src/scanner-lab/scanner-monitor.js";

let running;
const alertPresenter = createAlertPresenter(chrome);
async function work() {
  if (running) return running;
  running = (async () => {
    await runMonitorTick();
    await deliverMonitorAlerts(alertPresenter);
    await ensureMonitorAlarm(chrome.alarms);
    chrome.runtime.sendMessage({ type: "scanner-monitor-updated" }).catch(() => {});
    // New alerts reach AI agents without the panel open; a missing local server is not an error.
    const settings = await getSettings();
    if (settings.mcpBridgeEnabled === true) await syncMcpBridge(settings, await readScannerDocument()).catch(() => {});
  })().catch((error) => console.error("Background scanner task failed", error)).finally(() => { running = null; });
  return running;
}
function configurePanel() {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error) => console.error("Failed to set side panel behavior", error));
}
function recover() { void ensureMonitorAlarm(chrome.alarms).then(work).catch((error) => console.error("Could not restore monitor", error)); }
chrome.runtime.onInstalled.addListener(() => { configurePanel(); recover(); });
chrome.runtime.onStartup.addListener(() => { configurePanel(); recover(); });
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === MONITOR_ALARM) void work(); });
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (["scanner-alert-open", "scanner-alert-receipt"].includes(message?.type) && sender.id === chrome.runtime.id) {
    (async () => {
      const doc = await readScannerDocument();
      let trusted = sender.url?.startsWith(chrome.runtime.getURL(""));
      if (!trusted) { try { trusted = (await getSettings()).notificationSites?.includes(websiteOrigin(sender.url)); } catch {} }
      if (!trusted || doc.generation !== message.generation || !doc.data.alerts.some(alert => alert.id === message.id)) throw new Error("Alert is no longer available.");
      if (message.type === "scanner-alert-receipt") {
        const alert = doc.data.alerts.find(row => row.id === message.id);
        if (!doc.monitor?.enabled || alert.monitorId !== doc.monitor.id) throw new Error("Alert expired.");
        const key = presentationKey(doc.generation, message.id);
        const saved = await chrome.storage.session.get(key);
        if (message.shown === true) await chrome.storage.session.set({ [key]: { channel: "website", at: Date.now() } });
        return { ok: true, receipt: saved[key] || null };
      }
      await chrome.tabs.create({ url: chrome.runtime.getURL(`side_panel.html#alerts?event=${encodeURIComponent(message.id)}`) });
      return { ok: true };
    })().then(reply, () => reply({ ok: false }));
    return true;
  }
  if (sender.id !== chrome.runtime.id || !["scanner-monitor-start", "scanner-monitor-stop", "scanner-monitor-state", "scanner-monitor-interval"].includes(message?.type)) return;
  if (sender.url && !sender.url.startsWith(chrome.runtime.getURL(""))) return;
  (async () => {
    if (message.type === "scanner-monitor-start") {
      await startScannerMonitor(message.recipe, message.options);
      await ensureMonitorAlarm(chrome.alarms);
      void work();
    } else if (message.type === "scanner-monitor-stop") {
      await stopScannerMonitor(message.options);
      await ensureMonitorAlarm(chrome.alarms);
    } else if (message.type === "scanner-monitor-interval") await updateScannerMonitorInterval(message.options);
    const doc = await readScannerDocument();
    return { ok: true, generation: doc.generation, monitor: doc.monitor || null, alerts: doc.data.alerts || [] };
  })().then(reply, (error) => reply({ ok: false, name: error.name, error: error.message }));
  return true;
});
chrome.notifications.onClicked.addListener((id) => { chrome.tabs.create({ url: chrome.runtime.getURL(`side_panel.html#alerts?event=${encodeURIComponent(id)}`) }).catch((error) => console.error("Could not open Alerts", error)); });
void ensureMonitorAlarm(chrome.alarms).catch((error) => console.error("Could not restore monitor alarm", error));
