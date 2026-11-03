import { readScannerDocument, updateScannerDocument } from "./scanner-store.js";
export const BROKER_WATCHLIST_MAX_SYMBOLS = 30;
const BROKER_SCANNER_HISTORY_LIMIT = 10;

async function getValue(key) { return (await readScannerDocument()).data[key]; }
function requireGeneration(options) {
  if (!options?.expectedGeneration) throw new Error("Reload scanner data before saving: expected data generation is required.");
  return options;
}
async function setValue(key, value, options) {
  await updateScannerDocument((doc) => { doc.data[key] = value; return doc; }, requireGeneration(options));
}

export async function getBrokerData() {
  const doc = await readScannerDocument();
  return { generation: doc.generation, presets: doc.data.presets,
    monitor: doc.monitor || null, alerts: doc.data.alerts || [],
    watchlist: normalizeWatchlistEntries(doc.data.watchlist),
    scannerState: doc.data.scannerState ? { ...doc.data.scannerState, loopHistory: doc.data.loopHistory } : { loopHistory: doc.data.loopHistory }
  };
}

export async function getConditionPresets() {
  const presets = await getValue("presets");
  return Array.isArray(presets) ? presets : [];
}

export async function saveConditionPresets(presets, options) {
  if (!Array.isArray(presets)) throw new Error("Condition presets must be an array.");
  const next = presets;
  await setValue("presets", next, options);
  return next;
}

export async function getWatchlist() {
  const entries = await getValue("watchlist");
  return normalizeWatchlistEntries(entries);
}

export async function saveWatchlist(entries, options) {
  const next = normalizeWatchlistEntries(entries);
  await setValue("watchlist", next, options);
  return next;
}

function normalizeWatchlistEntries(entries) {
  const input = Array.isArray(entries) ? entries : [];
  const seen = new Set();
  const normalized = [];
  input.forEach((entry) => {
    const row = normalizeWatchlistEntry(entry);
    if (!row || seen.has(row.marketTicker)) return;
    seen.add(row.marketTicker);
    normalized.push(row);
  });
  return normalized;
}

function normalizeWatchlistEntry(entry) {
  const source = entry && typeof entry === "object" ? entry : { marketTicker: entry };
  const marketTicker = normalizeMarketTicker(source.marketTicker || source.symbol || source.ticker || "");
  if (!marketTicker) return null;
  return {
    marketTicker,
    symbol: marketTicker,
    eventTicker: String(source.eventTicker || source.event_ticker || ""),
    seriesTicker: String(source.seriesTicker || source.series_ticker || ""),
    eventTitle: String(source.eventTitle || source.event_title || ""),
    marketTitle: String(source.marketTitle || source.title || source.market_title || marketTicker),
    status: String(source.status || ""),
    closeTime: String(source.closeTime || source.close_time || ""),
    result: String(source.result || ""),
    canCloseEarly: source.canCloseEarly === true,
    relatedMarketCount: source.relatedMarketCount,
    savedAt: String(source.savedAt || new Date().toISOString())
  };
}

function normalizeMarketTicker(value = "") {
  return String(value || "").trim().toUpperCase().replace(/\//g, ".").replace(/[^A-Z0-9.-]/g, "");
}

export async function getScannerLabState() {
  return (await getBrokerData()).scannerState;
}

export async function saveScannerLabState() {
  // Fail closed for old callers: only the common executor may replace successful results.
  throw new Error("Scanner result snapshots can only be saved by the common executor. Reload this page.");
}

export async function appendScannerLoopHistoryEntry(entry, options) {
  if (!entry?.id || typeof entry.id !== "string") throw new Error("Scanner history entry needs an id.");
  const next = Object.fromEntries(["id", "cycle", "mode", "status", "observedAt", "scannedSymbols", "resolvedSymbols", "matches", "newMatches", "message"]
    .filter((key) => entry[key] !== undefined).map((key) => [key, entry[key]]));
  const doc = await updateScannerDocument((current) => {
    current.data.loopHistory = [next, ...current.data.loopHistory.filter((row) => row.id !== next.id)].slice(0, BROKER_SCANNER_HISTORY_LIMIT);
    return current;
  }, requireGeneration(options));
  return doc.data.loopHistory;
}
