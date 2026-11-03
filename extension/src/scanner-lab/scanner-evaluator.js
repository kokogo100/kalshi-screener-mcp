import { evaluateFormulaState } from "./scanner-formula.js";
import { computeCrossValues, computeIndicatorLatest, normalizeOhlcvRows } from "./scanner-indicators.js";
import { normalizeConditionInstance } from "./scanner-parameters.js";
import { EXECUTABLE_TICKER_METRICS } from "./scanner-capabilities.js";

export function evaluateScannerRecipe({ conditions = [], formulaTokens = [], marketData = {} } = {}) {
  const normalizedConditions = conditions.map(normalizeConditionInstance);
  const conditionResults = normalizedConditions.map((condition, index) => evaluateConditionInstance(condition, marketData, index));
  const state = evaluateFormulaState(formulaTokens, conditionResults.map((result) => result.state));
  return {
    matched: state === true,
    state,
    incomplete: state === null,
    conditionResults
  };
}

export function evaluateConditionInstance(condition = {}, marketData = {}, index = 0) {
  const normalized = normalizeConditionInstance(condition, index);
  if (!normalized.enabled) {
    return { condition: normalized, matched: false, state: null, skipped: true, reason: "disabled", clauseResults: [] };
  }
  const clauseResults = normalized.clauses.map((clause) => evaluateClause(clause, marketData));
  const state = !clauseResults.length ? null : clauseResults.some((result) => result.available && !result.matched)
    ? false : clauseResults.some((result) => !result.available) ? null : true;
  return {
    condition: normalized,
    matched: state === true,
    state,
    skipped: false,
    clauseResults
  };
}

export function evaluateClause(clause = {}, marketData = {}) {
  const numeric = (value) => (typeof value === "number" || typeof value === "string" && value.trim() !== "") && Number.isFinite(Number(value));
  if (!["cross_above", "cross_below", "is_true", "is_false"].includes(clause.operator)) {
    if (!numeric(clause.value) || clause.operator === "between" && !numeric(clause.valueMax)) throw new Error("Invalid comparison target; specify finite numeric bounds.");
  }
  const value = metricValueForClause(clause, marketData);
  const crossOperator = ["cross_above", "cross_below"].includes(clause.operator);
  const available = crossOperator
    ? value && typeof value === "object" && [value.previousLeft, value.previousRight, value.currentLeft, value.currentRight].every(Number.isFinite)
    : typeof value === "boolean" ||
    (value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value))) ||
    (value && typeof value === "object" &&
      [value.previousLeft, value.previousRight, value.currentLeft, value.currentRight].every(Number.isFinite));
  const matched = operatorMatches(value, clause.operator, clause.value, clause.valueMax, marketData, clause);
  return {
    clause,
    value,
    matched,
    available: Boolean(available),
    reason: available ? "" : "metric unavailable"
  };
}

export function metricValueForClause(clause = {}, marketData = {}) {
  const metric = clause.metric;
  const ticker = marketData.ticker || {};
  if (EXECUTABLE_TICKER_METRICS.has(metric) && Object.keys(ticker).length === 0) return NaN;

  if (metric === "last_price") return ticker.last ?? ticker.last_price;
  if (metric === "bid_price") return ticker.bid ?? ticker.bid_price;
  if (metric === "ask_price") return ticker.ask ?? ticker.ask_price;
  if (metric === "mid_price") return midpoint(ticker.bid ?? ticker.bid_price, ticker.ask ?? ticker.ask_price);
  if (metric === "spread_pct") return ticker.spreadPct ?? ticker.spread_pct;
  if (metric === "vwap_24h") return ticker.vwap24h ?? ticker.vwap_24h;
  if (metric === "high_24h") return ticker.high24h ?? ticker.high_24h;
  if (metric === "low_24h") return ticker.low24h ?? ticker.low_24h;
  if (metric === "open_24h" || metric === "utc_day_open") return ticker.open ?? ticker.utc_day_open;
  if (metric === "range_pct_24h") return ticker.rangePct24h ?? ticker.range_pct_24h;
  if (metric === "utc_day_change_pct" || metric === "price_change_pct") return ticker.priceChangePct ?? ticker.utc_day_change_pct;
  if (metric === "abs_price_change_pct") return Math.abs(numericValue(ticker.priceChangePct ?? ticker.utc_day_change_pct));
  if (metric === "trade_count_24h") return ticker.tradeCount24h ?? ticker.trade_count_24h;
  if (metric === "volume_24h") return ticker.volume24h ?? ticker.volume_24h;
  if (metric === "quote_volume_24h") return ticker.quoteVolume24h ?? ticker.quote_volume_24h;
  if (metric === "liquidity") return ticker.liquidity ?? ticker.liquidity_dollars;
  if (metric === "open_interest") return ticker.openInterest ?? ticker.open_interest;
  if (metric === "closes_within_24h") return closesWithinHours(ticker, 24);
  if (metric === "closes_within_7d") return closesWithinHours(ticker, 24 * 7);
  if (metric === "hours_to_close") return hoursFromNow(ticker.closeTime || ticker.close_time || ticker.raw?.close_time, 1);
  if (metric === "hours_since_listed") return hoursFromNow(ticker.createdTime || ticker.openTime || ticker.raw?.created_time || ticker.raw?.open_time, -1);
  if (metric === "event_market_count") return ticker.eventSummary?.marketCount ?? NaN;
  if (metric === "event_yes_ask_sum") return ticker.eventSummary?.yesAskSum ?? NaN;
  if (metric === "event_yes_bid_sum") return ticker.eventSummary?.yesBidSum ?? NaN;
  if (metric === "event_price_rank") return ticker.eventSummary?.rank ?? NaN;
  if (metric === "can_close_early") return marketFlag(ticker.canCloseEarly, ticker.can_close_early, ticker.raw?.can_close_early, ticker.raw?.canCloseEarly, ticker.raw?.early_close_condition, ticker.raw?.earlyCloseCondition);
  if (metric === "rules_text_exists") return textExists(ticker.rulesSummary, ticker.rulesPrimary, ticker.rulesSecondary, ticker.raw?.rules_primary, ticker.raw?.rulesPrimary, ticker.raw?.rules_secondary, ticker.raw?.rulesSecondary);
  if (metric === "settlement_source_exists") {
    // Sources come from the market's series; without series data the answer is unknown, not "no".
    if (Array.isArray(ticker.settlementSources)) return ticker.settlementSources.length > 0;
    return textExists(ticker.settlementSource, ticker.settlement_source, ticker.raw?.settlement_source, ticker.raw?.settlementSource) || NaN;
  }
  if (metric === "result_exists") return textExists(ticker.result, ticker.contractResult, ticker.raw?.result, ticker.raw?.contract_result, ticker.raw?.contractResult);
  if (metric === "is_multivariate") return ticker.isMultivariate === true || ticker.raw?.is_multivariate_event === true || ticker.raw?.is_multivariate === true;
  if (metric === "has_related_markets") return hasRelatedMarkets(ticker);
  if (metric === "event_has_multiple_markets") return eventHasMultipleMarkets(ticker);
  if (metric.startsWith("order_book_")) return orderBookMetricValue(metric, marketData.orderBook, clause.options);
  if (metric.startsWith("recent_")) return recentTradesMetricValue(metric, marketData.recentTrades);
  if (metric.startsWith("spread_history_")) return spreadHistoryMetricValue(metric, marketData.spreadHistory);

  const timeframe = clause.timeframe || "1h";
  const timeframeRows = marketData.ohlcvByTimeframe?.[timeframe] || marketData.ohlcv || [];
  const allOhlcv = normalizeOhlcvRows(timeframeRows);
  const offset = Math.max(0, Math.floor(Number(clause.offset) || 0));
  const selectedOhlcv = offset ? allOhlcv.slice(0, Math.max(0, allOhlcv.length - offset)) : allOhlcv;
  if (!selectedOhlcv.length) return NaN;
  if (clause.operator === "cross_above" || clause.operator === "cross_below") {
    return computeCrossValues(metric, clause.compareTo, selectedOhlcv, {
      timeframe: clause.timeframe,
      source: clause.source,
      lookback: clause.lookback,
      length: clause.options?.length || clause.lookback,
      fast: clause.options?.fast,
      slow: clause.options?.slow,
      signal: clause.options?.signal
    });
  }
  return computeIndicatorLatest(metric, selectedOhlcv, {
    timeframe: clause.timeframe,
    source: clause.source,
    lookback: clause.lookback,
    length: clause.options?.length || clause.lookback,
    fast: clause.options?.fast,
    slow: clause.options?.slow,
    signal: clause.options?.signal,
    compareTo: clause.compareTo,
    pattern: clause.options?.pattern
  });
}

export function operatorMatches(metricValue, operator = "gte", targetValue, targetMax, marketData = {}, clause = {}) {
  if (metricValue === null || metricValue === undefined || metricValue === "") return false;
  if (operator === "is_true") return metricValue === true || Number(metricValue) > 0;
  if (operator === "is_false") return metricValue === false || Number(metricValue) <= 0;
  if (operator === "cross_above" || operator === "cross_below") {
    const cross = metricValue;
    if (!cross || ![cross.previousLeft, cross.previousRight, cross.currentLeft, cross.currentRight].every(Number.isFinite)) return false;
    return operator === "cross_above"
      ? cross.previousLeft <= cross.previousRight && cross.currentLeft > cross.currentRight
      : cross.previousLeft >= cross.previousRight && cross.currentLeft < cross.currentRight;
  }

  const value = Number(metricValue);
  if (!Number.isFinite(value)) return false;

  if (operator === "between") {
    const lower = Number(targetValue);
    const upper = Number(targetMax);
    if (!Number.isFinite(lower) || !Number.isFinite(upper)) return false;
    return value >= Math.min(lower, upper) && value <= Math.max(lower, upper);
  }

  const target = Number(targetValue);
  if (!Number.isFinite(target)) return false;
  if (operator === "gte") return value >= target;
  if (operator === "lte") return value <= target;
  if (operator === "gt") return value > target;
  if (operator === "lt") return value < target;
  if (operator === "eq") return value === target;
  return false;
}

function midpoint(bid, ask) {
  const bidValue = numericValue(bid);
  const askValue = numericValue(ask);
  if (!Number.isFinite(bidValue) || !Number.isFinite(askValue)) return NaN;
  return (bidValue + askValue) / 2;
}

function closesWithinHours(ticker = {}, hours = 24) {
  const raw = ticker.raw || {};
  const timestamp = Date.parse(ticker.closeTime || ticker.close_time || raw.close_time || raw.closeTime || "");
  if (!Number.isFinite(timestamp)) return NaN;
  const remainingMs = timestamp - Date.now();
  return remainingMs >= 0 && remainingMs <= hours * 60 * 60 * 1000;
}

// direction 1 measures time until the timestamp, -1 time elapsed since it.
function hoursFromNow(value, direction = 1) {
  const timestamp = Date.parse(value || "");
  if (!Number.isFinite(timestamp)) return NaN;
  const hours = direction * (timestamp - Date.now()) / 3600000;
  return hours >= 0 ? hours : NaN;
}

function textExists(...values) {
  return values.some((value) => String(value || "").trim().length > 0);
}

function marketFlag(...values) {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (Number.isFinite(numericValue(value))) return numericValue(value) !== 0;
    const normalized = String(value || "").trim().toLowerCase();
    if (["true", "yes", "y", "enabled", "available"].includes(normalized)) return true;
    if (["false", "no", "n", "disabled", "unavailable"].includes(normalized)) return false;
  }
  return NaN;
}

function hasRelatedMarkets(ticker = {}) {
  const raw = ticker.raw || {};
  const explicit = relatedMarketCount(ticker);
  if (Number.isFinite(explicit)) return explicit > 1;
  return ticker.isMultivariate === true
    || textExists(raw.mve_event_ticker, raw.mveEventTicker, raw.collection_ticker, raw.collectionTicker);
}

function eventHasMultipleMarkets(ticker = {}) {
  if (Number.isFinite(ticker.eventSummary?.marketCount)) return ticker.eventSummary.marketCount > 1;
  const explicit = relatedMarketCount(ticker);
  return Number.isFinite(explicit) ? explicit > 1 : NaN;
}

function relatedMarketCount(ticker = {}) {
  const raw = ticker.raw || {};
  const arrays = [
    ticker.relatedMarkets,
    raw.related_markets,
    raw.relatedMarkets,
    raw.event_markets,
    raw.eventMarkets,
    raw.markets
  ].filter(Array.isArray);
  if (arrays.length) return Math.max(...arrays.map((entry) => entry.length));
  const counts = [
    ticker.relatedMarketCount,
    raw.related_markets_count,
    raw.relatedMarketsCount,
    raw.event_market_count,
    raw.eventMarketCount,
    raw.market_count,
    raw.marketCount
  ].map(numericValue).filter(Number.isFinite);
  return counts.length ? Math.max(...counts) : NaN;
}

function orderBookMetricValue(metric, orderBook = null, options = {}) {
  if (!orderBook) return NaN;
  const depth = Math.max(1, Math.floor(Number(options.depth) || 10));
  const normalized = normalizeOrderBook(orderBook);
  if (!normalized) return NaN;
  const bids = normalized.bids.slice(0, depth);
  const asks = normalized.asks.slice(0, depth);
  const bestBid = bids[0]?.price;
  const bestAsk = asks[0]?.price;
  const bidDepth = bids.reduce((total, level) => total + level.volume, 0);
  const askDepth = asks.reduce((total, level) => total + level.volume, 0);
  if (metric === "order_book_spread_pct") {
    const mid = midpoint(bestBid, bestAsk);
    return mid ? ((bestAsk - bestBid) / mid) * 100 : NaN;
  }
  if (metric === "order_book_bid_depth") return bidDepth;
  if (metric === "order_book_ask_depth") return askDepth;
  if (metric === "order_book_imbalance") return bidDepth + askDepth ? (bidDepth - askDepth) / (bidDepth + askDepth) : NaN;
  return NaN;
}

function recentTradesMetricValue(metric, trades = null) {
  if (trades === null) return NaN;
  const normalized = normalizeTrades(trades);
  if (!normalized) return NaN;
  if (metric === "recent_trade_count") return normalized.length;
  if (metric === "recent_trade_volume") return normalized.reduce((total, trade) => total + trade.volume, 0);
  if (metric === "recent_buy_ratio") {
    if (!normalized.length) return NaN;
    if (normalized.some((trade) => !["buy", "sell"].includes(trade.side))) return NaN;
    return normalized.filter((trade) => trade.side === "buy").length / normalized.length;
  }
  return NaN;
}

function spreadHistoryMetricValue(metric, spreads = []) {
  const normalized = normalizeSpreads(spreads);
  const percentages = normalized
    .map((spread) => {
      const mid = midpoint(spread.bid, spread.ask);
      return mid ? ((spread.ask - spread.bid) / mid) * 100 : NaN;
    })
    .filter(Number.isFinite);
  if (!percentages.length) return NaN;
  if (metric === "spread_history_latest_pct") return percentages.at(-1);
  if (metric === "spread_history_average_pct") return percentages.reduce((total, value) => total + value, 0) / percentages.length;
  return NaN;
}

function normalizeOrderBook(orderBook = {}) {
  const payload = orderBookPayload(orderBook);
  if (!hasBookSides(payload)) return null;
  const bids = normalizeBookSide(payload.bids ?? payload.bid, "bid");
  const asks = normalizeBookSide(payload.asks ?? payload.ask, "ask");
  if (!bids || !asks) return null;
  return {
    bids, asks
  };
}

function orderBookPayload(orderBook = {}) {
  if (!orderBook || typeof orderBook !== "object") return {};
  if (hasBookSides(orderBook.orderBook)) return orderBook.orderBook;
  if (hasBookSides(orderBook)) return orderBook;
  if (orderBook.result && typeof orderBook.result === "object") {
    const nestedResult = Object.values(orderBook.result).find(hasBookSides);
    if (nestedResult) return nestedResult;
  }
  return Object.values(orderBook).find(hasBookSides) || {};
}

function hasBookSides(entry) {
  return entry && typeof entry === "object"
    && Array.isArray(entry.bids ?? entry.bid) && Array.isArray(entry.asks ?? entry.ask);
}

function normalizeBookSide(levels = [], side = "bid") {
  if (!Array.isArray(levels)) return null;
  const rows = levels
    .map((level) => ({
      price: numericValue(Array.isArray(level) ? level[0] : level?.price),
      volume: numericValue(Array.isArray(level) ? level[1] : level?.volume ?? level?.qty ?? level?.size)
    }))
    .sort((left, right) => side === "ask" ? left.price - right.price : right.price - left.price);
  return rows.every((row) => Number.isFinite(row.price) && Number.isFinite(row.volume) && row.volume >= 0) ? rows : null;
}

function normalizeTrades(trades = []) {
  const rows = tradeRows(trades);
  if (!rows) return null;
  const normalized = rows.map((trade) => ({
    price: numericValue(Array.isArray(trade) ? trade[0] : trade?.price),
    volume: numericValue(Array.isArray(trade) ? trade[1] : trade?.volume ?? trade?.qty ?? trade?.size),
    side: normalizeTradeSide(Array.isArray(trade) ? trade[3] : trade?.side)
  }));
  return normalized.every((row) => Number.isFinite(row.price) && Number.isFinite(row.volume) && row.volume >= 0) ? normalized : null;
}

function numericValue(value) {
  return (typeof value === "number" || typeof value === "string" && value.trim() !== "") && Number.isFinite(Number(value)) ? Number(value) : NaN;
}

function normalizeSpreads(spreads = []) {
  const rows = spreadRows(spreads);
  return rows.map((spread) => ({
    bid: Number(Array.isArray(spread) ? spread[1] : spread.bid),
    ask: Number(Array.isArray(spread) ? spread[2] : spread.ask)
  })).filter((spread) => Number.isFinite(spread.bid) && Number.isFinite(spread.ask));
}

function tradeRows(trades = []) {
  if (Array.isArray(trades)) return trades;
  if (!trades || typeof trades !== "object") return null;
  if (Array.isArray(trades.history)) return trades.history;
  if (trades.result && typeof trades.result === "object") {
    const nestedResult = Object.values(trades.result).find(Array.isArray);
    if (nestedResult) return nestedResult;
  }
  return Object.values(trades).find(Array.isArray) || null;
}

function spreadRows(spreads = []) {
  if (Array.isArray(spreads)) return spreads;
  if (!spreads || typeof spreads !== "object") return [];
  if (spreads.result && typeof spreads.result === "object") {
    const nestedResult = Object.values(spreads.result).find(Array.isArray);
    if (nestedResult) return nestedResult;
  }
  return Object.values(spreads).find(Array.isArray) || [];
}

function normalizeTradeSide(value = "") {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "b" || normalized === "buy") return "buy";
  if (normalized === "s" || normalized === "sell") return "sell";
  return normalized;
}

