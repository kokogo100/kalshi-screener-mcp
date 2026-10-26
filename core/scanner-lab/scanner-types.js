export const SCANNER_LAB_ENGINE_VERSION = "0.1.0";

export const DEFAULT_SCANNER_SCOPE = "open_markets";
export const DEFAULT_SCANNER_TIMEFRAME = "1h";
export const MAX_SCANNER_STACK_ROWS = 26;

export const DATA_REQUIREMENTS = Object.freeze({
  INSTRUMENT: "instrument",
  TICKER: "ticker",
  OHLCV: "ohlcv",
  ORDER_BOOK: "order_book",
  TRADES: "trades",
  SPREAD_HISTORY: "spread_history",
  ACCOUNT_READONLY: "account_readonly",
  EXTERNAL: "external"
});

export const TEMPLATE_SUPPORT_POLICIES = Object.freeze({
  COMMON: "common",
  KALSHI_EVENT_CONTRACTS: "kalshi_event_contracts",
  EXTERNAL: "external"
});

export const TEMPLATE_STATUS = Object.freeze({
  READY: "ready",
  NEEDS_DATA: "needs_data",
  ACCOUNT_OPT_IN: "account_opt_in",
  EXTERNAL_REQUIRED: "external_required",
  UNSUPPORTED: "unsupported"
});

export const SCANNER_TIMEFRAMES = Object.freeze([
  "1m",
  "15m",
  "1h",
  "1d"
]);

export const OHLC_PRICE_SOURCES = Object.freeze([
  "open",
  "high",
  "low",
  "close",
  "hl2",
  "hlc3",
  "ohlc4",
  "volume",
  "vwap"
]);

export const SCANNER_OPERATORS = Object.freeze([
  { id: "gte", label: ">=" },
  { id: "lte", label: "<=" },
  { id: "gt", label: ">" },
  { id: "lt", label: "<" },
  { id: "eq", label: "=" },
  { id: "between", label: "between" },
  { id: "cross_above", label: "cross above" },
  { id: "cross_below", label: "cross below" },
  { id: "is_true", label: "is true" },
  { id: "is_false", label: "is false" }
]);

export const PARAMETER_FIELD_TYPES = Object.freeze({
  NUMBER: "number",
  SELECT: "select",
  BOOLEAN: "boolean",
  TEXT: "text"
});

export function createScannerId(prefix = "scanner") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function scannerRuleLetter(index = 0) {
  const numericIndex = Number.isInteger(index) ? index : 0;
  if (numericIndex < 0 || numericIndex >= MAX_SCANNER_STACK_ROWS) return "?";
  return String.fromCharCode(65 + numericIndex);
}

export function scannerRuleIndex(letter = "") {
  const code = String(letter || "").trim().toUpperCase().charCodeAt(0);
  if (!Number.isFinite(code)) return -1;
  const index = code - 65;
  return index >= 0 && index < MAX_SCANNER_STACK_ROWS ? index : -1;
}

export function normalizeDataRequirements(requirements = []) {
  const allowed = new Set(Object.values(DATA_REQUIREMENTS));
  const input = Array.isArray(requirements) ? requirements : [requirements];
  return [...new Set(input.filter((requirement) => allowed.has(requirement)))];
}

export function normalizeOperator(operator = "gte") {
  const id = String(operator || "").trim();
  return SCANNER_OPERATORS.some((entry) => entry.id === id) ? id : "gte";
}

export function normalizeTimeframe(timeframe = DEFAULT_SCANNER_TIMEFRAME) {
  const value = String(timeframe || "").trim();
  return SCANNER_TIMEFRAMES.includes(value) ? value : DEFAULT_SCANNER_TIMEFRAME;
}

export function normalizePriceSource(source = "close") {
  const value = String(source || "").trim();
  return OHLC_PRICE_SOURCES.includes(value) ? value : "close";
}

export function normalizeStackLimit(limit = MAX_SCANNER_STACK_ROWS) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed)) return MAX_SCANNER_STACK_ROWS;
  return Math.max(1, Math.min(MAX_SCANNER_STACK_ROWS, Math.floor(parsed)));
}

export function parameterField(name, label, type, defaultValue, options = {}) {
  return {
    name,
    label,
    type,
    defaultValue,
    min: options.min,
    max: options.max,
    step: options.step,
    unit: options.unit || "",
    choices: Array.isArray(options.choices) ? options.choices : [],
    description: options.description || ""
  };
}
