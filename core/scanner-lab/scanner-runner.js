import { conditionLabel, normalizeConditionRow } from "../shared/condition-builder.js";
import { marketScopeById } from "../shared/market-scopes.js";
import { DATA_REQUIREMENTS, DEFAULT_SCANNER_SCOPE, scannerRuleIndex, scannerRuleLetter } from "./scanner-types.js";
import { evaluateConditionInstance, evaluateScannerRecipe } from "./scanner-evaluator.js";
import { parseFormulaText, defaultFormulaTokens, normalizeFormulaTokens, formulaText, evaluateFormulaState, validateFormulaTokens } from "./scanner-formula.js";
import { normalizeConditionInstance, normalizeConditionClause } from "./scanner-parameters.js";
import { createKALSHIEventContractScannerAdapter } from "./adapters/kalshi-event-contract-adapter.js";
import { EXECUTABLE_OHLCV_METRICS, EXECUTABLE_ORDER_BOOK_METRICS, EXECUTABLE_TRADES_METRICS, EXECUTABLE_SPREAD_HISTORY_METRICS } from "./scanner-capabilities.js";

const DEFAULT_RUN_SYMBOL_LIMIT = Number.POSITIVE_INFINITY;

export async function runScannerLabObservation({
  rows = [],
  conditions = [],
  formula = "",
  formulaTokens = [],
  directionFilter = "all",
  symbols = [],
  watchlist = [],
  settings = {},
  maxSymbols = DEFAULT_RUN_SYMBOL_LIMIT,
  adapter = null,
  signal = null,
  onProgress = null
} = {}) {
  throwIfAborted(signal);
  const observedAt = new Date().toISOString();
  const { conditionInstances, normalizedDirectionFilter, tokens, scopeId, requirements } = prepareScannerObservation({ rows, conditions, formula, formulaTokens, directionFilter, settings });
  const runAdapter = adapter || createScannerAdapterForScope(scopeId);
  assertAdapterSupportsRequirements(runAdapter, requirements);
  const runSymbols = await symbolsForRunScope(runAdapter, scopeId, { symbols, watchlist, settings, maxSymbols, signal });
  emitScanProgress(onProgress, {
    phase: "symbols",
    scopeId,
    total: runSymbols.length,
    message: `Resolved ${runSymbols.length} market contracts for ${marketScopeById(scopeId).label}.`
  });

  let tickerBySymbol = {};
  if (requirements.has(DATA_REQUIREMENTS.TICKER) || requirements.has(DATA_REQUIREMENTS.OHLCV)) {
    emitScanProgress(onProgress, {
      phase: "ticker",
      total: runSymbols.length,
      message: `Loading market snapshots for ${runSymbols.length} contracts.`
    });
    tickerBySymbol = await runAdapter.getTicker(runSymbols, { signal, settings });
  }
  if (usesEventMetrics(conditionInstances) && typeof runAdapter.getEventSummaries === "function") {
    await attachEventSummaries(runAdapter, tickerBySymbol, { signal, onProgress, settings });
  }
  if (usesSeriesMetrics(conditionInstances) && typeof runAdapter.getSettlementSources === "function") {
    await attachSettlementSources(runAdapter, tickerBySymbol, { signal, onProgress, settings });
  }
  const filteredSymbols = filterSymbolsByDirection(runSymbols, tickerBySymbol, normalizedDirectionFilter);
  const directionUnknownSymbols = normalizedDirectionFilter === "all" ? [] : runSymbols.filter((symbol) => {
    const ticker = tickerBySymbol[symbol] || tickerBySymbol[normalizeSymbolKey(symbol)] || {};
    return !Number.isFinite(Number(ticker.priceChangePct ?? ticker.utc_day_change_pct));
  });
  emitScanProgress(onProgress, {
    phase: "direction",
    directionFilter: normalizedDirectionFilter,
    total: runSymbols.length,
    filtered: filteredSymbols.length,
    message: `${directionFilterLabel(normalizedDirectionFilter)} lens kept ${filteredSymbols.length}/${runSymbols.length} contracts.`
  });
  const plannedSymbols = requirements.has(DATA_REQUIREMENTS.OHLCV)
    ? planSymbolsForOhlcvFetch(filteredSymbols, tickerBySymbol, conditionInstances, tokens)
    : { finalSymbols: filteredSymbols, ohlcvSymbols: [] };
  let candidateSymbols = plannedSymbols.finalSymbols;
  const dataState = {
    tickerBySymbol,
    ohlcvByTimeframe: {},
    orderBookBySymbol: {},
    tradesBySymbol: {},
    spreadHistoryBySymbol: {}
  };
  const availableRequirements = new Set([DATA_REQUIREMENTS.INSTRUMENT, DATA_REQUIREMENTS.TICKER]);
  if (requirements.has(DATA_REQUIREMENTS.OHLCV)) {
    emitScanProgress(onProgress, {
      phase: "planner",
      total: filteredSymbols.length,
      ohlcv: plannedSymbols.ohlcvSymbols.length,
      final: plannedSymbols.finalSymbols.length,
      message: `Execution planner will request OHLC for ${plannedSymbols.ohlcvSymbols.length}/${filteredSymbols.length} ${directionFilterLabel(normalizedDirectionFilter)} contracts.`
    });
  }
  const ohlcvByTimeframe = requirements.has(DATA_REQUIREMENTS.OHLCV)
    ? await loadOhlcvByTimeframe(runAdapter, plannedSymbols.ohlcvSymbols, timeframesForConditions(conditionInstances), { signal, onProgress, settings })
    : {};
  dataState.ohlcvByTimeframe = ohlcvByTimeframe;
  if (requirements.has(DATA_REQUIREMENTS.OHLCV)) {
    availableRequirements.add(DATA_REQUIREMENTS.OHLCV);
    const before = candidateSymbols.length;
    candidateSymbols = pruneSymbolsByAvailableData(candidateSymbols, conditionInstances, tokens, dataState, availableRequirements);
    emitScanProgress(onProgress, {
      phase: "planner",
      total: before,
      final: candidateSymbols.length,
      message: `OHLC checks kept ${candidateSymbols.length}/${before} contracts for downstream data.`
    });
  }
  const orderBookPlan = requirements.has(DATA_REQUIREMENTS.ORDER_BOOK)
    ? planSymbolsForRequirement(candidateSymbols, DATA_REQUIREMENTS.ORDER_BOOK, conditionInstances, tokens, dataState, availableRequirements)
    : { candidateSymbols, requestSymbols: [] };
  candidateSymbols = orderBookPlan.candidateSymbols;
  if (requirements.has(DATA_REQUIREMENTS.ORDER_BOOK)) {
    emitScanProgress(onProgress, {
      phase: "planner",
      total: candidateSymbols.length,
      orderBook: orderBookPlan.requestSymbols.length,
      message: `Execution planner will request order book for ${orderBookPlan.requestSymbols.length}/${candidateSymbols.length} remaining contracts.`
    });
  }
  const orderBookBySymbol = requirements.has(DATA_REQUIREMENTS.ORDER_BOOK)
    ? await loadOrderBookBySymbol(runAdapter, orderBookPlan.requestSymbols, maxOptionForConditions(conditionInstances, "depth", 10), { signal, onProgress, settings })
    : {};
  dataState.orderBookBySymbol = orderBookBySymbol;
  if (requirements.has(DATA_REQUIREMENTS.ORDER_BOOK)) {
    availableRequirements.add(DATA_REQUIREMENTS.ORDER_BOOK);
    candidateSymbols = pruneSymbolsByAvailableData(candidateSymbols, conditionInstances, tokens, dataState, availableRequirements);
  }
  const spreadHistoryPlan = requirements.has(DATA_REQUIREMENTS.SPREAD_HISTORY)
    ? planSymbolsForRequirement(candidateSymbols, DATA_REQUIREMENTS.SPREAD_HISTORY, conditionInstances, tokens, dataState, availableRequirements)
    : { candidateSymbols, requestSymbols: [] };
  candidateSymbols = spreadHistoryPlan.candidateSymbols;
  if (requirements.has(DATA_REQUIREMENTS.SPREAD_HISTORY)) {
    emitScanProgress(onProgress, {
      phase: "planner",
      total: candidateSymbols.length,
      spreadHistory: spreadHistoryPlan.requestSymbols.length,
      message: `Execution planner will request spread history for ${spreadHistoryPlan.requestSymbols.length}/${candidateSymbols.length} remaining contracts.`
    });
  }
  const spreadHistoryBySymbol = requirements.has(DATA_REQUIREMENTS.SPREAD_HISTORY)
    ? await loadSpreadHistoryBySymbol(runAdapter, spreadHistoryPlan.requestSymbols, { signal, onProgress, settings })
    : {};
  dataState.spreadHistoryBySymbol = spreadHistoryBySymbol;
  if (requirements.has(DATA_REQUIREMENTS.SPREAD_HISTORY)) {
    availableRequirements.add(DATA_REQUIREMENTS.SPREAD_HISTORY);
    candidateSymbols = pruneSymbolsByAvailableData(candidateSymbols, conditionInstances, tokens, dataState, availableRequirements);
  }
  const tradesPlan = requirements.has(DATA_REQUIREMENTS.TRADES)
    ? planSymbolsForRequirement(candidateSymbols, DATA_REQUIREMENTS.TRADES, conditionInstances, tokens, dataState, availableRequirements)
    : { candidateSymbols, requestSymbols: [] };
  candidateSymbols = tradesPlan.candidateSymbols;
  if (requirements.has(DATA_REQUIREMENTS.TRADES)) {
    emitScanProgress(onProgress, {
      phase: "planner",
      total: candidateSymbols.length,
      trades: tradesPlan.requestSymbols.length,
      message: `Execution planner will request recent trades for ${tradesPlan.requestSymbols.length}/${candidateSymbols.length} remaining contracts.`
    });
  }
  // A market with no volume in 24 hours has no recent trades; only the rest need trade data.
  const quietSymbols = tradesPlan.requestSymbols.filter((symbol) => Number(marketDataForSymbol(symbol, dataState).ticker.volume24h) === 0);
  const quiet = new Set(quietSymbols);
  const tradesBySymbol = requirements.has(DATA_REQUIREMENTS.TRADES)
    ? {
      ...Object.fromEntries(quietSymbols.map((symbol) => [symbol, []])),
      ...await loadTradesBySymbol(runAdapter, tradesPlan.requestSymbols.filter((symbol) => !quiet.has(symbol)), maxOptionForConditions(conditionInstances, "limit", 100),
        { signal, onProgress, settings, windowSeconds: tradeWindowSeconds(conditionInstances) })
    }
    : {};
  dataState.tradesBySymbol = tradesBySymbol;
  if (requirements.has(DATA_REQUIREMENTS.TRADES)) {
    availableRequirements.add(DATA_REQUIREMENTS.TRADES);
    candidateSymbols = pruneSymbolsByAvailableData(candidateSymbols, conditionInstances, tokens, dataState, availableRequirements);
  }

  emitScanProgress(onProgress, {
    phase: "evaluate",
    total: candidateSymbols.length,
    message: `Evaluating final formula for ${candidateSymbols.length} contracts.`
  });

  const incompleteSymbols = [...directionUnknownSymbols];
  const results = candidateSymbols
    .map((symbol) => {
      const marketData = marketDataForSymbol(symbol, dataState);
      const ticker = marketData.ticker || {};
      const evaluation = evaluateScannerRecipe({
        conditions: conditionInstances,
        formulaTokens: tokens,
        marketData
      });
      if (evaluation.incomplete) incompleteSymbols.push(symbol);
      if (!evaluation.matched) return null;
      return scannerResultFromEvaluation({
        symbol,
        scopeId,
        directionFilter: normalizedDirectionFilter,
        ticker,
        evaluation,
        formula: formulaText(tokens),
        observedAt
      });
    })
    .filter(Boolean);

  return {
    status: incompleteSymbols.length ? "partial" : "live",
    engine: "scanner-lab",
    scopeId,
    directionFilter: normalizedDirectionFilter,
    resolvedSymbols: runSymbols.length,
    scannedSymbols: filteredSymbols.length,
    plannedOhlcvSymbols: plannedSymbols.ohlcvSymbols.length,
    results,
    incompleteSymbols,
    incompleteCount: incompleteSymbols.length,
    observedAt,
    message: scanSummaryMessage(results.length, filteredSymbols.length, incompleteSymbols.length, normalizedDirectionFilter)
  };
}

export function createScannerAdapterForScope(scopeId = DEFAULT_SCANNER_SCOPE) {
  const scope = marketScopeById(scopeId);
  if (scope.selectable === false) {
    throw new Error(`${scope.label} is separated as a Kalshi market scope, but it is not enabled in this Scanner Lab build.`);
  }
  if (scope.family !== "kalshi" && scope.family !== "user") {
    throw new Error(`${scope.label} is not available in the current Kalshi event-contract scanner.`);
  }
  return createKALSHIEventContractScannerAdapter();
}

export function normalizeRunnerConditions({ rows = [], conditions = [], settings = {} } = {}) {
  if (Array.isArray(conditions) && conditions.length) {
    return conditions.map((condition, index) => normalizeConditionInstance({ ...condition, letter: condition.letter || scannerRuleLetter(index) }, index));
  }
  const fallbackScope = settings.marketScope || DEFAULT_SCANNER_SCOPE;
  return (Array.isArray(rows) ? rows : [])
    .map((row, index) => conditionInstanceFromRow(normalizeConditionRow(row, fallbackScope), index));
}

export function conditionInstanceFromRow(row = {}, index = 0) {
  const clauses = Array.isArray(row.scannerClauses) && row.scannerClauses.length
    ? row.scannerClauses.map(normalizeConditionClause)
    : [legacyClauseFromRow(row)];
  return normalizeConditionInstance({
    id: row.id,
    letter: scannerRuleLetter(index),
    templateId: row.scannerTemplateId || row.sourceTemplateId || "",
    label: row.sourceTemplateLabel || conditionLabel(row),
    dataRequirement: dataRequirementsForRow(row, clauses),
    parameters: {
      timeframe: row.timeframe,
      operator: row.operator,
      value: row.value,
      ...row.scannerParameters,
      scope: row.marketScope,
      marketScope: row.marketScope
    },
    clauses,
    enabled: true
  }, index);
}

function legacyClauseFromRow(row = {}) {
  // Accepts "3~48", "3,48" or "-5 to 2"; a plain hyphen split would break negative bounds.
  const [value, valueMax] = String(row.value || "").match(/-?\d*\.?\d+/g) || [];
  return normalizeConditionClause({
    metric: row.metric,
    operator: row.operator,
    value: row.operator === "between" ? value : row.value,
    valueMax: row.operator === "between" ? valueMax : undefined,
    timeframe: row.timeframe,
    lookback: row.metric === "rsi" || row.metric === "relative_volume" ? 14 : 0
  });
}

function dataRequirementsForRow(row = {}, clauses = []) {
  if (Array.isArray(row.dataRequirement) && row.dataRequirement.length) return row.dataRequirement;
  const ohlcvMetrics = new Set(["rsi", "relative_volume"]);
  return clauses.some((clause) => ohlcvMetrics.has(clause.metric))
    ? [DATA_REQUIREMENTS.OHLCV]
    : [DATA_REQUIREMENTS.TICKER];
}

function resolveFormulaTokens({ formula = "", formulaTokens = [], conditionInstances = [] }) {
  const parsed = Array.isArray(formulaTokens) && formulaTokens.length
    ? normalizeFormulaTokens(formulaTokens)
    : parseFormulaText(formula);
  return parsed.length ? parsed : defaultFormulaTokens(conditionInstances.length);
}

function resolveRunScope(conditionInstances = [], settings = {}) {
  const firstScoped = conditionInstances.find((condition) => condition.parameters?.scope)?.parameters?.scope;
  if (firstScoped) return firstScoped;
  const firstRowScope = conditionInstances.find((condition) => condition.parameters?.marketScope)?.parameters?.marketScope;
  return firstRowScope || settings.marketScope || DEFAULT_SCANNER_SCOPE;
}

async function symbolsForRunScope(adapter, scopeId, { symbols = [], watchlist = [], settings = {}, maxSymbols = DEFAULT_RUN_SYMBOL_LIMIT, signal = null } = {}) {
  const explicitSymbols = uniqueSymbols(symbols);
  if (explicitSymbols.length) return limitSymbols(explicitSymbols, maxSymbols);

  if (scopeId === "watchlist" || scopeId === "saved_symbols") {
    return limitSymbols(uniqueSymbols(watchlist), maxSymbols);
  }
  const instruments = await adapter.listSymbols(scopeId, { signal, settings });
  return limitSymbols(instruments.map((entry) => entry.symbol).filter(Boolean), maxSymbols);
}

// "Event has multiple markets" needs the event listing too; alone it was unknown for every market.
const EVENT_METRICS = new Set(["event_market_count", "event_yes_ask_sum", "event_yes_bid_sum", "event_price_rank", "event_has_multiple_markets"]);

function usesEventMetrics(conditions = []) {
  return conditions.some((condition) => (condition.clauses || []).some((clause) => EVENT_METRICS.has(clause.metric)));
}

const SERIES_METRICS = new Set(["settlement_source_exists"]);

function usesSeriesMetrics(conditions = []) {
  return conditions.some((condition) => (condition.clauses || []).some((clause) => SERIES_METRICS.has(clause.metric)));
}

async function attachSettlementSources(adapter, tickerBySymbol = {}, options = {}) {
  const tickers = Object.values(tickerBySymbol).filter((ticker) => ticker?.seriesTicker);
  const series = Array.from(new Set(tickers.map((ticker) => ticker.seriesTicker)));
  emitScanProgress(options.onProgress, { phase: "series", total: series.length, message: `Loading settlement sources for ${series.length} series.` });
  const sourcesBySeries = await adapter.getSettlementSources(series, options);
  tickers.forEach((ticker) => {
    if (Array.isArray(sourcesBySeries[ticker.seriesTicker])) ticker.settlementSources = sourcesBySeries[ticker.seriesTicker];
  });
}

async function attachEventSummaries(adapter, tickerBySymbol = {}, options = {}) {
  const tickers = Object.values(tickerBySymbol).filter((ticker) => ticker?.eventTicker);
  const events = Array.from(new Set(tickers.map((ticker) => ticker.eventTicker)));
  emitScanProgress(options.onProgress, { phase: "events", total: events.length, message: `Loading event structure for ${events.length} events.` });
  const summaries = await adapter.getEventSummaries(events, options);
  tickers.forEach((ticker) => {
    const summary = summaries[ticker.eventTicker];
    if (summary) ticker.eventSummary = { ...summary, rank: summary.rankBySymbol?.[ticker.symbol] ?? NaN };
  });
}

function requiredDataForConditions(conditions = []) {
  const requirements = new Set([DATA_REQUIREMENTS.TICKER]);
  conditions.forEach((condition) => {
    (condition.dataRequirement || []).forEach((requirement) => requirements.add(requirement));
  });
  return requirements;
}

function timeframesForConditions(conditions = []) {
  const timeframes = new Set();
  conditions.forEach((condition) => {
    condition.clauses.forEach((clause) => {
      if ((condition.dataRequirement || []).includes(DATA_REQUIREMENTS.OHLCV)) {
        timeframes.add(clause.timeframe || condition.parameters?.timeframe || "1h");
      }
    });
  });
  return timeframes.size ? Array.from(timeframes) : ["1h"];
}

async function loadOhlcvByTimeframe(adapter, symbols = [], timeframes = [], options = {}) {
  const entries = await Promise.all(timeframes.map(async (timeframe) => [
    timeframe,
    typeof adapter.getOhlcv === "function" ? await adapter.getOhlcv(symbols, timeframe, 240, options) : {}
  ]));
  return Object.fromEntries(entries);
}

async function loadOrderBookBySymbol(adapter, symbols = [], depth = 10, options = {}) {
  return typeof adapter.getOrderBook === "function" ? adapter.getOrderBook(symbols, depth, options) : {};
}

async function loadTradesBySymbol(adapter, symbols = [], limit = 100, options = {}) {
  return typeof adapter.getRecentTrades === "function" ? adapter.getRecentTrades(symbols, limit, options) : {};
}

async function loadSpreadHistoryBySymbol(adapter, symbols = [], options = {}) {
  return typeof adapter.getSpreadHistory === "function" ? adapter.getSpreadHistory(symbols, options) : {};
}

// "Recent" trades are those inside the condition's timeframe (1 hour by default).
const TIMEFRAME_SECONDS = { "1m": 60, "5m": 300, "15m": 900, "1h": 3600, "4h": 14400, "1d": 86400 };
function tradeWindowSeconds(conditions = []) {
  const windows = conditions.filter((condition) => (condition.dataRequirement || []).includes(DATA_REQUIREMENTS.TRADES))
    .flatMap((condition) => condition.clauses.map((clause) => TIMEFRAME_SECONDS[clause.timeframe || condition.parameters?.timeframe || "1h"] || 3600));
  return windows.length ? Math.max(...windows) : 3600;
}

function maxOptionForConditions(conditions = [], optionName = "", fallback = 10) {
  return conditions.reduce((current, condition) => Math.max(current, ...condition.clauses.map((clause) => Number(clause.options?.[optionName])).filter(Number.isFinite)), fallback);
}

function normalizeDirectionFilter(value = "all") {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["yes", "yes_gaining", "yes_rising", "up", "rising", "bullish", "positive"].includes(normalized)) return "yes_gaining";
  if (["no", "no_gaining", "no_rising", "down", "falling", "bearish", "negative"].includes(normalized)) return "no_gaining";
  return "all";
}

function directionFilterLabel(value = "all") {
  const normalized = normalizeDirectionFilter(value);
  if (normalized === "yes_gaining") return "YES gaining";
  if (normalized === "no_gaining") return "NO gaining";
  return "All contracts";
}

function filterSymbolsByDirection(symbols = [], tickerBySymbol = {}, directionFilter = "all") {
  const normalizedDirectionFilter = normalizeDirectionFilter(directionFilter);
  if (normalizedDirectionFilter === "all") return symbols;
  return symbols.filter((symbol) => {
    const ticker = tickerBySymbol[symbol] || tickerBySymbol[normalizeSymbolKey(symbol)] || {};
    const change = Number(ticker.priceChangePct ?? ticker.utc_day_change_pct);
    if (!Number.isFinite(change)) return false;
    return normalizedDirectionFilter === "no_gaining" ? change < 0 : change > 0;
  });
}

function planSymbolsForOhlcvFetch(symbols = [], tickerBySymbol = {}, conditions = [], formulaTokens = []) {
  const finalSymbols = [];
  const ohlcvSymbols = [];

  symbols.forEach((symbol) => {
    const ticker = tickerBySymbol[symbol] || tickerBySymbol[normalizeSymbolKey(symbol)] || {};
    const partialMatches = conditions.map((condition, index) => {
      if (conditionNeedsOhlcv(condition)) return null;
      return evaluateConditionInstance(condition, { ticker }, index).state;
    });
    const state = evaluatePartialFormulaState(formulaTokens, partialMatches);
    if (state === false) return;
    finalSymbols.push(symbol);
    if (state === null) ohlcvSymbols.push(symbol);
  });

  return { finalSymbols, ohlcvSymbols };
}

function planSymbolsForRequirement(symbols = [], requirement, conditions = [], formulaTokens = [], dataState = {}, availableRequirements = new Set()) {
  const candidateSymbols = [];
  const requestSymbols = [];
  symbols.forEach((symbol) => {
    const matches = partialMatchesForSymbol(symbol, conditions, dataState, availableRequirements);
    const state = evaluatePartialFormulaState(formulaTokens, matches);
    if (state === false) return;
    candidateSymbols.push(symbol);
    if (state !== null) return;
    if (conditions.some((condition, index) => matches[index] === null && (condition.dataRequirement || []).includes(requirement))) {
      requestSymbols.push(symbol);
    }
  });
  return { candidateSymbols, requestSymbols };
}

function pruneSymbolsByAvailableData(symbols = [], conditions = [], formulaTokens = [], dataState = {}, availableRequirements = new Set()) {
  return symbols.filter((symbol) => {
    const matches = partialMatchesForSymbol(symbol, conditions, dataState, availableRequirements);
    return evaluatePartialFormulaState(formulaTokens, matches) !== false;
  });
}

function partialMatchesForSymbol(symbol, conditions = [], dataState = {}, availableRequirements = new Set()) {
  const marketData = marketDataForSymbol(symbol, dataState);
  return conditions.map((condition, index) => {
    if (!conditionReadyWithRequirements(condition, availableRequirements)) return null;
    return evaluateConditionInstance(condition, marketData, index).state;
  });
}

function conditionReadyWithRequirements(condition = {}, availableRequirements = new Set()) {
  return (condition.dataRequirement || []).every((requirement) => availableRequirements.has(requirement));
}

function marketDataForSymbol(symbol, dataState = {}) {
  const key = normalizeSymbolKey(symbol);
  return {
    ticker: dataState.tickerBySymbol?.[symbol] || dataState.tickerBySymbol?.[key] || {},
    ohlcvByTimeframe: Object.fromEntries(Object.entries(dataState.ohlcvByTimeframe || {}).map(([timeframe, rowsBySymbol]) => [
      timeframe,
      rowsBySymbol?.[symbol] || rowsBySymbol?.[key] || []
    ])),
    orderBook: dataState.orderBookBySymbol?.[symbol] || dataState.orderBookBySymbol?.[key] || null,
    recentTrades: Object.prototype.hasOwnProperty.call(dataState.tradesBySymbol || {}, symbol)
      ? dataState.tradesBySymbol[symbol] : dataState.tradesBySymbol?.[key] ?? null,
    spreadHistory: dataState.spreadHistoryBySymbol?.[symbol] || dataState.spreadHistoryBySymbol?.[key] || []
  };
}

function conditionNeedsOhlcv(condition = {}) {
  return (condition.dataRequirement || []).some((requirement) => ![DATA_REQUIREMENTS.TICKER, DATA_REQUIREMENTS.INSTRUMENT].includes(requirement));
}

function evaluatePartialFormulaState(tokens = [], matches = []) {
  return evaluateFormulaState(tokens, matches);
}

function assertAdapterSupportsRequirements(adapter, requirements) {
  if (!Array.isArray(adapter?.supportedRequirements)) return;
  const supported = new Set(adapter?.supportedRequirements || []);
  const unsupported = Array.from(requirements).filter((requirement) => !supported.has(requirement));
  if (unsupported.length) {
    throw new Error(`${adapter?.label || "Scanner adapter"} does not support ${unsupported.join(", ")} for this scope.`);
  }
}

// Plain words for the Results header; "observation ... lens" read like a log line.
function scanSummaryMessage(matches, checked, unknown, directionFilter) {
  const count = (value) => Number(value).toLocaleString("en-US");
  const lens = directionFilter && directionFilter !== "all" ? ` (${directionFilterLabel(directionFilter)} only)` : "";
  return (matches ? `${count(matches)} of ${count(checked)} markets matched${lens}.` : `No markets matched out of ${count(checked)}${lens}.`)
    + (unknown ? ` ${count(unknown)} could not be checked because Kalshi has no data yet for a condition (for example, no previous-day price).` : "");
}

function scannerResultFromEvaluation({ symbol, scopeId, directionFilter = "all", ticker = {}, evaluation, formula, observedAt }) {
  const matchedConditionResults = evaluation.conditionResults.filter((entry) => entry.matched);
  const matchedIndexes = matchedConditionResults.map((entry) => evaluation.conditionResults.indexOf(entry));
  const ruleLetters = matchedIndexes.map(scannerRuleLetter);
  const matchedRules = matchedConditionResults.map((entry, index) => {
    const letter = ruleLetters[index] || entry.condition.letter;
    const clauseText = entry.clauseResults
      .map((result) => `${result.clause.metric} ${result.clause.operator} ${result.clause.value}: ${formatMetricValue(result.value)}`)
      .join(", ");
    return `${letter}. ${entry.condition.label}${clauseText ? ` (${clauseText})` : ""}`;
  });
  // What the result card shows: the condition in words and the market's actual value.
  const matchSummary = matchedConditionResults.map((entry) => {
    const values = entry.clauseResults.filter((result) => Number.isFinite(Number(result.value)) && result.value !== null)
      .map((result) => `${Number(result.value).toLocaleString("en-US", { maximumFractionDigits: Math.abs(Number(result.value)) >= 1000 ? 0 : 2 })}${/pct/.test(result.clause.metric) ? "%" : ""}`);
    return `${entry.condition.label}${values.length ? `, now ${values.join(", ")}` : ""}`;
  }).join("; ");
  const scope = marketScopeById(scopeId);
  const marketTicker = ticker.marketTicker || ticker.symbol || symbol;
  const rulesSummary = String(ticker.rulesSummary || "").slice(0, 700);
  return {
    id: `scanner-${normalizeSymbolKey(marketTicker).replace(/[^A-Za-z0-9]/g, "")}-${ruleLetters.join("") || "match"}-${Date.now()}`,
    symbol: marketTicker,
    marketTicker,
    eventTicker: ticker.eventTicker || "",
    seriesTicker: ticker.seriesTicker || "",
    eventTitle: ticker.eventTitle || "",
    marketTitle: ticker.marketTitle || ticker.title || ticker.restName || marketTicker,
    marketType: ticker.marketType || "",
    yesOutcome: ticker.yesOutcome || "YES",
    noOutcome: ticker.noOutcome || "NO",
    scope: scope.label,
    formula: `${directionFilterLabel(directionFilter)} | ${formula}`,
    ruleLetter: ruleLetters.join(", "),
    matchedRule: matchedRules.join(" / "),
    matchSummary,
    match: `Formula ${formula}: ${matchedRules.join(" / ")}`,
    note: "Scanner Lab read-only market observation. No trading action or buy/sell signal.",
    source: ticker.source || "scanner_lab",
    observedAt,
    last: ticker.last,
    bid: ticker.bid,
    ask: ticker.ask,
    yesBid: ticker.yesBid ?? ticker.bid,
    yesAsk: ticker.yesAsk ?? ticker.ask,
    noBid: ticker.noBid,
    noAsk: ticker.noAsk,
    yesBidSize: ticker.yesBidSize,
    yesAskSize: ticker.yesAskSize,
    noBidSize: ticker.noBidSize,
    noAskSize: ticker.noAskSize,
    open: ticker.open,
    high24h: ticker.high24h,
    low24h: ticker.low24h,
    vwap24h: ticker.vwap24h,
    priceChangePct: ticker.priceChangePct,
    absPriceChangePct: Math.abs(Number(ticker.priceChangePct)),
    volume24h: ticker.volume24h,
    quoteVolume24h: ticker.quoteVolume24h,
    liquidity: ticker.liquidity,
    openInterest: ticker.openInterest,
    spreadPct: ticker.spreadPct,
    rangePct24h: ticker.rangePct24h,
    closeTime: ticker.closeTime || "",
    createdTime: ticker.createdTime || "",
    status: ticker.status || "",
    rulesPrimary: ticker.rulesPrimary || "",
    rulesSecondary: ticker.rulesSecondary || "",
    rulesSummary,
    settlementSource: ticker.settlementSource || "",
    result: ticker.result || "",
    canCloseEarly: ticker.canCloseEarly === true,
    relatedMarketCount: ticker.relatedMarketCount,
    isMultivariate: ticker.isMultivariate === true,
    conditionResults: evaluation.conditionResults
  };
}

function uniqueSymbols(symbols = []) {
  return [...new Set(symbols.map(normalizeSymbolKey).filter(Boolean))];
}

function limitSymbols(symbols = [], maxSymbols = DEFAULT_RUN_SYMBOL_LIMIT) {
  const unique = uniqueSymbols(symbols);
  return Number.isFinite(maxSymbols) ? unique.slice(0, maxSymbols) : unique;
}

function normalizeSymbolKey(symbol = "") {
  const value = symbol && typeof symbol === "object" ? symbol.marketTicker || symbol.symbol || symbol.ticker || "" : symbol;
  return String(value || "").trim().toUpperCase();
}

function throwIfAborted(signal = null) {
  if (signal?.aborted) {
    throw new DOMException("Scanner operation was stopped.", "AbortError");
  }
}

function emitScanProgress(onProgress, payload = {}) {
  if (typeof onProgress === "function") onProgress({ ...payload, observedAt: new Date().toISOString() });
}

function formatMetricValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "n/a";
  return Math.abs(number) >= 100 ? number.toFixed(2) : number.toFixed(4).replace(/0+$/g, "").replace(/\.$/, "");
}

export function prepareScannerObservation({ rows = [], conditions = [], formula = "", formulaTokens = [], directionFilter = "all", settings = {} } = {}) {
  const conditionInstances = normalizeRunnerConditions({ rows, conditions, settings });
  // Derive requirements from every clause as well as legacy declarations.
  // An omitted requirement must not let the planner treat an unfetched metric as false.
  for (const condition of conditionInstances) {
    const requirements = new Set(condition.dataRequirement);
    for (const clause of condition.clauses) {
      for (const metric of [clause.metric, clause.compareTo]) {
        if (EXECUTABLE_OHLCV_METRICS.has(metric)) requirements.add(DATA_REQUIREMENTS.OHLCV);
        if (EXECUTABLE_ORDER_BOOK_METRICS.has(metric)) requirements.add(DATA_REQUIREMENTS.ORDER_BOOK);
        if (EXECUTABLE_TRADES_METRICS.has(metric)) requirements.add(DATA_REQUIREMENTS.TRADES);
        if (EXECUTABLE_SPREAD_HISTORY_METRICS.has(metric)) requirements.add(DATA_REQUIREMENTS.SPREAD_HISTORY);
      }
    }
    condition.dataRequirement = [...requirements];
  }
  if (!conditionInstances.length) {
    throw new Error("Add at least one condition before running Scanner Lab.");
  }
  if (conditionInstances.some((condition) => !condition.enabled || !condition.clauses.length)) {
    throw new Error("Remove disabled or empty conditions from the formula before running the scanner.");
  }
  const normalizedDirectionFilter = normalizeDirectionFilter(directionFilter);
  const tokens = resolveFormulaTokens({ formula, formulaTokens, conditionInstances });
  const formulaValidation = validateFormulaTokens(tokens, conditionInstances.length);
  if (!formulaValidation.valid) throw new Error(`Invalid scanner formula: ${formulaValidation.message}`);
  const scopeId = resolveRunScope(conditionInstances, settings);
  const requirements = requiredDataForConditions(conditionInstances);
  if (requirements.has(DATA_REQUIREMENTS.ACCOUNT_READONLY)) {
    throw new Error("Account/Positions conditions are private-only and are not available in public Scanner Lab runs. Remove the private condition or use Account/Positions as private Chat context.");
  }
  return { conditionInstances, normalizedDirectionFilter, tokens, scopeId, requirements };
}
