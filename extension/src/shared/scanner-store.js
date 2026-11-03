// IndexedDB transactions serialize writers across extension pages and workers.
export const SCANNER_SCHEMA_VERSION = 1;
const DATABASE = "kalshiEightyPlus.scanner";
const STORE = "documents";
const LEGACY_KEYS = {
  presets: "kalshiEightyPlus.conditionPresets",
  watchlist: "kalshiEightyPlus.watchlist",
  scannerState: "kalshiEightyPlus.scannerLabState"
};
let opening;

function openDatabase() {
  if (!globalThis.indexedDB) throw new Error("Persistent scanner storage is unavailable.");
  if (!opening) opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Close other extension pages to upgrade scanner storage."));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); opening = null; };
      resolve(db);
    };
  }).catch((error) => { opening = null; throw error; });
  return opening;
}

// The updater is synchronous: awaiting non-IDB work inside a transaction closes it.
async function transaction(key, updater) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, updater ? "readwrite" : "readonly");
    const store = tx.objectStore(STORE);
    let result;
    let failure;
    tx.oncomplete = () => resolve(result);
    tx.onabort = () => reject(failure || tx.error || new Error("Scanner transaction aborted."));
    tx.onerror = () => {};
    const request = store.get(key);
    request.onsuccess = () => {
      try {
        result = updater ? updater(request.result) : request.result;
        if (updater) store.put(result, key);
      } catch (error) { failure = error; tx.abort(); }
    };
  });
}

async function legacyData() {
  let values;
  if (globalThis.chrome?.storage?.local) values = await chrome.storage.local.get(Object.values(LEGACY_KEYS));
  else if (globalThis.localStorage) {
    values = {};
    for (const key of Object.values(LEGACY_KEYS)) {
      const raw = localStorage.getItem(key);
      if (raw !== null) values[key] = JSON.parse(raw);
    }
  } else values = {};
  const legacy = Object.fromEntries(Object.entries(LEGACY_KEYS).map(([name, key]) => [name, values[key] ?? (name === "scannerState" ? null : [])]));
  validateData(legacy);
  return legacy;
}

export function validateData(data) {
  if (!data || !Array.isArray(data.presets) || !Array.isArray(data.watchlist)
    || (data.scannerState !== null && (!data.scannerState || typeof data.scannerState !== "object" || Array.isArray(data.scannerState)))) {
    throw new Error("Invalid scanner data. Existing data has been preserved.");
  }
  if (data.presets.some((row) => !row || typeof row !== "object" || Array.isArray(row))) throw new Error("Invalid condition preset.");
  if (data.watchlist.some((row) => typeof row !== "string" && (!row || typeof row !== "object" || Array.isArray(row)))) throw new Error("Invalid watchlist entry.");
  if (data.loopHistory !== undefined && !Array.isArray(data.loopHistory)) throw new Error("Invalid scanner loop history.");
  if (data.loopHistory?.some((row) => !row || typeof row !== "object" || Array.isArray(row))) throw new Error("Invalid scanner loop history entry.");
  if (data.alerts !== undefined && (!Array.isArray(data.alerts) || data.alerts.some((row) => !row || typeof row !== "object" || Array.isArray(row)))) throw new Error("Invalid scanner alerts.");
  if (data.scannerState) {
    for (const field of ["results", "loopHistory"]) {
      if (data.scannerState[field] !== undefined && !Array.isArray(data.scannerState[field])) throw new Error(`Invalid scanner ${field}.`);
    }
    if (data.scannerState.results?.some((row) => !row || typeof row !== "object" || Array.isArray(row))) throw new Error("Invalid scanner result entry.");
  }
  return data;
}

function assertDocument(doc) {
  if (doc?.schemaVersion !== SCANNER_SCHEMA_VERSION) throw new Error("Unsupported scanner data version. Existing data has been preserved.");
  validateData(doc.data);
  return doc;
}

export async function readScannerDocument() {
  const existing = await transaction("current");
  if (existing) {
    assertDocument(existing);
    if (existing.generation && Array.isArray(existing.data.loopHistory)) return existing;
    // Upgrade existing phase-2 documents once, preserving successful snapshots.
    return transaction("current", (doc) => {
      assertDocument(doc);
      if (!doc.generation) doc.generation = crypto.randomUUID();
      if (!Array.isArray(doc.data.loopHistory)) doc.data.loopHistory = structuredClone(doc.data.scannerState?.loopHistory || []);
      return doc;
    });
  }
  const legacy = await legacyData();
  // If another context migrates first, its committed data wins. Legacy keys stay intact.
  return transaction("current", (current) => current ? assertDocument(current) : ({
    schemaVersion: SCANNER_SCHEMA_VERSION, revision: 1, generation: crypto.randomUUID(),
    updatedAt: new Date().toISOString(), data: { ...legacy, loopHistory: structuredClone(legacy.scannerState?.loopHistory || []) },
    migrationBackup: structuredClone(legacy), recoveryBackup: null, execution: null
  }));
}

export async function updateScannerDocument(updater, { expectedRevision, expectedGeneration } = {}) {
  await readScannerDocument();
  return transaction("current", (current) => {
    assertDocument(current);
    if (expectedRevision !== undefined && current.revision !== expectedRevision) throw new Error("Scanner data changed in another page. Reload before importing.");
    if (expectedGeneration !== undefined && current.generation !== expectedGeneration) {
      const error = new Error("Scanner data was restored in another page. Reload this page before saving or running.");
      error.name = "StaleScannerPageError";
      throw error;
    }
    const next = updater(structuredClone(current));
    assertDocument(next);
    next.revision = current.revision + 1;
    next.updatedAt = new Date().toISOString();
    return next;
  });
}

export async function replaceScannerData(data, options = {}) {
  validateData(data);
  return updateScannerDocument((doc) => {
    if (doc.execution?.status === "running" && doc.execution.leaseUntil > Date.now()) throw new Error("Stop the scanner before restoring data.");
    doc.recoveryBackup = structuredClone(doc.data);
    doc.data = structuredClone(data);
    doc.data.loopHistory ??= structuredClone(data.scannerState?.loopHistory || []);
    // Never accept a generation from a backup. Every replacement retires all UI writers.
    doc.generation = crypto.randomUUID();
    // Retiring the owner fences off late results, including those after lease expiry.
    doc.execution = null;
    // Restored backups do not implicitly re-enable background work.
    doc.monitor = null;
    return doc;
  }, options);
}

export async function recoverScannerData() {
  const doc = await readScannerDocument();
  const backup = doc.recoveryBackup || doc.migrationBackup;
  if (!backup) throw new Error("No recovery snapshot is available.");
  return replaceScannerData(backup, { expectedRevision: doc.revision });
}
