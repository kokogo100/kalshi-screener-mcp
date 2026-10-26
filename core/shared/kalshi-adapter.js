import { marketScopeById } from "./market-scopes.js";

export const KALSHI_READ_ONLY_BOUNDARY = [
  "Kalshi public event-contract market data and optional read-only account, positions, and WebSocket readiness only.",
  "No order placement, no order replacement, no order cancellation, no RFQ, no quote, no transfers, no deposits, no withdrawals, no trading execution, no auto-trading, no buy/sell signals, no personalized investment advice, no fee analysis, and no return predictions."
].join(" ");

export const KALSHI_PUBLIC_REST_BASE_URL = "https://external-api.kalshi.com/trade-api/v2";
export const KALSHI_PRODUCTION_REST_BASE_URL = "https://api.elections.kalshi.com/trade-api/v2";
export const KALSHI_DEMO_REST_BASE_URL = "https://external-api.demo.kalshi.co/trade-api/v2";
export const KALSHI_DEMO_REST_FALLBACK_BASE_URL = "https://demo-api.kalshi.co/trade-api/v2";
export const KALSHI_PRODUCTION_WS_URL = "wss://external-api-ws.kalshi.com/trade-api/ws/v2";
export const KALSHI_DEMO_WS_URL = "wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2";

const DEFAULT_SCAN_MARKET_LIMIT = 1000;
const REST_TIMEOUT_MS = 15000;
const REST_MIN_INTERVAL_MS = 110;
const REST_RATE_LIMIT_RETRIES = 4;
// Open Markets is about 165 pages of 1000; this leaves room to grow without unbounded memory.
const MAX_DISCOVERY_PAGES = 500;
const REST_RATE_LIMIT_BACKOFF_MS = 1000;
let restQueue = Promise.resolve();
let restNextAt = 0;

export function sanitizeKalshiSettings(settings = {}) {
  const scope = marketScopeById(settings.marketScope || "open_markets");
  const hasApiKey = Boolean(String(settings.apiKey || "").trim());
  const hasApiSecret = Boolean(String(settings.apiSecret || "").trim());
  const hasCredentials = hasApiKey && hasApiSecret;
  return {
    environment: "auto",
    productionBaseUrl: settings.productionBaseUrl || KALSHI_PUBLIC_REST_BASE_URL,
    productionFallbackBaseUrl: settings.productionFallbackBaseUrl || KALSHI_PRODUCTION_REST_BASE_URL,
    demoBaseUrl: settings.demoBaseUrl || KALSHI_DEMO_REST_BASE_URL,
    productionWebSocketUrl: settings.productionWebSocketUrl || KALSHI_PRODUCTION_WS_URL,
    demoWebSocketUrl: settings.demoWebSocketUrl || KALSHI_DEMO_WS_URL,
    connectionStatus: settings.connectionStatus || (hasCredentials ? "not_tested" : "not_configured"),
    connectionMessage: settings.connectionMessage || (hasCredentials
      ? "Saved. Test Connection to verify Kalshi read-only private access."
      : "Public Kalshi market data works without an API key. Add Key ID and RSA Private Key only for optional private snapshots and WebSocket readiness."),
    connectionCheckedAt: settings.connectionCheckedAt || "",
    accountMode: "auto",
    detectedAccountMode: normalizeKalshiDetectedEnvironment(settings.detectedAccountMode),
    marketDataFeed: "rest",
    marketScope: scope.id,
    scannerAutoResultsMode: settings.scannerAutoResultsMode !== false,
    hasApiKey,
    hasApiSecret,
    accountConnectionEnabled: hasCredentials,
    brokerLinkEnabled: false,
    readOnlyConfirmed: settings.readOnlyConfirmed === true,
    includePortfolioContext: settings.includePortfolioContext === true
  };
}

export const sanitizeKALSHISettings = sanitizeKalshiSettings;

export async function testKALSHIConnection(settings = {}, options = {}) {
  const checkedAt = new Date().toISOString();
  const marketPayload = await publicRestRequest("/markets", { status: "open", limit: 1 }, { signal: options.signal });
  const marketCount = Array.isArray(marketPayload?.markets) ? marketPayload.markets.length : 0;
  const credentials = normalizeKalshiCredentials(settings);

  if (!credentials.ready) {
    return {
      ok: true,
      status: "public_connected",
      message: `Kalshi public market data is reachable${marketCount ? "" : " but returned no markets"}. Private read-only access is not configured.`,
      checkedAt
    };
  }

  if (settings.readOnlyConfirmed !== true) {
    return {
      ok: false,
      status: "read_only_unconfirmed",
      message: "Tick \"I confirm these Kalshi credentials are used only for read-only observation\" above, then press Test Connection again.",
      checkedAt
    };
  }

  const failures = [];
  for (const environment of signedEnvironmentTestOrder(settings)) {
    try {
      const limits = await signedRestRequest({ ...settings, environment }, "/account/limits", {}, { signal: options.signal });
      const label = kalshiEnvironmentLabel(environment);
      return {
        ok: true,
        status: "connected",
        environment,
        detectedAccountMode: environment,
        message: `Kalshi ${label} read-only private access verified.`,
        checkedAt,
        limits
      };
    } catch (error) {
      failures.push({ environment, error });
    }
  }

  const message = failures.length
    ? `Kalshi read-only private access could not be verified for ${failures.map(formatEnvironmentFailure).join("; ")}.`
    : "Kalshi read-only private access could not be verified.";
  const error = new Error(message);
  error.failures = failures;
  throw error;
}

export async function getMarketMetadata(scopeId = "open_markets", options = {}) {
  const scope = marketScopeById(scopeId);
  if (scope.id === "watchlist" || scope.id === "saved_symbols") return [];
  const params = paramsForScope(scope, options.settings);
  const markets = await paginatedMarkets(params, { ...options, maxPages: scope.maxPages, scopeLabel: scope.label });
  const now = Date.now();
  const hours = closeWindowHours(scope);
  return markets.filter((market) => isTradableInWindow(market, hours, now)).map(normalizeMarketMetadata).filter(Boolean);
}

// A durable monitor can commit each cursor page before the worker is stopped.
export async function getMarketMetadataPage(scopeId = "open_markets", options = {}) {
  const scope = marketScopeById(scopeId);
  if (["watchlist", "saved_symbols"].includes(scope.id)) return { markets: [], cursor: "" };
  const now = options.now ?? Date.now();
  const payload = await marketPage({ ...paramsForScope(scope, options.settings, now), cursor: options.cursor || "" }, options.signal);
  if (!Array.isArray(payload?.markets) || payload.markets.some((row) => !row || !(row.ticker || row.market_ticker))) throw new Error("Kalshi returned an invalid market page.");
  const hours = closeWindowHours(scope);
  return { cursor: String(payload.cursor || ""), markets: payload.markets.filter((row) => isTradableInWindow(row, hours, now)).map(normalizeMarketMetadata).filter(Boolean) };
}

export async function getTickerSnapshot(symbols = [], options = {}) {
  const tickers = uniqueTickers(symbols);
  if (!tickers.length) return [];
  const rows = [];
  for (let offset = 0; offset < tickers.length; offset += 100) {
    throwIfAborted(options.signal);
    const batch = tickers.slice(offset, offset + 100);
    const markets = await paginatedMarkets({ tickers: batch.join(","), limit: 100 }, options);
    const wanted = new Set(batch);
    rows.push(...markets.map(normalizeMarketTicker).filter((row) => row && wanted.has(row.symbol)));
  }
  return Array.from(new Map(rows.map((row) => [row.symbol, row])).values());
}

// Close windows filter tradable statuses locally too, so dropping status keeps results correct.
async function marketPage(params, signal) {
  try {
    return await publicRestRequest("/markets", params, { signal });
  } catch (error) {
    if (error?.status !== 400 || !params.status || !params.max_close_ts) throw error;
    const { status, ...withoutStatus } = params;
    return publicRestRequest("/markets", withoutStatus, { signal });
  }
}

async function paginatedMarkets(params, options = {}) {
  const markets = new Map();
  const cursors = new Set();
  let cursor = "";
  let pages = 0;
  do {
    throwIfAborted(options.signal);
    const payload = await marketPage({ ...params, cursor }, options.signal);
    if (!Array.isArray(payload?.markets)) throw new Error("Kalshi returned an invalid market list. Search is incomplete.");
    for (const market of payload.markets) {
      const ticker = market.ticker || market.market_ticker;
      if (ticker) markets.set(ticker, market);
    }
    pages += 1;
    options.onProgress?.({ phase: "markets", pages, total: markets.size, message: `Loaded ${markets.size} contracts across ${pages} pages.` });
    cursor = String(payload.cursor || "");
    // Without a cap, millions of rows exhaust memory and crash the panel or the MCP server.
    if (cursor && pages >= (options.maxPages || MAX_DISCOVERY_PAGES)) {
      throw new Error(`${options.scopeLabel || "This scope"} has more than ${markets.size.toLocaleString("en-US")} markets, too many to scan at once. Use a narrower scope such as Closing in 24h, or search specific tickers.`);
    }
    if (cursor && cursors.has(cursor)) throw new Error("Kalshi repeated a pagination cursor. Search is incomplete.");
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return Array.from(markets.values());
}

export async function getKlines(ticker, { interval = "1h", limit = 240, signal = null, seriesTicker: knownSeriesTicker = "" } = {}) {
  if (!["1m", "15m", "1h", "1d"].includes(interval)) throw new Error(`Unsupported Kalshi candle interval: ${interval}`);
  // Market rows carry no series_ticker, so a per-market lookup would only repeat this derivation.
  const seriesTicker = knownSeriesTicker || seriesTickerFromMarketTicker(ticker);
  if (!seriesTicker) return [];
  const endTs = Math.floor(Date.now() / 1000);
  const periodInterval = timeframeToKalshiInterval(interval);
  const outputLimit = clampInteger(limit, 1, 1000);
  const multiplier = interval === "15m" ? 15 : 1;
  const startTs = endTs - periodInterval * 60 * Math.max(10, outputLimit * multiplier + multiplier);
  const payload = await publicRestRequest(`/series/${encodeURIComponent(seriesTicker)}/markets/${encodeURIComponent(ticker)}/candlesticks`, {
    period_interval: periodInterval,
    start_ts: startTs,
    end_ts: endTs
  }, { signal });
  if (!Array.isArray(payload?.candlesticks)) throw new Error("Kalshi returned an invalid candlesticks container.");
  const normalized = payload.candlesticks.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("Kalshi returned an invalid candlestick row.");
    const candle = normalizeCandlestick(row);
    if (!Number.isFinite(candle.time)) throw new Error("Kalshi returned a candlestick without a valid timestamp.");
    return candle;
  });
  const closed = closedCandleGrid(normalized, periodInterval, endTs);
  return (interval === "15m" ? aggregateCandlesticks(closed, 15, endTs) : closed).slice(-outputLimit);
}

export async function getRecentTrades(ticker, { limit = 100, signal = null, minTs = null } = {}) {
  const payload = await publicRestRequest("/markets/trades", {
    ticker,
    limit: clampInteger(limit, 1, 1000),
    ...(Number.isFinite(minTs) ? { min_ts: Math.floor(minTs) } : {})
  }, { signal });
  if (!Array.isArray(payload?.trades)) throw new Error("Kalshi returned an invalid trades container.");
  return payload.trades.map((trade) => {
    if (!trade || typeof trade !== "object" || Array.isArray(trade)) throw new Error("Kalshi returned an invalid trade row.");
    const row = normalizeTrade(trade);
    if (![row.price, row.volume, row.time].every(Number.isFinite) || row.price < 0 || row.price > 1 || row.volume < 0) {
      throw new Error("Kalshi returned a trade with invalid price, quantity, or timestamp.");
    }
    return row;
  });
}

// Every market's trades since minTs (seconds), newest first, 1000 per request. One market-wide pass
// replaces a request per market; complete is false when maxPages ran out before reaching minTs.
export async function getTradesSince(minTs, { signal = null, maxPages = 1000, onPage = null } = {}) {
  const byTicker = new Map();
  let cursor = "", pages = 0, count = 0;
  do {
    const payload = await publicRestRequest("/markets/trades", { limit: 1000, min_ts: Math.floor(minTs), ...(cursor ? { cursor } : {}) }, { signal });
    if (!Array.isArray(payload?.trades)) throw new Error("Kalshi returned an invalid trades container.");
    for (const trade of payload.trades) {
      const row = normalizeTrade(trade);
      if (!trade?.ticker || ![row.price, row.volume, row.time].every(Number.isFinite)) continue;
      if (!byTicker.has(trade.ticker)) byTicker.set(trade.ticker, []);
      byTicker.get(trade.ticker).push(row);
      count++;
    }
    cursor = payload.cursor || "";
    pages++;
    onPage?.({ pages, count, oldest: payload.trades.at(-1)?.created_time || "" });
  } while (cursor && pages < maxPages);
  return { byTicker, complete: !cursor, pages, count };
}

export async function getOrderBook(ticker, { depth = 10, signal = null } = {}) {
  const payload = await publicRestRequest(`/markets/${encodeURIComponent(ticker)}/orderbook`, {
    depth: clampInteger(depth, 1, 100)
  }, { signal });
  return normalizeOrderBook(payload);
}

export async function getAccountSnapshot(settings = {}, options = {}) {
  const credentials = normalizeKalshiCredentials(settings);
  if (!credentials.ready || settings.readOnlyConfirmed !== true) {
    throw new Error("Add Kalshi Key ID and RSA Private Key, then confirm read-only use before loading private snapshots.");
  }
  const [balancePayload, positionsPayload] = await Promise.all([
    signedRestRequest(settings, "/portfolio/balance", {}, { signal: options.signal }),
    signedRestRequest(settings, "/portfolio/positions", { limit: 100 }, { signal: options.signal })
  ]);
  return normalizeAccountSnapshot(balancePayload, positionsPayload);
}

export async function createKalshiTickerStream(symbols = [], handlers = {}, options = {}) {
  const selected = uniqueTickers(symbols);
  const message = "Kalshi WebSocket readiness is planned for selected market live observation. Direct browser-extension signed-header support must be verified; using REST polling fallback for now.";
  handlers.onStatus?.("off", message);
  return {
    symbols: selected,
    status: "off",
    message,
    close() {
      handlers.onStatus?.("off", "Kalshi WebSocket stream closed.");
    }
  };
}

export function timeframeToKalshiInterval(timeframe) {
  if (timeframe === "1m" || timeframe === "5m" || timeframe === "15m" || timeframe === "30m") return 1;
  if (timeframe === "1d" || timeframe === "1w" || timeframe === "1mo") return 1440;
  return 60;
}

function paramsForScope(scope = {}, settings = {}, now = Date.now()) {
  const limit = clampInteger(settings?.marketLimit || DEFAULT_SCAN_MARKET_LIMIT, 1, 1000);
  const hours = closeWindowHours(scope);
  // status=open with a close window cuts a 7-day scan from hundreds of pages to dozens.
  // Kalshi once rejected that pair, so marketPage retries without status on a 400.
  const params = hours === null
    ? { status: "open", limit }
    : { status: "open", limit, min_close_ts: Math.floor(now / 1000), max_close_ts: Math.floor(now / 1000) + hours * 3600 };
  if (scope.seriesTicker) params.series_ticker = scope.seriesTicker;
  if (scope.eventTicker) params.event_ticker = scope.eventTicker;
  if (scope.mveFilter) params.mve_filter = scope.mveFilter;
  return params;
}

function closeWindowHours(scope = {}) {
  return scope.id === "closing_24h" ? 24 : scope.id === "closing_7d" ? 168 : null;
}

const NON_TRADABLE_STATUSES = new Set(["initialized", "unopened", "inactive", "paused", "closed", "determined", "disputed", "amended", "finalized", "settled"]);

function isTradableInWindow(market = {}, hours = null, now = Date.now()) {
  if (hours === null) return true;
  if (NON_TRADABLE_STATUSES.has(String(market.status || "").toLowerCase())) return false;
  const close = Date.parse(market.close_time || "");
  return Number.isFinite(close) && close >= now && close <= now + hours * 3600000;
}

export async function publicRestRequest(path, params = {}, options = {}) {
  const baseUrls = [KALSHI_PUBLIC_REST_BASE_URL, KALSHI_PRODUCTION_REST_BASE_URL];
  let lastError = null;
  for (const baseUrl of baseUrls) {
    try {
      return await withRateLimitRetry(() => fetchJson(baseUrl, path, params, {}, options), options.signal);
    } catch (error) {
      lastError = error;
      if (![404, 410, 429, 500, 502, 503, 504].includes(error?.status)) break;
    }
  }
  throw lastError || new Error("Kalshi public REST request failed.");
}

async function signedRestRequest(settings = {}, path, params = {}, options = {}) {
  const environment = signedEnvironmentForSettings(settings);
  const baseUrls = signedBaseUrlsForEnvironment(environment, settings);
  let lastError = null;
  for (const baseUrl of baseUrls) {
    try {
      const headers = await kalshiAuthHeaders(settings, path);
      return await fetchJson(baseUrl, path, params, headers, options);
    } catch (error) {
      lastError = error;
      if (![404, 410, 429, 500, 502, 503, 504].includes(error?.status)) break;
    }
  }
  throw lastError || new Error("Kalshi signed REST request failed.");
}

function signedBaseUrlsForEnvironment(environment = "production", settings = {}) {
  if (normalizeKalshiEnvironment(environment) === "demo") {
    return [
      settings.demoBaseUrl || KALSHI_DEMO_REST_BASE_URL,
      settings.demoFallbackBaseUrl || KALSHI_DEMO_REST_FALLBACK_BASE_URL
    ].filter((url, index, list) => url && list.indexOf(url) === index);
  }
  return [settings.productionFallbackBaseUrl || KALSHI_PRODUCTION_REST_BASE_URL].filter(Boolean);
}

function normalizeKalshiEnvironment(environment = "") {
  const value = String(environment || "").trim().toLowerCase();
  if (value === "demo") return "demo";
  if (value === "production") return "production";
  return "auto";
}

function normalizeKalshiDetectedEnvironment(environment = "") {
  const value = normalizeKalshiEnvironment(environment);
  return value === "auto" ? "" : value;
}

function signedEnvironmentForSettings(settings = {}) {
  return normalizeKalshiDetectedEnvironment(settings.environment)
    || normalizeKalshiDetectedEnvironment(settings.detectedAccountMode) || "production";
}

function signedEnvironmentTestOrder(settings = {}) {
  const selected = normalizeKalshiDetectedEnvironment(settings.environment);
  if (selected) return [selected];
  return ["production", "demo"];
}

function kalshiEnvironmentLabel(environment = "") {
  return normalizeKalshiEnvironment(environment) === "demo" ? "Demo" : "Production";
}

function formatEnvironmentFailure({ environment, error } = {}) {
  return `${kalshiEnvironmentLabel(environment)} (${error?.message || "failed"})`;
}

function fetchJson(baseUrl, path, params = {}, headers = {}, options = {}) {
  return queueRestRequest(async () => {
    throwIfAborted(options.signal);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REST_TIMEOUT_MS);
    const abort = () => controller.abort(options.signal?.reason);
    if (options.signal) {
      if (options.signal.aborted) controller.abort();
      options.signal.addEventListener("abort", abort, { once: true });
    }
    try {
      const url = new URL(path.replace(/^\//, ""), `${baseUrl.replace(/\/$/, "")}/`);
      Object.entries(cleanParams(params)).forEach(([key, value]) => url.searchParams.set(key, value));
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...headers
        },
        signal: controller.signal
      });
      const text = await response.text();
      let payload = null;
      try { payload = text ? JSON.parse(text) : null; } catch {
        const error = new Error(`Kalshi HTTP ${response.status}: invalid JSON response.`);
        error.status = response.status;
        throw error;
      }
      if (!response.ok) {
        // Kalshi nests errors as { error: { code, message, details } }.
        const detail = payload?.error?.details || payload?.error?.message || payload?.message || (typeof payload?.error === "string" ? payload.error : "");
        const error = new Error(detail ? `Kalshi HTTP ${response.status}: ${detail}` : `Kalshi HTTP ${response.status}`);
        error.status = response.status;
        error.payload = payload;
        throw error;
      }
      return payload;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
    }
  });
}

async function kalshiAuthHeaders(settings = {}, path = "") {
  const credentials = normalizeKalshiCredentials(settings);
  if (!credentials.ready) throw new Error("Kalshi credentials are not configured.");
  const timestamp = Date.now().toString();
  const signingPath = `/trade-api/v2/${String(path || "").replace(/^\//, "").split("?")[0]}`;
  const message = `${timestamp}GET${signingPath}`;
  const signature = await signRsaPss(credentials.privateKeyPem, message);
  return {
    "KALSHI-ACCESS-KEY": credentials.apiKey,
    "KALSHI-ACCESS-TIMESTAMP": timestamp,
    "KALSHI-ACCESS-SIGNATURE": signature
  };
}

async function signRsaPss(privateKeyPem, message) {
  const cryptoApi = globalThis.crypto?.subtle;
  if (!cryptoApi) throw new Error("Request signing is unavailable in this browser context.");
  const { key, algorithm } = await importKalshiPrivateKey(cryptoApi, privateKeyPem);
  const signature = await cryptoApi.sign(algorithm, key, new TextEncoder().encode(message));
  return bytesToBase64(new Uint8Array(signature));
}

// Kalshi RSA downloads are PKCS#1 ("BEGIN RSA PRIVATE KEY"); Ed25519 downloads are PKCS#8.
// The PKCS#8 header does not say which algorithm it holds, so try RSA-PSS first, then Ed25519.
export async function importKalshiPrivateKey(cryptoApi, privateKeyPem = "") {
  const pem = String(privateKeyPem || "");
  const der = new Uint8Array(pemToArrayBuffer(pem));
  if (!der.length) throw new Error("Kalshi private key is empty or not PEM encoded.");
  if (/-----BEGIN RSA PRIVATE KEY-----/.test(pem)) {
    const key = await cryptoApi.importKey("pkcs8", wrapPkcs1RsaKey(der), { name: "RSA-PSS", hash: "SHA-256" }, false, ["sign"]);
    return { key, algorithm: { name: "RSA-PSS", saltLength: 32 } };
  }
  try {
    const key = await cryptoApi.importKey("pkcs8", der, { name: "RSA-PSS", hash: "SHA-256" }, false, ["sign"]);
    return { key, algorithm: { name: "RSA-PSS", saltLength: 32 } };
  } catch (rsaError) {
    try {
      const key = await cryptoApi.importKey("pkcs8", der, { name: "Ed25519" }, false, ["sign"]);
      return { key, algorithm: { name: "Ed25519" } };
    } catch {
      throw new Error("Kalshi private key could not be read as an RSA or Ed25519 key. Ed25519 keys need Chrome 137 or later.");
    }
  }
}

const RSA_ENCRYPTION_ALGORITHM_ID = [0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00];

function wrapPkcs1RsaKey(pkcs1) {
  const version = [0x02, 0x01, 0x00];
  const octetString = [0x04, ...derLength(pkcs1.length), ...pkcs1];
  const body = [...version, ...RSA_ENCRYPTION_ALGORITHM_ID, ...octetString];
  return new Uint8Array([0x30, ...derLength(body.length), ...body]).buffer;
}

function derLength(length) {
  if (length < 0x80) return [length];
  const bytes = [];
  for (let value = length; value > 0; value >>= 8) bytes.unshift(value & 0xff);
  return [0x80 | bytes.length, ...bytes];
}

function normalizeMarketMetadata(market = {}) {
  const row = normalizeMarketTicker(market);
  if (!row?.symbol) return null;
  return {
    symbol: row.symbol,
    marketTicker: row.marketTicker,
    eventTicker: row.eventTicker,
    seriesTicker: row.seriesTicker,
    name: row.marketTitle || row.restName || row.symbol,
    label: row.marketTitle || row.restName || row.symbol,
    status: row.status,
    marketTitle: row.marketTitle,
    eventTitle: row.eventTitle,
    raw: market
  };
}

export function normalizeKalshiMarket(market = {}) {
  return normalizeMarketTicker(market);
}

// Kalshi accepts one event_ticker per request, so callers should only ask for events they need.
// Series carry the settlement sources and contract terms that market rows do not.
export async function getSeriesInfo(seriesTicker, options = {}) {
  const ticker = String(seriesTicker || "").trim();
  if (!ticker) return null;
  const payload = await publicRestRequest(`/series/${encodeURIComponent(ticker)}`, {}, { signal: options.signal });
  return normalizeSeries(payload?.series, ticker);
}

// One request lists every series with its settlement sources, so scans need not ask series by series.
export async function getSeriesSettlementSources(options = {}) {
  const payload = await publicRestRequest("/series", {}, { signal: options.signal });
  const rows = Array.isArray(payload?.series) ? payload.series : [];
  return Object.fromEntries(rows.map((series) => normalizeSeries(series)).filter(Boolean)
    .map((series) => [series.seriesTicker, series.settlementSources]));
}

function normalizeSeries(series, fallbackTicker = "") {
  if (!series || typeof series !== "object") return null;
  const ticker = String(series.ticker || fallbackTicker || "").trim();
  if (!ticker) return null;
  return {
    seriesTicker: ticker,
    title: series.title || "",
    category: series.category || "",
    settlementSources: (Array.isArray(series.settlement_sources) ? series.settlement_sources : [])
      .map((source) => ({ name: String(source?.name || "").trim(), url: String(source?.url || "").trim() }))
      .map((source) => ({ ...source, url: /^https:\/\/\S+$/i.test(source.url) ? source.url : "" }))
      .filter((source) => source.name || source.url),
    contractUrl: series.contract_url || "",
    contractTermsUrl: series.contract_terms_url || ""
  };
}

export async function getEventMarkets(eventTicker, options = {}) {
  const ticker = String(eventTicker || "").trim();
  if (!ticker) return [];
  const markets = await paginatedMarkets({ event_ticker: ticker, status: "open", limit: 1000 }, { signal: options.signal });
  return markets.map(normalizeMarketTicker).filter(Boolean);
}

function normalizeMarketTicker(market = {}) {
  if (!market || typeof market !== "object") return null;
  const symbol = String(market.ticker || market.market_ticker || "").trim();
  if (!symbol) return null;
  const yesBid = dollars(market.yes_bid_dollars, market.yes_bid);
  const yesAsk = dollars(market.yes_ask_dollars, market.yes_ask);
  const noBid = dollars(market.no_bid_dollars, market.no_bid);
  const noAsk = dollars(market.no_ask_dollars, market.no_ask);
  const last = dollars(market.last_price_dollars, market.last_price);
  const open = dollars(market.open_price_dollars, market.open_price);
  const previous = dollars(market.previous_price_dollars, market.previous_price);
  const spread = Number.isFinite(yesBid) && Number.isFinite(yesAsk) ? yesAsk - yesBid : NaN;
  const mid = Number.isFinite(yesBid) && Number.isFinite(yesAsk) ? (yesAsk + yesBid) / 2 : NaN;
  // Kalshi markets expose the previous day's price, not an open price.
  const reference = Number.isFinite(previous) && previous !== 0 ? previous : open;
  const priceChangePct = Number.isFinite(reference) && reference !== 0 && Number.isFinite(last) ? ((last - reference) / reference) * 100 : NaN;
  const yesBidSize = numberValue(market.yes_bid_size_fp, market.yes_bid_size);
  const yesAskSize = numberValue(market.yes_ask_size_fp, market.yes_ask_size);
  const closeTime = market.close_time || market.closeTime || "";
  const eventTicker = market.event_ticker || "";
  const seriesTicker = market.series_ticker || seriesTickerFromMarketTicker(symbol);
  // title/subtitle are deprecated upstream; keep them only as fallbacks.
  const marketTitle = market.title || market.market_title || market.yes_sub_title || market.subtitle || symbol;
  const eventTitle = market.event_title || market.event_sub_title || "";
  const rulesPrimary = market.rules_primary || market.rulesPrimary || "";
  const rulesSecondary = market.rules_secondary || market.rulesSecondary || "";
  const rulesSummary = [rulesPrimary, rulesSecondary].filter(Boolean).join(" ");
  return {
    symbol,
    marketTicker: symbol,
    restName: market.title || market.subtitle || market.market_title || symbol,
    source: "kalshi_market",
    last,
    bid: yesBid,
    ask: yesAsk,
    open,
    high24h: dollars(market.high_price_dollars, market.high_price),
    low24h: dollars(market.low_price_dollars, market.low_price),
    vwap24h: NaN,
    volume24h: numberValue(market.volume_24h_fp, market.volume_24h),
    tradeCount24h: NaN,
    quoteVolume24h: numberValue(market.dollar_volume_24h),
    spreadPct: Number.isFinite(spread) && Number.isFinite(mid) && mid !== 0 ? (spread / mid) * 100 : NaN,
    rangePct24h: NaN,
    priceChangePct,
    yesBid,
    yesAsk,
    noBid,
    noAsk,
    yesBidSize,
    yesAskSize,
    noBidSize: numberValue(market.no_bid_size_fp, market.no_bid_size),
    noAskSize: numberValue(market.no_ask_size_fp, market.no_ask_size),
    yesOutcome: market.yes_sub_title || market.yesSubtitle || "YES",
    noOutcome: market.no_sub_title || market.noSubtitle || "NO",
    lastPrice: last,
    previousPrice: previous,
    liquidity: topOfBookLiquidity(yesBid, yesBidSize, yesAsk, yesAskSize),
    openInterest: numberValue(market.open_interest_fp, market.open_interest),
    marketType: market.market_type || "",
    status: market.status || "",
    eventTicker,
    seriesTicker,
    title: marketTitle,
    marketTitle,
    eventTitle,
    rulesPrimary,
    rulesSecondary,
    rulesSummary,
    settlementSource: market.settlement_source || market.settlementSource || "",
    result: market.result || market.contract_result || market.contractResult || "",
    canCloseEarly: Boolean(market.can_close_early || market.canCloseEarly || market.early_close_condition || market.earlyCloseCondition),
    relatedMarketCount: numberValue(market.related_markets_count, market.relatedMarketsCount, market.event_market_count, market.eventMarketCount, market.market_count, market.marketCount),
    isMultivariate: Boolean(market.is_multivariate_event || market.is_multivariate || market.mve_event_ticker || market.mve_collection_ticker || market.collection_ticker),
    closeTime,
    createdTime: market.created_time || market.createdTime || "",
    openTime: market.open_time || market.openTime || "",
    raw: market
  };
}

function normalizeCandlestick(row = {}) {
  const price = row.price || row;
  const time = numberValue(row.end_period_ts, row.ts, row.time);
  const timestamp = Number.isFinite(time) ? time * 1000 : Date.parse(row.timestamp || "");
  return {
    time: timestamp,
    open: dollars(price.open_dollars, price.open),
    high: dollars(price.high_dollars, price.high),
    low: dollars(price.low_dollars, price.low),
    close: dollars(price.close_dollars, price.close),
    volume: numberValue(row.volume_fp, row.volume),
    vwap: NaN,
    trades: NaN,
    openInterest: numberValue(row.open_interest_fp, row.open_interest)
  };
}

function closedCandleGrid(rows, minutes, endTs) {
  const duration = minutes * 60000;
  const lastClosed = Math.floor(endTs * 1000 / duration) * duration;
  const byTime = new Map();
  for (const row of rows) {
    if (row.time % duration !== 0) throw new Error("Kalshi returned a candlestick off the expected period boundary.");
    if (byTime.has(row.time)) throw new Error("Kalshi returned duplicate candlestick timestamps.");
    if (row.time <= lastClosed) byTime.set(row.time, row);
  }
  if (!byTime.size) return [];
  const first = Math.min(...byTime.keys());
  if ((lastClosed - first) / duration > 10000) throw new Error("Kalshi returned candlesticks outside the requested history window.");
  const result = [];
  for (let time = first; time <= lastClosed; time += duration) {
    result.push(byTime.get(time) || { time, open: NaN, high: NaN, low: NaN, close: NaN, volume: NaN, vwap: NaN, trades: NaN });
  }
  return result;
}

function aggregateCandlesticks(rows, minutes, endTs) {
  const duration = minutes * 60000;
  const groups = new Map();
  for (const row of [...rows].sort((a, b) => a.time - b.time)) {
    const end = Math.ceil(row.time / duration) * duration;
    if (end > endTs * 1000) continue;
    if (!groups.has(end)) groups.set(end, []);
    groups.get(end).push(row);
  }
  return Array.from(groups, ([time, bars]) => {
    const complete = bars.length === minutes && bars.every((bar, index) => bar.time === time - (minutes - 1 - index) * 60000);
    const prices = complete && bars.every((bar) => [bar.open, bar.high, bar.low, bar.close].every(Number.isFinite));
    const volumes = complete && bars.every((bar) => Number.isFinite(bar.volume));
    return {
      time,
      open: prices ? bars[0].open : NaN,
      high: prices ? Math.max(...bars.map((bar) => bar.high)) : NaN,
      low: prices ? Math.min(...bars.map((bar) => bar.low)) : NaN,
      close: prices ? bars.at(-1).close : NaN,
      volume: volumes ? bars.reduce((total, bar) => total + bar.volume, 0) : NaN,
      vwap: NaN,
      trades: NaN,
      openInterest: bars.at(-1).openInterest
    };
  });
}

function normalizeTrade(trade = {}) {
  const price = dollars(trade.yes_price_dollars, trade.yes_price);
  const side = String(trade.taker_outcome_side || trade.taker_side || "").toLowerCase();
  return {
    price,
    volume: numberValue(trade.count_fp, trade.count),
    side: side === "yes" ? "buy" : side === "no" ? "sell" : "unknown",
    outcomeSide: side || "unknown",
    time: Date.parse(trade.created_time || trade.ts || ""),
    raw: trade
  };
}

function normalizeOrderBook(payload = {}) {
  const book = payload?.orderbook_fp ?? payload?.orderbook;
  if (!book || typeof book !== "object" || Array.isArray(book)) throw new Error("Kalshi returned an invalid orderbook container.");
  const yesRows = book.yes_dollars ?? book.yes;
  const noRows = book.no_dollars ?? book.no;
  if (!Array.isArray(yesRows) || !Array.isArray(noRows)) throw new Error("Kalshi returned invalid orderbook sides.");
  const yesBids = normalizeBookSide(yesRows, Boolean(book.yes_dollars)).sort((a, b) => b.price - a.price);
  const noBids = normalizeBookSide(noRows, Boolean(book.no_dollars)).sort((a, b) => b.price - a.price);
  const bestNoBid = noBids[0]?.price;
  const bestYesBid = yesBids[0]?.price;
  return {
    bids: yesBids,
    asks: noBids.map((row) => ({ price: 1 - row.price, volume: row.volume })),
    yesBids,
    noBids,
    bestYesBid,
    impliedYesAsk: Number.isFinite(bestNoBid) ? 1 - bestNoBid : NaN,
    raw: payload
  };
}

function normalizeBookSide(rows = [], inDollars = true) {
  return rows.map((row) => {
    if (!Array.isArray(row) || row.length !== 2) throw new Error("Kalshi returned an invalid orderbook row.");
    const price = inDollars ? numberValue(row[0]) : dollars(undefined, row[0]);
    const volume = numberValue(row[1]);
    if (![price, volume].every(Number.isFinite) || price < 0 || price > 1 || volume < 0) throw new Error("Kalshi returned an invalid orderbook price or quantity.");
    return { price, volume };
  });
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw new DOMException("Scanner operation was stopped.", "AbortError");
}

function normalizeAccountSnapshot(balancePayload = {}, positionsPayload = {}) {
  const positions = Array.isArray(positionsPayload?.market_positions) ? positionsPayload.market_positions : [];
  const normalizedPositions = positions.map((position) => {
    const marketTicker = position.ticker || position.market_ticker || "";
    return {
      asset: marketTicker,
      displayAsset: marketTicker,
      marketTicker,
      marketSymbol: marketTicker,
      amount: numberValue(position.position_fp, position.position),
      rawAmount: String(position.position_fp ?? position.position ?? ""),
      avgEntryPriceUsd: dollars(position.average_open_price_dollars, position.average_open_price),
      currentPriceUsd: dollars(position.last_price_dollars, position.last_price),
      currentValueUsd: dollars(position.market_exposure_dollars, position.market_exposure),
      profitLossUsd: dollars(position.realized_pnl_dollars, position.realized_pnl),
      profitLossPct: "",
      raw: position
    };
  });
  const totalExposureUsd = sumFinite(normalizedPositions.map((position) => position.currentValueUsd));
  return {
    checkedAt: new Date().toISOString(),
    accountType: "Kalshi read-only",
    canTrade: false,
    summary: {
      portfolioValueUsd: dollars(balancePayload.portfolio_value_dollars, balancePayload.portfolio_value),
      equityUsd: "",
      cashUsd: dollars(balancePayload.balance_dollars, balancePayload.balance),
      buyingPowerUsd: "",
      totalMarketValueUsd: totalExposureUsd,
      totalProfitLossUsd: sumFinite(normalizedPositions.map((position) => position.profitLossUsd)),
      totalProfitLossPct: ""
    },
    positions: normalizedPositions,
    holdings: normalizedPositions
  };
}

function normalizeKalshiCredentials(settings = {}) {
  const apiKey = String(settings.apiKey || "").trim();
  const privateKeyPem = String(settings.apiSecret || "").trim();
  return {
    apiKey,
    privateKeyPem,
    ready: Boolean(apiKey && privateKeyPem)
  };
}

// Kalshi no longer reports a liquidity figure; use dollars resting at the best YES bid and ask.
function topOfBookLiquidity(bid, bidSize, ask, askSize) {
  const parts = [[bid, bidSize], [ask, askSize]].filter(([price, size]) => Number.isFinite(price) && Number.isFinite(size));
  return parts.length ? parts.reduce((total, [price, size]) => total + price * size, 0) : NaN;
}

function seriesTickerFromMarketTicker(ticker = "") {
  return String(ticker || "").split("-")[0] || "";
}

function dollars(value, centsFallback) {
  const parsed = numberValue(value);
  if (Number.isFinite(parsed)) return parsed;
  const centsValue = numberValue(centsFallback);
  return Number.isFinite(centsValue) ? centsValue / 100 : NaN;
}

function cents(value) {
  const parsed = numberValue(value);
  return Number.isFinite(parsed) ? parsed / 100 : "";
}

function sumFinite(values = []) {
  const finite = values.map(Number).filter(Number.isFinite);
  return finite.length ? finite.reduce((total, value) => total + value, 0) : "";
}

function numberValue(...values) {
  for (const value of values) {
    if (!(typeof value === "number" || typeof value === "string" && value.trim() !== "")) continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return NaN;
}

function uniqueTickers(symbols = []) {
  return Array.from(new Set((Array.isArray(symbols) ? symbols : [symbols]).map((symbol) => {
    const value = symbol && typeof symbol === "object" ? symbol.marketTicker || symbol.symbol || symbol.ticker || "" : symbol;
    return String(value || "").trim();
  }).filter(Boolean)));
}

function cleanParams(params = {}) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

function clampInteger(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function pemToArrayBuffer(pem = "") {
  const body = String(pem || "")
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const binary = atobCompat(body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

function atobCompat(value = "") {
  if (typeof atob === "function") return atob(value);
  return Buffer.from(value, "base64").toString("binary");
}

function bytesToBase64(bytes) {
  if (typeof btoa === "function") {
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }
  return Buffer.from(bytes).toString("base64");
}

// A long scan can hit Kalshi's per-second read limit; back off and slow the shared queue instead of failing the scan.
async function withRateLimitRetry(request, signal) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await request();
    } catch (error) {
      if (error?.status !== 429 || attempt >= REST_RATE_LIMIT_RETRIES || signal?.aborted) throw error;
      const waitMs = REST_RATE_LIMIT_BACKOFF_MS * 2 ** attempt;
      restNextAt = Math.max(restNextAt, Date.now() + waitMs);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      throwIfAborted(signal);
    }
  }
}

function queueRestRequest(task) {
  const queued = restQueue.then(async () => {
    const waitMs = Math.max(0, restNextAt - Date.now());
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    restNextAt = Date.now() + REST_MIN_INTERVAL_MS;
    return task();
  });
  restQueue = queued.catch(() => null);
  return queued;
}
