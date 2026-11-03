// The larger alert window: the newest matches of the running monitor, with room for an ad slot.
import { readScannerDocument } from "./shared/scanner-store.js";
import { getSettings } from "./shared/storage.js";
import { alertWindowBackground } from "./shared/alert-window.js";
import { escapeHtml, formatDate } from "./shared/format.js";

const params = new URLSearchParams(location.search);
const test = params.get("test") === "1";
const count = Math.max(1, Number(params.get("count")) || 1);
// Kalshi titles sometimes carry markdown bold markers ("**gas prices**").
const plain = (value) => String(value || "").replaceAll("**", "");
const cents = (value) => Number.isFinite(Number(value)) && value !== null ? `${Math.round(Number(value) * 100)}c` : "-";

function marketCard(alert) {
  const result = alert.result || {};
  return `<article class="alert-window-market">
    <strong>${escapeHtml(plain(alert.title || alert.symbol))}</strong>
    <p>${escapeHtml(alert.symbol || "")}${result.closeTime ? ` · closes ${escapeHtml(formatDate(result.closeTime))}` : ""}</p>
    <p>YES bid ${cents(result.yesBid)} · ask ${cents(result.yesAsk)} · last ${cents(result.last)}</p>
  </article>`;
}

async function render() {
  const settings = await getSettings().catch(() => ({}));
  document.body.dataset.alertBg = alertWindowBackground(settings.alertWindowBackground);
  let heading, condition = "", markets = [];
  if (test) {
    heading = "Test alert";
    condition = "This is how an alert looks when your conditions match. Matches also appear as a Windows notification and in the Alerts tab.";
    markets = [{ title: "Example market (not real data)", symbol: "EXAMPLE", result: { yesBid: 0.62, yesAsk: 0.64, last: 0.63 } }];
  } else {
    const doc = await readScannerDocument();
    const alerts = (doc.data?.alerts || []).filter((alert) => alert.monitorId === doc.monitor?.id);
    markets = alerts.slice(-5).reverse();
    heading = count > 1 ? `${count} markets matched` : "Condition matched";
    condition = markets[0]?.recipeFormula || "";
  }
  // The ad slot sits at the top, above the alert itself.
  document.querySelector("#app").innerHTML = `
    <header class="alert-window-header"><img src="icons/48X48.png" alt="" width="32" height="32" /><div><small>Kalshi Screener</small><h1>${escapeHtml(heading)}</h1></div></header>
    ${condition ? `<p class="alert-window-condition">${escapeHtml(condition)}</p>` : ""}
    <section class="alert-window-list">${markets.map(marketCard).join("")}
    ${count > markets.length && !test ? `<p class="provider-note">Showing the newest ${markets.length}. All matches are in the Alerts tab.</p>` : ""}</section>
    <div class="alert-window-actions"><button id="openAlerts" class="button-primary">Open Alerts</button><button id="closeWindow">Close</button></div>
    <p class="provider-note">Not affiliated with Kalshi. Not financial advice.</p>`;
  document.querySelector("#openAlerts").addEventListener("click", async () => {
    await chrome.tabs.create({ url: chrome.runtime.getURL("side_panel.html#alerts") });
    window.close();
  });
  document.querySelector("#closeWindow").addEventListener("click", () => window.close());
}

render().catch((error) => { document.querySelector("#app").textContent = `Could not show the alert: ${error.message}`; });
