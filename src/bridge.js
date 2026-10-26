import { createServer } from "node:http";
import { SERVER_NAME, SERVER_VERSION } from "./server.js";

export const DEFAULT_PORT = 47811;
const MAX_BODY_BYTES = 4 * 1024 * 1024;

// Localhost endpoint the Chrome extension pushes its presets, watchlist and alerts to.
// Only extension origins may call it, so ordinary web pages cannot write or read this state.
// The first extension that syncs is paired; other extensions are refused until --pair is used.
export function createBridgeHandler({ store, mcpHandler = null, acceptSync = true, pair = false }) {
  let pairing = pair;
  return async (req, res) => {
    // A Host check blocks DNS rebinding: a web page cannot reach this server under its own domain name.
    const host = String(req.headers.host || "").replace(/:\d+$/, "");
    if (!["127.0.0.1", "localhost", "[::1]"].includes(host)) return send(res, 403, { error: "This server only answers on 127.0.0.1." });
    const origin = req.headers.origin || "";
    const fromExtension = origin.startsWith("chrome-extension://");
    if (origin && !fromExtension && !(mcpHandler && req.url?.startsWith("/mcp"))) return send(res, 403, { error: "Only the Kalshi Screener extension may use this endpoint." });
    if (fromExtension) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "content-type, x-kalshi-screener");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      if (req.method === "OPTIONS") return send(res, 204);
      if (url.pathname === "/mcp" && mcpHandler) return mcpHandler(req, res);
      if (req.method === "GET" && url.pathname === "/status") {
        const state = await store.read();
        return send(res, 200, { ok: true, name: SERVER_NAME, version: SERVER_VERSION, accepts_sync: acceptSync, synced_at: state.extension?.syncedAt || null, saved_screens: Object.keys(state.savedScreens).length });
      }
      if (req.method === "POST" && url.pathname === "/sync") {
        if (!acceptSync) return send(res, 403, { error: "This server was started with --no-bridge and does not accept extension data." });
        if (!fromExtension || req.headers["x-kalshi-screener"] !== "1") return send(res, 403, { error: "Sync is accepted only from the Kalshi Screener extension." });
        const extensionId = origin.slice("chrome-extension://".length).replace(/\/$/, "");
        const pairedId = (await store.read()).extension?.id || "";
        if (pairedId && pairedId !== extensionId && !pairing) {
          return send(res, 403, { error: "This server is paired with a different extension install. Restart it once with --pair to pair this one." });
        }
        const body = await readJson(req);
        pairing = false;
        const list = (value) => Array.isArray(value) ? value : [];
        const next = await store.setExtension({ id: extensionId, presets: list(body.presets), watchlist: list(body.watchlist), alerts: list(body.alerts).slice(-200) });
        return send(res, 200, { ok: true, synced_at: next.extension.syncedAt });
      }
      return send(res, 404, { error: "Not found" });
    } catch (error) {
      return send(res, error.status || 500, { error: error.message });
    }
  };
}

export function listen(handler, port = DEFAULT_PORT, host = "127.0.0.1") {
  return new Promise((resolve, reject) => {
    const server = createServer(handler);
    server.once("error", reject);
    server.listen(port, host, () => resolve(server));
  });
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error("Sync payload is too large."), { status: 413 }));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch { reject(Object.assign(new Error("Invalid JSON."), { status: 400 })); }
    });
    req.on("error", reject);
  });
}

function send(res, status, body) {
  if (res.headersSent) return;
  res.statusCode = status;
  if (body === undefined) return res.end();
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
