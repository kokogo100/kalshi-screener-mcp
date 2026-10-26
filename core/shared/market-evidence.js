import { getSeriesInfo, getTickerSnapshot, normalizeKalshiMarket, publicRestRequest } from "./kalshi-adapter.js";

export const EVIDENCE_DEFAULTS = { events: 20, maxEvents: 40, priceBand: 0.05, maxHoursBeforeClose: 720 };
const HOUR = 3600;
// Kalshi's batch candlestick endpoint rejects more than 100 markets per request.
const BATCH_MARKETS = 100;
// Historical candles are one request per market; series with many strikes per event would need thousands.
const HISTORICAL_CANDLE_BUDGET = 200;
const SETTLED_PAGES = 10;
const RECENT_EVENTS_SHOWN = 10;
// Spreads wider than this make the mid price meaningless, so the last trade is used instead.
const MAX_MID_SPREAD = 0.1;

// Shared by the extension chat and the MCP server, which passes its own market formatter.
// Historical evidence for one market from settled events in its own series.
// Every number is computed here so the AI explains it instead of inventing probabilities.
export async function getMarketEvidence(ticker, options = {}) {
  const { signal, formatMarket = compactRow } = options;
  const eventCount = clamp(Math.round(options.events ?? EVIDENCE_DEFAULTS.events), 1, EVIDENCE_DEFAULTS.maxEvents);
  const band = clamp(options.priceBand ?? EVIDENCE_DEFAULTS.priceBand, 0.01, 0.2);
  const [row] = await getTickerSnapshot([ticker], { signal });
  if (!row) throw new Error(`Kalshi market ${ticker} was not found.`);
  if (!row.seriesTicker) throw new Error(`Kalshi market ${ticker} has no series, so there is no history to compare.`);

  const market = formatMarket(row);
  const current = currentPrice(row);
  // Markets that can close early carry a far-off close_time; past events record when they really closed.
  const anchorMs = decisionTime(row.raw || {});
  const hoursToAnchor = Number.isFinite(anchorMs) ? (anchorMs - Date.now()) / 3600000 : market.hours_to_close;
  const lookbackHours = clamp(options.hoursBeforeClose ?? hoursToAnchor ?? 24, 1, EVIDENCE_DEFAULTS.maxHoursBeforeClose);
  const notes = [];
  const fetcher = createFetcher(signal, notes);

  const series = await getSeriesInfo(row.seriesTicker, { signal }).catch(() => null);
  const events = (await settledEvents(row.seriesTicker, eventCount + 1, fetcher))
    .filter((event) => event.eventTicker !== row.eventTicker)
    .slice(0, eventCount);
  for (const event of events) await priceEventAt(event, event.closeTs - Math.round(lookbackHours * HOUR), fetcher);

  const priced = events.filter((event) => event.markets.some((entry) => entry.price !== null));
  const comparable = current === null ? [] : priced
    .map((event) => ({ event, match: closestPriced(event.markets, current, band) }))
    .filter((entry) => entry.match);
  const comparableYes = comparable.filter((entry) => entry.match.result === "yes").length;
  const yesRate = ratio(comparableYes, comparable.length);
  const favorites = priced.map((event) => favoriteOf(event.markets));
  const favoriteWins = favorites.filter((entry) => entry.result === "yes").length;

  if (!events.length) notes.push("No settled events were found for this series, so there is no history to compare.");
  if (events.length && priced.length < events.length) notes.push(`${events.length - priced.length} of ${events.length} settled events had no price ${formatHours(lookbackHours)} before close (no trades or quotes yet, or the request failed).`);
  if (current === null) notes.push("This market has no usable current price, so the similar-price comparison was skipped.");
  if (options.hoursBeforeClose === undefined && Number.isFinite(hoursToAnchor) && hoursToAnchor < 1) notes.push("This market's expected expiration has already passed, so its outcome may be decided or in progress; history is compared 1 hour before close.");

  return {
    market: { ...market, current_price: round(current), price_basis: current === null ? null : currentBasis(row) },
    theme: {
      series_ticker: row.seriesTicker,
      series_title: series?.title || "",
      category: series?.category || ""
    },
    method: {
      compared_at: `${formatHours(lookbackHours)} before each past event closed`,
      hours_before_close: round(lookbackHours, 1),
      price_band: round(band),
      events_requested: eventCount,
      price_basis: `Mid of the YES bid and ask when the spread is ${MAX_MID_SPREAD * 100}c or less, otherwise the last trade.`,
      counting: "One market per past event, the one priced closest to the current price, so related outcomes in an event are not counted twice."
    },
    similar_price_history: current === null ? null : {
      events_checked: priced.length,
      comparable_events: comparable.length,
      settled_yes: comparableYes,
      yes_rate: round(yesRate),
      range_95: rangeOf(comparableYes, comparable.length),
      current_price: round(current),
      history_minus_price: yesRate === null ? null : round(yesRate - current),
      confidence: confidenceFor(comparable.length),
      summary: comparable.length
        ? `${comparable.length} of the last ${priced.length} settled events in this series had a market priced within ${cents(band)} of ${cents(current)} at ${formatHours(lookbackHours)} before close; ${comparableYes} of those settled YES (${percent(yesRate)}, 95% range ${rangeText(comparableYes, comparable.length)}).`
        : `None of the last ${priced.length} settled events in this series had a market priced within ${cents(band)} of ${cents(current)} at ${formatHours(lookbackHours)} before close.`
    },
    favorite_history: {
      events_checked: favorites.length,
      favorite_won: favoriteWins,
      win_rate: round(ratio(favoriteWins, favorites.length)),
      range_95: rangeOf(favoriteWins, favorites.length),
      note: "The favorite is the highest priced market in each past event at the comparison time. Meaningful only when an event's outcomes are mutually exclusive."
    },
    recent_events: events.slice(0, RECENT_EVENTS_SHOWN).map((event) => recentView(event, current, band)),
    data_notes: notes,
    how_to_use: "State the sample size and the 95% range with every rate. Fewer than 30 comparable events, or a wide range, means the history says little. Past settlements describe this series, not this market's future; this is market information, not a prediction or financial advice."
  };
}

// Kalshi moves markets settled before its historical cutoff to /historical/markets.
async function settledEvents(seriesTicker, wanted, fetcher) {
  const rows = [];
  let cursor = "";
  for (let page = 0; page < SETTLED_PAGES; page += 1) {
    const payload = await fetcher.get("/markets", { series_ticker: seriesTicker, status: "settled", limit: 1000, cursor });
    if (!payload) break;
    rows.push(...(payload.markets || []).map((market) => ({ market, tier: "live" })));
    cursor = payload.cursor || "";
    if (!cursor || groupEvents(rows).length >= wanted) break;
  }
  if (groupEvents(rows).length < wanted) {
    const payload = await fetcher.get("/historical/markets", { series_ticker: seriesTicker, limit: 1000 });
    const known = new Set(rows.map((entry) => entry.market.ticker));
    rows.push(...(payload?.markets || []).filter((market) => !known.has(market.ticker)).map((market) => ({ market, tier: "historical" })));
  }
  return groupEvents(rows).slice(0, wanted);
}

function groupEvents(rows) {
  const byEvent = new Map();
  for (const { market, tier } of rows) {
    const result = String(market?.result || "").toLowerCase();
    if (!market?.ticker || !market.event_ticker || !["yes", "no"].includes(result)) continue;
    const normalized = normalizeKalshiMarket(market);
    const closeTs = Math.floor(decisionTime(market) / 1000);
    if (!Number.isFinite(closeTs)) continue;
    const event = byEvent.get(market.event_ticker) || { eventTicker: market.event_ticker, closeTs: 0, tier, markets: [] };
    event.closeTs = Math.max(event.closeTs, closeTs);
    if (tier === "historical") event.tier = "historical";
    event.markets.push({ ticker: market.ticker, outcome: normalized?.yesOutcome || market.ticker, result, price: null });
    byEvent.set(market.event_ticker, event);
  }
  return [...byEvent.values()].sort((a, b) => b.closeTs - a.closeTs);
}

// The earlier of close_time and expected_expiration_time: when the outcome was actually decided.
function decisionTime(market = {}) {
  const times = [market.close_time, market.expected_expiration_time].map((value) => Date.parse(value || "")).filter(Number.isFinite);
  return times.length ? Math.min(...times) : NaN;
}

// Batch requests of up to 100 markets per live event; historical candlesticks are only served one market at a time.
async function priceEventAt(event, anchorTs, fetcher) {
  if (event.tier === "live") {
    for (let start = 0; start < event.markets.length; start += BATCH_MARKETS) {
      const chunk = event.markets.slice(start, start + BATCH_MARKETS);
      const payload = await fetcher.get("/markets/candlesticks", {
        market_tickers: chunk.map((entry) => entry.ticker).join(","),
        start_ts: anchorTs - 6 * HOUR,
        end_ts: anchorTs,
        period_interval: 60,
        include_latest_before_start: true
      });
      for (const row of payload?.markets || []) {
        const entry = chunk.find((candidate) => candidate.ticker === row.market_ticker);
        if (entry) entry.price = priceFromCandles(row.candlesticks);
      }
    }
    return;
  }
  if (!fetcher.takeHistorical(event.markets.length)) return;
  for (const entry of event.markets) {
    const payload = await fetcher.get(`/historical/markets/${encodeURIComponent(entry.ticker)}/candlesticks`, { start_ts: anchorTs - 24 * HOUR, end_ts: anchorTs, period_interval: 60 });
    entry.price = priceFromCandles(payload?.candlesticks);
  }
}

function priceFromCandles(candles = []) {
  if (!Array.isArray(candles)) return null;
  for (let index = candles.length - 1; index >= 0; index -= 1) {
    const candle = candles[index] || {};
    const bid = field(candle.yes_bid, "close");
    const ask = field(candle.yes_ask, "close");
    if (bid > 0 && ask < 1 && ask >= bid && ask - bid <= MAX_MID_SPREAD) return (bid + ask) / 2;
    const last = field(candle.price, "close") ?? field(candle.price, "previous");
    if (last !== null) return last;
  }
  return null;
}

// Batch candlesticks name fields close_dollars; historical candlesticks name them close.
function field(group, name) {
  const value = Number.parseFloat(group?.[`${name}_dollars`] ?? group?.[name]);
  return Number.isFinite(value) ? value : null;
}

// Failed requests become data notes; after the Worker's request budget runs out, stop asking.
function createFetcher(signal, notes) {
  let failures = 0;
  let stopped = false;
  let historicalLeft = HISTORICAL_CANDLE_BUDGET;
  let historicalNoted = false;
  return {
    // Whole events only, so an event is never priced from some of its markets.
    takeHistorical(count) {
      if (count <= historicalLeft) {
        historicalLeft -= count;
        return true;
      }
      if (!historicalNoted) {
        historicalNoted = true;
        notes.push("Older events in this series have too many markets to price one by one, so some were skipped.");
      }
      return false;
    },
    async get(path, params) {
      if (stopped) return null;
      try {
        return await publicRestRequest(path, params, { signal });
      } catch (error) {
        if (signal?.aborted) throw error;
        failures += 1;
        if (/request budget|more Kalshi requests/i.test(error?.message || "")) {
          stopped = true;
          notes.push("The request limit was reached, so only part of the history was checked. The MCP server on your own computer has no such limit.");
        } else if (failures === 1) {
          notes.push(`Some Kalshi history requests failed (${error?.message || "unknown error"}); results use what was returned.`);
        }
        return null;
      }
    }
  };
}

function currentPrice(row) {
  const bid = row.yesBid;
  const ask = row.yesAsk;
  if (bid > 0 && ask < 1 && ask >= bid && ask - bid <= MAX_MID_SPREAD) return (bid + ask) / 2;
  return Number.isFinite(row.last) && row.last > 0 ? row.last : null;
}

function currentBasis(row) {
  return row.yesBid > 0 && row.yesAsk < 1 && row.yesAsk >= row.yesBid && row.yesAsk - row.yesBid <= MAX_MID_SPREAD ? "mid" : "last_trade";
}

function closestPriced(markets, target, band) {
  let best = null;
  for (const entry of markets) {
    if (entry.price === null || Math.abs(entry.price - target) > band + 1e-9) continue;
    if (!best || Math.abs(entry.price - target) < Math.abs(best.price - target)) best = entry;
  }
  return best;
}

function favoriteOf(markets) {
  return markets.filter((entry) => entry.price !== null).reduce((best, entry) => (!best || entry.price > best.price ? entry : best), null);
}

function recentView(event, current, band) {
  const winner = event.markets.find((entry) => entry.result === "yes");
  const favorite = favoriteOf(event.markets);
  const similar = current === null ? null : closestPriced(event.markets, current, band);
  return {
    event_ticker: event.eventTicker,
    closed_at: new Date(event.closeTs * 1000).toISOString(),
    winner: winner ? { ticker: winner.ticker, outcome: winner.outcome, price_then: round(winner.price) } : null,
    favorite_then: favorite ? { ticker: favorite.ticker, outcome: favorite.outcome, price: round(favorite.price), won: favorite.result === "yes" } : null,
    similar_price_market: similar ? { ticker: similar.ticker, outcome: similar.outcome, price: round(similar.price), result: similar.result } : null
  };
}

// Wilson score interval: honest about small samples, unlike a plain ratio.
export function wilsonRange(successes, total, z = 1.96) {
  if (!total) return null;
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = (p + (z * z) / (2 * total)) / denominator;
  const half = (z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total))) / denominator;
  return [Math.max(0, center - half), Math.min(1, center + half)];
}

function rangeOf(successes, total) {
  const range = wilsonRange(successes, total);
  return range ? range.map((value) => round(value)) : null;
}

function rangeText(successes, total) {
  const range = wilsonRange(successes, total);
  return range ? `${percent(range[0])} to ${percent(range[1])}` : "n/a";
}

function confidenceFor(count) {
  if (count < 10) return "very_low";
  if (count < 30) return "low";
  if (count < 100) return "medium";
  return "high";
}

function ratio(part, total) {
  return total ? part / total : null;
}

function formatHours(hours) {
  if (hours >= 48) return `${round(hours / 24, 1)} days`;
  return `${round(hours, 1)} hours`;
}

function cents(value) {
  return `${Math.round(value * 100)}c`;
}

function percent(value) {
  return value === null ? "n/a" : `${Math.round(value * 100)}%`;
}

function clamp(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : min;
}

function round(value, digits = 4) {
  if (value === null || value === undefined) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

function compactRow(row = {}) {
  const closeTime = row.closeTime || "";
  const hours = Date.parse(closeTime) ? (Date.parse(closeTime) - Date.now()) / 3600000 : null;
  return {
    ticker: row.symbol || row.marketTicker || "",
    title: [row.eventTitle, row.marketTitle || row.title].filter(Boolean).join(" | "),
    yes_outcome: row.yesOutcome || "YES",
    yes_bid: round(row.yesBid),
    yes_ask: round(row.yesAsk),
    last_price: round(row.last),
    volume_24h: round(row.volume24h, 0),
    close_time: closeTime,
    hours_to_close: hours === null ? null : round(hours, 1)
  };
}
