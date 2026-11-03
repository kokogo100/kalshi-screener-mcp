import { AI_PROVIDERS } from "./config.js";

export function normalizeAIConfiguration(settings = {}) {
  const migrated = !Array.isArray(settings.aiConnections);
  const legacy = Array.isArray(settings.chatProviders) ? settings.chatProviders : [{ provider: settings.chatProvider,
    apiKey: settings.chatApiKey, model: settings.chatModel, baseUrl: settings.chatBaseUrl,
    localHost: settings.localLlmHost, localModel: settings.localLlmModel }];
  const input = migrated ? legacy.map((slot, index) => ({ ...slot, id: `legacy-${index}` })) : settings.aiConnections;
  const seen = new Set();
  const connections = input.filter((slot) => slot && slot.provider && slot.provider !== "none").map((slot, index) => {
    const config = AI_PROVIDERS.find((provider) => provider.id === slot.provider);
    if (!config) throw new Error(`Unknown AI provider: ${slot.provider}`);
    const id = String(slot.id || `connection-${index}`);
    if (seen.has(id)) throw new Error("Duplicate AI connection ID.");
    seen.add(id);
    return { ...slot, id, label: slot.label || config.label, model: slot.model ?? slot.localModel ?? config.defaultModel ?? "",
      apiKey: slot.apiKey || "", baseUrl: slot.baseUrl || (config.kind === "local" ? slot.localHost : "") || config.defaultBaseUrl || "",
      customModel: true, testStatus: slot.testStatus || "not_tested", testedAt: slot.testedAt || "" };
  });
  const count = settings.chatMode === "triple" ? 3 : settings.chatMode === "dual" ? 2 : 1;
  const routing = migrated ? { primary: connections.find((slot) => slot.id === "legacy-0")?.id || "",
    fallback1: count > 1 ? connections.find((slot) => slot.id === "legacy-1")?.id || "" : "",
    fallback2: count > 2 ? connections.find((slot) => slot.id === "legacy-2")?.id || "" : "", fallbackEnabled: count > 1 }
    : { primary: "", fallback1: "", fallback2: "", fallbackEnabled: false, ...settings.aiRouting };
  for (const key of ["primary", "fallback1", "fallback2"]) if (!seen.has(routing[key])) routing[key] = "";
  return { aiConnections: connections, aiRouting: routing };
}

export function selectedAIConnections(settings = {}) {
  const { aiConnections, aiRouting } = normalizeAIConfiguration(settings);
  if (!aiRouting.primary) return [];
  const ids = aiRouting.fallbackEnabled ? [aiRouting.primary, aiRouting.fallback1, aiRouting.fallback2] : [aiRouting.primary];
  const used = new Set();
  return ids.map((id, index) => {
    if (!id || used.has(id)) return null;
    used.add(id);
    const slot = aiConnections.find((connection) => connection.id === id);
    return slot ? { ...slot, routePosition: index + 1, routeRole: index ? `Fallback ${index}` : "Primary" } : null;
  }).filter(Boolean);
}

export function connectionOrigin(connection) {
  const config = AI_PROVIDERS.find((provider) => provider.id === connection.provider);
  const raw = connection.baseUrl || config?.defaultBaseUrl || (connection.provider === "gemini" ? "https://generativelanguage.googleapis.com" : connection.provider === "anthropic" ? "https://api.anthropic.com" : "");
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Use an HTTP(S) endpoint without embedded credentials.");
  return `${url.protocol}//${url.hostname}/*`;
}

// Call directly from a user click, before any awaited operation, for custom hosts.
export async function requestConnectionAccess(connection) {
  const origin = connectionOrigin(connection);
  if (typeof chrome === "undefined" || !chrome.permissions) return true;
  return chrome.permissions.request({ origins: [origin] });
}
