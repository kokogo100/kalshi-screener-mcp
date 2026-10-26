import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SCOPES, SORTS, getEvent, getMarket, makeExtensionLink, runSavedScreen, searchMarkets, compactMarket } from "./screener.js";
import { getTickerSnapshot } from "../core/shared/kalshi-adapter.js";
import { EVIDENCE_DEFAULTS, getMarketEvidence } from "./evidence.js";

export const SERVER_NAME = "kalshi-screener";
export const SERVER_VERSION = "0.3.0";

const INSTRUCTIONS = [
  "Kalshi Screener finds and watches Kalshi prediction markets using public market data.",
  "It is read-only: it never places, changes or cancels orders and gives no buy or sell advice.",
  "Prices are in dollars from 0 to 1 and match the implied probability of YES.",
  "When the user asks whether a market will go up, settle YES or is likely, call get_market_evidence and answer from its numbers: give the sample size and 95% range with every rate, say plainly when the sample is small, and do not turn the numbers into a buy or sell recommendation.",
  "When a market includes open_in_kalshi_screener, show that link so the user can open the market in the Chrome extension; if it does not open from the app, the user can paste it into Chrome's address bar.",
  "Kalshi Screener is an independent tool, not affiliated with Kalshi. Present results as market information, not financial advice."
].join(" ");

const filterShape = {
  scope: z.enum(SCOPES).optional().describe("Market universe. open_markets (default) excludes multivariate combo markets and scans about 165,000 markets, which takes 30 to 60 seconds; closing_24h (a few seconds) and closing_7d (about 20 seconds) narrow by close time. multivariate_only is too large to scan unless Kalshi lists fewer than 100,000 combo markets."),
  text: z.string().optional().describe("Case-insensitive text that must appear in the market or event title or ticker."),
  min_yes_price: z.number().min(0).max(1).optional().describe("Minimum YES last price, e.g. 0.8 for 80c or higher."),
  max_yes_price: z.number().min(0).max(1).optional().describe("Maximum YES last price."),
  min_yes_bid: z.number().min(0).max(1).optional(),
  max_yes_ask: z.number().min(0).max(1).optional(),
  max_hours_to_close: z.number().min(0).optional().describe("Only markets closing within this many hours."),
  min_hours_to_close: z.number().min(0).optional(),
  listed_within_hours: z.number().min(0).optional().describe("Only markets created within this many hours."),
  min_volume_24h: z.number().min(0).optional().describe("Minimum contracts traded in the last 24 hours."),
  min_open_interest: z.number().min(0).optional(),
  max_spread_pct: z.number().min(0).optional().describe("Maximum YES bid/ask spread as a percent of the mid price."),
  min_change_pct: z.number().optional().describe("Minimum YES price change in percent versus the previous day."),
  max_change_pct: z.number().optional(),
  event_favorite_only: z.boolean().optional().describe("Keep only the highest priced market in each event."),
  min_event_markets: z.number().int().min(1).optional().describe("Only markets whose event has at least this many open markets."),
  max_event_yes_ask_total: z.number().min(0).optional().describe("Maximum sum of YES asks across the event. Meaningful for mutually exclusive outcomes."),
  min_event_yes_bid_total: z.number().min(0).optional().describe("Minimum sum of YES bids across the event."),
  sort: z.enum(SORTS).optional().describe("Result order. Default volume."),
  limit: z.number().int().min(1).max(100).optional().describe("Markets to return, default 20.")
};

export function createKalshiScreenerServer({ store, extensionId = "" } = {}) {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION }, { instructions: INSTRUCTIONS });
  const linkFor = async () => {
    const id = extensionId || (await store.read()).extension?.id || "";
    return (ticker) => makeExtensionLink(id, ticker);
  };
  const readOnly = { readOnlyHint: true, openWorldHint: true };

  tool(server, "search_markets", {
    title: "Search Kalshi markets",
    description: "Screen open Kalshi markets by price, time to close, listing age, volume, spread, daily change and event structure.",
    inputSchema: filterShape,
    annotations: readOnly
  }, async (filters, { signal, onProgress }) => searchMarkets(filters, { linkFor: await linkFor(), signal, onProgress }));

  tool(server, "get_market", {
    title: "Get a Kalshi market",
    description: "Prices, top of the order book, rules, settlement sources and the other markets in the same event for one market ticker. Includes research_prompt, a brief for researching the market with web search or a browser tool.",
    inputSchema: { ticker: z.string().min(1).describe("Kalshi market ticker, e.g. KXHIGHNY-25OCT23-B70.5") },
    annotations: readOnly
  }, async ({ ticker }, { signal }) => getMarket(ticker.trim().toUpperCase(), { linkFor: await linkFor(), signal }));

  tool(server, "get_market_evidence", {
    title: "Get historical evidence for a market",
    description: "How past events in the same Kalshi series settled: how often markets priced near this market's current price at the same time before close settled YES, how often the favorite won, and the most recent events. Every rate comes with its sample size and a 95% range. Use it for questions like \"will this go up?\" or \"is this likely?\", and explain the numbers instead of predicting.",
    inputSchema: {
      ticker: z.string().min(1).describe("Kalshi market ticker, e.g. KXHIGHNY-25OCT23-B70.5"),
      events: z.number().int().min(1).max(EVIDENCE_DEFAULTS.maxEvents).optional().describe(`Past settled events to check, default ${EVIDENCE_DEFAULTS.events}. More events means more Kalshi requests.`),
      hours_before_close: z.number().min(1).max(EVIDENCE_DEFAULTS.maxHoursBeforeClose).optional().describe("Compare past prices this many hours before close. Defaults to this market's own hours to close."),
      price_band: z.number().min(0.01).max(0.2).optional().describe(`How close a past price must be to count as similar, default ${EVIDENCE_DEFAULTS.priceBand} (5c).`)
    },
    annotations: readOnly
  }, async ({ ticker, events, hours_before_close, price_band }, { signal }) => getMarketEvidence(ticker.trim().toUpperCase(), {
    events, hoursBeforeClose: hours_before_close, priceBand: price_band, linkFor: await linkFor(), signal
  }));

  tool(server, "get_event", {
    title: "Compare markets in an event",
    description: "All open markets in one Kalshi event ranked by YES price, with YES bid and ask totals.",
    inputSchema: { event_ticker: z.string().min(1) },
    annotations: readOnly
  }, async ({ event_ticker }, { signal }) => getEvent(event_ticker.trim().toUpperCase(), { linkFor: await linkFor(), signal }));

  tool(server, "save_screen", {
    title: "Save a screen",
    description: "Save search filters under a name so they can be run again with run_saved_screen.",
    inputSchema: { name: z.string().min(1).max(80), description: z.string().max(300).optional(), filters: z.object(filterShape) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
  }, async ({ name, description, filters }) => {
    await store.saveScreen(name.trim(), { description: description || "", filters });
    return { saved: name.trim() };
  });

  tool(server, "delete_screen", {
    title: "Delete a saved screen",
    description: "Delete a screen saved through this server. Screens saved in the Chrome extension are not affected.",
    inputSchema: { name: z.string().min(1) },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true }
  }, async ({ name }) => {
    await store.deleteScreen(name.trim());
    return { deleted: name.trim() };
  });

  tool(server, "list_saved_screens", {
    title: "List saved screens",
    description: "Screens saved through this server plus condition presets and the watchlist shared by the Chrome extension.",
    inputSchema: {},
    annotations: readOnly
  }, async () => {
    const state = await store.read();
    return {
      server_screens: Object.entries(state.savedScreens).map(([name, screen]) => ({ name, description: screen.description, filters: screen.filters, saved_at: screen.savedAt })),
      extension_presets: (state.extension?.presets || []).map((preset) => ({ name: preset.name, id: preset.id, logic: preset.logic, conditions: preset.rows?.length ?? 1 })),
      extension_watchlist_size: state.extension?.watchlist?.length ?? 0,
      extension_synced_at: state.extension?.syncedAt || null
    };
  });

  tool(server, "run_saved_screen", {
    title: "Run a saved screen",
    description: "Run a screen saved through this server or a condition preset shared by the Chrome extension, by name or id.",
    inputSchema: { name: z.string().min(1), limit: z.number().int().min(1).max(100).optional() },
    annotations: readOnly
  }, async ({ name, limit }, { signal }) => {
    const state = await store.read();
    const key = name.trim();
    const saved = state.savedScreens[key];
    const preset = (state.extension?.presets || []).find((entry) => entry.id === key || entry.name === key);
    if (!saved && !preset) throw new Error(`No saved screen or extension preset named ${key}.`);
    const rows = preset?.rows || [];
    // Single-row presets store "AND" as their logic; the engine then uses its default formula.
    const logic = rows.length > 1 && /\b[A-Z]\b/.test(preset.logic || "") ? preset.logic : "";
    const screen = saved || { rows, logic, directionFilter: preset.directionFilter, scope: rows[0]?.marketScope };
    return runSavedScreen(screen, { limit, linkFor: await linkFor(), signal });
  });

  tool(server, "get_watchlist", {
    title: "Get the extension watchlist",
    description: "Current prices for the markets saved in the Chrome extension watchlist.",
    inputSchema: {},
    annotations: readOnly
  }, async (_args, { signal }) => {
    const state = await store.read();
    const tickers = (state.extension?.watchlist || []).map((entry) => typeof entry === "string" ? entry : entry.marketTicker || entry.symbol).filter(Boolean);
    if (!tickers.length) return { markets: [], note: state.extension ? "The extension watchlist is empty." : "The Chrome extension has not shared data with this server yet." };
    const make = await linkFor();
    return { markets: (await getTickerSnapshot(tickers, { signal })).map((row) => compactMarket(row, make)) };
  });

  tool(server, "list_alerts", {
    title: "List condition alerts",
    description: "Recent condition matches recorded by the Chrome extension's background monitor.",
    inputSchema: { limit: z.number().int().min(1).max(100).optional(), unread_only: z.boolean().optional() },
    annotations: readOnly
  }, async ({ limit = 20, unread_only = false }) => {
    const state = await store.read();
    const make = await linkFor();
    const alerts = (state.extension?.alerts || []).filter((alert) => !unread_only || !alert.readAt).slice(-limit).reverse();
    return {
      synced_at: state.extension?.syncedAt || null,
      alerts: alerts.map((alert) => ({
        ticker: alert.symbol, title: alert.title || alert.symbol, matched_at: alert.createdAt, formula: alert.recipeFormula || "",
        read: Boolean(alert.readAt), open_in_kalshi_screener: make(alert.symbol)
      })),
      note: state.extension ? undefined : "The Chrome extension has not shared alerts with this server yet."
    };
  });

  return server;
}

// Long scans report progress so clients that reset their timeout on progress do not give up.
function progressReporter(extra = {}) {
  const progressToken = extra._meta?.progressToken;
  if (progressToken === undefined || !extra.sendNotification) return null;
  let progress = 0;
  return (update = {}) => {
    progress += 1;
    extra.sendNotification({ method: "notifications/progress", params: { progressToken, progress, message: update.message || update.phase || "Working" } }).catch(() => {});
  };
}

function tool(server, name, config, handler) {
  server.registerTool(name, config, async (args, extra) => {
    try {
      const result = await handler(args || {}, { ...extra, onProgress: progressReporter(extra) });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: error?.message || String(error) }] };
    }
  });
}
