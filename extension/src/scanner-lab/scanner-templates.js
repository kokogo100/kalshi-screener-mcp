import {
  DATA_REQUIREMENTS,
  PARAMETER_FIELD_TYPES,
  TEMPLATE_STATUS,
  TEMPLATE_SUPPORT_POLICIES,
  parameterField
} from "./scanner-types.js";

const TIMEFRAME_CHOICES = [
  choice("1m", "1m"),
  choice("15m", "15m"),
  choice("1h", "1h"),
  choice("1d", "1d")
];

const COMPARISON_CHOICES = [
  choice("gte", ">="),
  choice("lte", "<="),
  choice("gt", ">"),
  choice("lt", "<"),
  choice("between", "between"),
  choice("is_true", "is true"),
  choice("is_false", "is false")
];

export const SCANNER_TEMPLATE_CATEGORIES = [
  category("target-scope", "Target / Scope", "Kalshi event-contract scopes and user lists.", [
    scopeTemplate("scope-open-markets", "Open Markets", "open_markets"),
    scopeTemplate("scope-closing-24h", "Closing in 24h", "closing_24h"),
    scopeTemplate("scope-closing-7d", "Closing in 7d", "closing_7d"),
    scopeTemplate("scope-multivariate-only", "Multivariate Only", "multivariate_only"),
    scopeTemplate("scope-watchlist", "Watchlist", "watchlist"),
    scopeTemplate("scope-saved-markets", "Saved Markets", "saved_symbols")
  ]),
  category("market-discovery", "Market Discovery", "Basic market eligibility and status observations.", [
    tickerTemplate("last-price-exists", "Last price exists", "last_price", "is_true", 1),
    tickerTemplate("yes-bid-exists", "YES bid exists", "bid_price", "is_true", 1),
    tickerTemplate("yes-ask-exists", "YES ask exists", "ask_price", "is_true", 1)
  ]),
  category("probability-price", "Probability And Price", "YES price and probability-like market observations.", [
    tickerTemplate("yes-bid-above", "YES bid above", "bid_price", "gte", 0.6),
    tickerTemplate("yes-ask-below", "YES ask below", "ask_price", "lte", 0.4),
    tickerTemplate("last-price-above", "YES last price above", "last_price", "gte", 0.6),
    tickerTemplate("last-price-below", "YES last price below", "last_price", "lte", 0.4),
    tickerTemplate("price-near-50", "YES price near 50c", "last_price", "between", 0.45, { valueMax: 0.55 }),
    tickerTemplate("utc-day-change-above", "Change vs previous day above (%)", "price_change_pct", "gte", 3, { description: "YES last price change in percent versus the previous day's price." }),
    tickerTemplate("utc-day-change-below", "Change vs previous day below (%)", "price_change_pct", "lte", -3, { description: "YES last price change in percent versus the previous day's price." }),
    tickerTemplate("price-80-plus", "YES price 80c or higher", "last_price", "gte", 0.8),
    tickerTemplate("price-extreme-high", "YES price above 90c", "last_price", "gte", 0.9),
    tickerTemplate("price-extreme-low", "YES price below 10c", "last_price", "lte", 0.1)
  ]),
  category("spread-tradability", "Spread And Tradability", "Top-of-book and spread quality observations.", [
    tickerTemplate("yes-spread-below", "YES spread percent below", "spread_pct", "lte", 5),
    tickerTemplate("yes-spread-above", "YES spread percent above", "spread_pct", "gte", 10),
    orderBookTemplate("order-book-spread-below", "Order book spread percent below", "order_book_spread_pct", "lte", 5),
    orderBookTemplate("order-book-bid-depth-above", "YES bid depth above", "order_book_bid_depth", "gte", 100),
    orderBookTemplate("order-book-ask-depth-above", "Implied YES ask depth above", "order_book_ask_depth", "gte", 100)
  ]),
  category("liquidity-participation", "Liquidity And Participation", "Volume, liquidity, and open-interest observations.", [
    tickerTemplate("volume-24h-above", "24h volume above", "volume_24h", "gte", 1000),
    tickerTemplate("liquidity-above", "Top-of-book liquidity above ($)", "liquidity", "gte", 1000),
    tickerTemplate("open-interest-above", "Open interest above", "open_interest", "gte", 500)
  ]),
  category("trade-flow", "Trade Flow", "Recent public trade feed observations.", [
    tradesTemplate("recent-trade-count-above", "Recent trade count above", "recent_trade_count", "gte", 10),
    tradesTemplate("recent-trade-volume-above", "Recent traded contracts above", "recent_trade_volume", "gte", 100),
    tradesTemplate("recent-yes-flow-above", "Recent YES-side flow above", "recent_buy_ratio", "gte", 0.6),
    tradesTemplate("recent-no-flow-above", "Recent NO-side flow above", "recent_buy_ratio", "lte", 0.4)
  ]),
  category("probability-history", "Probability History", "Kalshi candlestick history for probability movement.", [
    ohlcvTemplate("close-above", "YES close above", "close", 1, "gte", 0.6),
    ohlcvTemplate("close-below", "YES close below", "close", 1, "lte", 0.4),
    ohlcvTemplate("period-volume-above", "Period volume above", "candle_volume", 1, "gte", 100),
    ohlcvTemplate("probability-change-above", "Probability change percent above", "n_candle_change_pct", 5, "gte", 10),
    ohlcvTemplate("probability-change-below", "Probability change percent below", "n_candle_change_pct", 5, "lte", -10)
  ]),
  category("deadline-lifecycle", "Deadline And Lifecycle", "Close time and listing age of each market.", [
    tickerTemplate("hours-to-close-below", "Closes within N hours", "hours_to_close", "lte", 48, { description: "Hours left until the market closes." }),
    tickerTemplate("listed-within-hours", "New listing within N hours", "hours_since_listed", "lte", 24, { description: "Hours since the market was created on Kalshi." }),
    metadataTemplate("closes-within-24h", "Closes within 24h"),
    metadataTemplate("closes-within-7d", "Closes within 7d"),
    metadataTemplate("can-close-early", "Can close early")
  ]),
  category("event-structure", "Event Comparison", "Compare a market with the other open markets in the same event.", [
    tickerTemplate("event-favorite", "Event favorite (rank 1)", "event_price_rank", "lte", 1, { description: "Rank of this market's YES price inside its event. 1 is the highest." }),
    tickerTemplate("event-market-count-above", "Event has N or more markets", "event_market_count", "gte", 3, { description: "Number of open markets in the same event." }),
    tickerTemplate("event-yes-ask-sum-below", "Event YES ask total below", "event_yes_ask_sum", "lte", 1, { description: "Sum of YES asks across the event's open markets. Meaningful when the outcomes are mutually exclusive." }),
    tickerTemplate("event-yes-bid-sum-above", "Event YES bid total above", "event_yes_bid_sum", "gte", 1, { description: "Sum of YES bids across the event's open markets. Meaningful when the outcomes are mutually exclusive." })
  ]),
  category("rules-settlement", "Rules And Settlement", "Rules and settlement clarity templates planned for market metadata.", [
    metadataTemplate("rules-text-exists", "Rules text exists"),
    metadataTemplate("settlement-source-exists", "Settlement source exists"),
    metadataTemplate("result-exists", "Contract result exists")
  ]),
  category("multivariate-related", "Multivariate And Related Markets", "Related-event structure templates planned for MVE fields.", [
    metadataTemplate("is-multivariate", "Is multivariate"),
    metadataTemplate("has-related-markets", "Has related markets"),
    metadataTemplate("event-has-multiple-markets", "Event has multiple markets")
  ]),
  category("account-positions", "Account And Positions", "Optional private read-only account and position context.", [
    accountTemplate("has-market-position", "Has market position"),
    accountTemplate("has-event-position", "Has event position")
  ])
];

export const SCANNER_LAB_TEMPLATE_SUMMARY = summarizeScannerTemplates(SCANNER_TEMPLATE_CATEGORIES);

export function scannerTemplateById(id) {
  return flattenScannerTemplates().find((template) => template.id === id) || null;
}

export function flattenScannerTemplates(categories = SCANNER_TEMPLATE_CATEGORIES) {
  return categories.flatMap((entry) => entry.templates.map((template) => ({
    ...template,
    categoryId: entry.id,
    categoryLabel: entry.label
  })));
}

export function summarizeScannerTemplates(categories = SCANNER_TEMPLATE_CATEGORIES) {
  const templates = flattenScannerTemplates(categories);
  return {
    categoryCount: categories.length,
    templateCount: templates.length,
    tickerCount: templates.filter((template) => template.dataRequirement.includes(DATA_REQUIREMENTS.TICKER)).length,
    ohlcvCount: templates.filter((template) => template.dataRequirement.includes(DATA_REQUIREMENTS.OHLCV)).length,
    accountCount: templates.filter((template) => template.dataRequirement.includes(DATA_REQUIREMENTS.ACCOUNT_READONLY)).length
  };
}

function category(id, label, description, templates) {
  return { id, label, description, templates };
}

function scopeTemplate(id, title, scope) {
  return {
    id,
    title,
    categoryPath: ["Target / Scope"],
    description: `Set the default scanner universe to ${title}.`,
    dataRequirement: [DATA_REQUIREMENTS.INSTRUMENT],
    supportPolicy: TEMPLATE_SUPPORT_POLICIES.KALSHI_EVENT_CONTRACTS,
    status: TEMPLATE_STATUS.READY,
    action: "scope",
    defaultParameters: { scope },
    parameterSchema: [selectField("scope", "Scope", scope, [choice(scope, title)])]
  };
}

function tickerTemplate(id, title, metric, operator = "gte", value = 0, options = {}) {
  return metricTemplate({
    id,
    title,
    description: options.description,
    categoryPath: ["Kalshi Market Snapshot"],
    metric,
    operator,
    value,
    valueMax: options.valueMax,
    dataRequirement: [DATA_REQUIREMENTS.TICKER],
    parameterSchema: [operatorField(operator), numberField("value", "Value", value), numberField("valueMax", "Max", options.valueMax ?? value, { optional: true })]
  });
}

function ohlcvTemplate(id, title, metric, lookback = 14, operator = "gte", value = 0) {
  return metricTemplate({
    id,
    title,
    categoryPath: ["Probability History"],
    metric,
    operator,
    value,
    dataRequirement: [DATA_REQUIREMENTS.OHLCV],
    parameterSchema: [
      timeframeField(),
      numberField("lookback", "Lookback", lookback, { min: 1, max: 720, step: 1 }),
      operatorField(operator),
      numberField("value", "Value", value)
    ]
  });
}

function orderBookTemplate(id, title, metric, operator = "gte", value = 0) {
  return metricTemplate({
    id,
    title,
    categoryPath: ["Orderbook Depth"],
    metric,
    operator,
    value,
    dataRequirement: [DATA_REQUIREMENTS.ORDER_BOOK],
    parameterSchema: [
      numberField("depth", "Depth", 10, { min: 1, max: 100, step: 1 }),
      operatorField(operator),
      numberField("value", "Value", value)
    ],
    defaultParameters: { depth: 10 }
  });
}

function tradesTemplate(id, title, metric, operator = "gte", value = 0) {
  return metricTemplate({
    id,
    title,
    categoryPath: ["YES / NO Flow"],
    metric,
    operator,
    value,
    dataRequirement: [DATA_REQUIREMENTS.TRADES],
    parameterSchema: [
      numberField("limit", "Trades", 100, { min: 1, max: 1000, step: 1 }),
      operatorField(operator),
      numberField("value", "Value", value)
    ],
    defaultParameters: { limit: 100 }
  });
}

function metadataTemplate(id, title) {
  return metricTemplate({
    id,
    title,
    categoryPath: ["Kalshi Metadata"],
    metric: id.replace(/-/g, "_"),
    operator: "is_true",
    value: 1,
    dataRequirement: [DATA_REQUIREMENTS.TICKER],
    parameterSchema: []
  });
}

function accountTemplate(id, title) {
  return metricTemplate({
    id,
    title,
    categoryPath: ["Account And Positions"],
    metric: id.replace(/-/g, "_"),
    operator: "is_true",
    value: 1,
    dataRequirement: [DATA_REQUIREMENTS.ACCOUNT_READONLY],
    parameterSchema: []
  });
}

function metricTemplate(config) {
  return {
    id: config.id,
    title: config.title,
    categoryPath: config.categoryPath,
    description: config.description || `${config.title} condition.`,
    dataRequirement: config.dataRequirement,
    supportPolicy: config.supportPolicy || TEMPLATE_SUPPORT_POLICIES.KALSHI_EVENT_CONTRACTS,
    status: config.status || TEMPLATE_STATUS.READY,
    metric: config.metric,
    operator: config.operator,
    value: config.value,
    parameterSchema: config.parameterSchema,
    defaultParameters: {
      timeframe: "1h",
      operator: config.operator,
      value: config.value,
      valueMax: config.valueMax,
      ...(config.defaultParameters || {})
    },
    buildClauses(parameters = {}) {
      return [{
        metric: config.metric,
        operator: parameters.operator || config.operator,
        value: parameters.value ?? config.value,
        valueMax: parameters.valueMax ?? config.valueMax,
        timeframe: parameters.timeframe,
        lookback: parameters.lookback ?? 0,
        options: {
          depth: parameters.depth,
          limit: parameters.limit
        }
      }];
    }
  };
}

function timeframeField(defaultValue = "1h") {
  return selectField("timeframe", "Timeframe", defaultValue, TIMEFRAME_CHOICES);
}

function operatorField(defaultValue = "gte") {
  return selectField("operator", "Operator", defaultValue, COMPARISON_CHOICES);
}

function numberField(name, label, defaultValue, options = {}) {
  return parameterField(name, label, PARAMETER_FIELD_TYPES.NUMBER, defaultValue, options);
}

function selectField(name, label, defaultValue, choices) {
  return parameterField(name, label, PARAMETER_FIELD_TYPES.SELECT, defaultValue, { choices });
}

function choice(value, label) {
  return { value, label };
}
