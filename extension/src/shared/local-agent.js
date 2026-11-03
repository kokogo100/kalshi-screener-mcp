export const DEFAULT_LOCAL_AGENT_URL = "http://127.0.0.1:8912";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost"]);

export function normalizeLocalAgentUrl(value = "") {
  const raw = String(value || "").trim() || DEFAULT_LOCAL_AGENT_URL;
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== "http:") return DEFAULT_LOCAL_AGENT_URL;
    if (!LOOPBACK_HOSTS.has(url.hostname)) return DEFAULT_LOCAL_AGENT_URL;
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return DEFAULT_LOCAL_AGENT_URL;
  }
}

export function localAgentDisabledStatus() {
  return {
    ok: false,
    checked: false,
    state: "off",
    label: "Off",
    detail: "Browser only",
    aiTaggingLabel: "Off"
  };
}

export async function checkLocalAgent(settings = {}, { timeoutMs = 1600 } = {}) {
  if (!settings.localAgentEnabled) return localAgentDisabledStatus();

  const baseUrl = normalizeLocalAgentUrl(settings.localAgentUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/health`, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        ok: false,
        checked: true,
        state: "error",
        label: `HTTP ${response.status}`,
        detail: "Agent responded with an error",
        aiTaggingLabel: "Unavailable"
      };
    }

    const data = await response.json().catch(() => ({}));
    const appName = data.app || "Local Agent";
    const version = data.version ? ` ${data.version}` : "";
    const aiTagging = data.aiTagging || data.g12 || {};

    return {
      ok: data.ok !== false,
      checked: true,
      state: data.ok === false ? "error" : "connected",
      label: data.ok === false ? "Unavailable" : "Connected",
      detail: `${appName}${version}`,
      aiTaggingLabel: aiTagging.enabled === false ? "Off" : aiTagging.provider || "Ready",
      data
    };
  } catch (error) {
    const aborted = error?.name === "AbortError";
    return {
      ok: false,
      checked: true,
      state: aborted ? "timeout" : "disconnected",
      label: aborted ? "Timeout" : "Disconnected",
      detail: aborted ? "Start Local Agent and check again" : "Local Agent is not reachable",
      aiTaggingLabel: "Unavailable"
    };
  } finally {
    clearTimeout(timeout);
  }
}
