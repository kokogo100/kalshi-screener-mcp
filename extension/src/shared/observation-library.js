export const OBSERVATION_TEMPLATE_STATUSES = {
  live: {
    label: "Live-ready",
    tone: "live",
    description: "Uses Kalshi public event-contract market data."
  },
  ohlc: {
    label: "Needs OHLC",
    tone: "ohlc",
    description: "Requires Kalshi candlestick history before it can run."
  },
  later: {
    label: "Later",
    tone: "later",
    description: "Kept in the library map but not executable yet."
  },
  scope: {
    label: "Scope",
    tone: "scope",
    description: "Changes the target Kalshi event-contract scope for selected conditions."
  }
};

export const OBSERVATION_LIBRARY_CATEGORIES = [
  {
    id: "scope",
    label: "Target / Scope",
    description: "Choose the Kalshi market universe before combining observation rows.",
    templates: [
      scopeTemplate("scope_open_markets", "Open Markets", "open_markets", "Open Kalshi event-contract markets."),
      scopeTemplate("scope_closing_24h", "Closing in 24h", "closing_24h", "Open markets closing within 24 hours."),
      scopeTemplate("scope_closing_7d", "Closing in 7d", "closing_7d", "Open markets closing within 7 days."),
      scopeTemplate("scope_multivariate_only", "Multivariate Only", "multivariate_only", "Open multivariate Kalshi markets only."),
      scopeTemplate("scope_exclude_multivariate", "Exclude Multivariate", "exclude_multivariate", "Open Kalshi markets excluding multivariate markets."),
      scopeTemplate("scope_watchlist", "Watchlist only", "watchlist", "Restrict observations to locally saved Kalshi market tickers.")
    ]
  },
  {
    id: "probability",
    label: "Probability And Price",
    description: "YES price, spread, and probability-like market observations.",
    templates: [
      liveTemplate("yes_bid_gte", "YES bid above", "YES bid is greater than or equal to a selected dollar probability.", { metric: "bid_price", operator: "gte", value: "0.60" }),
      liveTemplate("yes_ask_lte", "YES ask below", "YES ask is less than or equal to a selected dollar probability.", { metric: "ask_price", operator: "lte", value: "0.40" }),
      liveTemplate("last_price_gte", "YES last above", "Last YES price is at or above a selected value.", { metric: "last_price", operator: "gte", value: "0.60" }),
      liveTemplate("last_price_lte", "YES last below", "Last YES price is at or below a selected value.", { metric: "last_price", operator: "lte", value: "0.40" }),
      liveTemplate("spread_lte", "YES spread below", "YES bid/ask spread is below the selected percent.", { metric: "spread_pct", operator: "lte", value: "5" })
    ]
  },
  {
    id: "liquidity",
    label: "Liquidity And Participation",
    description: "Volume, liquidity, and open-interest filters.",
    templates: [
      liveTemplate("volume_24h_gte", "24h volume above", "24h volume is greater than or equal to a selected value.", { metric: "volume_24h", operator: "gte", value: "1000" }),
      liveTemplate("liquidity_gte", "Top-of-book liquidity above", "Dollars resting at the best YES bid and ask are at or above a selected value.", { metric: "liquidity", operator: "gte", value: "1000" }),
      liveTemplate("open_interest_gte", "Open interest above", "Open interest is greater than or equal to a selected value.", { metric: "open_interest", operator: "gte", value: "500" })
    ]
  },
  {
    id: "flow",
    label: "YES / NO Flow",
    description: "Derived observations from recent Kalshi public trades.",
    templates: [
      liveTemplate("recent_trade_count_gte", "Recent trade count above", "Recent public trade count is above a selected value.", { metric: "recent_trade_count", operator: "gte", value: "10" }),
      liveTemplate("recent_trade_volume_gte", "Recent traded contracts above", "Recent traded contracts are above a selected value.", { metric: "recent_trade_volume", operator: "gte", value: "100" }),
      liveTemplate("yes_flow_gte", "YES flow ratio above", "YES-side recent flow ratio is above a selected value.", { metric: "recent_buy_ratio", operator: "gte", value: "0.60" })
    ]
  }
];

export function observationTemplateById(id) {
  return OBSERVATION_LIBRARY_CATEGORIES
    .flatMap((category) => category.templates.map((template) => ({ ...template, categoryId: category.id, categoryLabel: category.label })))
    .find((template) => template.id === id) || null;
}

function liveTemplate(id, label, description, row = {}) {
  return {
    id,
    label,
    description,
    status: "live",
    rows: [{ timeframe: "1h", marketScope: "open_markets", ...row }]
  };
}

function scopeTemplate(id, label, marketScope, description, status = "scope") {
  return {
    id,
    label,
    description,
    status,
    action: "scope",
    marketScope
  };
}
