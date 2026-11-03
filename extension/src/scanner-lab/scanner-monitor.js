import { readScannerDocument, updateScannerDocument } from "../shared/scanner-store.js";
import { getMarketMetadataPage } from "../shared/kalshi-adapter.js";
import { getSettings } from "../shared/storage.js";
import { prepareScannerObservation, runScannerLabObservation, createScannerAdapterForScope } from "./scanner-runner.js";
import { executeScannerObservation } from "./scanner-execution.js";
import { conditionLabel } from "../shared/condition-builder.js";
import { marketScopeById } from "../shared/market-scopes.js";

export const MONITOR_ALARM = "kalshi.scanner.monitor";
const MINUTE = 60000;
const LEASE = 45000;
const BACKOFF_MAX = 15 * MINUTE;
const SUMMARY_AFTER = 3;
// The whole scanner document is rewritten on every step, so alert history must stay bounded.
export const ALERT_HISTORY_LIMIT = 100;
const RESULT_LIMIT = 1000;
const unique = (values) => [...new Set(values.filter(Boolean).map((value) => String(value).trim().toUpperCase()))];
const active = (doc, id) => doc.monitor?.enabled && doc.monitor.id === id;
// Alerts and notifications show the conditions in words; a bare "A" told people nothing.
function recipeSummary({ conditionInstances, tokens, scopeId }, rows = []) {
  const scope = marketScopeById(scopeId).label;
  const labels = rows.length === conditionInstances.length
    ? rows.map((row) => {
      const clause = row.scannerClauses?.[0];
      const value = row.operator === "between" && clause?.valueMax !== undefined ? `${clause.value}~${clause.valueMax}` : row.value;
      return conditionLabel({ ...row, value }).replace(`${marketScopeById(row.marketScope).label} / `, "");
    })
    : conditionInstances.map((condition) => condition.label);
  const formula = tokens.map((token) => token.type === "condition" ? token.letter : token.type === "not" ? "not" : token.value).join(" ").replace(/\( /g, "(").replace(/ \)/g, ")");
  if (labels.length === 1 && !/not/.test(formula)) return `${scope}: ${labels[0]}`;
  return `${scope}: ${formula}; ${labels.map((label, index) => `${String.fromCharCode(65 + index)}. ${label}`).join("; ")}`;
}

export async function startScannerMonitor(recipe, { expectedGeneration, rescanMinutes = 15 } = {}) {
  if (!expectedGeneration) throw new Error("Reload scanner data before starting monitoring.");
  const input = structuredClone({ rows: recipe.rows || [], conditions: recipe.conditions || [], formula: recipe.formula || "",
    formulaTokens: recipe.formulaTokens || [], directionFilter: recipe.directionFilter || "all", watchlist: recipe.watchlist || [] });
  const prepared = prepareScannerObservation(input);
  const adapter = createScannerAdapterForScope(prepared.scopeId);
  for (const requirement of prepared.requirements) {
    if (!adapter.supportedRequirements.includes(requirement)) throw new Error(`Monitoring cannot supply ${requirement} for this scope.`);
  }
  if (!Number.isFinite(rescanMinutes) || rescanMinutes < 1 || rescanMinutes > 1440) throw new Error("Full rescan interval must be between 1 and 1440 minutes.");
  // Ticker-only recipes fetch 100 markets per request; 500 per batch keeps whole-document rewrites to a few hundred per full scan.
  const batchSize = [...prepared.requirements].some((value) => !["instrument", "ticker"].includes(value)) ? 1 : 500;
  const doc = await updateScannerDocument((current) => {
    if (current.execution?.status === "running" && current.execution.leaseUntil > Date.now()) throw new Error("Stop the current observation before starting monitoring.");
    if (current.monitor?.enabled) throw new Error("Stop the current monitor before applying a different recipe.");
    current.data.alerts ??= [];
    current.monitor = { id: crypto.randomUUID(), enabled: true, recipe: input, summary: recipeSummary(prepared, input.rows), scopeId: prepared.scopeId, batchSize,
      rescanMinutes, pollMinutes: 1, nextFullAt: Date.now(), nextPollAt: Date.now(), nextAttemptAt: Date.now(),
      status: "scheduled", lastCheckedAt: null, lastError: null, lastIncompleteCount: 0, failures: 0, states: {}, job: null, claim: null, cycleCount: 0 };
    return current;
  }, { expectedGeneration });
  return doc.monitor;
}

export async function stopScannerMonitor({ expectedGeneration } = {}) {
  if (!expectedGeneration) throw new Error("Reload scanner data before stopping monitoring.");
  return updateScannerDocument((doc) => {
    const id = doc.monitor?.id;
    if (doc.monitor) { doc.monitor.enabled = false; doc.monitor.status = "stopped"; doc.monitor.claim = null; doc.monitor.job = null; }
    if (doc.execution?.monitorId === id && doc.execution.status === "running") {
      doc.execution.status = "cancelled"; doc.execution.leaseUntil = 0;
    }
    for (const alert of doc.data.alerts || []) if (alert.monitorId === id && alert.delivery === "pending") alert.delivery = "cancelled";
    return doc;
  }, { expectedGeneration });
}

export async function updateScannerMonitorInterval({ expectedGeneration, rescanMinutes } = {}) {
  if (!expectedGeneration || !Number.isFinite(rescanMinutes) || rescanMinutes < 1 || rescanMinutes > 1440) throw new Error("Invalid monitor interval or data generation.");
  return updateScannerDocument((doc) => {
    if (doc.monitor?.enabled) { doc.monitor.rescanMinutes = rescanMinutes; doc.monitor.nextFullAt = Date.now() + rescanMinutes * MINUTE; }
    return doc;
  }, { expectedGeneration });
}

export async function ensureMonitorAlarm(alarms) {
  const { monitor } = await readScannerDocument();
  const alarm = await alarms.get(MONITOR_ALARM);
  if (monitor?.enabled && !alarm) await alarms.create(MONITOR_ALARM, { periodInMinutes: 0.5 });
  if (!monitor?.enabled && alarm) await alarms.clear(MONITOR_ALARM);
}

function cycleJob(monitor, now) {
  const full = now >= monitor.nextFullAt;
  const symbols = full ? (["watchlist", "saved_symbols"].includes(monitor.scopeId) ? unique(monitor.recipe.watchlist) : []) : Object.keys(monitor.states);
  return { id: crypto.randomUUID(), kind: full ? "full" : "poll", startedAt: now,
    phase: full && !["watchlist", "saved_symbols"].includes(monitor.scopeId) ? "discover" : "evaluate",
    cursor: "", seenCursors: [], symbols, offset: 0, results: [], incompleteSymbols: [], failedBatches: 0, successfulBatches: 0, batchFailures: 0 };
}

function finishCycle(doc, monitor, now, runId) {
  const job = monitor.job;
  const observedAt = new Date(now).toISOString();
  // A returned request is not necessarily a usable observation. Derive counts from
  // the durable symbols so jobs created before this change resume safely too.
  const unknown = new Set(unique(job.incompleteSymbols));
  const incompleteSymbols = unique(job.symbols).filter((symbol) => unknown.has(symbol));
  const knownCount = unique(job.symbols).length - incompleteSymbols.length;
  const allUnknown = job.symbols.length > 0 && knownCount === 0;
  const matches = job.matchCount ?? job.results.length;
  const shownNote = matches > job.results.length ? ` Results show the first ${job.results.length}.` : "";
  if (job.kind === "full" && !allUnknown) {
    doc.data.scannerState = { version: 2, runId, savedAt: observedAt, resultsStatus: incompleteSymbols.length ? "partial" : matches ? "live" : "empty",
      resultsMessage: `Background full scan: ${matches} matches from ${job.symbols.length} contracts. ${incompleteSymbols.length} unknown.${shownNote}`,
      results: job.results, recipe: { conditionRows: monitor.recipe.rows.length ? monitor.recipe.rows : monitor.recipe.conditions,
        formulaText: monitor.recipe.formula, directionFilter: monitor.recipe.directionFilter },
      incompleteCount: incompleteSymbols.length, incompleteSymbols, resolvedSymbols: job.symbols.length, scannedSymbols: job.symbols.length };
  }
  if (job.kind === "full") monitor.nextFullAt = now + monitor.rescanMinutes * MINUTE;
  doc.data.loopHistory = [{ id: job.id, mode: job.kind === "full" ? "Background Full Rescan" : "Background Monitor",
    status: allUnknown ? "unknown" : incompleteSymbols.length ? "partial" : "live", observedAt, matches,
    knownCount, incompleteCount: incompleteSymbols.length, scannedSymbols: job.symbols.length,
    message: `${knownCount} known; ${incompleteSymbols.length} unknown; ${allUnknown ? "previous successful results kept; " : ""}background polling.` }, ...doc.data.loopHistory].slice(0, 10);
  monitor.nextPollAt = now + monitor.pollMinutes * MINUTE;
  monitor.nextAttemptAt = Math.min(monitor.nextFullAt, Object.keys(monitor.states).length ? monitor.nextPollAt : Infinity);
  monitor.lastCheckedAt = observedAt; monitor.lastIncompleteCount = incompleteSymbols.length; monitor.lastKnownCount = knownCount;
  monitor.status = allUnknown ? "unknown" : monitor.lastIncompleteCount ? "partial" : "waiting"; monitor.cycleCount += 1; monitor.job = null;
}

// What "View matching result" shows; the full result row was ~7 KB per alert.
const ALERT_RESULT_KEYS = ["symbol", "marketTicker", "marketTitle", "eventTitle", "observedAt", "last", "yesBid", "yesAsk", "noBid", "noAsk", "volume24h", "openInterest", "liquidity", "status", "closeTime"];
function alertResult(row = {}) {
  const slim = Object.fromEntries(ALERT_RESULT_KEYS.filter((key) => row[key] != null).map((key) => [key, row[key]]));
  slim.conditionResults = (row.conditionResults || []).map((result) => ({ state: result.state ?? (result.matched ? true : false),
    clauseResults: (result.clauseResults || []).map((clause) => ({ metric: clause.metric || clause.clause?.metric, value: Number.isFinite(clause.value) ? clause.value : null,
      available: clause.available, matched: clause.matched })) }));
  return slim;
}

function acceptBatch(doc, id, jobId, offset, symbols, result, runId, now) {
  const monitor = doc.monitor;
  if (!active(doc, id) || monitor.job?.id !== jobId || monitor.job.offset !== offset) return false;
  const job = monitor.job;
  const unknown = new Set(result.incompleteSymbols || []);
  const matches = new Map((result.results || []).map((row) => [row.marketTicker || row.symbol, row]));
  doc.data.alerts ??= [];
  for (const symbol of symbols) {
    if (unknown.has(symbol)) continue; // Missing data never releases duplicate suppression.
    const previous = monitor.states[symbol];
    const match = matches.has(symbol);
    if (match && previous?.match !== true) {
      const occurrence = (previous?.occurrence || 0) + 1;
      monitor.states[symbol] = { match: true, occurrence, observedAt: new Date(now).toISOString() };
      const row = matches.get(symbol);
      doc.data.alerts.push({ id: `${id}:${symbol}:${occurrence}`, monitorId: id, symbol,
        title: row.marketTitle || symbol, createdAt: row.observedAt || new Date(now).toISOString(),
        recipeFormula: monitor.summary || monitor.recipe.formula, result: alertResult(row), delivery: "pending", attempts: 0, nextAttemptAt: now });
    } else if (previous) monitor.states[symbol] = { ...previous, match, observedAt: new Date(now).toISOString() };
  }
  if (doc.data.alerts.length > ALERT_HISTORY_LIMIT) {
    const dropped = doc.data.alerts.slice(0, -ALERT_HISTORY_LIMIT);
    // Matches cut before they were shown still count in the next grouped notification.
    monitor.unshownMatches = (monitor.unshownMatches || 0) + dropped.filter((alert) => alert.delivery === "pending" && alert.monitorId === id).length;
    doc.data.alerts = doc.data.alerts.slice(-ALERT_HISTORY_LIMIT);
  }
  // Every batch rewrites the whole document; a broad recipe over all open markets once held
  // tens of thousands of full result rows here. Keep the first rows for Results and count the rest.
  job.matchCount = (job.matchCount ?? job.results.length) + (result.results || []).length;
  job.results.push(...(result.results || []).slice(0, Math.max(0, RESULT_LIMIT - job.results.length)));
  job.successfulBatches += 1; job.batchFailures = 0;
  job.incompleteSymbols.push(...unknown);
  job.offset += symbols.length;
  monitor.lastCheckedAt = new Date(now).toISOString(); monitor.failures = 0; monitor.lastError = null;
  monitor.nextAttemptAt = now;
  if (job.offset >= job.symbols.length) finishCycle(doc, monitor, now, runId);
  return true;
}

// Each task is bounded and durable. After a crash, only the uncommitted page/batch is retried.
export async function runMonitorTick({ pageReader = getMarketMetadataPage, runner = runScannerLabObservation,
  adapterFactory = createScannerAdapterForScope, settingsReader = getSettings, now = () => Date.now(), taskBudgetMs = 20000, fetchTimeoutMs = 24000 } = {}) {
  const claim = crypto.randomUUID();
  let claimed = false;
  const acquired = await updateScannerDocument((doc) => {
    const monitor = doc.monitor;
    if (!monitor?.enabled || monitor.nextAttemptAt > now() || monitor.claim?.until > now()) return doc;
    if (doc.execution?.status === "running" && doc.execution.leaseUntil > now()) return doc;
    monitor.claim = { id: claim, until: now() + LEASE };
    monitor.job ||= cycleJob(monitor, now());
    monitor.status = monitor.job.phase === "discover" ? "discovering" : "scanning";
    claimed = true;
    return doc;
  });
  if (!claimed) return;
  const id = acquired.monitor.id;
  const generation = acquired.generation;
  const deadline = Date.now() + taskBudgetMs;
  let failedBatch = null;
  try {
    const settings = (await settingsReader()).KALSHI || {};
    do {
      const current = await readScannerDocument();
      if (!active(current, id) || current.monitor.claim?.id !== claim) return;
      const monitor = current.monitor;
      const job = monitor.job;
      if (!job) break;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);
      try {
        if (job.phase === "discover") {
          const page = await pageReader(monitor.scopeId, { cursor: job.cursor, settings, signal: controller.signal, now: job.startedAt });
          if (controller.signal.aborted) throw new DOMException("Market page timed out.", "AbortError");
          await updateScannerDocument((doc) => {
            if (!active(doc, id) || doc.monitor.claim?.id !== claim || doc.monitor.job?.id !== job.id) return doc;
            if (page.cursor && doc.monitor.job.seenCursors.includes(page.cursor)) throw new Error("Repeated market cursor; full scan is incomplete.");
            doc.monitor.job.symbols = unique([...doc.monitor.job.symbols, ...page.markets.map((row) => row.symbol || row.marketTicker)]);
            doc.monitor.job.cursor = page.cursor;
            if (page.cursor) doc.monitor.job.seenCursors.push(page.cursor);
            else doc.monitor.job.phase = "evaluate";
            doc.monitor.failures = 0; doc.monitor.lastError = null;
            doc.monitor.claim.until = now() + LEASE;
            return doc;
          }, { expectedGeneration: generation });
        } else {
          const symbols = job.symbols.slice(job.offset, job.offset + monitor.batchSize);
          if (!symbols.length) {
            await updateScannerDocument((doc) => {
              if (active(doc, id) && doc.monitor.job?.id === job.id) finishCycle(doc, doc.monitor, now(), job.id);
              return doc;
            }, { expectedGeneration: generation });
            break;
          }
          failedBatch = { jobId: job.id, offset: job.offset, symbols };
          await executeScannerObservation({ ...monitor.recipe, symbols, settings, monitorId: id, expectedGeneration: generation, signal: controller.signal }, {
            runner: async (options) => {
              const adapter = adapterFactory(monitor.scopeId);
              const scopeExcluded = new Set();
              const originalTicker = adapter.getTicker.bind(adapter);
              const restricted = !["watchlist", "saved_symbols"].includes(monitor.scopeId);
              const scopeUnknown = new Set(restricted ? symbols : []);
              adapter.getTicker = async (...args) => {
                const rows = await originalTicker(...args);
                if (!restricted) return rows;
                return Object.fromEntries(Object.entries(rows).filter(([symbol, row]) => {
                  if (!row.status) return false; // Missing scope metadata is unknown, not an eligible market.
                  const hours = monitor.scopeId === "closing_24h" ? 24 : monitor.scopeId === "closing_7d" ? 168 : null;
                  const close = Date.parse(row.closeTime || "");
                  if (hours !== null && !Number.isFinite(close)) return false;
                  scopeUnknown.delete(symbol);
                  const eligible = ["active", "open"].includes(row.status)
                    && (hours === null || (close >= now() && close <= now() + hours * 3600000))
                    && (monitor.scopeId !== "multivariate_only" || row.isMultivariate === true)
                    && (monitor.scopeId !== "exclude_multivariate" || row.isMultivariate === false);
                  if (!eligible) scopeExcluded.add(symbol);
                  return eligible;
                }));
              };
              const result = await runner({ ...options, adapter });
              return { ...result, results: result.results.filter((row) => !scopeExcluded.has(row.marketTicker || row.symbol) && !scopeUnknown.has(row.marketTicker || row.symbol)),
                incompleteSymbols: unique([...(result.incompleteSymbols || []).filter((symbol) => !scopeExcluded.has(symbol)), ...scopeUnknown]) };
            },
            commitResult: (doc, result, { runId }) => acceptBatch(doc, id, job.id, job.offset, symbols, result, runId, now())
          });
          failedBatch = null;
          await updateScannerDocument((doc) => { if (active(doc, id) && doc.monitor.claim?.id === claim) doc.monitor.claim.until = now() + LEASE; return doc; });
        }
      } finally { clearTimeout(timeout); }
    } while (Date.now() < deadline);
  } catch (error) {
    await updateScannerDocument((doc) => {
      if (!active(doc, id) || doc.monitor.claim?.id !== claim) return doc;
      // Retry the uncommitted work; no negative transition or successful-result overwrite.
      const monitor = doc.monitor;
      if (error?.name !== "ScannerBusyError" && failedBatch && monitor.job?.id === failedBatch.jobId && monitor.job.offset === failedBatch.offset) {
        monitor.job.batchFailures += 1;
        if (monitor.job.batchFailures >= 3) {
          // One permanently broken market must not starve the rest of the universe.
          monitor.job.incompleteSymbols.push(...failedBatch.symbols);
          monitor.job.offset += failedBatch.symbols.length;
          monitor.job.failedBatches += 1; monitor.job.batchFailures = 0;
          if (monitor.job.offset >= monitor.job.symbols.length) finishCycle(doc, monitor, now(), monitor.job.id);
        }
      }
      monitor.failures += 1; monitor.status = "retrying";
      if (monitor.job?.phase === "discover" && monitor.failures >= 3) monitor.job = null;
      monitor.lastError = error?.name === "AbortError" ? "Observation timed out; previous match states kept." : "Observation failed; previous match states kept.";
      monitor.nextAttemptAt = now() + Math.min(BACKOFF_MAX, MINUTE * 2 ** Math.min(monitor.failures - 1, 4));
      return doc;
    });
  } finally {
    await updateScannerDocument((doc) => {
      if (active(doc, id) && doc.monitor.claim?.id === claim) doc.monitor.claim = null;
      return doc;
    });
  }
}

export async function deliverMonitorAlerts(notifications, now = Date.now()) {
  const claim = crypto.randomUUID();
  const claimed = [];
  let summary = false;
  let unshown = 0;
  await updateScannerDocument((doc) => {
    unshown = doc.monitor?.enabled ? doc.monitor.unshownMatches || 0 : 0;
    const due = (alert) => alert.delivery === "pending" && !(alert.nextAttemptAt > now) && !(alert.deliveryLeaseUntil > now);
    // Hundreds of markets can match at once (an hour's games crossing a close-time limit); one
    // summary notification replaces a flood that would otherwise run 20 at a time for an hour.
    summary = unshown > 0 || (doc.data.alerts || []).filter((alert) => due(alert) && active(doc, alert.monitorId)).length > SUMMARY_AFTER;
    for (const alert of doc.data.alerts || []) {
      if (!summary && claimed.length >= 20) break;
      if (!due(alert)) continue;
      if (!active(doc, alert.monitorId)) { alert.delivery = "cancelled"; continue; }
      alert.deliveryClaim = claim; alert.deliveryLeaseUntil = now + LEASE;
      claimed.push(structuredClone(alert));
    }
    if (summary && claimed.length && doc.monitor) doc.monitor.unshownMatches = 0;
    return doc;
  });
  if (summary && claimed.length) return deliverSummary(notifications, claimed, claim, now, unshown);
  for (const alert of claimed) {
    let delivered = false;
    let channel = "os";
    try {
      const doc = await readScannerDocument();
      if (!active(doc, alert.monitorId) || !doc.data.alerts.some((row) => row.id === alert.id && row.deliveryClaim === claim && row.delivery === "pending")) continue;
      const shown = await notifications.getAll();
      const latest = await readScannerDocument();
      if (!active(latest, alert.monitorId) || !latest.data.alerts.some((row) => row.id === alert.id && row.deliveryClaim === claim && row.delivery === "pending")) continue;
      if (!shown[alert.id]) {
        const receipt = await notifications.create(alert.id, { type: "basic", iconUrl: "icons/128X128.png",
          title: "Kalshi condition matched", message: `${alert.title} (${alert.symbol})
${alert.recipeFormula || "saved recipe"}`, priority: 1 });
        channel = receipt?.channel || "os";
      }
      delivered = true;
    } catch { /* Keep an outbox entry when OS permission/display fails. */ }
    await updateScannerDocument((doc) => {
      const row = doc.data.alerts?.find((value) => value.id === alert.id && value.deliveryClaim === claim);
      if (!row || row.delivery !== "pending") return doc;
      row.delivery = delivered ? "delivered" : "pending";
      if (delivered) row.deliveryChannel = channel;
      row.attempts += 1; row.deliveryLeaseUntil = 0;
      row.nextAttemptAt = now + Math.min(BACKOFF_MAX, MINUTE * 2 ** Math.min(row.attempts - 1, 4));
      row.deliveryError = delivered ? null : "Notification presentation unavailable; event retained for retry.";
      return doc;
    });
  }
}

async function deliverSummary(notifications, claimed, claim, now, unshown = 0) {
  const [first] = claimed;
  let delivered = false;
  let channel = "os";
  try {
    const doc = await readScannerDocument();
    if (doc.data.alerts.some((row) => row.id === first.id && row.deliveryClaim === claim && row.delivery === "pending") && active(doc, first.monitorId)) {
      const count = claimed.length + unshown;
      const names = [...new Set(claimed.map((alert) => alert.title || alert.symbol))].slice(0, 3).join("; ");
      const receipt = await notifications.create(first.id, { type: "basic", iconUrl: "icons/128X128.png",
        title: `Kalshi: ${count} markets matched`, message: `Including ${names}. Open Alerts to see the latest ${claimed.length}.
${first.recipeFormula || "saved recipe"}`, priority: 1 }, { count });
      channel = receipt?.channel || "os";
      delivered = true;
    }
  } catch { /* Keep the outbox entries when OS permission/display fails. */ }
  const ids = new Set(claimed.map((alert) => alert.id));
  await updateScannerDocument((doc) => {
    for (const row of doc.data.alerts || []) {
      if (!ids.has(row.id) || row.deliveryClaim !== claim || row.delivery !== "pending") continue;
      row.delivery = delivered ? "delivered" : "pending";
      if (delivered) row.deliveryChannel = row.id === first.id ? channel : "summary";
      row.attempts += 1; row.deliveryLeaseUntil = 0;
      row.nextAttemptAt = now + Math.min(BACKOFF_MAX, MINUTE * 2 ** Math.min(row.attempts - 1, 4));
      row.deliveryError = delivered ? null : "Notification presentation unavailable; event retained for retry.";
    }
    return doc;
  });
}
