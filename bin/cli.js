#!/usr/bin/env node
import { homedir } from "node:os";
import { join } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createKalshiScreenerServer, SERVER_VERSION } from "../src/server.js";
import { createFileStore } from "../src/file-store.js";
import { createBridgeHandler, listen, DEFAULT_PORT } from "../src/bridge.js";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
};
// stdout carries the MCP protocol, so every message for people goes to stderr.
const log = (message) => process.stderr.write(`[kalshi-screener] ${message}\n`);

if (flag("help")) {
  log(`kalshi-screener-mcp ${SERVER_VERSION}
  (no flags)      MCP over stdio for Claude Desktop, Claude Code, Cursor and VS Code
  --http          MCP over HTTP at http://127.0.0.1:<port>/mcp instead of stdio
  --port <n>      Local port for the extension bridge and --http (default ${DEFAULT_PORT})
  --state <path>  State file (default ~/.kalshi-screener/mcp-state.json)
  --no-bridge     Do not accept data from the Chrome extension
  --pair          Accept the next extension that shares data, replacing the paired one`);
  process.exit(0);
}

const port = Number(option("port", process.env.KALSHI_SCREENER_PORT || DEFAULT_PORT));
const store = await createFileStore(option("state", process.env.KALSHI_SCREENER_STATE || join(homedir(), ".kalshi-screener", "mcp-state.json")));
const extensionId = process.env.KALSHI_SCREENER_EXTENSION_ID || "";

if (flag("http")) {
  const mcpHandler = async (req, res) => {
    // Stateless: a fresh server per request keeps concurrent clients independent.
    const server = createKalshiScreenerServer({ store, extensionId });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { transport.close(); server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  };
  await listen(createBridgeHandler({ store, mcpHandler, acceptSync: !flag("no-bridge"), pair: flag("pair") }), port);
  log(`MCP over HTTP at http://127.0.0.1:${port}/mcp${flag("no-bridge") ? "" : " (extension bridge on the same port)"}`);
} else {
  if (!flag("no-bridge")) {
    try {
      await listen(createBridgeHandler({ store, pair: flag("pair") }), port);
      log(`Extension bridge listening on http://127.0.0.1:${port}`);
    } catch (error) {
      // Another copy (for example a second AI app) already serves the bridge; both share the state file.
      log(error.code === "EADDRINUSE" ? `Port ${port} is in use; sharing the existing bridge.` : `Extension bridge unavailable: ${error.message}`);
    }
  }
  const server = createKalshiScreenerServer({ store, extensionId });
  await server.connect(new StdioServerTransport());
  log("MCP server ready on stdio.");
}
