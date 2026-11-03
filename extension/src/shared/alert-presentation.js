import { getSettings } from "./storage.js";
import { readScannerDocument, updateScannerDocument } from "./scanner-store.js";
import { openAlertWindow } from "./alert-window.js";
import { playAlertSound } from "./alert-sound.js";

export function websiteOrigin(value) {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Enter a normal HTTP(S) site origin without credentials.");
  return url.origin;
}
export const presentationKey = (generation, id) => `kalshi-alert:${generation}:${id}`;
export function pendingAlertForDocument(doc, event) {
  if (doc?.generation !== event.generation || !doc.monitor?.enabled) return null;
  return doc.data?.alerts?.find(alert => alert.id === event.id && alert.delivery === "pending" && alert.monitorId === doc.monitor.id) || null;
}
export function publicAlert(alert, generation) {
  return { id: alert.id, generation, title: String(alert.title || alert.symbol || "Condition matched").slice(0, 160),
    symbol: String(alert.symbol || "").slice(0, 100), formula: String(alert.recipeFormula || "Saved recipe").slice(0, 160), createdAt: alert.createdAt };
}

// Self-contained function for an ISOLATED-world injection. No remote scripts/assets.
export async function showWebsiteAlert(event, expiresAt) {
  if (Date.now() >= expiresAt || document.visibilityState !== "visible" || !document.hasFocus()) return false;
  const key = `kalshi-alert:${event.generation}:${event.id}`;
  const receipt = await chrome.runtime.sendMessage({ type: "scanner-alert-receipt", id: event.id, generation: event.generation });
  if (!receipt?.ok) return false;
  if (receipt.receipt) return true;
  if (Date.now() >= expiresAt || document.visibilityState !== "visible" || !document.hasFocus()) return false;
  const registry = globalThis.__kalshiAlertPresentation ??= { generation: event.generation, ids: new Set(), root: null, host: null };
  if (registry.generation !== event.generation) { registry.host?.remove(); registry.ids.clear(); registry.root = null; registry.generation = event.generation; }
  if (registry.ids.has(event.id)) {
    const ack = await chrome.runtime.sendMessage({ type: "scanner-alert-receipt", id: event.id, generation: event.generation, shown: true });
    if (!ack?.ok) throw new Error("Website receipt not acknowledged.");
    return true;
  }
  if (!registry.root || !registry.host?.isConnected) {
    const host = document.createElement("div");
    host.style.cssText = "all:initial;position:fixed;top:12px;right:12px;width:min(420px,calc(100vw - 24px));z-index:2147483647;";
    const root = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = ":host{color-scheme:dark}.box{font:14px system-ui;background:#111515;color:#f1f5ed;border:1px solid #edff20;border-radius:14px;padding:14px;box-shadow:0 12px 40px #0006;max-height:65vh;overflow:auto;animation:slide .22s ease}h2{font-size:16px;margin:0 0 8px}p{overflow-wrap:anywhere}button{font:inherit;color:#edff20;background:#202727;border:1px solid #697367;border-radius:8px;padding:8px;cursor:pointer;margin-right:8px}button:focus-visible{outline:3px solid #edff20}.ad{border-top:1px solid #465046;padding-top:10px;font-size:12px;color:#bbc4b4}article{border-bottom:1px solid #465046;padding:10px 0}@keyframes slide{from{transform:translateY(-24px);opacity:0}}@media(prefers-reduced-motion:reduce){.box{animation:none}}";
    const box = document.createElement("section"); box.className = "box"; box.setAttribute("role", "region"); box.setAttribute("aria-label", "Kalshi Screener condition alerts"); box.setAttribute("aria-live", "polite");
    const title = document.createElement("h2"); title.textContent = "Kalshi Screener · Condition matched";
    const close = document.createElement("button"); close.textContent = "Close alerts"; close.onclick = () => host.remove();
    box.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); host.remove(); } });
    box.append(title, close); root.append(style, box); document.documentElement.append(host);
    registry.root = box; registry.host = host;
  }
  const card = document.createElement("article");
  const title = document.createElement("strong"); title.textContent = event.title;
  const description = document.createElement("p"); description.textContent = `${event.symbol} · ${event.formula}`;
  const open = document.createElement("button"); open.textContent = "View matching result";
  open.onclick = () => chrome.runtime.sendMessage({ type: "scanner-alert-open", id: event.id, generation: event.generation }).catch(() => {});
  card.append(title, description, open); registry.root.append(card);
  registry.ids.add(event.id);
  const ack = await chrome.runtime.sendMessage({ type: "scanner-alert-receipt", id: event.id, generation: event.generation, shown: true });
  if (!ack?.ok) throw new Error("Website receipt not acknowledged.");
  return true;
}

export function createAlertPresenter(api = globalThis.chrome, { read = readScannerDocument, settings = getSettings } = {}) {
  const panels = new Set();
  api.runtime.onConnect?.addListener(port => {
    if (port.name !== "kalshi-alert-panel" || port.sender?.id !== api.runtime.id || !port.sender?.url?.startsWith(api.runtime.getURL(""))) return;
    const panel = { port, windowId: null, pending: new Map() }; panels.add(panel);
    port.onMessage.addListener(message => {
      if (message.type === "ready") panel.windowId = message.windowId;
      if (message.type === "ack") panel.pending.get(message.id)?.(message.shown === true, message.uncertain === true);
    });
    port.onDisconnect.addListener(() => { panels.delete(panel); for (const finish of panel.pending.values()) finish(false, true); });
  });
  const ask = (panel, event) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => { panel.pending.delete(event.id); reject(new Error("Presentation acknowledgement pending; retry retained event.")); }, 1800);
    panel.pending.set(event.id, (shown, uncertain) => { clearTimeout(timer); panel.pending.delete(event.id); if(uncertain)reject(new Error("Panel presentation not acknowledged; retain event for retry."));else resolve(shown); });
    try { panel.port.postMessage({ type: "alert", event, expiresAt: Date.now() + 1400 }); }
    catch { clearTimeout(timer); panel.pending.delete(event.id); resolve(false); }
  });
  return {
    getAll: () => api.notifications.getAll(),
    async create(id, options, { count = 1 } = {}) {
      const doc = await read(); const alert = doc.data.alerts.find(row => row.id === id);
      if (!alert || alert.delivery !== "pending" || !doc.monitor?.enabled || doc.monitor.id !== alert.monitorId) throw new Error("Alert is no longer active.");
      const event = publicAlert(alert, doc.generation); const key = presentationKey(doc.generation, id);
      const saved = await api.storage?.session?.get(key);
      if (saved?.[key]) return saved[key];
      const window = await api.windows?.getLastFocused();
      if (window?.focused && window.type === "normal") {
        const panel = [...panels].find(item => item.windowId === window.id);
        if (panel && await ask(panel, event)) return { channel: "panel" };
        if (!pendingAlertForDocument(await read(), event)) throw new Error("Alert expired.");
        const [tab] = await api.tabs.query({ active: true, windowId: window.id });
        const allowed = (await settings()).notificationSites || [];
        let origin; try { origin = websiteOrigin(tab?.url); } catch {}
        if (origin && allowed.includes(origin) && await api.permissions.contains({ origins: [`${new URL(origin).protocol}//${new URL(origin).hostname}/*`] })) {
          try {
            const latest = await read();
            if (!pendingAlertForDocument(latest, event)) throw new Error("Alert expired.");
            const result = await api.scripting.executeScript({ target: { tabId: tab.id }, world: "ISOLATED", func: showWebsiteAlert, args: [event, Date.now() + 1400] });
            if (result?.[0]?.result === true) return { channel: "website" };
          } catch { throw new Error("Website presentation not acknowledged; retain event for retry."); }
        }
      }
      const latest = await read();
      if (!pendingAlertForDocument(latest, event)) throw new Error("Alert expired.");
      const acknowledged = await api.storage?.session?.get(key);
      if (acknowledged?.[key]) return acknowledged[key];
      if (!pendingAlertForDocument(await read(), event)) throw new Error("Alert expired.");
      // The alert window is on and Windows notifications are off unless the person changed them; the Alerts tab keeps every alert.
      const current = await settings();
      let windowShown = false;
      if (current.alertWindow !== false) { try { await openAlertWindow(api, { count }); windowShown = true; } catch (error) { console.warn("Could not open the alert window", error); } }
      if (current.alertSound !== false && (windowShown || current.desktopNotifications !== false)) { try { await playAlertSound(api); } catch (error) { console.warn("Could not play the alert sound", error); } }
      if (current.desktopNotifications === false) return { channel: windowShown ? "window" : "muted" };
      await api.notifications.create(id, options);
      return { channel: "os" };
    }
  };
}

// Deletes chosen alerts, or all of them when ids is null. Markets still matching are not alerted again.
export async function deleteAlerts(ids, generation) {
  const remove = ids ? new Set(ids) : null;
  return updateScannerDocument(doc => {
    if (doc.generation !== generation) throw new Error("Scanner data was restored. Reload before changing alert history.");
    doc.data.alerts = remove ? (doc.data.alerts || []).filter(alert => !remove.has(alert.id)) : [];
    return doc;
  });
}

export async function markAlertRead(id, generation) {
  return updateScannerDocument(doc => {
    if (doc.generation !== generation) throw new Error("Scanner data was restored. Reload before changing alert history.");
    const alert = doc.data.alerts.find(row => row.id === id);
    if (alert) alert.readAt = new Date().toISOString();
    return doc;
  });
}
