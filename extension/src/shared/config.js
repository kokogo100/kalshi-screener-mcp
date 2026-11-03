export const FEATURE_FLAGS = {
  localAgent: false
};

export const AI_PROVIDERS = [
  {
    id: "none",
    label: "Off",
    kind: "none",
    keyLabel: "API Key",
    defaultModel: "",
    defaultBaseUrl: "",
    models: []
  },
  {
    id: "gemini",
    label: "Google Gemini",
    kind: "gemini",
    keyLabel: "Gemini API Key",
    defaultModel: "gemini-3.5-flash",
    defaultBaseUrl: "",
    models: ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash"]
  },
  {
    id: "github",
    label: "GitHub Models (retired)",
    kind: "openai-compatible",
    keyLabel: "GitHub PAT",
    defaultModel: "openai/gpt-5",
    defaultBaseUrl: "https://models.github.ai/inference/chat/completions",
    models: ["openai/gpt-5", "openai/gpt-5-mini", "openai/gpt-4.1"]
  },
  {
    id: "groq",
    label: "Groq",
    kind: "openai-compatible",
    keyLabel: "Groq API Key",
    defaultModel: "openai/gpt-oss-120b",
    defaultBaseUrl: "https://api.groq.com/openai",
    models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.6-27b"]
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    kind: "openai-compatible",
    keyLabel: "DeepSeek API Key",
    defaultModel: "deepseek-chat",
    defaultBaseUrl: "https://api.deepseek.com",
    models: ["deepseek-chat", "deepseek-reasoner"]
  },
  {
    id: "mistral",
    label: "Mistral AI",
    kind: "openai-compatible",
    keyLabel: "Mistral API Key",
    defaultModel: "mistral-large-latest",
    defaultBaseUrl: "https://api.mistral.ai",
    models: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"]
  },
  {
    id: "qwen",
    label: "Qwen",
    kind: "openai-compatible",
    keyLabel: "Qwen API Key",
    defaultModel: "qwen-plus",
    defaultBaseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode",
    models: ["qwen-max", "qwen-plus", "qwen-flash"]
  },
  {
    id: "openai",
    label: "OpenAI",
    kind: "openai-compatible",
    keyLabel: "OpenAI API Key",
    defaultModel: "gpt-5.2",
    defaultBaseUrl: "https://api.openai.com",
    models: ["gpt-5.2", "gpt-5.5", "gpt-5-mini"]
  },
  {
    id: "xai",
    label: "xAI Grok",
    kind: "openai-compatible",
    keyLabel: "xAI API Key",
    defaultModel: "grok-4.3",
    defaultBaseUrl: "https://api.x.ai",
    models: ["grok-4.3", "grok-4.20", "grok-4.1-fast"]
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    kind: "anthropic",
    keyLabel: "Anthropic API Key",
    defaultModel: "claude-sonnet-5-5",
    defaultBaseUrl: "",
    models: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"]
  },
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    kind: "openai-compatible",
    keyLabel: "NVIDIA API Key",
    // NVIDIA retired llama-3.3-nemotron-super-49b-v1.5 and llama-3.3-70b-instruct (410 Gone, checked 2026-10-24).
    defaultModel: "nvidia/nemotron-3-super-120b-a12b",
    defaultBaseUrl: "https://integrate.api.nvidia.com",
    models: ["nvidia/nemotron-3-super-120b-a12b", "nvidia/llama-3.1-nemotron-ultra-253b-v1", "openai/gpt-oss-20b"]
  },
  {
    id: "custom",
    label: "Custom OpenAI-compatible",
    kind: "openai-compatible",
    keyLabel: "API Key",
    defaultModel: "",
    defaultBaseUrl: "",
    models: []
  },
  {
    id: "local",
    label: "Local LLM",
    kind: "local",
    keyLabel: "API Key (optional)",
    defaultModel: "llama3.3",
    defaultBaseUrl: "http://localhost:11434",
    models: ["llama3.3", "qwen3", "mistral-small"]
  }
];

export const DEEP_RESEARCH_AGENTS = {
  standard: "deep-research-preview-04-2026",
  max: "deep-research-max-preview-04-2026"
};

// The extension source repo is private; the public repo holds the MCP server, privacy policy and issue forms.
export const PROJECT_REPO_URL = "https://github.com/kokogo100/kalshi-screener-mcp";
export const PRIVACY_POLICY_URL = "https://axnli.com/kalshi-screener/privacy/";
// Ad slots are hidden for now; set to true to show them again.
export const DISCLAIMER = "Kalshi Screener is an independent tool. It is not affiliated with, endorsed by or sponsored by Kalshi. Market information only, not financial advice.";

export const DEFAULT_KALSHI_SETTINGS = {
  apiKey: "",
  apiSecret: "",
  environment: "auto",
  productionBaseUrl: "https://external-api.kalshi.com/trade-api/v2",
  productionFallbackBaseUrl: "https://api.elections.kalshi.com/trade-api/v2",
  demoBaseUrl: "https://external-api.demo.kalshi.co/trade-api/v2",
  demoFallbackBaseUrl: "https://demo-api.kalshi.co/trade-api/v2",
  productionWebSocketUrl: "wss://external-api-ws.kalshi.com/trade-api/ws/v2",
  demoWebSocketUrl: "wss://external-api-ws.demo.kalshi.co/trade-api/ws/v2",
  readOnlyConfirmed: false,
  includePortfolioContext: false,
  connectionStatus: "not_configured",
  accountMode: "auto",
  detectedAccountMode: "",
  marketDataFeed: "rest",
  connectionMessage: "Public Kalshi market data works without an API key. Add Key ID and RSA Private Key only for optional read-only private snapshots and WebSocket readiness.",
  connectionCheckedAt: "",
  marketScope: "open_markets"
};

export const DEFAULT_SETTINGS = {
  appearance: "dark",
  language: "English",
  voiceSpeed: 1,
  selectedCategories: [],
  lastFeedCategory: "",
  chatMode: "single",
  chatProviders: [
    {
      provider: "none",
      apiKey: "",
      model: "gemini-3.5-flash",
      baseUrl: "",
      localHost: "http://localhost:11434",
      localModel: "llama3.1"
    },
    {
      provider: "none",
      apiKey: "",
      model: "gpt-5-mini",
      baseUrl: "",
      localHost: "http://localhost:11434",
      localModel: "llama3.1"
    },
    {
      provider: "none",
      apiKey: "",
      model: "llama3.3",
      baseUrl: "",
      localHost: "http://localhost:11434",
      localModel: "llama3.1"
    }
  ],
  chatProvider: "none",
  chatApiKey: "",
  chatModel: "gemini-3.5-flash",
  chatBaseUrl: "",
  localLlmHost: "http://localhost:11434",
  localLlmModel: "llama3.1",
  geminiApiKey: "",
  geminiModel: "gemini-3.5-flash",
  browserResearchEnabled: false,
  // Our own alert window is the main alert (sized by us, room for an ad); the small Windows notification is opt-in.
  desktopNotifications: false,
  alertWindow: true,
  alertSound: true,
  alertWindowBackground: "default",
  // "seen" once the person confirms a test notification appeared; Windows can hide them without telling Chrome.
  notificationCheck: "",
  browserResearchSites: [],
  deepResearchEnabled: false,
  deepResearchApiKey: "",
  deepResearchMode: "max",
  deepResearchModel: DEEP_RESEARCH_AGENTS.max,
  subscriptionStatus: "free_forever",
  subscriptionPlan: "Kalshi Screener",
  privacyPolicyUrl: PRIVACY_POLICY_URL,
  refundPolicyUrl: "",
  localAgentFeatureVisible: false,
  localAgentEnabled: false,
  localAgentUrl: "http://127.0.0.1:8912",
  localAgentAiTaggingEnabled: true,
  localAgentPairingToken: "",
  KALSHI: DEFAULT_KALSHI_SETTINGS
};
