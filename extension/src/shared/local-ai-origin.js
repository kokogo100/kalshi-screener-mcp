// Ollama refuses requests whose Origin is chrome-extension:// (403) unless OLLAMA_ORIGINS is set.
// A session rule rewrites Origin to the server's own origin, only for requests outside tabs
// (this extension's panel and worker), so web pages cannot use it to reach the local server.
const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])$/;
const RULE_ID_BASE = 100000;
const ready = new Set();

export function localAiOriginRule(url) {
  const target = new URL(url);
  if (target.protocol !== "http:" || !LOOPBACK.test(target.hostname)) return null;
  const port = Number(target.port || 80);
  const host = target.hostname.replace(/[.[\]]/g, "\$&");
  return {
    id: RULE_ID_BASE + port,
    priority: 1,
    condition: { regexFilter: `^http://${host}:${port}/`, tabIds: [-1], resourceTypes: ["xmlhttprequest", "other"] },
    action: { type: "modifyHeaders", requestHeaders: [{ header: "Origin", operation: "set", value: `http://${target.hostname}:${port}` }] }
  };
}

export async function allowLocalAiOrigin(url, dnr = globalThis.chrome?.declarativeNetRequest) {
  if (!dnr?.updateSessionRules) return;
  let rule;
  try { rule = localAiOriginRule(url); } catch { return; }
  if (!rule || ready.has(rule.id)) return;
  await dnr.updateSessionRules({ removeRuleIds: [rule.id], addRules: [rule] });
  ready.add(rule.id);
}
