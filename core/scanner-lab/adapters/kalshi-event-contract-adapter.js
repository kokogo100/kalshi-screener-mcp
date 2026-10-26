import {
  getEventMarkets,
  getKlines,
  getMarketMetadata,
  getOrderBook as getKalshiOrderBook,
  getRecentTrades,
  getTradesSince,
  getSeriesInfo,
  getSeriesSettlementSources,
  getTickerSnapshot,
  normalizeKalshiMarket
} from "../../shared/kalshi-adapter.js";
import { KALSHI_CAPABILITY_PROFILES } from "../scanner-capabilities.js";
import { normalizeOhlcvRows } from "../scanner-indicators.js";

const LISTING_REUSE_MS = 120000;
const SERIES_REUSE_MS = 10 * 60 * 1000;
const SERIES_FALLBACK_LIMIT = 50;
// Above this many markets, recent trades come from one market-wide pass instead of a request per market.
const PER_MARKET_TRADE_LIMIT = 60;
// Only an open-market listing holds every open market of each non-combo event.
const EVENT_COMPLETE_SCOPES = new Set(["open_markets"]);

export function createKALSHIEventContractScannerAdapter() {
  let listing = { at: 0, scope: "", bySymbol: new Map() };
  let seriesSources = { at: 0, byTicker: {} };
  return {
    id: "kalshi_event_contracts",
    label: "Kalshi Event Contracts",
    supportedMarkets: [
      "open_markets",
      "closing_24h",
      "closing_7d",
      "multivariate_only",
      "exclude_multivariate",
      "watchlist",
      "saved_symbols"
    ],
    supportedTimeframes: ["1m", "15m", "1h", "1d"],
    supportedRequirements: Array.from(KALSHI_CAPABILITY_PROFILES.eventContracts.adapterRequirements),
    async listSymbols(scope = "open_markets", options = {}) {
      const rows = await getMarketMetadata(scope, options);
      listing = { at: Date.now(), scope, bySymbol: new Map(rows.map((row) => [row.symbol, row.raw])) };
      return rows;
    },
    async getTicker(symbols = [], options = {}) {
      // The listing already returned full market rows; refetching them by ticker doubled scan requests.
      const fresh = Date.now() - listing.at <= LISTING_REUSE_MS;
      const reused = fresh ? symbols.map((symbol) => listing.bySymbol.get(symbol)).filter(Boolean).map(normalizeKalshiMarket).filter(Boolean) : [];
      const reusedSymbols = new Set(reused.map((row) => row.symbol));
      const missing = symbols.filter((symbol) => !reusedSymbols.has(symbol));
      const fetched = missing.length ? await getTickerSnapshot(missing, options) : [];
      return keyBySymbol([...reused, ...fetched]);
    },
    async getEventSummaries(eventTickers = [], options = {}) {
      const wanted = Array.from(new Set(eventTickers.map((ticker) => String(ticker || "").trim()).filter(Boolean)));
      const fromListing = Date.now() - listing.at <= LISTING_REUSE_MS && EVENT_COMPLETE_SCOPES.has(listing.scope);
      const grouped = new Map();
      if (fromListing) {
        for (const raw of listing.bySymbol.values()) {
          const row = normalizeKalshiMarket(raw);
          if (!row?.eventTicker) continue;
          if (!grouped.has(row.eventTicker)) grouped.set(row.eventTicker, []);
          grouped.get(row.eventTicker).push(row);
        }
      }
      const entries = [];
      for (const [index, eventTicker] of wanted.entries()) {
        throwIfAborted(options.signal);
        const rows = grouped.get(eventTicker) || await getEventMarkets(eventTicker, { signal: options.signal });
        entries.push([eventTicker, summarizeEventMarkets(rows)]);
        emitMarketDataProgress(options, { phase: "events", label: "event", symbol: eventTicker, index, total: wanted.length });
      }
      return Object.fromEntries(entries);
    },
    // Kalshi keeps settlement sources on the series, not on market rows.
    async getSettlementSources(seriesTickers = [], options = {}) {
      const wanted = Array.from(new Set(seriesTickers.map((ticker) => String(ticker || "").trim()).filter(Boolean)));
      if (Date.now() - seriesSources.at > SERIES_REUSE_MS) {
        try {
          seriesSources = { at: Date.now(), byTicker: await getSeriesSettlementSources({ signal: options.signal }) };
        } catch (error) {
          if (error?.name === "AbortError") throw error;
          seriesSources = { at: 0, byTicker: { ...seriesSources.byTicker } };
        }
      }
      const missing = wanted.filter((ticker) => !(ticker in seriesSources.byTicker)).slice(0, SERIES_FALLBACK_LIMIT);
      for (const [index, ticker] of missing.entries()) {
        throwIfAborted(options.signal);
        try {
          const series = await getSeriesInfo(ticker, { signal: options.signal });
          if (series) seriesSources.byTicker[ticker] = series.settlementSources;
        } catch (error) {
          if (error?.name === "AbortError") throw error;
        }
        emitMarketDataProgress(options, { phase: "series", label: "series", symbol: ticker, index, total: missing.length });
      }
      return Object.fromEntries(wanted.filter((ticker) => ticker in seriesSources.byTicker).map((ticker) => [ticker, seriesSources.byTicker[ticker]]));
    },
    async getOhlcv(symbols = [], timeframe = "1h", limit = 240, options = {}) {
      const entries = [];
      for (const [index, symbol] of symbols.entries()) {
        throwIfAborted(options.signal);
        try {
          const payload = await getKlines(symbol, {
            interval: timeframe,
            limit,
            signal: options.signal,
            settings: options.settings
          });
          throwIfAborted(options.signal);
          entries.push([symbol, normalizeKalshiBarPayload(payload, limit)]);
        } catch (error) {
          if (isSkippableMarketDataError(error)) {
            entries.push([symbol, []]);
            emitOhlcvProgress(options, { symbol, timeframe, index, total: symbols.length, skipped: true });
            continue;
          }
          throw error;
        }
        emitOhlcvProgress(options, { symbol, timeframe, index, total: symbols.length, skipped: false });
      }
      return Object.fromEntries(entries);
    },
    async getOrderBook(symbols = [], depth = 10, options = {}) {
      const entries = [];
      for (const symbol of symbols) {
        throwIfAborted(options.signal);
        try {
          entries.push([symbol, await getKalshiOrderBook(symbol, { depth, signal: options.signal })]);
        } catch (error) {
          if (!isSkippableMarketDataError(error)) throw error;
          entries.push([symbol, null]);
        }
      }
      return Object.fromEntries(entries);
    },
    // Trades from the last windowSeconds, newest first, at most limit per market. Many markets are read in
    // one market-wide pass (one request per 1,000 trades) instead of one request per market.
    async getRecentTrades(symbols = [], limit = 100, options = {}) {
      const windowSeconds = Number(options.windowSeconds) > 0 ? Number(options.windowSeconds) : 3600;
      const minTs = Date.now() / 1000 - windowSeconds;
      if (symbols.length > PER_MARKET_TRADE_LIMIT) {
        if (windowSeconds > 3600) throw new Error(`Recent trades over more than 1 hour can be checked for up to ${PER_MARKET_TRADE_LIMIT} markets at a time. Add a narrower condition first, such as Closing in 24h or 24h volume.`);
        const sweep = await getTradesSince(minTs, { signal: options.signal, onPage: ({ pages, count }) =>
          options.onProgress?.({ phase: "trades", current: pages, total: 0, message: `Loading trades from the last ${Math.round(windowSeconds / 60)} minutes across all markets: ${count.toLocaleString("en-US")} trades so far` }) });
        throwIfAborted(options.signal);
        return Object.fromEntries(symbols.map((symbol) => {
          const rows = (sweep.byTicker.get(symbol) || []).slice(0, limit);
          // Without the full window a market with no trades seen yet is unknown, not zero.
          return [symbol, sweep.complete || rows.length >= limit ? rows : null];
        }));
      }
      const entries = [];
      for (const [index, symbol] of symbols.entries()) {
        throwIfAborted(options.signal);
        try {
          const rows = await getRecentTrades(symbol, {
            limit,
            minTs,
            signal: options.signal,
            settings: options.settings
          });
          throwIfAborted(options.signal);
          entries.push([symbol, normalizeKalshiTrades(rows)]);
          emitMarketDataProgress(options, { phase: "trades", label: "latest trade", symbol, index, total: symbols.length });
        } catch (error) {
          if (isSkippableMarketDataError(error)) {
            entries.push([symbol, null]);
            emitMarketDataProgress(options, { phase: "trades", label: "latest trade", symbol, index, total: symbols.length, skipped: true });
            continue;
          }
          throw error;
        }
      }
      return Object.fromEntries(entries);
    },
    async getSpreadHistory(symbols = []) {
      return Object.fromEntries(symbols.map((symbol) => [symbol, []]));
    },
    async getAccountSnapshot() {
      return { positions: [], holdings: [] };
    }
  };
}

export const createKalshiEventContractScannerAdapter = createKALSHIEventContractScannerAdapter;

export function normalizeKalshiBarPayload(payload = [], limit = 240) {
  const rows = (Array.isArray(payload) ? payload : []).map((row) => ({
    time: typeof row.time === "number" ? row.time : Date.parse(row.t || row.timestamp || ""),
    open: Number(row.o ?? row.open),
    high: Number(row.h ?? row.high),
    low: Number(row.l ?? row.low),
    close: Number(row.c ?? row.close),
    volume: Number(row.v ?? row.volume),
    vwap: Number(row.vw ?? row.vwap),
    trades: Number(row.n ?? row.trade_count)
  }));
  const normalized = normalizeOhlcvRows(rows);
  return normalized.slice(Math.max(0, normalized.length - limit));
}

export const normalizeKALSHIOhlcPayload = normalizeKalshiBarPayload;

function normalizeKalshiTrades(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((trade) => ({
    price: Number(trade.p ?? trade.price),
    volume: Number(trade.s ?? trade.size ?? trade.volume),
    time: typeof trade.time === "number" ? trade.time : Date.parse(trade.t || trade.timestamp || ""),
    side: trade.side || "unknown"
  })).filter((trade) => Number.isFinite(trade.price) && Number.isFinite(trade.volume));
}

export function summarizeEventMarkets(rows = []) {
  const sumOf = (key) => rows.length && rows.every((row) => Number.isFinite(row[key])) ? rows.reduce((total, row) => total + row[key], 0) : NaN;
  const priceOf = (row) => Number.isFinite(row.last) ? row.last : Number.isFinite(row.bid) && Number.isFinite(row.ask) ? (row.bid + row.ask) / 2 : NaN;
  const ranked = rows.filter((row) => Number.isFinite(priceOf(row))).sort((a, b) => priceOf(b) - priceOf(a));
  return {
    marketCount: rows.length,
    yesAskSum: sumOf("ask"),
    yesBidSum: sumOf("bid"),
    rankBySymbol: Object.fromEntries(ranked.map((row, index) => [row.symbol, index + 1]))
  };
}

function keyBySymbol(rows = []) {
  return Object.fromEntries(rows.map((row) => [row.symbol, row]));
}

function throwIfAborted(signal = null) {
  if (signal?.aborted) {
    throw new DOMException("Scanner operation was stopped.", "AbortError");
  }
}

function isSkippableMarketDataError(error) {
  const message = String(error?.message || error || "");
  return /Unsupported Kalshi market|invalid ticker|not found|market not found/i.test(message);
}

function emitOhlcvProgress(options = {}, { symbol, timeframe, index = 0, total = 0, skipped = false } = {}) {
  if (typeof options.onProgress !== "function") return;
  const current = index + 1;
  options.onProgress({
    phase: "ohlcv",
    timeframe,
    symbol,
    current,
    total,
    skipped,
    message: `${skipped ? "Skipped" : "Loaded"} ${timeframe} OHLC ${current}/${total}${symbol ? ` - ${symbol}` : ""}`
  });
}

function emitMarketDataProgress(options = {}, { phase, label, symbol, index = 0, total = 0, skipped = false } = {}) {
  if (typeof options.onProgress !== "function") return;
  const current = index + 1;
  options.onProgress({
    phase,
    symbol,
    current,
    total,
    skipped,
    message: `${skipped ? "Skipped" : "Loaded"} ${label} ${current}/${total}${symbol ? ` - ${symbol}` : ""}`
  });
}

