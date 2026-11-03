// Browser research tool for the panel chat: the AI picks searches, the extension opens them in
// background tabs of the user's own Chrome (so existing logins apply), reads the visible text and
// closes the tabs. It never types, clicks, posts or reads a site the user has not allowed.
export const BROWSER_RESEARCH_SITES = [
  { id: "google", label: "Google News", origins: ["https://www.google.com/*"], searchUrl: (q) => `https://www.google.com/search?tbm=nws&q=${encodeURIComponent(q)}` },
  { id: "naver", label: "Naver News", origins: ["https://search.naver.com/*"], searchUrl: (q) => `https://search.naver.com/search.naver?where=news&sort=1&query=${encodeURIComponent(q)}` },
  { id: "duckduckgo", label: "DuckDuckGo", origins: ["https://html.duckduckgo.com/*"], searchUrl: (q) => `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}` },
  { id: "x", label: "X (Twitter)", origins: ["https://x.com/*"], searchUrl: (q) => `https://x.com/search?q=${encodeURIComponent(q)}&f=live` },
  { id: "reddit", label: "Reddit", origins: ["https://www.reddit.com/*"], searchUrl: (q) => `https://www.reddit.com/search/?q=${encodeURIComponent(q)}&sort=new` }
];
export const ANY_SITE_ORIGINS = ["https://*/*"];

const SITE_BY_ID = new Map(BROWSER_RESEARCH_SITES.map((site) => [site.id, site]));
const MAX_SEARCHES = 3;
// Deep runs a wider pass: more searches across news, the settlement source and social posts.
export const DEEP_MAX_SEARCHES = 6;
const MAX_URLS = 2;
const PAGE_CHAR_LIMIT = 4000;
const LOAD_TIMEOUT_MS = 20000;
const RENDER_WAIT_MS = 1500;

export function browserResearchSites(settings = {}) {
  const ids = Array.isArray(settings.browserResearchSites) ? settings.browserResearchSites : [];
  return ids.map((id) => SITE_BY_ID.get(id)).filter(Boolean);
}

export function isBrowserResearchOn(settings = {}) {
  return settings.browserResearchEnabled === true && browserResearchSites(settings).length > 0;
}

export const BROWSE_PLAN_SYSTEM = "You decide which web searches a research assistant should run before answering. Reply with JSON only.";

export function buildBrowsePlanPrompt({ userMessage = "", context = "", sites = [], maxSearches = MAX_SEARCHES, deep = false } = {}) {
  return [
    "A user asked a question in a Kalshi prediction market screener. Before answering, you may search the web through the user's own browser.",
    `Available sites: ${sites.map((site) => `${site.id} (${site.label})`).join(", ")}.`,
    `Return JSON: {"searches":[{"site":"<site id>","query":"<search words>"}],"urls":["<https link the user gave>"]}.`,
    deep
      ? `This is a deep research request: always search. Use up to ${maxSearches} searches across different angles (latest news, the official settlement source, social posts) and different sites. Only list urls that appear in the user's question.`
      : `Use at most ${maxSearches} searches. Only list urls that appear in the user's question. Return {"searches":[],"urls":[]} when the question needs no current information.`,
    "Write each query in the language that site's results are most likely to use.",
    context ? `Context: ${String(context).slice(0, 800)}` : "",
    `Question: ${String(userMessage).slice(0, 2000)}`
  ].filter(Boolean).join("\n");
}

export function parseBrowsePlan(text = "", { sites = [], userMessage = "", maxSearches = MAX_SEARCHES } = {}) {
  const allowed = new Set(sites.map((site) => site.id));
  let raw = {};
  try {
    const match = String(text).match(/\{[\s\S]*\}/);
    raw = match ? JSON.parse(match[0]) : {};
  } catch {
    raw = {};
  }
  const seen = new Set();
  const searches = (Array.isArray(raw.searches) ? raw.searches : [])
    .map((entry) => ({ site: String(entry?.site || "").toLowerCase().trim(), query: String(entry?.query || "").replace(/\s+/g, " ").trim().slice(0, 200) }))
    .filter((entry) => allowed.has(entry.site) && entry.query && !seen.has(`${entry.site}:${entry.query}`) && seen.add(`${entry.site}:${entry.query}`))
    .slice(0, maxSearches);
  // Only links the user typed are read, so a model cannot steer the browser to arbitrary pages.
  const typed = new Set(String(userMessage).match(/https:\/\/[^\s<>"')]+/g) || []);
  const urls = (Array.isArray(raw.urls) ? raw.urls : []).map((url) => String(url || "").trim()).filter((url) => typed.has(url)).slice(0, MAX_URLS);
  return { searches, urls };
}

// Runs inside the opened tab. Kept self-contained because executeScript serializes it.
export function extractVisiblePage(limit = PAGE_CHAR_LIMIT) {
  const root = document.querySelector("main, [role=main]") || document.body;
  const text = String(root?.innerText || "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return { title: document.title || "", url: location.href, text: text.slice(0, limit) };
}

export function originPattern(url) {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.hostname}/*`;
}

export async function hasSitePermission(url, api = globalThis.chrome) {
  if (!api?.permissions?.contains) return false;
  const pattern = originPattern(url);
  return await api.permissions.contains({ origins: [pattern] }) || await api.permissions.contains({ origins: ANY_SITE_ORIGINS });
}

export async function readPageInBackgroundTab(url, { api = globalThis.chrome, signal = null, renderWaitMs = RENDER_WAIT_MS, timeoutMs = LOAD_TIMEOUT_MS } = {}) {
  if (!await hasSitePermission(url, api)) throw new Error(`Not allowed to read ${new URL(url).hostname}. Allow it in Settings, Browser research.`);
  const tab = await api.tabs.create({ url, active: false });
  try {
    await waitForTabComplete(tab.id, { api, signal, timeoutMs });
    await sleep(renderWaitMs, signal);
    const [injection] = await api.scripting.executeScript({ target: { tabId: tab.id }, func: extractVisiblePage, args: [PAGE_CHAR_LIMIT] });
    const page = injection?.result || {};
    // A redirect to a login page or another host must still be on an allowed site.
    if (page.url && !await hasSitePermission(page.url, api)) throw new Error(`${new URL(url).hostname} redirected to a site that is not allowed.`);
    return { title: String(page.title || ""), url: String(page.url || url), text: String(page.text || "") };
  } finally {
    await api.tabs.remove(tab.id).catch(() => {});
  }
}

function waitForTabComplete(tabId, { api, signal, timeoutMs }) {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      api.tabs.onUpdated.removeListener(listener);
      signal?.removeEventListener?.("abort", onAbort);
      error ? reject(error) : resolve();
    };
    const listener = (id, info) => { if (id === tabId && info.status === "complete") finish(); };
    const onAbort = () => finish(new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(() => finish(), timeoutMs);
    api.tabs.onUpdated.addListener(listener);
    signal?.addEventListener?.("abort", onAbort, { once: true });
    if (signal?.aborted) onAbort();
    api.tabs.get(tabId).then((tab) => { if (tab?.status === "complete") finish(); }).catch(() => {});
  });
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener?.("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });
}

// Returns the `web` block ai.js already understands: { provider, results: [{ title, url, content }], errors }.
export async function runBrowserResearch(plan = {}, { read = readPageInBackgroundTab, signal = null, onStatus = null } = {}) {
  const jobs = [
    ...(plan.searches || []).map((search) => ({ label: `${SITE_BY_ID.get(search.site)?.label || search.site}: ${search.query}`, url: SITE_BY_ID.get(search.site)?.searchUrl(search.query) })),
    ...(plan.urls || []).map((url) => ({ label: url, url }))
  ].filter((job) => job.url);
  const results = [];
  const errors = [];
  for (const job of jobs) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    await onStatus?.(`Reading ${job.label} in your browser`);
    try {
      const page = await read(job.url, { signal });
      if (page.text) results.push({ title: `${job.label} | ${page.title}`.slice(0, 200), url: page.url, content: page.text });
      else errors.push(`${job.label}: page had no readable text`);
    } catch (error) {
      if (error?.name === "AbortError") throw error;
      errors.push(`${job.label}: ${error.message || String(error)}`);
    }
  }
  return { provider: "browser", results, errors, error: !results.length && errors.length ? errors.join(" | ") : "" };
}
