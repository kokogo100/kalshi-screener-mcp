import { readScannerDocument, updateScannerDocument } from "../shared/scanner-store.js";
import { runScannerLabObservation } from "./scanner-runner.js";

const LEASE_MS = 30000;
const ACTIVE = "running";
function abortError(message = "Scanner observation stopped.") {
  return new DOMException(message, "AbortError");
}

export async function cancelScannerExecution(runId = null, options = {}) {
  return updateScannerDocument((doc) => {
    if (doc.execution?.status === ACTIVE && (!runId || doc.execution.runId === runId)) {
      doc.execution.status = "cancelled";
      doc.execution.finishedAt = new Date().toISOString();
      doc.execution.leaseUntil = 0;
    }
    return doc;
  }, options);
}

// Runtime credentials and fetched market data are never stored in execution records.
export async function executeScannerObservation(options = {}, {
  runner = runScannerLabObservation, leaseMs = LEASE_MS, heartbeatMs = 5000, cancelPollMs = 1000, commitResult = null
} = {}) {
  if (options.signal?.aborted) throw abortError();
  const runId = crypto.randomUUID();
  const controller = new AbortController();
  const runtimeSettings = structuredClone(options.settings || {});
  const snapshot = structuredClone({
    rows: options.rows || [], conditions: options.conditions || [],
    formula: options.formula || "", formulaTokens: options.formulaTokens || [],
    directionFilter: options.directionFilter || "all",
    symbols: options.symbols || [], watchlist: options.watchlist || []
  });
  await updateScannerDocument((doc) => {
    if (options.monitorId && (!doc.monitor?.enabled || doc.monitor.id !== options.monitorId)) throw abortError("Monitor was stopped or replaced.");
    if (doc.execution?.status === ACTIVE && doc.execution.leaseUntil > Date.now()) {
      const error = new Error("A scanner observation is already running. Stop it or wait for completion.");
      error.name = "ScannerBusyError";
      throw error;
    }
    doc.execution = {
      monitorId: options.monitorId || null,
      runId, status: ACTIVE, startedAt: new Date().toISOString(),
      leaseUntil: Date.now() + leaseMs, recipe: snapshot,
      checkpoint: { phase: "starting", observedAt: new Date().toISOString() },
      interruptedRunId: doc.execution?.status === ACTIVE ? doc.execution.runId : null
    };
    return doc;
  }, { expectedGeneration: options.expectedGeneration });
  let storageError;
  let pending = Promise.resolve();
  let finished = false;
  const owned = (doc) => doc.execution?.runId === runId && doc.execution.status === ACTIVE;
  function enqueue(operation) {
    pending = pending.then(operation).catch((error) => {
      storageError ||= error;
      controller.abort();
    });
    return pending;
  }
  const cancel = () => {
    controller.abort();
    enqueue(() => cancelScannerExecution(runId));
  };
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const heartbeat = setInterval(() => enqueue(() => updateScannerDocument((doc) => {
    if (!owned(doc)) { controller.abort(); return doc; }
    doc.execution.leaseUntil = Date.now() + leaseMs;
    return doc;
  })), heartbeatMs);
  const poll = setInterval(() => enqueue(async () => {
    if (!owned(await readScannerDocument())) controller.abort();
  }), cancelPollMs);
  try {
    const result = await runner({ ...options, ...snapshot, settings: runtimeSettings, signal: controller.signal,
      onProgress: (progress) => {
        if (controller.signal.aborted || finished) return;
        // Progress is a recoverable phase marker, not cached data for resuming stale quotes.
        const checkpoint = Object.fromEntries(["phase", "current", "total", "timeframe", "symbol", "message", "observedAt"]
          .filter((key) => progress[key] !== undefined).map((key) => [key, progress[key]]));
        enqueue(() => updateScannerDocument((doc) => {
          if (!owned(doc)) { controller.abort(); return doc; }
          doc.execution.checkpoint = checkpoint;
          doc.execution.leaseUntil = Date.now() + leaseMs;
          return doc;
        }));
        options.onProgress?.(progress);
      }
    });
    finished = true;
    await pending;
    if (storageError) throw storageError;
    if (controller.signal.aborted) throw abortError();
    if (options.isCurrent && !options.isCurrent()) throw abortError("Scanner recipe changed. Run the new recipe again.");
    let committed = false;
    await updateScannerDocument((doc) => {
      if (!owned(doc) || controller.signal.aborted || (options.isCurrent && !options.isCurrent())) return doc;
      if (commitResult && commitResult(doc, result, { snapshot, runId }) === false) return doc;
      doc.execution.status = "completed";
      doc.execution.finishedAt = new Date().toISOString();
      doc.execution.leaseUntil = 0;
      doc.execution.summary = { status: result.status, matched: result.results?.length || 0 };
      if (!commitResult) doc.data.scannerState = {
        version: 2, savedAt: result.observedAt || new Date().toISOString(),
        resultsStatus: result.status === "partial" ? "partial" : result.results?.length ? "live" : "empty",
        resultsMessage: result.message || "Observation completed.", results: result.results || [],
        incompleteCount: result.incompleteCount || 0, incompleteSymbols: result.incompleteSymbols || [],
        resolvedSymbols: result.resolvedSymbols, scannedSymbols: result.scannedSymbols,
        recipe: { conditionRows: snapshot.rows.length ? snapshot.rows : snapshot.conditions,
          formulaText: snapshot.formula, directionFilter: snapshot.directionFilter },
        runId
      };
      committed = true;
      return doc;
    });
    if (!committed) throw abortError("Previous scanner execution was superseded or cancelled.");
    return { ...result, runId };
  } catch (error) {
    finished = true;
    await pending;
    await updateScannerDocument((doc) => {
      if (!owned(doc)) return doc;
      doc.execution.status = (controller.signal.aborted || error?.name === "AbortError") && !storageError ? "cancelled" : "failed";
      doc.execution.finishedAt = new Date().toISOString();
      doc.execution.leaseUntil = 0;
      // Error text can include authentication details; persist a generic marker only.
      doc.execution.error = storageError ? "storage_failed" : "observation_failed";
      return doc;
    });
    throw storageError || error;
  } finally {
    finished = true;
    clearInterval(heartbeat);
    clearInterval(poll);
    options.signal?.removeEventListener("abort", cancel);
  }
}
