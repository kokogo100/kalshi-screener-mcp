import { marketScopeById } from "../shared/market-scopes.js";
import { DATA_REQUIREMENTS, TEMPLATE_STATUS } from "./scanner-types.js";

export const EXECUTABLE_TICKER_METRICS = new Set([
  "last_price",
  "bid_price",
  "ask_price",
  "mid_price",
  "spread_pct",
  "vwap_24h",
  "high_24h",
  "low_24h",
  "open_24h",
  "utc_day_open",
  "range_pct_24h",
  "utc_day_change_pct",
  "price_change_pct",
  "abs_price_change_pct",
  "trade_count_24h",
  "volume_24h",
  "quote_volume_24h",
  "liquidity",
  "open_interest",
  "closes_within_24h",
  "closes_within_7d",
  "hours_to_close",
  "hours_since_listed",
  "event_market_count",
  "event_yes_ask_sum",
  "event_yes_bid_sum",
  "event_price_rank",
  "can_close_early",
  "rules_text_exists",
  "settlement_source_exists",
  "result_exists",
  "is_multivariate",
  "has_related_markets",
  "event_has_multiple_markets"
]);

export const KALSHI_TICKER_METRICS = new Set(EXECUTABLE_TICKER_METRICS);

export const EXECUTABLE_OHLCV_METRICS = new Set([
  "sma",
  "ema",
  "wma",
  "dema",
  "tema",
  "trima",
  "vwma",
  "rsi",
  "macd",
  "macd_signal",
  "macd_histogram",
  "momentum",
  "roc",
  "rocp",
  "rocr",
  "cci",
  "stochastic_k",
  "stochastic_d",
  "willr",
  "atr",
  "natr",
  "true_range",
  "stddev",
  "variance",
  "bb_width",
  "bb_percent_b",
  "bb_upper_distance",
  "bb_lower_distance",
  "obv",
  "ad",
  "mfi",
  "avgprice",
  "medprice",
  "typprice",
  "wclprice",
  "max",
  "min",
  "close",
  "open",
  "high",
  "low",
  "candle_volume",
  "average_volume",
  "relative_volume",
  "rolling_24h_change_pct",
  "upper_wick_pct",
  "lower_wick_pct",
  "close_near_high_pct",
  "close_near_low_pct",
  "n_candle_high_breakout",
  "n_candle_low_breakdown",
  "n_candle_change_pct",
  "consecutive_up_candles",
  "consecutive_down_candles",
  "gap_up_pct",
  "gap_down_pct",
  "candle_body_pct",
  "candle_range_pct",
  "volume_ratio_previous",
  "volume_breakout",
  "quote_turnover",
  "kama",
  "t3",
  "sma_cross",
  "ema_cross",
  "ma_alignment_3",
  "ma_alignment_4",
  "ma_distance_pct",
  "volume_ma_ratio",
  "adx",
  "adxr",
  "dx",
  "plus_di",
  "minus_di",
  "aroon_up",
  "aroon_down",
  "aroon_osc",
  "apo",
  "ppo",
  "linear_regression_slope",
  "linear_regression_angle",
  "tsf",
  "parabolic_sar_position",
  "supertrend_direction",
  "stoch_rsi",
  "cmo",
  "ultimate_oscillator",
  "trix",
  "bop",
  "mass_index",
  "volatility_expanding",
  "volatility_contracting",
  "envelope_position",
  "keltner_position",
  "donchian_position",
  "pivot_position",
  "ichimoku_position",
  "midpoint",
  "midprice",
  "adosc",
  "volume_oscillator",
  "positive_volume_index",
  "negative_volume_index",
  "volume_roc",
  "maxindex",
  "minindex",
  "correl",
  "candlestick_pattern"
]);

export const EXECUTABLE_ORDER_BOOK_METRICS = new Set([
  "order_book_spread_pct",
  "order_book_bid_depth",
  "order_book_ask_depth",
  "order_book_imbalance"
]);

export const EXECUTABLE_TRADES_METRICS = new Set([
  "recent_trade_count",
  "recent_trade_volume",
  "recent_buy_ratio"
]);

export const EXECUTABLE_SPREAD_HISTORY_METRICS = new Set([
  "spread_history_average_pct",
  "spread_history_latest_pct"
]);

export const KALSHI_CAPABILITY_PROFILES = Object.freeze({
  eventContracts: profile([
    DATA_REQUIREMENTS.INSTRUMENT,
    DATA_REQUIREMENTS.TICKER,
    DATA_REQUIREMENTS.OHLCV,
    DATA_REQUIREMENTS.ORDER_BOOK,
    DATA_REQUIREMENTS.TRADES
  ], [
    DATA_REQUIREMENTS.INSTRUMENT,
    DATA_REQUIREMENTS.TICKER,
    DATA_REQUIREMENTS.OHLCV,
    DATA_REQUIREMENTS.ORDER_BOOK,
    DATA_REQUIREMENTS.TRADES
  ], { tickerMetrics: KALSHI_TICKER_METRICS }),
  user: profile([
    DATA_REQUIREMENTS.INSTRUMENT,
    DATA_REQUIREMENTS.TICKER,
    DATA_REQUIREMENTS.OHLCV,
    DATA_REQUIREMENTS.ORDER_BOOK,
    DATA_REQUIREMENTS.TRADES
  ], [
    DATA_REQUIREMENTS.INSTRUMENT,
    DATA_REQUIREMENTS.TICKER,
    DATA_REQUIREMENTS.OHLCV,
    DATA_REQUIREMENTS.ORDER_BOOK,
    DATA_REQUIREMENTS.TRADES
  ], { tickerMetrics: KALSHI_TICKER_METRICS }),
  unavailable: profile([], [], { tickerMetrics: new Set() })
});

export function scannerCapabilitiesForScope(scopeId = "open_markets") {
  const scope = marketScopeById(scopeId);
  if (scope.selectable === false) return KALSHI_CAPABILITY_PROFILES.unavailable;
  if (scope.family === "user") return KALSHI_CAPABILITY_PROFILES.user;
  if (scope.family !== "kalshi") return KALSHI_CAPABILITY_PROFILES.unavailable;
  return KALSHI_CAPABILITY_PROFILES.eventContracts;
}

export function scannerTemplateCapabilityView(template = {}, scopeId = "open_markets") {
  const requirements = Array.isArray(template.dataRequirement) ? template.dataRequirement : [];
  const capabilities = scannerCapabilitiesForScope(scopeId);
  const apiSupported = requirements.every((requirement) => capabilities.apiRequirements.has(requirement));
  const scopeSupported = scannerTemplateScopeSupported(template, capabilities);
  const engineReady = scannerTemplateEngineReady(template);
  const external = requirements.includes(DATA_REQUIREMENTS.EXTERNAL);
  const privateOptIn = requirements.includes(DATA_REQUIREMENTS.ACCOUNT_READONLY);

  if (template.status === TEMPLATE_STATUS.UNSUPPORTED) {
    return templateStatus("Disabled", "later", { apiSupported: false, engineReady, scopeSupported: false });
  }
  if (template.action === "scope") return templateStatus("Scope", "scope", { apiSupported, engineReady: true, scopeSupported });
  if (external) return templateStatus("External", "later", { apiSupported: false, engineReady: false, scopeSupported: false });
  if (privateOptIn) return templateStatus("Private opt-in", "private", { apiSupported, engineReady, scopeSupported });
  if (!apiSupported) return templateStatus("API N/A", "later", { apiSupported, engineReady, scopeSupported: false });
  if (!engineReady) return templateStatus("Engine Planned", "later", { apiSupported, engineReady, scopeSupported });
  if (!scopeSupported) return templateStatus("Scope N/A", "later", { apiSupported, engineReady, scopeSupported });
  if (requirements.includes(DATA_REQUIREMENTS.ORDER_BOOK)) return templateStatus("Book", "ohlc", { apiSupported, engineReady, scopeSupported });
  if (requirements.includes(DATA_REQUIREMENTS.TRADES)) return templateStatus("Trades", "ohlc", { apiSupported, engineReady, scopeSupported });
  if (requirements.includes(DATA_REQUIREMENTS.SPREAD_HISTORY)) return templateStatus("Spread", "ohlc", { apiSupported, engineReady, scopeSupported });
  if (requirements.includes(DATA_REQUIREMENTS.OHLCV)) return templateStatus("OHLC", "ohlc", { apiSupported, engineReady, scopeSupported });
  if (requirements.includes(DATA_REQUIREMENTS.TICKER)) return templateStatus("Ticker", "live", { apiSupported, engineReady, scopeSupported });
  return templateStatus("Ready", "live", { apiSupported, engineReady, scopeSupported });
}

export function scannerTemplateEngineReady(template = {}) {
  if (template.action === "scope") return true;
  const metric = String(template.metric || "").trim();
  const requirements = Array.isArray(template.dataRequirement) ? template.dataRequirement : [];
  if (requirements.includes(DATA_REQUIREMENTS.EXTERNAL)) return false;
  if (requirements.includes(DATA_REQUIREMENTS.ORDER_BOOK)) return EXECUTABLE_ORDER_BOOK_METRICS.has(metric);
  if (requirements.includes(DATA_REQUIREMENTS.TRADES)) return EXECUTABLE_TRADES_METRICS.has(metric);
  if (requirements.includes(DATA_REQUIREMENTS.SPREAD_HISTORY)) return EXECUTABLE_SPREAD_HISTORY_METRICS.has(metric);
  if (requirements.includes(DATA_REQUIREMENTS.TICKER)) return EXECUTABLE_TICKER_METRICS.has(metric);
  if (requirements.includes(DATA_REQUIREMENTS.OHLCV)) return EXECUTABLE_OHLCV_METRICS.has(metric);
  return !metric;
}

export function scannerTemplateIsExecutable(template = {}, scopeId = "open_markets") {
  const status = scannerTemplateCapabilityView(template, scopeId);
  return status.apiSupported && status.engineReady && status.scopeSupported && status.tone !== "later";
}

function scannerTemplateScopeSupported(template = {}, capabilities = {}) {
  const requirements = Array.isArray(template.dataRequirement) ? template.dataRequirement : [];
  if (!requirements.every((requirement) => capabilities.adapterRequirements.has(requirement))) return false;
  if (requirements.includes(DATA_REQUIREMENTS.TICKER)) {
    const metric = String(template.metric || "").trim();
    if (metric && !capabilities.tickerMetrics.has(metric)) return false;
  }
  return true;
}

function profile(apiRequirements, adapterRequirements, options = {}) {
  return {
    apiRequirements: new Set(apiRequirements),
    adapterRequirements: new Set(adapterRequirements),
    tickerMetrics: new Set(options.tickerMetrics || [])
  };
}

function templateStatus(label, tone, details = {}) {
  return {
    label,
    tone,
    apiSupported: details.apiSupported === true,
    engineReady: details.engineReady === true,
    scopeSupported: details.scopeSupported === true,
    detail: [
      `API ${details.apiSupported === true ? "supported" : "not available"}`,
      `Engine ${details.engineReady === true ? "ready" : "planned"}`,
      `Scope ${details.scopeSupported === true ? "supported" : "not available"}`
    ].join(" / ")
  };
}

