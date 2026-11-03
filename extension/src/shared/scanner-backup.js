import { readScannerDocument, replaceScannerData, validateData } from "./scanner-store.js";

const FORMAT = "kalshi-scanner-backup";
const SENSITIVE = /api.?key|private.?key|password|credential|secret|authorization|access.?token|refresh.?token/i;
function portable(value) {
  if (Array.isArray(value)) return value.map(portable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !SENSITIVE.test(key) && !["settings", "__proto__", "constructor", "prototype"].includes(key))
    .map(([key, entry]) => [key, portable(entry)]));
}

export async function exportScannerBackup() {
  const doc = await readScannerDocument();
  // Explicitly exclude settings, execution records and recovery copies.
  return JSON.stringify({ format: FORMAT, version: 1, exportedAt: new Date().toISOString(),
    data: portable(doc.data) }, null, 2);
}

export function inspectScannerBackup(text) {
  if (typeof text !== "string" || text.length > 50 * 1024 * 1024) throw new Error("Backup must be a JSON file smaller than 50 MB.");
  const value = JSON.parse(text);
  if (value?.format !== FORMAT || value.version !== 1) throw new Error("Unsupported scanner backup format or version.");
  // Only the supported data fields can be imported. Credentials are never restored.
  const data = portable({ presets: value.data?.presets, watchlist: value.data?.watchlist, scannerState: value.data?.scannerState,
    loopHistory: value.data?.loopHistory ?? value.data?.scannerState?.loopHistory ?? [], alerts: value.data?.alerts ?? [] });
  validateData(data);
  return { data, presets: data.presets.length, watchlist: data.watchlist.length,
    results: data.scannerState?.results?.length || 0, alerts: data.alerts.length };
}

export async function importScannerBackup(text, options = {}) {
  const inspected = inspectScannerBackup(text);
  await replaceScannerData(inspected.data, options);
  return inspected;
}
