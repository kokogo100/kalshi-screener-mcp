// Shares saved conditions, the watchlist and alerts with a kalshi-screener-mcp server on this computer,
// so AI apps connected to that server see the same data. Nothing leaves the computer.
export const MCP_BRIDGE_DEFAULT_PORT = 47811;
export const MCP_PACKAGE = "kalshi-screener-mcp";
// The server is not on npm yet, so apps start it with Node from a downloaded mcp-server folder.
export const MCP_FOLDER_PLACEHOLDER = "C:/path/to/kalshi-screener-mcp";
const ALERT_LIMIT = 200;

export function mcpBridgePort(settings = {}) {
  const port = Number(settings.mcpBridgePort);
  return Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : MCP_BRIDGE_DEFAULT_PORT;
}

// Forward slashes work on Windows too and need no escaping in JSON or shell commands.
export function mcpServerFolder(settings = {}) {
  const folder = String(settings.mcpServerFolder || "").trim().replace(/^"|"$/g, "").replace(/\\/g, "/").replace(/\/+$/, "");
  return folder || MCP_FOLDER_PLACEHOLDER;
}

export function mcpServerEntry(settings = {}) {
  return { command: "node", args: [`${mcpServerFolder(settings)}/bin/cli.js`] };
}

export function mcpClaudeCodeCommand(settings = {}) {
  return `claude mcp add kalshi-screener -- node "${mcpServerFolder(settings)}/bin/cli.js"`;
}

export function mcpBridgeUrl(settings = {}, path = "") {
  return `http://127.0.0.1:${mcpBridgePort(settings)}${path}`;
}

export function mcpSyncPayload(doc = {}) {
  const data = doc.data || {};
  return {
    presets: Array.isArray(data.presets) ? data.presets : [],
    watchlist: Array.isArray(data.watchlist) ? data.watchlist : [],
    alerts: (Array.isArray(data.alerts) ? data.alerts : []).slice(-ALERT_LIMIT).map((alert) => ({
      id: alert.id, symbol: alert.symbol, title: alert.title, createdAt: alert.createdAt,
      recipeFormula: alert.recipeFormula, readAt: alert.readAt || null
    }))
  };
}

export async function checkMcpBridge(settings = {}, { fetchImpl = globalThis.fetch, timeoutMs = 2000 } = {}) {
  try {
    const response = await fetchImpl(mcpBridgeUrl(settings, "/status"), { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return { connected: false, detail: `Server answered HTTP ${response.status}.` };
    const body = await response.json();
    return { connected: body?.name === "kalshi-screener", version: body.version || "", syncedAt: body.synced_at || null, detail: body?.name === "kalshi-screener" ? "" : "Another program is using this port." };
  } catch {
    return { connected: false, detail: `No MCP server found on port ${mcpBridgePort(settings)}. Start it from your AI app or run node "${mcpServerFolder(settings)}/bin/cli.js".` };
  }
}

export async function syncMcpBridge(settings = {}, doc = {}, { fetchImpl = globalThis.fetch, timeoutMs = 4000 } = {}) {
  if (settings.mcpBridgeEnabled !== true) return { ok: false, skipped: true };
  const response = await fetchImpl(mcpBridgeUrl(settings, "/sync"), {
    method: "POST",
    headers: { "content-type": "application/json", "x-kalshi-screener": "1" },
    body: JSON.stringify(mcpSyncPayload(doc)),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `MCP server answered HTTP ${response.status}.`);
  return { ok: true, syncedAt: body.synced_at || new Date().toISOString() };
}

// Claude Desktop, Cursor and VS Code read this JSON shape from their MCP settings.
export function mcpClientConfig(settings = {}) {
  return JSON.stringify({ mcpServers: { "kalshi-screener": mcpServerEntry(settings) } }, null, 2);
}

export function linkedMarketFromLocation(locationLike = globalThis.location) {
  const hash = String(locationLike?.hash || "");
  if (!hash.startsWith("#market")) return "";
  const ticker = new URLSearchParams(hash.split("?")[1] || "").get("ticker") || "";
  return ticker.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 120);
}
