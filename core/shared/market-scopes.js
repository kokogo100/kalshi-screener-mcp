export const MARKET_SCOPES = [
  {
    id: "open_markets",
    label: "Open Markets",
    family: "kalshi",
    group: "Kalshi Event Contracts",
    selectable: true,
    estimatedSymbols: "all pages",
    estimatedScanTime: "data-dependent",
    // Multivariate combo markets number in the millions and kept full scans from finishing.
    mveFilter: "exclude",
    description: "All open Kalshi markets except multivariate combo markets."
  },
  {
    id: "closing_24h",
    label: "Closing in 24h",
    family: "kalshi",
    group: "Kalshi Event Contracts",
    selectable: true,
    estimatedSymbols: "all pages",
    estimatedScanTime: "data-dependent",
    mveFilter: "exclude",
    description: "Open markets with close time within 24 hours, excluding multivariate combo markets."
  },
  {
    id: "closing_7d",
    label: "Closing in 7d",
    family: "kalshi",
    group: "Kalshi Event Contracts",
    selectable: true,
    estimatedSymbols: "all pages",
    estimatedScanTime: "data-dependent",
    mveFilter: "exclude",
    description: "Open markets with close time within 7 days, excluding multivariate combo markets."
  },
  {
    id: "high_liquidity",
    label: "High Liquidity",
    family: "kalshi",
    aliasOf: "open_markets",
    group: "Kalshi Event Contracts",
    selectable: false,
    hidden: true,
    estimatedSymbols: "all pages",
    estimatedScanTime: "data-dependent",
    description: "Legacy scope kept for stored settings migration. Use the Liquidity above condition instead."
  },
  {
    id: "high_volume_24h",
    label: "High 24h Volume",
    family: "kalshi",
    aliasOf: "open_markets",
    group: "Kalshi Event Contracts",
    selectable: false,
    hidden: true,
    estimatedSymbols: "all pages",
    estimatedScanTime: "data-dependent",
    description: "Legacy scope kept for stored settings migration. Use the 24h volume above condition instead."
  },
  {
    id: "multivariate_only",
    label: "Multivariate Only",
    family: "kalshi",
    group: "Kalshi Event Contracts",
    selectable: true,
    estimatedSymbols: "all pages",
    estimatedScanTime: "data-dependent",
    mveFilter: "only",
    // Millions of combo markets exist; past this many pages the scan stops with a clear error.
    maxPages: 100,
    description: "Open multivariate Kalshi markets only."
  },
  {
    id: "exclude_multivariate",
    label: "Exclude Multivariate",
    family: "kalshi",
    aliasOf: "open_markets",
    group: "Kalshi Event Contracts",
    selectable: false,
    hidden: true,
    estimatedSymbols: "all pages",
    estimatedScanTime: "data-dependent",
    mveFilter: "exclude",
    description: "Legacy scope kept for stored settings migration. Open Markets now excludes multivariate markets."
  },
  {
    id: "watchlist",
    label: "Watchlist",
    family: "user",
    group: "User Lists",
    selectable: true,
    estimatedSymbols: "user-dependent",
    estimatedScanTime: "usually fastest",
    description: "User-selected Kalshi market tickers."
  },
  {
    id: "saved_symbols",
    label: "Saved Markets",
    family: "user",
    group: "User Lists",
    selectable: false,
    hidden: true,
    estimatedSymbols: "user-dependent",
    estimatedScanTime: "usually fastest",
    description: "Kalshi market tickers saved by the user."
  },
  {
    id: "kalshi_sp500",
    label: "Legacy Kalshi Scope",
    family: "kalshi",
    aliasOf: "open_markets",
    hidden: true,
    selectable: false,
    estimatedSymbols: "all pages",
    estimatedScanTime: "data-dependent",
    description: "Legacy copied scope kept only for stored settings migration."
  }
];

export const TIMEFRAMES = ["1m", "15m", "1h", "1d"];

export const CONDITION_METRICS = [
  { id: "last_price", label: "YES Last Price" },
  { id: "bid_price", label: "YES Bid" },
  { id: "ask_price", label: "YES Ask" },
  { id: "price_change_pct", label: "Probability Change % vs Previous Day" },
  { id: "abs_price_change_pct", label: "Absolute Probability Change % vs Previous Day" },
  { id: "volume_24h", label: "24h Volume" },
  { id: "spread_pct", label: "YES Spread %" },
  { id: "liquidity", label: "Top-of-book Liquidity ($)" },
  { id: "open_interest", label: "Open Interest" },
  { id: "hours_to_close", label: "Hours to Close" },
  { id: "hours_since_listed", label: "Hours Since Listed" },
  { id: "event_price_rank", label: "Rank in Event (1 = favorite)" },
  { id: "event_market_count", label: "Markets in Event" },
  { id: "event_yes_ask_sum", label: "Event YES Ask Total" },
  { id: "event_yes_bid_sum", label: "Event YES Bid Total" }
];

export const CONDITION_OPERATORS = [
  { id: "gte", label: ">=" },
  { id: "lte", label: "<=" },
  { id: "gt", label: ">" },
  { id: "lt", label: "<" },
  { id: "eq", label: "=" },
  { id: "between", label: "between" },
  { id: "is_true", label: "is true" },
  { id: "is_false", label: "is false" }
];

export function marketScopeById(id) {
  const scope = MARKET_SCOPES.find((entry) => entry.id === id) || MARKET_SCOPES[0];
  if (scope.aliasOf) return MARKET_SCOPES.find((entry) => entry.id === scope.aliasOf) || MARKET_SCOPES[0];
  return scope;
}
