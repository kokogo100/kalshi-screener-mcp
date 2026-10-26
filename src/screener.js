import { runScannerLabObservation, createScannerAdapterForScope } from "../core/scanner-lab/scanner-runner.js";
import { getEventMarkets, getOrderBook, getSeriesInfo, getTickerSnapshot } from "../core/shared/kalshi-adapter.js";
import { buildResearchPrompt } from "../core/shared/research.js";
import { summarizeEventMarkets } from "../core/scanner-lab/adapters/kalshi-event-contract-adapter.js";

export const SCOPES = ["open_markets", "closing_24h", "closing_7d", "multivariate_only"];
export const SORTS = ["volume", "closing_soon", "yes_price_high", "yes_price_low", "newest"];

// Each filter maps to one engine condition, so MCP searches and extension scans agree.
const FILTERS = {
  min_yes_price: ["last_price", "gte"],
  max_yes_price: ["last_price", "lte"],
  min_yes_bid: ["bid_price", "gte"],
  max_yes_ask: ["ask_price", "lte"],
  max_hours_to_close: ["hours_to_close", "lte"],
  min_hours_to_close: ["hours_to_close", "gte"],
  listed_within_hours: ["hours_since_listed", "lte"],
  min_volume_24h: ["volume_24h", "gte"],
  min_open_interest: ["open_interest", "gte"],
  max_spread_pct: ["spread_pct", "lte"],
  min_change_pct: ["price_change_pct", "gte"],
  max_change_pct: ["price_change_pct", "lte"],
  min_event_markets: ["event_market_count", "gte"],
  max_event_yes_ask_total: ["event_yes_ask_sum", "lte"],
  min_event_yes_bid_total: ["event_yes_bid_sum", "gte"]
};

export function conditionsFromFilters(filters = {}) {
  const conditions = [];
  for (const [key, [metric, operator]] of Object.entries(FILTERS)) {
    const value = filters[key];
    if (value === undefined || value === null || value === "") continue;
    conditions.push({ clauses: [{ metric, operator, value: Number(value) }] });
  }
  if (filters.event_favorite_only) conditions.push({ clauses: [{ metric: "event_price_rank", operator: "lte", value: 1 }] });
  // The engine needs at least one condition; "has a YES quote or last price" keeps every live market.
  if (!conditions.length) conditions.push({ clauses: [{ metric: "last_price", operator: "gte", value: 0 }] });
  return conditions;
}

export async function searchMarkets(filters = {}, { linkFor = defaultLink, signal, onProgress = null } = {}) {
  const scope = SCOPES.includes(filters.scope) ? filters.scope : "open_markets";
  const conditions = conditionsFromFilters(filters);
  const scan = await runScannerLabObservation({
    conditions,
    formula: conditions.map((_, index) => String.fromCharCode(65 + index)).join(" AND "),
    settings: { marketScope: scope },
    symbols: filters.tickers?.length ? filters.tickers : [],
    adapter: withPageProgress(createScannerAdapterForScope(scope), onProgress),
    signal,
    onProgress
  });
  const text = String(filters.text || "").trim().toLowerCase();
  let rows = scan.results.map((result) => compactMarket(result, linkFor));
  if (text) rows = rows.filter((row) => `${row.title} ${row.ticker} ${row.event_ticker}`.toLowerCase().includes(text));
  rows.sort(sorter(filters.sort));
  const limit = Math.max(1, Math.min(100, Number(filters.limit) || 20));
  return {
    scope,
    matched: rows.length,
    returned: Math.min(limit, rows.length),
    scanned: scan.scannedSymbols,
    incomplete: scan.incompleteCount,
    markets: rows.slice(0, limit)
  };
}

// The engine reports progress only between phases; a full scan spends most of its time paging the market list.
function withPageProgress(adapter, onProgress) {
  if (!onProgress) return adapter;
  const listSymbols = adapter.listSymbols.bind(adapter);
  return { ...adapter, listSymbols: (scope, options = {}) => listSymbols(scope, { ...options, onProgress }) };
}

export async function getMarket(ticker, { linkFor = defaultLink, signal } = {}) {
  const [row] = await getTickerSnapshot([ticker], { signal });
  if (!row) throw new Error(`Kalshi market ${ticker} was not found.`);
  const [book, eventRows, series] = await Promise.all([
    getOrderBook(row.symbol, { depth: 5, signal }).catch(() => null),
    row.eventTicker ? getEventMarkets(row.eventTicker, { signal }).catch(() => []) : [],
    row.seriesTicker ? getSeriesInfo(row.seriesTicker, { signal }).catch(() => null) : null
  ]);
  const summary = eventRows.length ? summarizeEventMarkets(eventRows) : null;
  return {
    ...compactMarket(row, linkFor),
    rules: row.rulesSummary || "",
    settlement_sources: series?.settlementSources || [],
    contract_terms_url: series?.contractTermsUrl || series?.contractUrl || "",
    category: series?.category || "",
    can_close_early: row.canCloseEarly,
    order_book: book ? {
      yes_bids: book.yesBids.slice(0, 5),
      no_bids: book.noBids.slice(0, 5)
    } : null,
    event: summary ? eventView(row.eventTicker, summary, eventRows, linkFor, row.symbol) : null,
    // A ready-made research brief: search the settlement sources and news, read-only, no advice.
    research_prompt: buildResearchPrompt(row, series)
  };
}

export async function getEvent(eventTicker, { linkFor = defaultLink, signal } = {}) {
  const rows = await getEventMarkets(eventTicker, { signal });
  if (!rows.length) throw new Error(`No open markets found for event ${eventTicker}.`);
  return eventView(eventTicker, summarizeEventMarkets(rows), rows, linkFor);
}

export async function runSavedScreen(screen = {}, options = {}) {
  if (screen.filters) return searchMarkets({ ...screen.filters, limit: options.limit ?? screen.filters.limit }, options);
  // Screens synced from the extension carry its own condition rows and logic formula.
  const scope = screen.scope && SCOPES.includes(screen.scope) ? screen.scope : "open_markets";
  const scan = await runScannerLabObservation({
    rows: screen.rows || [],
    formula: screen.logic || "",
    directionFilter: screen.directionFilter || "all",
    settings: { marketScope: scope },
    watchlist: screen.watchlist || [],
    adapter: createScannerAdapterForScope(scope),
    signal: options.signal
  });
  const linkFor = options.linkFor || defaultLink;
  const rows = scan.results.map((result) => compactMarket(result, linkFor)).sort(sorter("volume"));
  const limit = Math.max(1, Math.min(100, Number(options.limit) || 20));
  return { scope, matched: rows.length, returned: Math.min(limit, rows.length), incomplete: scan.incompleteCount, markets: rows.slice(0, limit) };
}

function eventView(eventTicker, summary, rows, linkFor, focus = "") {
  return {
    event_ticker: eventTicker,
    market_count: summary.marketCount,
    yes_ask_total: round(summary.yesAskSum),
    yes_bid_total: round(summary.yesBidSum),
    note: "Totals are meaningful only when the event's outcomes are mutually exclusive.",
    markets: rows
      .map((row) => ({ ...compactMarket(row, linkFor), rank_in_event: summary.rankBySymbol[row.symbol] ?? null }))
      .sort((a, b) => (a.rank_in_event ?? 999) - (b.rank_in_event ?? 999))
      .filter((row, index) => index < 25 || row.ticker === focus)
  };
}

export function compactMarket(row = {}, linkFor = defaultLink) {
  const ticker = row.symbol || row.marketTicker || row.ticker || "";
  const closeTime = row.closeTime || row.close_time || "";
  const hoursToClose = Date.parse(closeTime) ? (Date.parse(closeTime) - Date.now()) / 3600000 : null;
  return {
    ticker,
    event_ticker: row.eventTicker || "",
    title: [row.eventTitle, row.marketTitle || row.title].filter(Boolean).join(" | ") || ticker,
    yes_outcome: row.yesOutcome || "YES",
    yes_bid: round(row.yesBid ?? row.bid),
    yes_ask: round(row.yesAsk ?? row.ask),
    last_price: round(row.last),
    change_vs_previous_day_pct: round(row.priceChangePct, 1),
    volume_24h: round(row.volume24h, 0),
    open_interest: round(row.openInterest, 0),
    close_time: closeTime,
    hours_to_close: hoursToClose === null ? null : round(hoursToClose, 1),
    created_time: row.createdTime || "",
    open_in_kalshi_screener: linkFor(ticker)
  };
}

function sorter(sort = "volume") {
  const by = {
    volume: (a, b) => (b.volume_24h ?? -1) - (a.volume_24h ?? -1),
    closing_soon: (a, b) => (a.hours_to_close ?? Infinity) - (b.hours_to_close ?? Infinity),
    yes_price_high: (a, b) => (b.last_price ?? -1) - (a.last_price ?? -1),
    yes_price_low: (a, b) => (a.last_price ?? 2) - (b.last_price ?? 2),
    newest: (a, b) => (Date.parse(b.created_time) || 0) - (Date.parse(a.created_time) || 0)
  };
  return by[sort] || by.volume;
}

function round(value, digits = 4) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

export function defaultLink(ticker) {
  return makeExtensionLink(globalThis.process?.env?.KALSHI_SCREENER_EXTENSION_ID || "", ticker);
}

export function makeExtensionLink(extensionId, ticker) {
  if (!extensionId || !ticker) return null;
  return `chrome-extension://${extensionId}/open.html?market=${encodeURIComponent(ticker)}`;
}
