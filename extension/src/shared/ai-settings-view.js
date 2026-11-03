import { AI_PROVIDERS } from "./config.js";
import { escapeHtml as esc } from "./format.js";
import { normalizeAIConfiguration } from "./ai-connections.js";

export function renderAISettings(settings, { editingConnectionId = "", aiConnectionBusy = false } = {}) {
  const { aiConnections, aiRouting } = normalizeAIConfiguration(settings);
  const editing = aiConnections.find((slot) => slot.id === editingConnectionId);
  const options = (selected) => `<option value="">Off</option>${aiConnections.map((slot) => `<option value="${esc(slot.id)}" ${slot.id === selected ? "selected" : ""}>${esc(slot.label)} · ${esc(slot.model)}</option>`).join("")}`;
  return `<section class="settings-card"><h2>AI Connections</h2>
    <button data-about="ai" aria-label="About AI connections and image support">! About AI connections</button>
    <p class="provider-note">Register connections here: choose Add connection, then pick the provider (OpenAI, Anthropic Claude, Google Gemini, xAI Grok, Ollama and more) in the Provider list. Choose which ones to use in Execution order below. API usage follows your provider's billing; a web subscription is a separate connection.</p>
    <div class="ai-connection-grid">${aiConnections.map((slot) => `<article class="ai-connection-card">
      <h3>${esc(slot.label)}</h3><p>${esc(AI_PROVIDERS.find((provider) => provider.id === slot.provider)?.kind === "local" ? "Local server" : "API connection")} · ${esc(slot.model || "Choose a model")}</p>
      <p class="provider-note">${slot.testStatus === "connected" ? `Response verified ${esc(slot.testedAt ? new Date(slot.testedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "")}` : slot.testStatus === "failed" ? esc(slot.testMessage || "Test failed") : "Not tested"}</p>
      <button data-ai-edit="${esc(slot.id)}" ${aiConnectionBusy ? "disabled" : ""}>Edit</button>
      <button data-ai-delete="${esc(slot.id)}" ${aiConnectionBusy ? "disabled" : ""}>Delete</button></article>`).join("")}</div>
    <button id="addAIConnection" ${aiConnectionBusy ? "disabled" : ""}>Add connection</button>
    ${editing ? `<div class="ai-connection-editor" data-ai-editor="${esc(editing.id)}">
      <h3>Edit connection</h3>
      <label>Name <input id="aiConnectionLabel" class="field" value="${esc(editing.label)}" /></label>
      <label>Provider <select id="aiConnectionProvider" class="field">${AI_PROVIDERS.filter((provider) => provider.id !== "none").map((provider) => `<option value="${esc(provider.id)}" ${provider.id === editing.provider ? "selected" : ""}>${esc(provider.id === "local" ? "Ollama / Local Server" : provider.label)}</option>`).join("")}</select></label>
      <label>Model ID <input id="aiConnectionModel" class="field" list="aiModelSuggestions" value="${esc(editing.model)}" autocomplete="off" /></label>
      <datalist id="aiModelSuggestions">${(editing.availableModels || []).map((model) => `<option value="${esc(model)}"></option>`).join("")}</datalist>
      <label>Image support for this model (your declaration)<select id="aiConnectionImageSupport">${[["unknown","Unknown: check model documentation"],["supported","Supports images"],["unsupported","Does not support images"]].map(([value,label])=>`<option value="${value}" ${editing.imageSupport===value||(!editing.imageSupport&&value==="unknown")?"selected":""}>${label}</option>`).join("")}</select></label>
      <p class="provider-note">Enter a model ID or load the provider's model list. Listing a model does not verify text or image support; Test response checks the selected model.</p>
      <label>${editing.provider === "local" ? "API key (optional)" : "API key"} <input id="aiConnectionKey" class="field" type="password" value="${esc(editing.apiKey)}" autocomplete="off" /></label>
      ${!["gemini", "anthropic"].includes(editing.provider) ? `<label>API base URL <input id="aiConnectionBase" class="field" type="url" value="${esc(editing.baseUrl)}" /></label>` : ""}
      <div class="settings-actions"><button id="loadAIModels" ${aiConnectionBusy ? "disabled" : ""}>Load models</button><button id="testAIResponse" ${aiConnectionBusy ? "disabled" : ""}>Test response</button><button id="cancelAIRequest" ${aiConnectionBusy ? "" : "hidden"}>Cancel request</button></div>
      <p role="status">${aiConnectionBusy ? "Request in progress…" : esc(editing.testMessage || "Changes need Save settings.")}</p>
      </div>` : ""}</section>
    <section class="settings-card"><h2>Execution order</h2>
      <label>Primary <select class="field" data-ai-route="primary">${options(aiRouting.primary)}</select></label>
      <label class="inline-check"><input id="aiFallbackEnabled" type="checkbox" ${aiRouting.fallbackEnabled ? "checked" : ""} /> Use fallbacks when a request fails</label>
      <label>Fallback 1 <select class="field" data-ai-route="fallback1">${options(aiRouting.fallback1)}</select></label>
      <label>Fallback 2 <select class="field" data-ai-route="fallback2">${options(aiRouting.fallback2)}</select></label>
      <p class="provider-note">The first usable answer wins. This is not AI collaboration or answer comparison. Cancellation stops the entire request. A fallback receives the same request and attachments.</p>
    </section>`;
}
