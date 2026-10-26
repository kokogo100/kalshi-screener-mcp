// Cloudflare Worker entry: the same MCP tools at https://<your-worker>/mcp, on the user's own account.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createKalshiScreenerServer, SERVER_NAME, SERVER_VERSION } from "../src/server.js";
import { createKvStore, createMemoryStore } from "../src/store.js";
import { AsyncLocalStorage } from "node:async_hooks";

// Cloudflare's free plan allows 50 outbound requests per invocation; stop early with a clear message.
const SUBREQUEST_BUDGET = 45;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/" && request.method === "GET") {
      return new Response(`${SERVER_NAME} ${SERVER_VERSION}\nConnect your AI app to ${url.origin}/mcp?key=YOUR_ACCESS_KEY\n`, { headers: { "content-type": "text/plain" } });
    }
    if (url.pathname !== "/mcp") return new Response("Not found", { status: 404 });
    if (!env.ACCESS_KEY) return json({ error: "Set the ACCESS_KEY secret for this Worker before connecting an AI app." }, 503);
    const bearer = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (!timingSafeEqual(bearer || url.searchParams.get("key") || "", env.ACCESS_KEY)) return json({ error: "Missing or wrong access key." }, 401);

    const store = env.STATE ? createKvStore(env.STATE) : createMemoryStore();
    const server = createKalshiScreenerServer({ store, extensionId: env.EXTENSION_ID || "" });
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    await server.connect(transport);
    return withSubrequestBudget(() => transport.handleRequest(request));
  }
};

// Concurrent requests share one isolate, so the budget is tracked per request, not on a global counter.
const budget = new AsyncLocalStorage();
let fetchWrapped = false;

function withSubrequestBudget(run) {
  if (!fetchWrapped) {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (...args) => {
      const counter = budget.getStore();
      if (counter && ++counter.used > SUBREQUEST_BUDGET) {
        return Promise.reject(new Error("This search needs more Kalshi requests than a free Cloudflare Worker allows. Narrow it with scope closing_24h or closing_7d, or run the local server with npx kalshi-screener-mcp."));
      }
      return realFetch(...args);
    };
    fetchWrapped = true;
  }
  return budget.run({ used: 0 }, run);
}

function timingSafeEqual(a, b) {
  const left = new TextEncoder().encode(String(a));
  const right = new TextEncoder().encode(String(b));
  let diff = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) diff |= (left[index] || 0) ^ (right[index] || 0);
  return diff === 0;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
