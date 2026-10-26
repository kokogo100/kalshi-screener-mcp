// Builds the "Research with AI" hand-off: a prompt the user pastes into their own AI, plus
// third-party browser tools for sites that need a login. Shared with the MCP server through core/.
export const RESEARCH_DISCLAIMER = "Third-party tool. Not affiliated with Kalshi Screener.";
export const RESEARCH_LOGIN_WARNING = "These tools let an AI use the sites you are signed in to. Only connect accounts you are comfortable letting the AI read.";

export const RESEARCH_TOOLS = [
  {
    id: "claude-chrome",
    name: "Claude in Chrome",
    kind: "Chrome extension",
    worksWith: "Claude paid plans",
    summary: "Claude reads and clicks in your own Chrome tabs. The easiest option if you already pay for Claude.",
    url: "https://support.claude.com/en/articles/12012173-get-started-with-claude-in-chrome"
  },
  {
    id: "playwright-mcp",
    name: "Playwright MCP Bridge",
    kind: "Chrome extension + MCP server",
    worksWith: "Claude Desktop, Claude Code, Cursor, VS Code, LM Studio",
    summary: "Free and open source from Microsoft. Any MCP app on this computer can use your signed-in Chrome tabs. Add it next to Kalshi Screener with Copy MCP settings below.",
    url: "https://chromewebstore.google.com/detail/mmlmfjhmonkocbjadbfplnigmagldckm",
    sourceUrl: "https://github.com/microsoft/playwright-mcp"
  },
  {
    id: "ego-lite",
    name: "ego lite",
    kind: "Separate browser (Windows, macOS)",
    worksWith: "Claude Code, Codex, Cursor",
    summary: "A browser where AI agents work in their own spaces with your logins. Agent skill: npx skills add citrolabs/ego-lite",
    url: "https://lite.ego.app/",
    sourceUrl: "https://github.com/citrolabs/ego-lite"
  },
  {
    id: "aside",
    name: "Aside",
    kind: "Separate AI browser (Windows, macOS)",
    worksWith: "Its built-in agent, using your ChatGPT or Claude account",
    summary: "Research runs inside the Aside browser. Paste the prompt there.",
    url: "https://aside.com/"
  }
];

export const PLAYWRIGHT_MCP_SERVER = { command: "npx", args: ["@playwright/mcp@latest", "--extension"] };

// One MCP settings block with both servers, for apps that read the Claude Desktop JSON shape.
export function researchMcpConfig(kalshiServer) {
  return JSON.stringify({
    mcpServers: {
      "kalshi-screener": kalshiServer,
      playwright: PLAYWRIGHT_MCP_SERVER
    }
  }, null, 2);
}

export function buildResearchPrompt(market = {}, series = null) {
  const ticker = String(market.symbol || market.marketTicker || market.ticker || "").trim();
  const title = [market.eventTitle, market.marketTitle || market.title].map(clean).filter(Boolean).join(" | ") || ticker;
  const yesOutcome = clean(market.yesOutcome);
  const prices = [
    ["YES bid", market.yesBid ?? market.bid],
    ["YES ask", market.yesAsk ?? market.ask],
    ["last trade", market.last ?? market.lastPrice]
  ].map(([label, value]) => (cents(value) ? `${label} ${cents(value)}` : "")).filter(Boolean);
  const closeTime = clean(market.closeTime || market.close_time);
  const rules = [clip(market.rulesPrimary, 1200), clip(market.rulesSecondary, 600)].filter(Boolean).join(" ");
  const sources = (series?.settlementSources || [])
    .map((source) => [clean(source.name), safeUrl(source.url)].filter(Boolean).join(" "))
    .filter(Boolean);
  const terms = safeUrl(series?.contractTermsUrl || series?.contractUrl);

  const lines = [
    "Research this Kalshi market and tell me what the latest news and official data suggest about YES and NO.",
    "",
    `Market: ${title}${ticker && title !== ticker ? ` (${ticker})` : ""}`,
    yesOutcome && yesOutcome.toUpperCase() !== "YES" ? `YES means: ${yesOutcome}` : null,
    prices.length ? `Prices now: ${prices.join(", ")}` : null,
    closeTime ? `Closes: ${closeTime}` : null,
    rules ? `Settlement rules: ${rules}` : null,
    sources.length ? `Settlement sources: ${sources.join("; ")}` : "Settlement sources: not listed. Find the source named in the rules.",
    terms ? `Contract terms: ${terms}` : null,
    ticker ? `Kalshi page: https://kalshi.com/markets/${encodeURIComponent(seriesFromTicker(market, ticker).toLowerCase())}` : null,
    "",
    "Steps:",
    "1. Start with the settlement sources, then look for news and official releases since the market opened.",
    "2. If a page needs a login or blocks you, use my browser tool if one is connected (Claude in Chrome, Playwright MCP or ego-browser). Only read pages. Do not post, trade or change anything in any account.",
    "3. List every source with its date and link, and say clearly what is still unknown.",
    "4. Compare what you found with the current YES price, without telling me to buy or sell.",
    "",
    "This is research for my own decision, not financial advice."
  ];
  return lines.filter((line) => line !== null).join("\n");
}

function seriesFromTicker(market, ticker) {
  return String(market.seriesTicker || market.series_ticker || ticker.split("-")[0] || ticker);
}

function cents(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1) return "";
  return `${Math.round(number * 1000) / 10}c`;
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function clip(value, limit) {
  const text = clean(value);
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

function safeUrl(value) {
  const text = clean(value);
  return /^https:\/\/[^\s]+$/i.test(text) ? text : "";
}
