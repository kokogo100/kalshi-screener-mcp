import { renderAISettings } from "./shared/ai-settings-view.js";
import { MCP_FOLDER_PLACEHOLDER, checkMcpBridge, linkedMarketFromLocation, mcpBridgePort, mcpClaudeCodeCommand, mcpClientConfig, mcpServerEntry, syncMcpBridge } from "./shared/mcp-bridge.js";
import { createProductUX, productTools, imageRequestIdentity } from "./shared/product-ux.js";
import { openAlertWindow, renderBackgroundSwatches } from "./shared/alert-window.js";
import { deleteAlerts } from "./shared/alert-presentation.js";
import { playChime } from "./shared/alert-sound.js";
import { parseFormulaText, validateFormulaTokens } from "./scanner-lab/scanner-formula.js";
function translationDisabled() { return false; }
function translationUnavailable() { return false; }
async function originalAnalysisText(text) { return { text }; }
async function noTranslationDownload() { return false; }
function translationEnglish() { return "en"; }
async function unchangedLegacyItems(items) { return items; }
import { normalizeAIConfiguration, selectedAIConnections, requestConnectionAccess } from "./shared/ai-connections.js";
import { AI_PROVIDERS, FEATURE_FLAGS, PRIVACY_POLICY_URL, PROJECT_REPO_URL, DISCLAIMER } from "./shared/config.js";
import {
  clampText,
  escapeHtml,
  formatDate,
  formatNumber,
  getMarketLabel,
  getNewsTimestamp,
  getSentimentScore,
  getSource,
  getSummary,
  signalKind,
  signalLabel
} from "./shared/format.js";
import { SCANNER_DRAFT_SIGNAL, WATCHLIST_ADD_SIGNAL, WATCHLIST_REMOVE_SIGNAL, answerChat, isChatConfigured, planScannerLabCommand, testAIConnection, listAIConnectionModels } from "./shared/ai.js";
import { buildBrokerContextPackage } from "./shared/broker-context.js";
import { BROKER_WATCHLIST_MAX_SYMBOLS, getBrokerData, appendScannerLoopHistoryEntry, saveConditionPresets, saveWatchlist } from "./shared/broker-storage.js";
import { conditionLabel, createConditionPreset, defaultConditionRow, normalizeConditionRow } from "./shared/condition-builder.js";
import { executeScannerObservation, cancelScannerExecution } from "./scanner-lab/scanner-execution.js";
import { runScannerLabObservation } from "./scanner-lab/scanner-runner.js";
import { exportScannerBackup, inspectScannerBackup, importScannerBackup } from "./shared/scanner-backup.js";
import { readScannerDocument, recoverScannerData } from "./shared/scanner-store.js";
import {
  checkLocalAgent,
  localAgentDisabledStatus,
  normalizeLocalAgentUrl
} from "./shared/local-agent.js";
import { createKalshiTickerStream, getAccountSnapshot, getEventMarkets, getSeriesInfo, getTickerSnapshot, testKALSHIConnection } from "./shared/kalshi-adapter.js";
import { getMarketEvidence } from "./shared/market-evidence.js";
import { ANY_SITE_ORIGINS, BROWSER_RESEARCH_SITES, DEEP_MAX_SEARCHES, browserResearchSites, isBrowserResearchOn, runBrowserResearch } from "./shared/browser-research.js";
import { RESEARCH_DISCLAIMER, RESEARCH_LOGIN_WARNING, RESEARCH_TOOLS, buildResearchPrompt, researchMcpConfig } from "./shared/research.js";
import { CONDITION_METRICS, CONDITION_OPERATORS, MARKET_SCOPES, TIMEFRAMES, marketScopeById } from "./shared/market-scopes.js";
import {
  DATA_REQUIREMENTS,
  SCANNER_LAB_ENGINE_VERSION,
  SCANNER_TEMPLATE_CATEGORIES,
  createConditionInstance,
  deleteSelectedUiFormulaTokens,
  normalizeTemplateParameters,
  removeSelectedUiFormulaParentheses,
  scannerTemplateCapabilityView,
  scannerTemplateById
} from "./scanner-lab/index.js";
import { buildNewsPrompt, copyPromptToClipboard } from "./shared/prompt.js";
import {
  CHAT_LOG_LIMIT,
  DEFAULT_GROUP,
  SAVED_NEWS_LIMIT,
  appendChatMessage,
  createSavedGroup,
  getChatLog,
  getSavedGroups,
  getSavedNews,
  getSettings,
  isSaved,
  mergeSavedData,
  removeSavedNewsItem,
  saveChatLog,
  saveNewsItem,
  saveSettings,
  setSelectedNews,
  updateChatMessage,
  updateSavedNewsItem
} from "./shared/storage.js";

const app = document.querySelector("#app");

const state = {
  activeTab: window.location.hash.startsWith("#alerts") ? "alerts" : "broker",
  settingsSection: "ai",
  linkedMarket: linkedMarketFromLocation(),
  linkedMarketData: null,
  mcpBridgeStatus: null,
  mcpBridgeBusy: false,
  editingConnectionId: "",
  aiConnectionBusy: false,
  aiConnectionController: null,
  scannerRequestDraft: "",
  pendingScannerPlan: null,
  advancedLogicOpen: false,
  backgroundMonitor: null,
  scannerAlerts: [],
  researchTarget: null,
  browserPermissions: null,
  brokerSubTab: "scanner",
  briefingItems: [],
  savedItems: [],
  groups: [DEFAULT_GROUP],
  settings: null,
  brokerCondition: null,
  brokerConditionRows: [],
  brokerConditionPresets: [],
  brokerConditionResults: [],
  brokerWatchlist: [],
  brokerWatchlistTickers: {},
  brokerWatchlistUpdatedAt: "",
  brokerPortfolioSnapshot: null,
  brokerPortfolioUpdatedAt: "",
  brokerPortfolioAutoRefreshActive: false,
  brokerPortfolioAutoRefreshTimer: null,
  brokerTickerStream: null,
  brokerTickerStreamStatus: "off",
  brokerTickerStreamMessage: "Live ticker off",
  brokerTickerStreamSymbols: [],
  brokerTickerStreamUpdatedAt: "",
  brokerResultsStatus: "idle",
  brokerResultsMessage: "",
  brokerResultsSavedAt: "",
  brokerResultsRestored: false,
  brokerResultsRunId: null,
  brokerDataGeneration: null,
  brokerResultsRecipe: null,
  selected: null,
  chatLog: [],
  chatDraft: "",
  chatAttachments: [],
  briefingQuery: "",
  briefingPage: 0,
  briefingHasMore: true,
  savedGroupId: DEFAULT_GROUP.id,
  loading: true,
  busy: "",
  error: "",
  status: "",
  translationBusy: "",
  translationModelReady: false,
  analysisTranslations: {},
  chatOpen: false,
  chatHeight: 300,
  saveTarget: null,
  noteTarget: null,
  groupDialogOpen: false,
  deepInfoModal: "",
  chatSwitchTarget: null,
  chatClearConfirm: false,
  chatRunController: null,
  subscriptionModal: "",
  kalshiSecretVisible: false,
  brokerInfoModal: "",
  conditionEditTarget: null,
  conditionFormulaTokens: [],
  conditionFormulaRowCount: 0,
  conditionFormulaSelectionStart: null,
  conditionFormulaSelectionEnd: null,
  conditionFormulaDragging: false,
  conditionFormulaWrapped: false,
  observationLibraryOpenCategoryIds: [],
  observationLibraryQuery: "",
  observationLibraryDraftQuery: "",
  scannerSelectedTemplateId: "",
  scannerDraftParameters: {},
  scannerEditTargetIndex: null,
  scannerEditDraftParameters: {},
  scannerLoopStatus: "off",
  scannerLoopMessage: "Off",
  scannerLoopController: null,
  scannerRunController: null,
  scannerLoopTargetSymbols: [],
  scannerLoopRunCount: 0,
  scannerLoopLastRunAt: "",
  scannerLoopNextRescanAt: "",
  scannerLoopRecipeHash: "",
  scannerLoopHistory: [],
  scannerLoopSeenMatchKeys: [],
  scannerRescanIntervalMinutes: 15,
  scannerAutoResultsMode: true,
  scannerDirectionFilter: "all",
  settingsSaving: false,
  kalshiConnectionTesting: false,
  localAgentStatus: localAgentDisabledStatus()
};

const PANEL_PAGE_SIZE = 24;
const BRIEFING_LOOKBACK_HOURS = 24;
const CHAT_MIN_HEIGHT = 148;
const CHAT_DEFAULT_HEIGHT = 300;
const CHAT_MIN_MAIN_HEIGHT = 190;
const DEEP_RESEARCH_CHAT_CONTEXT_MESSAGE_LIMIT = 10;
const DEEP_RESEARCH_CHAT_CONTEXT_CHAR_LIMIT = 6000;
const DEEP_RESEARCH_CHAT_MESSAGE_CHAR_LIMIT = 800;
const CHAT_ATTACHMENT_MAX_FILES = 4;
const CHAT_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;
const CHAT_ATTACHMENT_ACCEPT_ATTRIBUTE = ".md,.txt,.png,.jpg,.jpeg,.webp,.gif,.pdf,text/markdown,text/plain,image/png,image/jpeg,image/webp,image/gif,application/pdf";
const PRODUCT_NAME = "Kalshi Screener";
const SCANNER_LAB_LABEL = "Scanner Lab";
const SCANNER_LAB_DESCRIPTION = "Condition-based Observation Search for segmented Kalshi US market scopes.";
const OBSERVATION_LIBRARY_HIDDEN_CATEGORY_IDS = new Set(["target-scope", "account-positions"]);
const SCANNER_LAB_LIBRARY_SUMMARY = summarizeObservationLibraryTemplates();
const SCANNER_LAB_ENGINE_DESCRIPTION = [
  `Engine ${SCANNER_LAB_ENGINE_VERSION}`,
  `${SCANNER_LAB_LIBRARY_SUMMARY.categoryCount} categories`,
  `${SCANNER_LAB_LIBRARY_SUMMARY.templateCount} templates`,
  `${SCANNER_LAB_LIBRARY_SUMMARY.ohlcvCount} OHLC-ready templates`
].join(" / ");
const CONDITION_RULE_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MAX_CONDITION_ROWS = CONDITION_RULE_LETTERS.length;
// Saved presets are capped so storage and the list stay small.
const PRESET_LIMIT = 10;
const SCANNER_RESCAN_OPTIONS_MINUTES = [15, 30, 60, 120, 180];
const SCANNER_LOOP_HISTORY_LIMIT = 10;
const PORTFOLIO_AUTO_REFRESH_MS = 3000;
const SCANNER_EMPTY_RECIPE_MESSAGE = "Add at least one condition before running Scanner Lab.";
const DEFAULT_SCANNER_DIRECTION_FILTER = "all";
const KALSHI_LIVE_TICKER_SYMBOL_LIMIT = 10;
const SCANNER_CHAT_RESOLVE_PROVIDER = "scanner-lab-command";
const SCANNER_CHAT_CONDITION_WIDTH = 90;
const SCANNER_SCOPE_SELECTOR_HIDDEN_IDS = new Set(["saved_symbols"]);
const SCANNER_CHAT_COMMAND_EXAMPLES = [
  "Set Scanner Lab to Open Markets, YES bid >= 0.60 and 24h volume >= 1000, then run once.",
  "Add recent YES flow >= 0.60 and turn Auto Results on.",
  "Repeat Scanner Lab with rescan 30m.",
  "Stop Scanner Lab."
];
const CHAT_MARKET_SYMBOL_ALIASES = [];
const BROKER_SUBTABS = [
  { id: "scanner", label: SCANNER_LAB_LABEL },
  { id: "results", label: "Results" },
  { id: "watchlist", label: "Watchlist" },
  { id: "overview", label: "Overview" }
];
const CONDITION_QUICK_PRESETS = [
  {
    id: "price_jump",
    label: "Price Jump",
    accent: "amber",
    row: { timeframe: "1h", metric: "price_change_pct", operator: "gte", value: "3" }
  },
  {
    id: "volume_spike",
    label: "Volume Spike",
    accent: "green",
    row: { timeframe: "1d", metric: "volume_24h", operator: "gte", value: "10000" }
  },
  {
    id: "tight_spread",
    label: "Tight Spread",
    accent: "blue",
    row: { timeframe: "1h", metric: "spread_pct", operator: "lte", value: "1" }
  },
  {
    id: "closing_soon",
    label: "Closing Soon",
    accent: "rose",
    row: { timeframe: "1h", metric: "hours_to_close", operator: "lte", value: "48" }
  }
];
const TIMEFRAME_UNIT_OPTIONS = [
  { value: "m", label: "minute" },
  { value: "h", label: "hour" },
  { value: "d", label: "day" },
  { value: "w", label: "week" },
  { value: "mo", label: "month" }
];
const SUPPORTED_TIMEFRAME_MESSAGE = `Kalshi OHLC timeframes: ${TIMEFRAMES.join(", ")}.`;
const AI_PROVIDER_BY_ID = new Map(AI_PROVIDERS.map((provider) => [provider.id, provider]));
const CUSTOM_MODEL_VALUE = "__custom__";
let defaultTranslationPrimeStarted = false;
let tickerRenderTimer = null;
const LEGACY_PROVIDER_DEFAULTS = {
  gemini: ["gemini-2.5-flash", "gemini-3.1-pro-preview"],
  github: ["openai/gpt-4o"],
  groq: ["llama-3.3-70b-versatile"],
  mistral: ["mistral-large-latest"],
  qwen: ["qwen-plus"],
  openai: ["gpt-4.1-mini"],
  xai: ["grok-3-mini"],
  anthropic: ["claude-sonnet-4-6"],
  nvidia: ["meta/llama-3.1-70b-instruct"],
  local: ["llama3.1"]
};

const productUX = createProductUX({ state, render, addFiles: addChatFiles, send: sendChat });
init();

async function init() {
  bindGlobalEvents();
  render();
  await loadData();
}

function bindGlobalEvents() {}


async function loadData() {
  state.loading = true;
  state.error = "";
  render();

  try {
    const [settings, savedItems, groups, chatLog, brokerData] = await Promise.all([
      getSettings(),
      getSavedNews(),
      getSavedGroups(),
      getChatLog(),
      getBrokerData()
    ]);
    state.settings = settings;
    state.savedItems = savedItems;
    state.groups = groups;
    state.chatLog = chatLog;
    state.brokerDataGeneration = brokerData.generation;
    state.brokerConditionPresets = brokerData.presets;
    state.brokerWatchlist = brokerData.watchlist;
    restoreScannerLabState(brokerData.scannerState);
    state.scannerAutoResultsMode = settings?.KALSHI?.scannerAutoResultsMode !== false;
    state.brokerCondition = null;
    state.brokerConditionRows = [];
    if (brokerData.monitor?.enabled) {
      const recipe = brokerData.monitor.recipe;
      setConditionRows(recipe.rows, { clearResults: false });
      state.conditionFormulaTokens = scannerChatFormulaTokensFromText(recipe.formula, recipe.rows);
      state.conditionFormulaRowCount = recipe.rows.length;
      state.scannerDirectionFilter = recipe.directionFilter;
    } else restoreScannerRecipeOnOpen(settings);
    state.scannerRecipeReady = true;
    applyBackgroundMonitor(brokerData.monitor);
    state.scannerAlerts = brokerData.alerts;
    state.localAgentStatus = FEATURE_FLAGS.localAgent && settings.localAgentEnabled
      ? { ...state.localAgentStatus, state: "checking", label: "Checking", detail: "Checking Local Agent..." }
      : localAgentDisabledStatus();
    if (FEATURE_FLAGS.localAgent && settings.localAgentEnabled) {
      refreshLocalAgentStatus({ settings, silent: true });
    }

    state.selected = null;
    if (state.linkedMarket) void loadLinkedMarket();
    if (settings.mcpBridgeEnabled === true) void syncMcpNow({ silent: true });

  } catch (error) {
    state.error = error.message || "Failed to load Kalshi Screener data.";
  } finally {
    state.loading = false;
    render();
  }
}

function restoreScannerLabState(scannerLabState = null) {
  if (!scannerLabState || typeof scannerLabState !== "object") return;
  state.brokerResultsRunId = scannerLabState.runId || null;
  const results = Array.isArray(scannerLabState.results)
    ? scannerLabState.results.map(normalizeStoredScannerResult).filter(Boolean)
    : [];
  const loopHistory = normalizeStoredScannerLoopHistory(scannerLabState.loopHistory);
  const recipe = normalizeStoredScannerRecipe(scannerLabState.recipe);
  const hasStoredRecipe = Array.isArray(recipe.conditionRows) && recipe.conditionRows.length > 0;
  const shouldRestoreResultState = results.length || (hasStoredRecipe && ["empty", "error", "partial"].includes(scannerLabState.resultsStatus));
  const hasStoredRun = shouldRestoreResultState || loopHistory.length;
  if (!hasStoredRun) return;

  state.brokerConditionResults = shouldRestoreResultState ? results : [];
  state.brokerResultsStatus = shouldRestoreResultState ? scannerRestoredResultsStatus(scannerLabState.resultsStatus, results) : "idle";
  state.brokerResultsMessage = shouldRestoreResultState ? String(scannerLabState.resultsMessage || "").slice(0, 240) : "";
  state.brokerResultsSavedAt = shouldRestoreResultState ? String(scannerLabState.savedAt || "") : "";
  state.brokerResultsRestored = shouldRestoreResultState;
  state.brokerResultsRecipe = shouldRestoreResultState ? recipe : null;
  state.scannerLoopHistory = loopHistory;
  state.scannerLoopStatus = "off";
  state.scannerLoopMessage = "Loop off";
  state.scannerLoopController = null;
  state.scannerLoopTargetSymbols = [];
  state.scannerLoopRunCount = 0;
  state.scannerLoopLastRunAt = "";
  state.scannerLoopNextRescanAt = "";
}

function scannerRestoredResultsStatus(status = "", results = []) {
  if (status === "partial") return "partial";
  if (results.length) return "stale";
  if (status === "empty" || status === "error") return status;
  return "idle";
}

function normalizeStoredScannerResult(result = {}) {
  const marketTicker = normalizeWatchlistSymbol(result.marketTicker || result.symbol || "");
  const symbol = marketTicker;
  if (!symbol) return null;
  return {
    id: String(result.id || `scanner-${symbol.replace(/[^A-Z0-9]/g, "")}-restored`),
    symbol,
    marketTicker,
    eventTicker: String(result.eventTicker || ""),
    seriesTicker: String(result.seriesTicker || ""),
    eventTitle: String(result.eventTitle || ""),
    marketTitle: String(result.marketTitle || result.title || symbol),
    marketType: String(result.marketType || ""),
    yesOutcome: String(result.yesOutcome || "YES"),
    noOutcome: String(result.noOutcome || "NO"),
    scope: String(result.scope || "Open Markets"),
    formula: String(result.formula || ""),
    ruleLetter: String(result.ruleLetter || ""),
    matchedRule: String(result.matchedRule || ""),
    matchSummary: String(result.matchSummary || ""),
    match: String(result.match || ""),
    note: String(result.note || "Scanner Lab read-only market observation. No trading action or buy/sell signal."),
    source: String(result.source || "scanner_lab"),
    observedAt: String(result.observedAt || ""),
    last: result.last,
    bid: result.bid,
    ask: result.ask,
    yesBid: result.yesBid ?? result.bid,
    yesAsk: result.yesAsk ?? result.ask,
    noBid: result.noBid,
    noAsk: result.noAsk,
    yesBidSize: result.yesBidSize,
    yesAskSize: result.yesAskSize,
    noBidSize: result.noBidSize,
    noAskSize: result.noAskSize,
    open: result.open,
    high24h: result.high24h,
    low24h: result.low24h,
    vwap24h: result.vwap24h,
    priceChangePct: result.priceChangePct,
    absPriceChangePct: result.absPriceChangePct,
    volume24h: result.volume24h,
    quoteVolume24h: result.quoteVolume24h,
    liquidity: result.liquidity,
    openInterest: result.openInterest,
    spreadPct: result.spreadPct,
    rangePct24h: result.rangePct24h,
    closeTime: String(result.closeTime || ""),
    status: String(result.status || ""),
    rulesPrimary: String(result.rulesPrimary || ""),
    rulesSecondary: String(result.rulesSecondary || ""),
    rulesSummary: String(result.rulesSummary || "").slice(0, 700),
    settlementSource: String(result.settlementSource || ""),
    result: String(result.result || ""),
    canCloseEarly: result.canCloseEarly === true,
    relatedMarketCount: result.relatedMarketCount,
    isMultivariate: result.isMultivariate === true
  };
}

function normalizeStoredScannerLoopHistory(history = []) {
  return (Array.isArray(history) ? history : [])
    .map((entry) => ({
      id: String(entry?.id || `loop-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      cycle: Number(entry?.cycle) || 0,
      mode: String(entry?.mode || "Loop"),
      status: String(entry?.status || "idle"),
      observedAt: String(entry?.observedAt || ""),
      scannedSymbols: Number(entry?.scannedSymbols) || 0,
      resolvedSymbols: Number(entry?.resolvedSymbols) || 0,
      matches: Number(entry?.matches) || 0,
      newMatches: Number(entry?.newMatches) || 0,
      message: String(entry?.message || "").slice(0, 220)
    }))
    .slice(0, SCANNER_LOOP_HISTORY_LIMIT);
}

function normalizeStoredScannerRecipe(recipe = {}) {
  if (!recipe || typeof recipe !== "object") return null;
  const fallbackScope = state.settings?.KALSHI?.marketScope || "open_markets";
  const conditionRows = Array.isArray(recipe.conditionRows)
    ? recipe.conditionRows.map((row) => normalizeConditionRow(row, row?.marketScope || fallbackScope)).slice(0, MAX_CONDITION_ROWS)
    : [];
  return {
    formulaText: String(recipe.formulaText || ""),
    directionFilter: normalizeScannerDirectionFilter(recipe.directionFilter, DEFAULT_SCANNER_DIRECTION_FILTER),
    conditionRows
  };
}

function currentScannerResultRecipeSnapshot({
  rows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets"),
  formulaText = conditionFormulaText(currentConditionFormulaTokens(rows)),
  directionFilter = currentScannerDirectionFilter()
} = {}) {
  return {
    formulaText,
    directionFilter,
    conditionRows: rows.map((row) => normalizeConditionRow(row, row.marketScope || state.settings?.KALSHI?.marketScope || "open_markets"))
  };
}

function scannerWriteOptions() {
  return { expectedGeneration: state.brokerDataGeneration };
}

async function saveScannerUiValue(writer, value) {
  try {
    const saved = await writer(value, scannerWriteOptions());
    scheduleMcpSync();
    return saved;
  }
  catch (error) {
    if (error.name === "StaleScannerPageError") stopScannerLoop({ silent: true });
    state.status = `Scanner data was not saved: ${error.message || String(error)}`;
    render({ preserveScroll: true });
    throw error;
  }
}

async function persistScannerLoopHistory(entry) {
  try {
    await appendScannerLoopHistoryEntry(entry, scannerWriteOptions());
  } catch (error) {
    if (error.name === "StaleScannerPageError") stopScannerLoop({ silent: true });
    state.status = `Scanner data was not saved: ${error.message || String(error)}`;
    render({ preserveScroll: true });
  }
}














function appendUniqueItems(current, next) {
  const seen = new Set(current.map(itemKey));
  const additions = next.filter((item) => {
    const key = itemKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return [...current, ...additions];
}

function itemKey(item) {
  return String(item?.id ?? item?.url ?? item?.title ?? "");
}

function render({ preserveScroll = false } = {}) {
  applyAppearance(state.settings);
  rememberScannerRecipe();
  const kalshiCredentialsConfigured = Boolean(state.settings?.KALSHI?.apiKey && state.settings?.KALSHI?.apiSecret);
  const previousScrollTop = preserveScroll
    ? document.querySelector("#panelMain")?.scrollTop ?? 0
    : 0;

  app.innerHTML = `
    <section class="side-panel panel-workspace">
      <header class="panel-header">
        <div class="product-brand"><img src="icons/48X48.png" width="32" height="32" alt=""><span>Kalshi Screener</span></div>
        <nav class="panel-tabs" aria-label="Kalshi Screener navigation">
          ${renderPanelTab("broker", "Scanner")}
          ${renderPanelTab("results", "Results")}
          ${renderPanelTab("alerts", "Alerts")}
          ${renderPanelTab("settings", "Settings")}
        </nav>
        <div class="panel-status">
          <span class="status-pill ${kalshiCredentialsConfigured ? "is-on" : "is-muted"}">${kalshiCredentialsConfigured ? "Private key configured" : "Public markets"}</span>
          <span class="status-pill ${isChatReady(state.settings) ? "is-on" : "is-muted"}">AI ${isChatReady(state.settings) ? "On" : "Off"}</span>
        </div>
      </header>

      <main id="panelMain" class="panel-main">
        
        ${productTools()}
        ${state.error ? `<div class="error-box">${escapeHtml(state.error)}</div>` : ""}
        ${state.status && !(state.activeTab === "results" && state.status === state.brokerResultsMessage) ? `<div class="status-line">${escapeHtml(state.status)}</div>` : ""}
        ${state.linkedMarket ? renderLinkedMarketCard() : ""}
        ${state.loading ? `<div class="loading">Loading Kalshi Screener...</div>` : renderActiveTab()}
        <p class="panel-disclaimer">Not affiliated with Kalshi. Not financial advice.</p>
      </main>

      ${renderPanelChat()}
      ${state.saveTarget ? renderSaveModal() : ""}
      ${state.noteTarget ? renderNoteModal() : ""}
      ${state.groupDialogOpen ? renderGroupModal() : ""}
      ${state.deepInfoModal ? renderDeepResearchInfoModal() : ""}
      ${state.chatSwitchTarget ? renderChatSwitchModal() : ""}
      ${state.chatClearConfirm ? renderClearChatModal() : ""}
      ${state.subscriptionModal ? renderSubscriptionModal() : ""}
      ${state.brokerInfoModal ? renderBrokerInfoModal() : ""}
      ${state.researchTarget ? renderResearchModal() : ""}
      ${state.chatInfoModal ? renderChatInfoModal() : ""}
    </section>
  `;

  bindEvents();
  productUX.afterRender();
  if (preserveScroll) {
    const panelMain = document.querySelector("#panelMain");
    if (panelMain) panelMain.scrollTop = previousScrollTop;
  }
}

function renderPanelTab(id, label) {
  return `<button class="panel-tab ${state.activeTab === id ? "is-active" : ""}" data-tab="${id}">${label}</button>`;
}

function applyAppearance(settings = {}) {
  const appearance = settings?.appearance || "dark";
  if (appearance === "light" || appearance === "dark") {
    document.documentElement.dataset.theme = appearance;
    return;
  }
  delete document.documentElement.dataset.theme;
}

function renderIcon(name) {
  const icons = {
    translate: `<text class="translate-glyph" x="12" y="13">T</text>`,
    ai: `<path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"/><path d="M5 14l.8 2.2L8 17l-2.2.8L5 20l-.8-2.2L2 17l2.2-.8L5 14z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z"/>`,
    bookmark: `<path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5z"/>`,
    download: `<path d="M12 3v11"/><path d="M7 9l5 5 5-5"/><path d="M5 20h14"/>`,
    folder: `<path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h5l2 2h7a1.5 1.5 0 0 1 1.5 1.5v8A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5v-10z"/>`,
    note: `<path d="M5 4h14v16H5z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/>`,
    plus: `<path d="M12 5v14"/><path d="M5 12h14"/>`,
    share: `<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.6l6.8-4.2"/><path d="M8.6 13.4l6.8 4.2"/>`,
    trash: `<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/>`,
    search: `<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>`,
    close: `<path d="M6 6l12 12"/><path d="M18 6L6 18"/>`
  };
  return `<svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.ai}</svg>`;
}

function renderIconButton({ action, id = "", pool = "", title, icon, active = false }) {
  return `
    <button class="icon-action ${active ? "is-active" : ""}" title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}" data-action="${escapeHtml(action)}" data-id="${escapeHtml(id)}" data-pool="${escapeHtml(pool)}">
      ${renderIcon(icon)}
    </button>
  `;
}

function renderActiveTab() {
  if (state.activeTab === "alerts") return renderScannerAlertsTab();
  if (state.activeTab === "settings") return renderSettingsTab();
  if (state.activeTab === "results") {
    const rows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets");
    return renderBrokerResultsTab({ conditionRows: rows, formulaText: conditionFormulaText(currentConditionFormulaTokens(rows)) });
  }
  return renderBrokerTab();
}

// Plain words for where an alert was shown; "os presentation acknowledged" meant nothing to people.
function alertDeliveryText(alert = {}) {
  if (alert.delivery === "delivered") return { panel: "Shown in this panel", website: "Shown on the open website", summary: "Included in a grouped alert", muted: "Kept here only; desktop notifications are off", window: "Shown in the alert window" }[alert.deliveryChannel] || "Shown as a desktop notification";
  if (alert.delivery === "pending") return alert.deliveryError ? "Not shown yet; Chrome notifications may be off. Will retry." : "Waiting to be shown";
  if (alert.delivery === "cancelled") return "Not shown because alerts were turned off";
  return "Recorded";
}

function renderScannerAlertsTab() {
  const alerts = state.scannerAlerts || [];
  return `<section class="panel-section">${renderDesktopNotificationCard(state.settings || {})}<div class="settings-card"><div class="alerts-heading"><h2>Condition Alerts (${alerts.length})</h2>${alerts.length ? `<button data-delete-all-alerts>Delete all</button>` : ""}</div>
    <p class="provider-note">A market is listed when it first matches, and again only if it stops matching and later matches again. The latest 100 alerts are kept; older ones are removed automatically.</p>
    ${state.alertDeleteError ? renderActionResult(state.alertDeleteError, "warn") : ""}
    ${alerts.length ? alerts.slice(-100).reverse().map((alert, index) => `<article class="settings-card"><strong>${escapeHtml(alert.title || alert.symbol)}</strong>
      <p>${escapeHtml(alert.symbol)} · ${escapeHtml(formatDate(alert.createdAt))}</p><p>${escapeHtml(alert.recipeFormula || "Saved recipe")}</p>
      <p>${escapeHtml(alertDeliveryText(alert))} · ${alert.readAt ? "Read" : "Unread"}</p><div class="broker-result-actions"><button data-open-alert="${escapeHtml(alert.id)}">View matching result</button><button data-research-market="${escapeHtml(alert.symbol)}">Research with AI</button><button data-delete-alert="${escapeHtml(alert.id)}">Delete</button></div></article>`).join("") : "<p>No condition alerts yet.</p>"}</div></section>`;
}

// The chat's + menu closes when people click anywhere else.
document.addEventListener("click", (event) => {
  if (!state.chatAttachMenuOpen || event.target.closest?.(".chat-attach-menu, #chatAttachMenuButton")) return;
  state.chatAttachMenuOpen = false;
  render({ preserveScroll: true });
});

// Delegated so buttons in the alert toast, which lives outside the rendered panel, work too.
document.addEventListener("click", (event) => {
  const button = event.target.closest?.("[data-research-market]");
  if (button) void openResearch(button.dataset.researchMarket);
});

if (globalThis.chrome?.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "scanner-monitor-updated") void refreshBackgroundMonitor().catch((error) => {
      state.status = `Could not refresh monitoring status: ${error.message}`;
      render({ preserveScroll: true });
    });
  });
}

function currentConditionRows(fallbackScope = "open_markets") {
  const rows = Array.isArray(state.brokerConditionRows) ? state.brokerConditionRows : [];
  return rows.filter(Boolean).map((row) => normalizeConditionRow(row, fallbackScope));
}

function conditionRuleLetter(index) {
  return CONDITION_RULE_LETTERS[index] || String(index + 1);
}

function conditionRuleIndex(letter) {
  return CONDITION_RULE_LETTERS.indexOf(String(letter || "").toUpperCase());
}

function defaultConditionFormulaTokens(rows) {
  return rows.flatMap((_, index) => {
    const conditionToken = { type: "condition", value: conditionRuleLetter(index) };
    return index === 0
      ? [conditionToken]
      : [{ type: "operator", value: "AND" }, conditionToken];
  });
}

function sanitizeConditionFormulaTokens(tokens, rows) {
  const validLetters = new Set(rows.map((_, index) => conditionRuleLetter(index)));
  const normalized = Array.isArray(tokens)
    ? tokens
      .map((token) => ({
        type: String(token?.type || ""),
        value: String(token?.value || "").toUpperCase()
      }))
      .filter((token) => {
        if (token.type === "condition") return validLetters.has(token.value);
        if (token.type === "operator") return token.value === "AND" || token.value === "OR";
        return token.type === "open" || token.type === "close" || token.type === "not";
      })
    : [];

  const compact = normalized.reduce((acc, token) => {
    const previous = acc[acc.length - 1];
    if (token.type === "operator" && (!previous || previous.type === "operator" || previous.type === "open" || previous.type === "not")) {
      return acc;
    }
    if (token.type === "close" && previous?.type === "operator") {
      acc.pop();
    }
    acc.push(token);
    return acc;
  }, []);

  while (compact[0]?.type === "operator" || compact[0]?.type === "close") compact.shift();
  while (["operator", "open", "not"].includes(compact[compact.length - 1]?.type)) compact.pop();
  return compact;
}

function syncConditionFormulaWithRows(rows, { reset = false } = {}) {
  const rowCount = rows.length;
  if (!rowCount) {
    state.conditionFormulaTokens = [];
    state.conditionFormulaRowCount = 0;
    state.conditionFormulaSelectionStart = null;
    state.conditionFormulaSelectionEnd = null;
    state.conditionFormulaDragging = false;
    return;
  }
  const previousCount = state.conditionFormulaRowCount || 0;
  const needsDefault = reset || !state.conditionFormulaTokens.length;
  let shouldClearSelection = needsDefault || (previousCount > 0 && previousCount !== rowCount);
  let tokens = needsDefault
    ? defaultConditionFormulaTokens(rows)
    : sanitizeConditionFormulaTokens(state.conditionFormulaTokens, rows);

  if (!reset && previousCount && rowCount > previousCount) {
    for (let index = previousCount; index < rowCount; index += 1) {
      if (tokens.length) tokens.push({ type: "operator", value: "AND" });
      tokens.push({ type: "condition", value: conditionRuleLetter(index) });
    }
  }

  if (!tokens.some((token) => token.type === "condition")) {
    tokens = defaultConditionFormulaTokens(rows);
    shouldClearSelection = true;
  }

  state.conditionFormulaTokens = tokens;
  state.conditionFormulaRowCount = rowCount;
  if (shouldClearSelection) {
    state.conditionFormulaSelectionStart = null;
    state.conditionFormulaSelectionEnd = null;
    state.conditionFormulaDragging = false;
  }
}

function currentConditionFormulaTokens(rows) {
  syncConditionFormulaWithRows(rows);
  return state.conditionFormulaTokens;
}

function setConditionFormulaTokens(tokens, rows, { clearResults = true } = {}) {
  if (!rows.length) {
    state.conditionFormulaTokens = [];
    state.conditionFormulaRowCount = 0;
    state.conditionFormulaSelectionStart = null;
    state.conditionFormulaSelectionEnd = null;
    state.conditionFormulaDragging = false;
    clearBrokerConditionResults();
    return;
  }
  const sanitized = sanitizeConditionFormulaTokens(tokens, rows);
  state.conditionFormulaTokens = sanitized.some((token) => token.type === "condition")
    ? sanitized
    : defaultConditionFormulaTokens(rows);
  state.conditionFormulaRowCount = rows.length;
  state.conditionFormulaSelectionStart = null;
  state.conditionFormulaSelectionEnd = null;
  state.conditionFormulaDragging = false;
  if (clearResults) clearBrokerConditionResults();
}

function formulaSelectionBounds() {
  const start = state.conditionFormulaSelectionStart;
  const end = state.conditionFormulaSelectionEnd;
  if (!Number.isInteger(start) || !Number.isInteger(end)) return null;
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function formulaTokenText(token) {
  if (token.type === "operator") return token.value.toLowerCase();
  if (token.type === "open") return "(";
  if (token.type === "close") return ")";
  if (token.type === "not") return "!";
  return token.value;
}

function conditionFormulaText(tokens) {
  return tokens
    .map(formulaTokenText)
    .join(" ")
    .replaceAll("! ", "!")
    .replaceAll("( ", "(")
    .replaceAll(" )", ")")
    .trim();
}

function normalizeScannerDirectionFilter(value = DEFAULT_SCANNER_DIRECTION_FILTER, fallback = DEFAULT_SCANNER_DIRECTION_FILTER) {
  const normalized = String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["all", "any", "none", "all_contracts", "no_lens"].includes(normalized)) return "all";
  if (["yes", "yes_gaining", "yes_rising", "up", "rising", "bullish", "positive"].includes(normalized)) return "yes_gaining";
  if (["no", "no_gaining", "no_rising", "down", "falling", "bearish", "negative"].includes(normalized)) return "no_gaining";
  if (fallback && fallback !== value) return normalizeScannerDirectionFilter(fallback, "all");
  return "all";
}

function currentScannerDirectionFilter() {
  return normalizeScannerDirectionFilter(state.scannerDirectionFilter, DEFAULT_SCANNER_DIRECTION_FILTER);
}

function scannerDirectionLabel(directionFilter = currentScannerDirectionFilter()) {
  const normalized = normalizeScannerDirectionFilter(directionFilter);
  if (normalized === "yes_gaining") return "YES gaining";
  if (normalized === "no_gaining") return "NO gaining";
  return "All contracts";
}

function scannerDirectionFormulaText(formula = "", directionFilter = currentScannerDirectionFilter()) {
  const lens = scannerDirectionLabel(directionFilter);
  const logic = String(formula || "").trim();
  return logic ? `${lens} | ${logic}` : lens;
}

function nextScannerDirectionFilter(directionFilter = currentScannerDirectionFilter()) {
  const normalized = normalizeScannerDirectionFilter(directionFilter);
  if (normalized === "all") return "yes_gaining";
  if (normalized === "yes_gaining") return "no_gaining";
  return "all";
}

function validateConditionFormula(tokens, rows) {
  const validLetters = new Set(rows.map((_, index) => conditionRuleLetter(index)));
  let depth = 0;
  let expectingCondition = true;
  for (const token of tokens) {
    if (token.type === "condition") {
      if (!expectingCondition || !validLetters.has(token.value)) return false;
      expectingCondition = false;
      continue;
    }
    if (token.type === "not") {
      if (!expectingCondition) return false;
      continue;
    }
    if (token.type === "open") {
      if (!expectingCondition) return false;
      depth += 1;
      continue;
    }
    if (token.type === "close") {
      if (expectingCondition || depth <= 0) return false;
      depth -= 1;
      expectingCondition = false;
      continue;
    }
    if (token.type === "operator") {
      if (expectingCondition) return false;
      expectingCondition = true;
      continue;
    }
    return false;
  }
  return !expectingCondition && depth === 0;
}

function parseConditionEditTarget() {
  if (!state.conditionEditTarget) return null;
  const [index, field] = String(state.conditionEditTarget).split(":");
  const parsedIndex = Number(index);
  if (!Number.isInteger(parsedIndex) || !field) return null;
  return { index: parsedIndex, field };
}

function clearBrokerConditionResults(message = "") {
  if (state.backgroundMonitor?.enabled) void stopScannerLoop();
  state.brokerConditionResults = [];
  state.brokerResultsStatus = "idle";
  state.brokerResultsMessage = message;
  state.brokerResultsSavedAt = "";
  state.brokerResultsRestored = false;
  state.brokerResultsRecipe = null;
  // Hide results for an edited recipe without deleting the persisted successful run.
}

function setConditionRows(rows, { marketScope = "", clearResults = true } = {}) {
  const fallbackScope = marketScope || state.settings?.KALSHI?.marketScope || "open_markets";
  const normalized = Array.isArray(rows)
    ? rows.filter(Boolean).map((row) => normalizeConditionRow(row, fallbackScope)).slice(0, MAX_CONDITION_ROWS)
    : [];
  state.brokerConditionRows = normalized;
  state.brokerCondition = normalized[0] || null;
  if (clearResults) clearBrokerConditionResults();
  syncConditionFormulaWithRows(normalized);
  if (state.settings) {
    const nextMarketScope = normalized[0]?.marketScope || marketScope || state.settings.KALSHI?.marketScope || "open_markets";
    state.settings = {
      ...state.settings,
      KALSHI: {
        ...(state.settings.KALSHI || {}),
        marketScope: nextMarketScope
      }
    };
  }
}

function updateConditionRow(index, patch = {}) {
  const rows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets");
  if (!rows[index]) return;
  rows[index] = normalizeConditionRow({
    ...rows[index],
    ...patch
  }, rows[index].marketScope);
  setConditionRows(rows);
}

function renderBrokerTab() {
  const settings = state.settings || {};
  const KALSHI = settings.KALSHI || {};
  const conditionRows = currentConditionRows(KALSHI.marketScope || "open_markets");
  const formulaTokens = currentConditionFormulaTokens(conditionRows);
  const formulaText = conditionFormulaText(formulaTokens);
  const condition = conditionRows[0];
  const scope = marketScopeById(condition?.marketScope || KALSHI.marketScope || "open_markets");
  const brokerContext = currentBrokerContextPackage({ settings, conditionRows, formulaText, condition });
  const brokerModel = {
    settings,
    KALSHI,
    conditionRows,
    formulaText,
    condition,
    scope,
    brokerContext
  };
  return `
    <section class="panel-section broker-panel">
      <nav class="broker-subtabs" aria-label="Kalshi workspace sections">
        ${BROKER_SUBTABS.filter((tab) => tab.id !== "results").map((tab) => renderBrokerSubTabButton(tab)).join("")}
      </nav>
      ${renderBrokerSubTabContent(brokerModel)}
    </section>
  `;
}

function currentBrokerContextPackage({
  settings = state.settings || {},
  conditionRows = currentConditionRows(settings.KALSHI?.marketScope || "open_markets"),
  formulaText = conditionFormulaText(currentConditionFormulaTokens(conditionRows)),
  condition = conditionRows[0],
  conditionResults = state.brokerConditionResults,
  includeConditionResults = true,
  includeScannerLabRecipe = true
} = {}) {
  const baseContext = buildBrokerContextPackage({
    settings,
    selectedItem: state.selected,
    conditionRow: includeScannerLabRecipe ? condition : null,
    conditionResults: includeConditionResults ? conditionResults : [],
    watchlist: state.brokerWatchlist,
    portfolioSnapshot: state.brokerPortfolioSnapshot
  });
  return {
    ...baseContext,
    chatAttachments: buildChatAttachmentContext(),
    tickerStream: buildTickerStreamContext(),
    scannerLab: buildScannerLabAiContext({
      conditionRows: includeScannerLabRecipe ? conditionRows : [],
      formulaText: includeScannerLabRecipe ? formulaText : "",
      includeRecipe: includeScannerLabRecipe
    })
  };
}

function buildChatAttachmentContext() {
  return state.chatLog
    .filter((message) => message && message.contextPayload && !message.pending)
    .slice(-10)
    .map((message) => ({
      id: message.id || "",
      type: message.contextType || message.contextPayload?.type || "context",
      label: message.displayText || message.text || "Attached context",
      createdAt: message.createdAt || "",
      payload: message.contextPayload
    }));
}

function buildTickerStreamContext() {
  return {
    active: tickerStreamActive(),
    status: state.brokerTickerStreamStatus,
    message: state.brokerTickerStreamMessage,
    marketTickers: state.brokerTickerStreamSymbols.slice(0, KALSHI_LIVE_TICKER_SYMBOL_LIMIT),
    symbols: state.brokerTickerStreamSymbols.slice(0, KALSHI_LIVE_TICKER_SYMBOL_LIMIT),
    updatedAt: state.brokerTickerStreamUpdatedAt || ""
  };
}

function buildScannerLabAiContext({ conditionRows = [], formulaText = "", includeRecipe = true } = {}) {
  const scope = marketScopeById(conditionRows[0]?.marketScope || state.settings?.KALSHI?.marketScope || "open_markets");
  const context = {
    state: {
      loopStatus: state.scannerLoopStatus,
      loopMessage: state.scannerLoopMessage,
      autoResultsMode: state.scannerAutoResultsMode,
      directionFilter: currentScannerDirectionFilter(),
      rescanIntervalMinutes: state.scannerRescanIntervalMinutes,
      nextRescanAt: state.scannerLoopNextRescanAt,
      targetMarketTickers: includeRecipe ? state.scannerLoopTargetSymbols.slice(0, 50) : [],
      targetSymbols: includeRecipe ? state.scannerLoopTargetSymbols.slice(0, 50) : [],
      resultCount: includeRecipe ? state.brokerConditionResults.length : 0
    },
    routingRules: {
      scannerLab: "Use REST for market-wide scans, broad contract requests, formula scans, and OHLC indicator scans.",
      chatWebSocket: "Use WebSocket only for explicit live observation of 10 or fewer user-selected Kalshi market tickers.",
      chatRest: "Use REST when the prompt references more than 10 contracts, a market scope, or a condition search."
    }
  };
  if (!includeRecipe) return context;
  return {
    ...context,
    currentRecipe: {
      scope: {
        id: scope.id,
        label: scope.label,
        family: scope.family,
        estimatedSymbols: scope.estimatedSymbols,
        estimatedScanTime: scope.estimatedScanTime
      },
      directionFilter: currentScannerDirectionFilter(),
      formula: formulaText,
      conditions: conditionRows.map((row, index) => ({
        letter: conditionRuleLetter(index),
        label: conditionLabel(row),
        marketScope: row.marketScope,
        timeframe: row.timeframe,
        metric: row.metric,
        operator: row.operator,
        value: row.value,
        scannerTemplateId: row.scannerTemplateId || row.sourceTemplateId || "",
        scannerParameters: row.scannerParameters || {},
        scannerClauses: row.scannerClauses || []
      }))
    },
    observationLibrary: SCANNER_TEMPLATE_CATEGORIES.map((category) => ({
      id: category.id,
      label: category.label,
      templates: category.templates.map((template) => {
        const status = scannerTemplateStatusView(template);
        return {
          id: template.id,
          title: template.title,
          description: template.description,
          categoryPath: template.categoryPath || [],
          action: template.action || "condition",
          status: status.label,
          executable: status.tone !== "later" && status.tone !== "private",
          dataRequirement: template.dataRequirement || [],
          defaultParameters: template.defaultParameters || {},
          parameterSchema: template.parameterSchema || []
        };
      })
    }))
  };
}

function renderBrokerSubTabButton(tab) {
  const resultCount = tab.id === "results" && state.brokerConditionResults.length
    ? ` ${state.brokerConditionResults.length}`
    : "";
  const watchCount = tab.id === "watchlist" && state.brokerWatchlist.length
    ? ` ${state.brokerWatchlist.length}`
    : "";
  return `<button class="broker-subtab ${state.brokerSubTab === tab.id ? "is-active" : ""}" data-broker-subtab="${escapeHtml(tab.id)}">${escapeHtml(tab.label)}${escapeHtml(resultCount || watchCount)}</button>`;
}

function renderBrokerSubTabContent(model) {
  if (state.brokerSubTab === "scanner") return renderBrokerScannerTab(model);
  if (state.brokerSubTab === "results") return renderBrokerResultsTab(model);
  if (state.brokerSubTab === "watchlist") return renderBrokerWatchlistTab(model);
  if (state.brokerSubTab === "overview") return renderBrokerOverviewTab(model);
  return renderBrokerScannerTab(model);
}

function renderBrokerOverviewTab({ KALSHI, brokerContext }) {
  const scope = marketScopeById(KALSHI.marketScope || "open_markets");
  const gate = portfolioSnapshotGate(KALSHI);
  return `
      ${renderPortfolioSnapshotCard(KALSHI, brokerContext)}

      <div class="settings-card broker-card broker-hero broker-section-status">
        <div class="settings-card-heading">
          <div>
            <h2>Read-only Access</h2>
            <p class="broker-section-subtitle">Public market data plus optional signed read-only account snapshot.</p>
          </div>
          <div class="broker-heading-actions">
            <button class="broker-guide-button" data-broker-info="overview">Guide</button>
            <span class="subscription-badge ${gate.hasCredentials ? "is-active" : "is-off"}">${gate.hasCredentials ? "Kalshi On" : "Kalshi Off"}</span>
          </div>
        </div>
        ${renderStatusLine("API credentials", gate.hasCredentials, gate.hasCredentials ? "Configured in Settings" : "Not configured")}
        ${renderStatusLine("Read-only key", gate.readOnly, gate.readOnly ? "Confirmed by user" : "Read-only confirmation required")}
        ${renderStatusLine("Connection test", KALSHI.connectionStatus === "connected", KALSHI.connectionMessage || "Not tested")}
        ${renderStatusLine("Chat / Deep positions context", brokerContext.KALSHI.includePortfolioContext, brokerContext.KALSHI.includePortfolioContext ? "Explicit opt-in enabled" : "Off")}
        ${renderStatusLine("OAuth / Broker API", false, "Excluded")}
        ${renderStatusLine("Public REST", true, "Available without API key")}
        ${renderStatusLine("Read-only WebSocket", gate.hasCredentials, gate.hasCredentials ? "Credentials configured" : "Optional credentials required")}
        ${renderStatusLine("Default scope", true, scope.label)}
      </div>

      ${renderBrokerGuidesCard()}
  `;
}

function portfolioSnapshotGate(KALSHI = {}) {
  const hasCredentials = Boolean(KALSHI.apiKey && KALSHI.apiSecret);
  const readOnly = KALSHI.readOnlyConfirmed === true;
  const optIn = KALSHI.includePortfolioContext === true;
  const connected = KALSHI.connectionStatus === "connected";
  if (!hasCredentials) {
    return {
      ready: false,
      hasCredentials,
      readOnly,
      optIn,
      connected,
      badge: "Setup needed",
      message: "Public market data works without keys. Add Key ID and RSA Private Key only for optional private snapshots or live-readiness checks."
    };
  }
  if (!readOnly) {
    return {
      ready: false,
      hasCredentials,
      readOnly,
      optIn,
      connected,
      badge: "Read-only required",
      message: "Confirm read-only permission in Settings."
    };
  }
  return {
    ready: true,
    hasCredentials,
    readOnly,
    optIn,
    connected,
    badge: optIn ? "Snapshot + Chat opt-in" : "Local snapshot only",
    message: connected ? "Ready for read-only snapshot" : "Ready, but connection has not been tested"
  };
}

function renderPortfolioSnapshotCard(KALSHI, brokerContext) {
  const gate = portfolioSnapshotGate(KALSHI);
  const snapshot = gate.ready ? state.brokerPortfolioSnapshot : null;
  const autoActive = portfolioAutoRefreshActive();
  const buttonLabel = state.busy === "portfolio"
    ? "Loading..."
    : autoActive ? "Refresh Now" : "Load Account/Positions";
  const badgeLabel = autoActive ? "Auto-refreshing every 3s" : gate.badge;
  return `
      <div class="settings-card broker-card broker-section-privacy">
        <div class="settings-card-heading">
          <div>
            <h2>Account & Positions</h2>
            <p class="broker-section-subtitle">Account summary first, positions list below.</p>
          </div>
          <span class="subscription-badge ${gate.ready ? "is-active" : "is-off"}">${escapeHtml(badgeLabel)}</span>
        </div>
        <div class="broker-actions portfolio-actions">
          <button id="loadPortfolioSnapshotButton" class="button-primary" ${gate.ready && state.busy !== "portfolio" ? "" : "disabled"}>${buttonLabel}</button>
          <button id="stopPortfolioAutoRefreshButton" class="results-stop-control" ${autoActive ? "" : "disabled"}>Stop Auto</button>
        </div>
        ${snapshot ? renderPortfolioSnapshot(snapshot) : renderPortfolioSnapshotPlaceholder(gate)}
      </div>
  `;
}

function renderPortfolioSnapshotPlaceholder(gate = {}) {
  const detail = gate.ready
    ? "Press Load Account/Positions to show account metrics and non-zero positions, then refresh every 3 seconds while the panel stays open."
    : gate.message || "Configure read-only Kalshi access in Settings.";
  return `
    <div class="portfolio-snapshot is-empty-state">
      <div class="portfolio-summary-section">
        <div class="portfolio-section-title">
          <strong>Account Summary</strong>
          <span>Snapshot not loaded</span>
        </div>
        <div class="broker-result-metrics portfolio-metrics">
          ${renderPortfolioMetric("Portfolio Value", "-")}
          ${renderPortfolioMetric("Cash Balance", "-")}
          ${renderPortfolioMetric("Market Exposure", "-")}
          ${renderPortfolioMetric("Open P/L", "-")}
          ${renderPortfolioMetric("Positions", "-")}
          ${renderPortfolioMetric("Snapshot Time", "-")}
        </div>
      </div>
      <div class="portfolio-holdings-section">
        <div class="portfolio-section-title">
          <strong>Positions List</strong>
          <span>Snapshot not loaded</span>
        </div>
        <div class="empty">${escapeHtml(detail)}</div>
      </div>
    </div>
  `;
}

function renderPortfolioSnapshot(snapshot = {}) {
  const positions = portfolioPositions(snapshot);
  const visiblePositions = positions.slice(0, 30);
  const summary = snapshot.summary || {};
  const totalTone = marketMetricToneClass(summary.totalProfitLossPct);
  const metrics = [
    renderPortfolioMetric("Portfolio Value", formatUsdValue(summary.portfolioValueUsd || snapshot.portfolioValue)),
    renderPortfolioMetric("Cash Balance", formatUsdValue(summary.cashUsd || snapshot.cash)),
    renderPortfolioMetric("Market Exposure", formatUsdValue(summary.totalMarketValueUsd)),
    renderPortfolioMetric("Open P/L", formatSignedUsdValue(summary.totalProfitLossUsd), { toneClass: totalTone }),
    renderPortfolioMetric("Positions", positions.length),
    renderPortfolioMetric("Snapshot Time", snapshot.checkedAt ? formatDate(snapshot.checkedAt) : "Now")
  ].join("");
  const positionRows = visiblePositions.map(renderPortfolioHoldingRow).join("");
  return `
    <div class="portfolio-snapshot">
      <div class="portfolio-summary-section">
        <div class="portfolio-section-title">
          <strong>Account Summary</strong>
          <span>${portfolioAutoRefreshActive() ? "Auto-refreshing every 3s" : "Read-only snapshot"}</span>
        </div>
        <div class="broker-result-metrics portfolio-metrics">${metrics}</div>
      </div>
      <div class="portfolio-holdings-section">
        <div class="portfolio-section-title">
          <strong>Positions List</strong>
          <span>${positions.length ? positions.length > visiblePositions.length ? `Showing ${visiblePositions.length} of ${positions.length}` : `${positions.length} positions` : "0 positions"}</span>
        </div>
        ${positions.length ? `
          <div class="portfolio-holdings">
            <div class="portfolio-holdings-head">
              <strong>Market</strong>
              <span>Position</span>
              <span>Avg Price</span>
              <span>Mark</span>
              <span>Exposure</span>
              <span>P/L</span>
              <span></span>
            </div>
            ${positionRows}
          </div>
        ` : `<div class="empty">No open Kalshi positions returned.</div>`}
      </div>
      <p class="provider-note">Snapshot is read-only account and position data from Kalshi. Positions include market ticker, contract count, mark price, exposure, and P/L only when Kalshi provides those fields. API Key and RSA Private Key are never shown here or sent to Chat/Deep.</p>
    </div>
  `;
}

function renderPortfolioHoldingRow(holding = {}) {
  const toneClass = marketMetricToneClass(holding.profitLossUsd);
  const marketTicker = holding.marketTicker || holding.displayAsset || holding.asset || "";
  return `
    <div class="portfolio-holding-row">
      <div class="portfolio-holding-asset">
        <strong>${escapeHtml(marketTicker)}</strong>
        <span>${escapeHtml(holding.marketSymbol || "Kalshi position")}</span>
      </div>
      <span class="portfolio-holding-amount">${escapeHtml(formatPortfolioAmount(holding.amount))}</span>
      <span>${escapeHtml(formatUsdValue(holding.avgEntryPriceUsd))}</span>
      <span>${escapeHtml(formatUsdValue(holding.currentPriceUsd))}</span>
      <span>${escapeHtml(formatUsdValue(holding.currentValueUsd))}</span>
      <span class="${escapeHtml(toneClass)}">${escapeHtml(formatSignedUsdValue(holding.profitLossUsd))}</span>
      <button data-holding-send-chat="${escapeHtml(portfolioHoldingKey(holding))}">Send to Chat</button>
    </div>
  `;
}

function portfolioPositions(snapshot = {}) {
  if (Array.isArray(snapshot?.positions)) return snapshot.positions;
  if (Array.isArray(snapshot?.holdings)) return snapshot.holdings;
  return [];
}

function renderPortfolioMetric(label, value, options = {}) {
  const config = typeof options === "number" ? { fractionDigits: options } : options;
  const safeToneClass = ["is-up", "is-down", "is-flat"].includes(config.toneClass) ? ` ${config.toneClass}` : "";
  const title = config.title ? ` title="${escapeHtml(config.title)}"` : "";
  return `
    <div class="broker-metric${safeToneClass}"${title}>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(config.formatted || formatPortfolioAmount(value, config.fractionDigits ?? 6))}</strong>
    </div>
  `;
}

function formatPortfolioAmount(value, fractionDigits = 8) {
  if (value === undefined || value === null || value === "") return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return formatNumber(number, fractionDigits);
}

function formatUsdValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  const absolute = Math.abs(number);
  const fractionDigits = absolute > 0 && absolute < 1 ? 4 : absolute < 100 ? 2 : 0;
  return `$${formatNumber(number, fractionDigits)}`;
}

function formatSignedUsdValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  const prefix = number > 0 ? "+" : number < 0 ? "-" : "";
  return `${prefix}${formatUsdValue(Math.abs(number))}`;
}

function formatProfitPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return `${number > 0 ? "+" : ""}${formatNumber(number, 2)}%`;
}

function marketMetricToneClass(changePct) {
  const number = Number(changePct);
  if (!Number.isFinite(number)) return "";
  if (number > 0) return "is-up";
  if (number < 0) return "is-down";
  return "is-flat";
}

function formatSignedNumber(value, fractionDigits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return `${number > 0 ? "+" : ""}${formatNumber(number, fractionDigits)}`;
}

function renderMarketMetric(label, value, { fractionDigits = 2, suffix = "", formatter = null, toneClass = "" } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  const safeToneClass = ["is-up", "is-down", "is-flat"].includes(toneClass) ? ` ${toneClass}` : "";
  const formattedValue = formatter ? formatter(value) : formatNumber(value, fractionDigits);
  return `
    <div class="broker-metric${safeToneClass}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(formattedValue)}${escapeHtml(suffix)}</strong>
    </div>
  `;
}

function formatProbabilityPrice(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return `${formatNumber(number * 100, 1)}c`;
}

function renderContractMetaChip(value, label = "") {
  const text = String(value || "").trim();
  if (!text) return "";
  return `<span>${escapeHtml(label ? `${label}: ${text}` : text)}</span>`;
}

function renderContractRules(result = {}) {
  const rules = String(result.rulesSummary || result.rulesPrimary || result.rulesSecondary || "").trim();
  const matched = String(result.matchSummary || result.matchedRule || result.match || "").trim();
  return [
    matched ? `<p><strong>Matched:</strong> ${escapeHtml(matched)}</p>` : "",
    rules ? `<p><strong>Kalshi rules:</strong> ${escapeHtml(clampText(rules, 260))}</p>` : ""
  ].join("");
}

function renderBrokerScannerTab({ conditionRows, formulaText, scope }) {
  const formulaDisplayText = scannerDirectionFormulaText(formulaText);
  const recipeText = conditionRows.length
    ? `${formulaDisplayText} | ${conditionRows.map((row, index) => `${conditionRuleLetter(index)}. ${conditionLabel(row)}`).join(" / ")}`
    : "No condition selected";
  return `
      ${renderScannerRequest()}
      <div class="settings-card broker-card broker-section-builder scanner-workbench-card">
        <div class="settings-card-heading">
          <div>
            <h2>${SCANNER_LAB_LABEL}</h2>
            <p class="broker-section-subtitle">Describe a search, review the draft, then run or monitor it.</p>
          </div>
          <div class="broker-heading-actions">
            <button class="broker-guide-button" data-broker-info="condition">Guide + Examples</button>
            <button class="broker-guide-button" data-broker-info="scope">Scope</button>
            <span class="source-pill">${escapeHtml(scope.estimatedScanTime)}</span>
          </div>
        </div>
        <div class="scanner-workbench">
          ${renderObservationLibraryPane(conditionRows)}
          <section class="scanner-builder-pane" aria-label="Scanner Lab condition stack">
            <div class="scanner-scope-bar">
              <label>Default Scope
                <select id="brokerMarketScope" class="field">
                  ${renderScannerScopeSelectOptions(scope.id)}
                </select>
              </label>
              <div class="broker-scope-meta is-compact">
                ${renderStatusLine("Contracts", true, scope.estimatedSymbols)}
                ${renderStatusLine("Time", true, scope.estimatedScanTime)}
              </div>
            </div>
            ${renderConditionRecipeBuilder(conditionRows)}
            ${renderScannerControlDock(conditionRows)}
            ${renderScannerRunStatusPanel()}
            <div class="broker-current-condition">
              <span>Observation recipe</span>
              <strong>${escapeHtml(recipeText)}</strong>
            </div>
          </section>
        </div>
      </div>

      <div class="settings-card broker-card broker-section-presets">
        <div class="settings-card-heading">
          <h2>Saved Presets</h2>
          <span class="source-pill">${state.brokerConditionPresets.length}/${PRESET_LIMIT}</span>
        </div>
        <p class="provider-note">Save Preset keeps up to ${PRESET_LIMIT}. Mark one as default and Scanner opens with it; without a default, Scanner opens with your last conditions.</p>
        ${state.brokerConditionPresets.length ? state.brokerConditionPresets.slice().reverse().map(renderConditionPreset).join("") : `<div class="empty">No saved presets yet. Add conditions above and press Save Preset.</div>`}
      </div>
  `;
}

function scannerScopeSelectorOptions(currentScopeId = "") {
  return MARKET_SCOPES.filter((entry) => {
    if (entry.hidden && entry.id !== currentScopeId) return false;
    if (entry.id === "watchlist") return true;
    if (entry.id === currentScopeId) return true;
    return !SCANNER_SCOPE_SELECTOR_HIDDEN_IDS.has(entry.id);
  });
}

function scannerScopeIsSelectable(scopeId = "") {
  return marketScopeById(scopeId).selectable !== false;
}

function renderScannerScopeSelectOptions(currentScopeId = "") {
  const groups = new Map();
  scannerScopeSelectorOptions(currentScopeId).forEach((entry) => {
    const label = entry.group || "Scopes";
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(entry);
  });
  return Array.from(groups.entries()).map(([label, entries]) => `
    <optgroup label="${escapeHtml(label)}">
      ${entries.map((entry) => {
        const disabled = entry.selectable === false;
        const suffix = disabled ? " (not enabled)" : "";
        return `<option value="${escapeHtml(entry.id)}" ${entry.id === currentScopeId ? "selected" : ""} ${disabled ? "disabled" : ""}>${escapeHtml(entry.label + suffix)}</option>`;
      }).join("")}
    </optgroup>
  `).join("");
}

function renderScannerControlDock(conditionRows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets")) {
  const running = scannerLoopActive();
  const scanning = state.busy === "broker-scan";
  const hasConditions = conditionRows.length > 0 || Boolean(pendingSetupTemplate(conditionRows));
  const controlsDisabled = !hasConditions || scanning || running;
  const stopEnabled = running || scanning;
  const runLabel = scanning ? renderLoadingLabel("Running") : "Run Once";
  const startLabel = running ? renderLoadingLabel("Looping") : "Repeat";
  return `
    <div class="scanner-control-dock">
      <p class="provider-note">Repeat runs in the background. Full scans discover new matches; previously matched markets are checked about every minute between full scans. Chrome shutdown, sleep and offline periods delay checks. Editing the recipe stops monitoring; press Repeat to apply the edited recipe.</p>
      <div class="scanner-control-row is-top">
        <label class="scanner-inline-select scanner-control-rescan" title="Full market rediscovery interval">
          <span>Rescan</span>
          <select id="scannerRescanInterval">
            ${SCANNER_RESCAN_OPTIONS_MINUTES.map((minutes) => `<option value="${minutes}" ${minutes === state.scannerRescanIntervalMinutes ? "selected" : ""}>${scannerRescanOptionLabel(minutes)}</option>`).join("")}
          </select>
        </label>
        <label class="scanner-review-toggle scanner-control-review" title="Open Results after Run Once or the first Repeat scan">
          <input id="scannerAutoResultsMode" type="checkbox" ${state.scannerAutoResultsMode ? "checked" : ""} />
          <span>Auto Results</span>
        </label>
        <button id="scannerLoopHelpButton" class="scanner-help-button scanner-control-help" aria-label="Open Scanner Lab help">? Help</button>
      </div>
      <div class="scanner-control-row is-main">
        <button id="runConditionButton" class="scanner-control-run button-primary" ${controlsDisabled ? "disabled" : ""}>${runLabel}</button>
        <button id="startScannerLoopButton" class="scanner-control-start" ${running || controlsDisabled ? "disabled" : ""}>${startLabel}</button>
        <button id="stopScannerLoopButton" class="scanner-control-stop" ${stopEnabled ? "" : "disabled"}>Stop</button>
      </div>
      <div class="scanner-loop-status">
        <span>${escapeHtml(scannerLoopStatusLabel())}</span>
        <span>${escapeHtml(scannerLoopTargetLabel())}</span>
        <span>${escapeHtml(scannerLoopNextRescanLabel())}</span>
      </div>
      <div class="broker-actions scanner-secondary-actions">
        <button id="saveConditionButton" ${conditionRows.length ? "" : "disabled"}>Save Preset (${state.brokerConditionPresets.length}/${PRESET_LIMIT})</button>
      </div>
      ${state.presetActionResult ? renderActionResult(state.presetActionResult.text, state.presetActionResult.tone) : ""}
      ${state.notificationCheckAsk || state.notificationCheckHelp ? renderNotificationCheck() : ""}
    </div>
  `;
}

function renderLoadingLabel(label) {
  return `<span class="loading-inline-label">${escapeHtml(label)}${renderThinkingDots()}</span>`;
}

function renderThinkingDots() {
  return '<span class="thinking-dots" aria-hidden="true"><span></span><span></span><span></span></span>';
}

function renderScannerRunStatusPanel() {
  const running = scannerLoopActive();
  const isScanning = state.busy === "broker-scan";
  const hasConditions = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets").length > 0;
  const resultCount = Array.isArray(state.brokerConditionResults) ? state.brokerConditionResults.length : 0;
  const hasResultsView = resultCount
    || ["error", "empty", "stale", "partial"].includes(state.brokerResultsStatus)
    || (Array.isArray(state.scannerLoopHistory) && state.scannerLoopHistory.length);
  const statusClass = isScanning
    ? "is-loading"
    : state.brokerResultsStatus === "error"
      ? "is-error"
      : running
        ? "is-active"
        : state.brokerResultsStatus === "live"
          ? "is-live"
          : ["stale", "partial"].includes(state.brokerResultsStatus)
            ? "is-stale"
            : state.brokerResultsStatus === "empty"
            ? "is-empty"
            : hasConditions ? "" : "is-empty";
  const title = isScanning
    ? "Running observation"
    : running
      ? "Loop active"
      : state.brokerResultsStatus === "error"
        ? "Last run failed"
        : state.brokerResultsStatus === "live"
          ? "Last run completed"
          : state.brokerResultsStatus === "partial"
            ? "Search incomplete: some data unavailable"
          : state.brokerResultsStatus === "stale"
            ? "Last results restored"
            : state.brokerResultsStatus === "empty"
            ? "Last run completed"
            : hasConditions ? "Scanner idle" : "No condition selected";
  const detail = isScanning
    ? state.brokerResultsMessage || "Running read-only Kalshi observation"
    : running
      ? scannerLoopStatusLabel()
      : state.brokerResultsStatus === "idle"
        ? hasConditions ? "Run Once starts a single read-only scan. Repeat runs the loop." : SCANNER_EMPTY_RECIPE_MESSAGE
        : brokerResultsStatusLabel();
  const detailHtml = isScanning
    ? `${escapeHtml(detail.replace(/\.+$/, ""))}${renderThinkingDots()}`
    : escapeHtml(detail);
  return `
    <div class="scanner-run-status ${statusClass}">
      <div>
        <span>${escapeHtml(title)}</span>
        <strong>${detailHtml}</strong>
      </div>
      <div class="scanner-run-status-meta">
        <span>${escapeHtml(scannerLoopTargetLabel())}</span>
        <span>${escapeHtml(resultCount ? `${resultCount} matches` : state.brokerResultsStatus === "empty" ? "0 matches" : "No results")}</span>
        <button data-broker-subtab="results" ${hasResultsView ? "" : "disabled"}>View Results</button>
      </div>
    </div>
  `;
}

function scannerLoopActive() {
  return ["starting", "rescanning", "polling", "waiting"].includes(state.scannerLoopStatus);
}

function scannerLoopStatusLabel() {
  if (!scannerLoopActive()) return state.scannerLoopMessage || "Loop off";
  const message = state.scannerLoopMessage || state.scannerLoopStatus;
  return state.scannerLoopRunCount ? `Scan ${state.scannerLoopRunCount} done · ${message}` : message;
}

function scannerLoopTargetLabel() {
  const count = Array.isArray(state.scannerLoopTargetSymbols) ? state.scannerLoopTargetSymbols.length : 0;
  return `Matches ${count}`;
}

function scannerLoopNextRescanLabel() {
  if (!scannerLoopActive() || !state.scannerLoopNextRescanAt) return `Rescan ${scannerRescanOptionLabel(state.scannerRescanIntervalMinutes)}`;
  return `Next ${formatDate(state.scannerLoopNextRescanAt)}`;
}

function scannerRescanSentenceLabel(minutes = state.scannerRescanIntervalMinutes) {
  const value = Number(minutes) || 15;
  if (value >= 60 && value % 60 === 0) {
    const hours = value / 60;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  if (value > 60) {
    const hours = Math.floor(value / 60);
    const rest = value % 60;
    return rest
      ? `${hours} hour${hours === 1 ? "" : "s"} ${rest} minute${rest === 1 ? "" : "s"}`
      : `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${value} minute${value === 1 ? "" : "s"}`;
}

function scannerZeroResultWaitMessage() {
  return `0 results found, so Scanner Lab will run again in ${scannerRescanSentenceLabel()}.`;
}

function scannerRescanOptionLabel(minutes) {
  if (minutes >= 60) {
    const hours = minutes / 60;
    return Number.isInteger(hours) ? `${hours}h` : `${minutes}m`;
  }
  return `${minutes}m`;
}

function scannerResultsDisplayRecipe(conditionRows = [], formulaText = "") {
  if (state.brokerResultsRecipe?.conditionRows?.length) return state.brokerResultsRecipe;
  return {
    formulaText,
    directionFilter: currentScannerDirectionFilter(),
    conditionRows
  };
}

function renderBrokerResultsTab({ conditionRows, formulaText }) {
  const loopActive = scannerLoopActive();
  const displayRecipe = scannerResultsDisplayRecipe(conditionRows, formulaText);
  const displayRows = Array.isArray(displayRecipe.conditionRows) ? displayRecipe.conditionRows : [];
  const formulaDisplayText = scannerDirectionFormulaText(displayRecipe.formulaText, displayRecipe.directionFilter);
  const conditionSummary = displayRows.length
    ? displayRows.map((row, index) => `${conditionRuleLetter(index)}. ${conditionLabel(row)}`).join(" / ")
    : "No condition selected";
  const emptyMessage = brokerResultsEmptyMessage();
  const emptyClass = state.brokerResultsStatus === "error"
    ? "is-error"
    : state.brokerResultsStatus === "stale"
      ? "is-stale"
      : "";
  return `
      <div class="settings-card broker-card broker-section-results">
        <div class="settings-card-heading">
          <div class="broker-heading-title">
            <h2>Condition Results</h2>
            <button class="result-help-button" data-broker-info="results" title="Explain result cards" aria-label="Explain Condition Results">?</button>
          </div>
          <span class="source-pill">${state.brokerConditionResults.length} matches</span>
        </div>
        ${loopActive ? `<div class="broker-actions"><button id="stopScannerLoopFromResultsButton" class="results-stop-control">Stop Scanner</button></div>` : ""}
        ${renderStatusLine("Results state", state.brokerResultsStatus === "live", brokerResultsStatusLabel())}
        ${state.brokerResultsSavedAt ? renderStatusLine("Last run", !state.brokerResultsRestored, `${formatDate(state.brokerResultsSavedAt)}${state.brokerResultsRestored ? " / restored after refresh" : ""}`) : ""}
        ${loopActive || state.scannerLoopRunCount ? renderStatusLine("Scanner loop", loopActive, scannerLoopStatusLabel()) : ""}
        ${loopActive ? renderStatusLine("Next rescan", true, scannerLoopNextRescanLabel()) : ""}
        <div class="broker-current-condition">
          <span>Formula</span>
          <strong>${escapeHtml(displayRows.length > 1 ? `${formulaDisplayText} | ${conditionSummary}` : `${formulaDisplayText.replace(/ \| A$/, "")} | ${conditionSummary.replace(/^A\. /, "")}`)}</strong>
        </div>
        ${renderScannerLoopHistory()}
        ${state.busy === "broker-scan" ? `<div class="empty is-loading">${escapeHtml(state.brokerResultsMessage || "Running read-only Kalshi observation")}${renderThinkingDots()}</div>` : state.brokerConditionResults.length ? renderConditionResultPage() : `<div class="empty ${emptyClass}">${escapeHtml(emptyMessage)}</div>`}
      </div>
  `;
}

// Broad scans can match thousands of markets; drawing every card froze the panel.
// Busiest markets come first and the list grows a page at a time.
const RESULTS_PAGE_SIZE = 100;

function renderConditionResultPage() {
  const results = state.brokerConditionResults;
  const shown = Math.min(results.length, state.resultsShownCount || RESULTS_PAGE_SIZE);
  const ordered = results
    .map((result) => ({ result, volume: Number(contractDisplayModel(result).volume24h) || 0 }))
    .sort((a, b) => b.volume - a.volume)
    .map((entry) => entry.result);
  const more = results.length - shown;
  return `${results.length > 1 ? `<p class="provider-note">Sorted by 24h volume, highest first. Showing ${shown} of ${results.length}.</p>` : ""}
    ${ordered.slice(0, shown).map(renderConditionResult).join("")}
    ${more > 0 ? `<button id="showMoreResultsButton">Show ${Math.min(more, RESULTS_PAGE_SIZE)} more</button>` : ""}`;
}

function renderScannerLoopHistory() {
  const history = Array.isArray(state.scannerLoopHistory) ? state.scannerLoopHistory.slice(0, SCANNER_LOOP_HISTORY_LIMIT) : [];
  if (!history.length && !scannerLoopActive() && !state.scannerLoopRunCount) return "";
  return `
    <div class="scanner-loop-history">
      <div class="scanner-loop-history-head">
        <strong>Loop History</strong>
        <span>${history.length}/${SCANNER_LOOP_HISTORY_LIMIT}</span>
      </div>
      ${history.length ? history.map(renderScannerLoopHistoryRow).join("") : `<div class="scanner-loop-history-empty">No loop cycles recorded yet.</div>`}
    </div>
  `;
}

function renderScannerLoopHistoryRow(entry = {}) {
  const status = entry.status === "error" ? "Failed" : entry.matches ? "Matched" : "No match";
  return `
    <div class="scanner-loop-history-row ${entry.status === "error" ? "is-error" : ""}">
      <strong>Cycle ${escapeHtml(String(entry.cycle || "-"))}</strong>
      <span>${escapeHtml(entry.mode || "Loop")}</span>
      <span>${escapeHtml(formatDate(entry.observedAt))}</span>
      <span>${escapeHtml(`Scanned ${entry.scannedSymbols ?? 0}`)}</span>
      <span>${escapeHtml(`${entry.matches ?? 0} matches`)}</span>
      <span>${escapeHtml(`+${entry.newMatches ?? 0} new`)}</span>
      <span>${escapeHtml(status)}</span>
    </div>
  `;
}

function renderBrokerWatchlistTab() {
  const updatedLabel = state.brokerWatchlistUpdatedAt ? `Updated ${formatDate(state.brokerWatchlistUpdatedAt)}` : "Not refreshed";
  const streamButtonLabel = tickerStreamActive() ? "Stop Live" : "Start Live";
  const watchlistFull = state.brokerWatchlist.length >= BROKER_WATCHLIST_MAX_SYMBOLS;
  const liveCount = Math.min(state.brokerWatchlist.length, KALSHI_LIVE_TICKER_SYMBOL_LIMIT);
  return `
      <div class="settings-card broker-card broker-section-watchlist">
        <div class="settings-card-heading">
          <h2>Watchlist</h2>
          <span class="source-pill">${state.brokerWatchlist.length}/${BROKER_WATCHLIST_MAX_SYMBOLS} contracts</span>
        </div>
        <div class="watchlist-add-row">
          <input id="watchlistSymbolInput" class="field" placeholder="KXEXAMPLE-26DEC31-Y" ${watchlistFull ? "disabled" : ""} />
          <button id="addWatchlistSymbolButton" class="button-primary" ${watchlistFull ? "disabled" : ""}>${watchlistFull ? "Full" : "Add"}</button>
        </div>
        <div class="broker-actions">
          <button id="refreshWatchlistButton" class="button-primary" ${state.brokerWatchlist.length && state.busy !== "watchlist" ? "" : "disabled"}>${state.busy === "watchlist" ? "Refreshing..." : "Refresh Markets"}</button>
          <button id="toggleWatchlistTickerButton" ${state.brokerWatchlist.length && state.busy !== "ticker" ? "" : "disabled"}>${streamButtonLabel}</button>
        </div>
        ${renderStatusLine("Live market", tickerStreamActive(), tickerStreamLabel())}
        ${renderStatusLine("Live coverage", tickerStreamActive(), tickerStreamActive() ? `${state.brokerTickerStreamSymbols.length}/${KALSHI_LIVE_TICKER_SYMBOL_LIMIT} contracts subscribed` : `${liveCount}/${KALSHI_LIVE_TICKER_SYMBOL_LIMIT} contracts available for live`)}
        <div class="broker-current-condition">
          <span>Live data</span>
          <strong>${escapeHtml(state.brokerTickerStreamUpdatedAt ? `WebSocket ${formatDate(state.brokerTickerStreamUpdatedAt)}` : updatedLabel)}</strong>
        </div>
        ${state.brokerWatchlist.length ? `
          <div class="watchlist-symbol-grid">
            ${state.brokerWatchlist.map((symbol) => renderWatchlistSymbol(symbol)).join("")}
          </div>
        ` : `<div class="empty">No watchlist contracts yet. Save a result market or add one manually.</div>`}
        <p class="provider-note">Watchlist stores up to ${BROKER_WATCHLIST_MAX_SYMBOLS} Kalshi market tickers locally. Refresh uses one public REST snapshot. Start Live can use read-only Kalshi WebSocket updates for up to ${KALSHI_LIVE_TICKER_SYMBOL_LIMIT} saved contracts after signed-header support is verified. Attach to Chat shows only a short market note while Chat AI receives the read-only context internally.</p>
      </div>
  `;
}
function renderBrokerGuidesCard() {
  return `
      <div class="settings-card broker-card broker-help broker-section-help">
        <div class="settings-card-heading">
          <h2>Guides</h2>
          <span class="source-pill">Reference</span>
        </div>
        <div class="broker-guide-grid">
          <button class="broker-guide-button" data-broker-info="overview">Kalshi Guide</button>
          <button class="broker-guide-button" data-broker-info="scope">Scope Guide</button>
          <button class="broker-guide-button" data-broker-info="condition">Condition Examples</button>
          <button class="broker-guide-button" data-broker-info="boundary">Privacy & Boundary</button>
        </div>
      </div>
  `;
}

function renderWatchlistSymbol(entry) {
  const marketTicker = normalizeWatchlistSymbol(entry);
  const ticker = watchlistTickerForSymbol(marketTicker);
  const display = contractDisplayModel(ticker || entry || { marketTicker });
  const toneClass = marketMetricToneClass(display.priceChangePct);
  const metrics = ticker ? contractMetricGrid(display) : "";
  return `
    <div class="watchlist-symbol ${escapeHtml(toneClass)}">
      <div class="watchlist-symbol-head">
        <div>
          <strong>${escapeHtml(display.marketTitle || display.marketTicker)}</strong>
          <span>${escapeHtml(display.marketTicker)}${display.eventTicker ? ` / ${escapeHtml(display.eventTicker)}` : ""}</span>
        </div>
        <div class="broker-result-actions">
          <button data-watchlist-send-chat="${escapeHtml(marketTicker)}">Attach to Chat</button>
          <button data-watchlist-remove="${escapeHtml(marketTicker)}" title="Remove ${escapeHtml(marketTicker)}">Remove</button>
        </div>
      </div>
      <div class="broker-result-meta">
        ${renderContractMetaChip(display.seriesTicker, "Series")}
        ${renderContractMetaChip(display.status, "Status")}
        ${renderContractMetaChip(display.closeTime ? formatDate(display.closeTime) : "", "Close")}
      </div>
      ${metrics ? `<div class="broker-result-metrics">${metrics}</div>` : `<small>Refresh to load public Kalshi market data.</small>`}
    </div>
  `;
}

function watchlistTickerForSymbol(symbol) {
  return state.brokerWatchlistTickers[normalizeWatchlistSymbol(symbol)] || null;
}

function contractDisplayModel(contract = {}) {
  const marketTicker = normalizeWatchlistSymbol(contract.marketTicker || contract.symbol || contract.ticker || "");
  return {
    ...contract,
    symbol: marketTicker,
    marketTicker,
    eventTicker: String(contract.eventTicker || contract.event_ticker || ""),
    seriesTicker: String(contract.seriesTicker || contract.series_ticker || ""),
    eventTitle: String(contract.eventTitle || contract.event_title || ""),
    marketTitle: String(contract.marketTitle || contract.title || contract.market_title || marketTicker),
    marketType: String(contract.marketType || contract.market_type || ""),
    yesOutcome: String(contract.yesOutcome || contract.yes_sub_title || "YES"),
    noOutcome: String(contract.noOutcome || contract.no_sub_title || "NO"),
    yesBid: contract.yesBid ?? contract.bid,
    yesAsk: contract.yesAsk ?? contract.ask,
    noBid: contract.noBid,
    noAsk: contract.noAsk,
    last: contract.last,
    priceChangePct: contract.priceChangePct,
    volume24h: contract.volume24h,
    quoteVolume24h: contract.quoteVolume24h,
    liquidity: contract.liquidity,
    openInterest: contract.openInterest,
    spreadPct: contract.spreadPct,
    closeTime: String(contract.closeTime || contract.close_time || ""),
    status: String(contract.status || ""),
    source: String(contract.source || "kalshi_market"),
    observedAt: String(contract.observedAt || ""),
    result: String(contract.result || ""),
    canCloseEarly: contract.canCloseEarly === true,
    relatedMarketCount: contract.relatedMarketCount,
    isMultivariate: contract.isMultivariate === true
  };
}

function contractMetricGrid(contract = {}, toneClass = marketMetricToneClass(contract.priceChangePct)) {
  return [
    renderMarketMetric("YES Bid", contract.yesBid, { formatter: formatProbabilityPrice }),
    renderMarketMetric("YES Ask", contract.yesAsk, { formatter: formatProbabilityPrice }),
    renderMarketMetric("NO Bid", contract.noBid, { formatter: formatProbabilityPrice }),
    renderMarketMetric("NO Ask", contract.noAsk, { formatter: formatProbabilityPrice }),
    renderMarketMetric("Last", contract.last, { formatter: formatProbabilityPrice }),
    renderMarketMetric("Change", contract.priceChangePct, { formatter: formatSignedNumber, suffix: "%", toneClass }),
    renderMarketMetric("24h Vol", contract.volume24h, { fractionDigits: 0 }),
    renderMarketMetric("Liquidity", contract.liquidity, { fractionDigits: 0 }),
    renderMarketMetric("Open Int", contract.openInterest, { fractionDigits: 0 }),
    renderMarketMetric("Spread", contract.spreadPct, { formatter: formatSpreadPct, suffix: "%" })
  ].filter(Boolean).join("");
}

function finiteMarketNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function isZeroMarketNumber(value) {
  const number = finiteMarketNumber(value);
  return Number.isFinite(number) && Math.abs(number) <= 0.000001;
}

function marketHealthSpreadLabel(spreadPct) {
  const spread = finiteMarketNumber(spreadPct);
  if (!Number.isFinite(spread)) return "";
  if (spread <= 5) return "Tight spread";
  if (spread <= 25) return "Tradable spread";
  if (spread <= 100) return "Wide spread";
  return "Very wide spread";
}

function marketHealthModel(contract = {}) {
  const yesBid = finiteMarketNumber(contract.yesBid);
  const yesAsk = finiteMarketNumber(contract.yesAsk);
  const noBid = finiteMarketNumber(contract.noBid);
  const noAsk = finiteMarketNumber(contract.noAsk);
  const spreadPct = finiteMarketNumber(contract.spreadPct);
  const noActiveYesQuote = Number.isFinite(yesBid) && Number.isFinite(yesAsk) && yesBid <= 0 && yesAsk >= 1;
  const noActiveNoQuote = Number.isFinite(noBid) && Number.isFinite(noAsk) && noBid <= 0 && noAsk >= 1;
  const noActiveBidAsk = noActiveYesQuote || noActiveNoQuote || (Number.isFinite(spreadPct) && spreadPct >= 199.5);
  const noRecentVolume = isZeroMarketNumber(contract.volume24h);
  const noLiquidity = isZeroMarketNumber(contract.liquidity);
  const noOpenInterest = isZeroMarketNumber(contract.openInterest);
  const spreadLabel = marketHealthSpreadLabel(spreadPct);
  const details = [];

  if (noRecentVolume && noLiquidity) details.push("Illiquid market");
  if (noRecentVolume) details.push("No recent volume");
  if (noLiquidity) details.push("No liquidity");
  if (noOpenInterest) details.push("No open interest");
  if (spreadLabel && !["Tight spread", "Tradable spread"].includes(spreadLabel)) details.push(spreadLabel);

  if (noActiveBidAsk) {
    return {
      label: "No active bid/ask",
      tone: "alert",
      details: Array.from(new Set(details)).slice(0, 4),
      description: "This market is active, but currently has no usable bid/ask quote."
    };
  }

  if (noRecentVolume && noLiquidity) {
    return {
      label: "Illiquid market",
      tone: "warn",
      details: Array.from(new Set(details.filter((entry) => entry !== "Illiquid market"))).slice(0, 4),
      description: "This market has little or no visible trading activity."
    };
  }

  if (spreadLabel === "Very wide spread") {
    return {
      label: "Very wide spread",
      tone: "warn",
      details: Array.from(new Set(details.filter((entry) => entry !== "Very wide spread"))).slice(0, 4),
      description: "The bid/ask spread is too wide to be useful right now."
    };
  }

  if (spreadLabel === "Wide spread") {
    return {
      label: "Wide spread",
      tone: "watch",
      details: Array.from(new Set(details.filter((entry) => entry !== "Wide spread"))).slice(0, 4),
      description: "The quote is available, but the bid/ask spread is wide."
    };
  }

  if (spreadLabel === "Tight spread" || spreadLabel === "Tradable spread") {
    return {
      label: spreadLabel,
      tone: spreadLabel === "Tight spread" ? "good" : "neutral",
      details: Array.from(new Set(details)).slice(0, 4),
      description: spreadLabel === "Tight spread"
        ? "The bid/ask spread is tight."
        : "The bid/ask spread is moderate."
    };
  }

  return {
    label: "Market data available",
    tone: "neutral",
    details: Array.from(new Set(details)).slice(0, 4),
    description: "Scanner Lab found matching public Kalshi market data."
  };
}

function renderMarketHealth(contract = {}) {
  const health = marketHealthModel(contract);
  const details = health.details.length
    ? `<div class="market-health-details">${health.details.map((detail) => `<span>${escapeHtml(detail)}</span>`).join("")}</div>`
    : "";
  return `
    <div class="market-health-row" title="${escapeHtml(health.description)}">
      <span class="market-health-label">Market Health</span>
      <span class="market-health-chip is-${escapeHtml(health.tone)}">${escapeHtml(health.label)}</span>
      ${details}
    </div>
  `;
}

function renderConditionResult(result) {
  const display = contractDisplayModel(result);
  const saved = state.brokerWatchlist.some((entry) => normalizeWatchlistSymbol(entry) === display.marketTicker);
  const toneClass = marketMetricToneClass(display.priceChangePct);
  const metrics = contractMetricGrid(display, toneClass);
  return `
    <div class="broker-result ${escapeHtml(toneClass)}">
      <div class="broker-result-head">
        <div class="broker-result-title">
          <strong>${escapeHtml(display.marketTitle || display.marketTicker)}</strong>
          <span class="source-pill ${saved ? "is-active" : "is-muted"}">${saved ? "In Watchlist" : "Not in Watchlist"}</span>
        </div>
        <div class="broker-result-actions">
          <button data-research-market="${escapeHtml(display.marketTicker)}">Research with AI</button>
          <button data-result-send-chat="${escapeHtml(result.id)}">Send to Chat</button>
          <button data-result-save-market="${escapeHtml(result.id)}">${saved ? "In Watchlist" : "Add to Watchlist"}</button>
        </div>
      </div>
      <div class="broker-result-meta">
        ${renderContractMetaChip(display.marketTicker, "Market")}
        ${renderContractMetaChip(display.eventTicker, "Event")}
        ${renderContractMetaChip(display.seriesTicker, "Series")}
        ${renderContractMetaChip(display.status, "Status")}
        ${display.isMultivariate ? renderContractMetaChip("Multivariate") : ""}
        ${renderContractMetaChip(display.closeTime ? formatDate(display.closeTime) : "", "Close")}
        ${display.observedAt ? `<span>${escapeHtml(formatDate(display.observedAt))}</span>` : ""}
      </div>
      ${renderMarketHealth(display)}
      ${metrics ? `<div class="broker-result-metrics">${metrics}</div>` : ""}
      ${renderContractRules(result)}
    </div>
  `;
}
function renderConditionPreset(preset) {
  const rows = Array.isArray(preset.rows) && preset.rows.length ? preset.rows.map((row) => normalizeConditionRow(row)) : [normalizeConditionRow({})];
  const firstLabel = conditionLabel(rows[0]);
  const formula = preset.logic || "";
  const formulaLabel = formula ? scannerDirectionFormulaText(formula, preset.directionFilter || DEFAULT_SCANNER_DIRECTION_FILTER) : "";
  const presetId = escapeHtml(preset.id || "");
  return `
    <div class="broker-result broker-preset-result ${presetId ? "is-actionable" : ""}" data-condition-saved-preset="${presetId}" tabindex="${presetId ? "0" : "-1"}" aria-label="Load condition preset">
      <div class="broker-result-head">
        <div class="broker-result-title">
          <strong>${escapeHtml(rows.length === 1 ? firstLabel : formulaLabel || "Condition preset")}</strong>${preset.isDefault ? ` <span class="preset-default-badge">Default</span>` : ""}
          <span>${escapeHtml(formatDate(preset.createdAt))}</span>
        </div>
        <div class="broker-result-actions">
          <button data-condition-preset-load="${presetId}" ${presetId ? "" : "disabled"} title="Load this preset">Load</button>
          <button data-condition-preset-default="${presetId}" ${presetId ? "" : "disabled"} aria-pressed="${preset.isDefault === true}">${preset.isDefault ? "Unset default" : "Set as default"}</button>
          <button data-condition-preset-delete="${presetId}" ${presetId ? "" : "disabled"} title="Delete this preset">Delete</button>
        </div>
      </div>
      ${rows.length > 1 ? `<small>${escapeHtml(rows.map((row, index) => `${conditionRuleLetter(index)}. ${conditionLabel(row)}`).join(" / "))}</small>` : ""}
    </div>
  `;
}

function renderObservationLibraryPane(rows) {
  const query = state.observationLibraryQuery.trim().toLowerCase();
  const inputQuery = state.observationLibraryDraftQuery ?? state.observationLibraryQuery;
  const libraryCategories = observationLibraryCategories();
  const totalTemplates = libraryCategories.reduce((sum, category) => sum + category.templates.length, 0);
  const visibleCategories = libraryCategories
    .map((category) => ({
      ...category,
      templates: category.templates.filter((template) => {
        if (!query) return true;
        return [
          category.label,
          template.title,
          template.description,
          template.categoryPath?.join(" "),
          scannerTemplateStatusView(template).label
        ].some((value) => String(value || "").toLowerCase().includes(query));
      })
    }))
    .filter((category) => category.templates.length);

  return `
    <aside class="observation-library-pane" aria-label="Condition library">
      <div class="observation-library-label">
        <span>Observation Library</span>
        <small>Pick templates to build the stack.</small>
      </div>
      <div class="observation-library-toolbar">
        <input id="observationLibrarySearch" class="field" type="search" value="${escapeHtml(inputQuery)}" placeholder="Search conditions..." />
        <button id="observationLibrarySearchButton" class="observation-search-button" title="Search conditions" aria-label="Search conditions">${renderIcon("search")}</button>
        <span class="source-pill">${visibleCategories.reduce((sum, category) => sum + category.templates.length, 0)}/${totalTemplates}</span>
      </div>
      <div class="observation-library-tree">
        ${visibleCategories.map((category) => renderObservationCategory(category, rows)).join("") || `<div class="empty">No conditions match this search.</div>`}
      </div>
    </aside>
  `;
}

function applyObservationLibrarySearch({ preserveFocus = false } = {}) {
  const input = document.querySelector("#observationLibrarySearch");
  const nextQuery = input ? input.value : state.observationLibraryDraftQuery;
  state.observationLibraryDraftQuery = nextQuery;
  state.observationLibraryQuery = nextQuery;
  render({ preserveScroll: true });
  if (!preserveFocus) return;
  const nextInput = document.querySelector("#observationLibrarySearch");
  if (!nextInput) return;
  nextInput.focus();
  const cursorPosition = nextInput.value.length;
  nextInput.setSelectionRange?.(cursorPosition, cursorPosition);
}

function observationLibraryCategories() {
  return SCANNER_TEMPLATE_CATEGORIES.filter((category) => !OBSERVATION_LIBRARY_HIDDEN_CATEGORY_IDS.has(category.id));
}

function summarizeObservationLibraryTemplates() {
  const categories = observationLibraryCategories();
  const templates = categories.flatMap((category) => category.templates);
  return {
    categoryCount: categories.length,
    templateCount: templates.length,
    ohlcvCount: templates.filter((template) => (template.dataRequirement || []).includes(DATA_REQUIREMENTS.OHLCV)).length
  };
}

function renderObservationCategory(category, rows) {
  const isOpen = Boolean(state.observationLibraryQuery.trim()) || state.observationLibraryOpenCategoryIds.includes(category.id);
  return `
    <details class="observation-category" data-observation-category="${escapeHtml(category.id)}" ${isOpen ? "open" : ""}>
      <summary>
        <span>${escapeHtml(category.label)}</span>
        <small>${category.templates.length}</small>
      </summary>
      <div class="observation-template-list">
        ${category.templates.map((template) => renderObservationTemplateButton(template, rows)).join("")}
      </div>
    </details>
  `;
}

function renderObservationTemplateButton(template, rows) {
  const status = scannerTemplateStatusView(template);
  const currentScope = rows[0]?.marketScope || state.settings?.KALSHI?.marketScope || "open_markets";
  const isCurrentScope = template.action === "scope" && template.defaultParameters?.scope === currentScope;
  const isSelected = state.scannerSelectedTemplateId === template.id;
  const disabled = status.tone === "later";
  return `
    <button class="observation-template is-${escapeHtml(status.tone)} ${isCurrentScope || isSelected ? "is-current" : ""}" data-observation-template="${escapeHtml(template.id)}" ${disabled ? "disabled" : ""}>
      <span class="observation-template-title">${escapeHtml(template.title)}</span>
      <span class="observation-template-meta">
        <span class="observation-status is-${escapeHtml(status.tone)}" title="${escapeHtml(status.detail || status.label)}">${escapeHtml(status.label)}</span>
        ${template.categoryPath?.length ? `<span>${escapeHtml(template.categoryPath.at(-1))}</span>` : ""}
      </span>
      <small>${escapeHtml(template.description)}</small>
    </button>
  `;
}

function scannerTemplateStatusView(template = {}) {
  return scannerTemplateCapabilityView(template, state.settings?.KALSHI?.marketScope || "open_markets");
}

function scannerTemplateIsExecutable(template = {}) {
  const status = scannerTemplateStatusView(template);
  return status.apiSupported && status.engineReady && status.scopeSupported && status.tone !== "later";
}

function scannerDisplayParametersForTemplate(template = {}, draftParameters = state.scannerDraftParameters) {
  const parameters = normalizeTemplateParameters(template, draftParameters);
  if (!scannerTemplateHasTimeframe(template)) return parameters;

  const parts = parseTimeframeParts(parameters.timeframe);
  return {
    ...parameters,
    timeframeValue: draftParameters.timeframeValue ?? parts.value,
    timeframeUnit: draftParameters.timeframeUnit ?? parts.unit
  };
}

function scannerParametersForAdd(template = {}) {
  return scannerParametersFromDraft(template, state.scannerDraftParameters);
}

function scannerParametersForEdit(template = {}) {
  return scannerParametersFromDraft(template, state.scannerEditDraftParameters);
}

function scannerParametersFromDraft(template = {}, draftParameters = {}) {
  const draft = { ...draftParameters };
  if (scannerTemplateHasTimeframe(template)) {
    const normalized = normalizeTemplateParameters(template, draft);
    const parts = parseTimeframeParts(normalized.timeframe);
    const timeframe = timeframeFromParts(
      draft.timeframeValue ?? parts.value,
      draft.timeframeUnit ?? parts.unit
    );
    if (!TIMEFRAMES.includes(timeframe)) return null;
    draft.timeframe = timeframe;
  }
  return normalizeTemplateParameters(template, draft);
}

function scannerParametersFromRow(row = {}, template = {}) {
  const clause = row.scannerClauses?.[0] || {};
  const parameters = normalizeTemplateParameters(template, {
    ...(row.scannerParameters || {}),
    scope: row.marketScope,
    timeframe: row.timeframe || clause.timeframe,
    source: clause.source || row.scannerParameters?.source,
    operator: row.operator || clause.operator,
    value: row.value ?? clause.value,
    valueMax: clause.valueMax,
    lookback: clause.lookback || row.scannerParameters?.lookback,
    length: clause.options?.length || row.scannerParameters?.length,
    fast: clause.options?.fast || row.scannerParameters?.fast,
    slow: clause.options?.slow || row.scannerParameters?.slow,
    signal: clause.options?.signal || row.scannerParameters?.signal,
    pattern: clause.options?.pattern || row.scannerParameters?.pattern,
    compareTo: clause.compareTo || row.scannerParameters?.compareTo
  });
  const parts = parseTimeframeParts(parameters.timeframe);
  return {
    ...parameters,
    timeframeValue: parts.value,
    timeframeUnit: parts.unit
  };
}

function scannerTemplateHasTimeframe(template = {}) {
  return (template.parameterSchema || []).some((field) => field.name === "timeframe");
}

function parseTimeframeParts(timeframe = "1h") {
  const match = String(timeframe || "1h").trim().match(/^(\d+)(mo|m|h|d|w)$/);
  if (!match) return { value: "1", unit: "h" };
  return { value: match[1], unit: match[2] };
}

function timeframeFromParts(value, unit) {
  const amount = Math.max(1, Math.floor(Number(value) || 1));
  const safeUnit = TIMEFRAME_UNIT_OPTIONS.some((option) => option.value === unit) ? unit : "h";
  return `${amount}${safeUnit}`;
}

function renderScannerConfigurePanel(rows) {
  const template = scannerTemplateById(state.scannerSelectedTemplateId);
  if (!template) {
    return `
      <div class="scanner-configure-panel is-empty">
        <div class="condition-panel-title">
          <div>
            <span>Condition Setup</span>
            <small>Select a library condition before adding it to the stack.</small>
          </div>
        </div>
      </div>
    `;
  }

  const parameters = scannerDisplayParametersForTemplate(template);
  const status = scannerTemplateStatusView(template);
  return `
    <div class="scanner-configure-panel is-${escapeHtml(status.tone)}">
      <div class="condition-panel-title">
        <div>
          <span>Condition Setup</span>
          <small>${escapeHtml(template.categoryPath?.join(" / ") || "Scanner Lab")}</small>
        </div>
        <span class="observation-status is-${escapeHtml(status.tone)}" title="${escapeHtml(status.detail || status.label)}">${escapeHtml(status.label)}</span>
      </div>
      <div class="scanner-configure-body">
        <div class="scanner-configure-summary">
          <strong>${escapeHtml(template.title)}</strong>
        </div>
        ${renderScannerParameterGroups(template, parameters)}
        <div class="scanner-configure-actions">
          <button id="clearScannerTemplateButton">Clear</button>
          <button id="addConfiguredScannerConditionButton" class="button-primary">${template.action === "scope" ? "Apply Scope" : "Add to Stack"}</button>
        </div>
      </div>
    </div>
  `;
}

function renderScannerConditionEditPanel(row, index) {
  const template = scannerTemplateById(row.scannerTemplateId || row.sourceTemplateId);
  if (!template) return renderConditionEditPanel(row, "value", index, "is-top-editor");

  const status = scannerTemplateStatusView(template);
  const draftParameters = state.scannerEditTargetIndex === index && Object.keys(state.scannerEditDraftParameters || {}).length
    ? state.scannerEditDraftParameters
    : scannerParametersFromRow(row, template);
  const parameters = scannerDisplayParametersForTemplate(template, draftParameters);
  return `
    <div class="scanner-configure-panel scanner-configure-edit is-${escapeHtml(status.tone)}">
      <div class="condition-panel-title">
        <div>
          <span>Condition Setup</span>
          <small>${escapeHtml(`${template.categoryPath?.join(" / ") || "Scanner Lab"} / Edit ${conditionRuleLetter(index)}`)}</small>
        </div>
        <span class="observation-status is-${escapeHtml(status.tone)}" title="${escapeHtml(status.detail || status.label)}">${escapeHtml(status.label)}</span>
      </div>
      <div class="scanner-configure-body">
        <div class="scanner-configure-summary">
          <strong>${escapeHtml(template.title)}</strong>
        </div>
        ${renderScannerParameterGroups(template, parameters)}
        <div class="scanner-configure-actions">
          <button id="cancelScannerEditButton">Done</button>
          <button id="updateConfiguredScannerConditionButton" class="button-primary">Update Condition</button>
        </div>
      </div>
    </div>
  `;
}

function renderScannerParameterGroups(template = {}, parameters = {}) {
  const fields = template.parameterSchema || [];
  if (template.action === "scope") {
    return renderScannerParameterSection("Target", fields, parameters, "");
  }

  const calculationFields = fields.filter(isScannerCalculationField);
  const conditionFields = fields.filter((field) => !isScannerCalculationField(field));
  return `
    ${calculationFields.length ? renderScannerParameterSection("Calculation", calculationFields, parameters, "") : ""}
    ${renderScannerParameterSection("Condition", conditionFields, parameters, template.title)}
  `;
}

function renderScannerParameterSection(label, fields = [], parameters = {}, conditionTitle = "") {
  return `
    <div class="scanner-parameter-section">
      <span class="scanner-parameter-section-label">${escapeHtml(label)}</span>
      <div class="scanner-parameter-row">
        ${conditionTitle ? `
          <span class="scanner-condition-name">
            <span>Condition =</span>
            <strong>${escapeHtml(conditionTitle)}</strong>
          </span>
        ` : ""}
        ${fields.map((field) => renderScannerParameterField(field, parameters[field.name], parameters)).join("")}
      </div>
    </div>
  `;
}

function isScannerCalculationField(field = {}) {
  return ["timeframe", "source", "length", "lookback", "fast", "slow", "signal", "offset", "period"].includes(field.name);
}

function renderScannerParameterField(field, value, parameters = {}) {
  if (field.name === "timeframe") return renderScannerTimeframeField(field, parameters);

  const safeName = escapeHtml(field.name);
  const label = escapeHtml(field.label || field.name);
  const unit = field.unit ? `<span>${escapeHtml(field.unit)}</span>` : "";
  if (field.type === "select") {
    return `
      <label class="scanner-parameter-field">
        <span>${label}</span>
        <select class="field" data-scanner-param="${safeName}">
          ${(field.choices || []).map((choice) => {
            const choiceValue = String(choice.value ?? choice.id ?? choice);
            const choiceLabel = String(choice.label ?? choiceValue);
            return `<option value="${escapeHtml(choiceValue)}" ${String(value) === choiceValue ? "selected" : ""}>${escapeHtml(choiceLabel)}</option>`;
          }).join("")}
        </select>
      </label>
    `;
  }
  if (field.type === "boolean") {
    return `
      <label class="scanner-parameter-field is-checkbox">
        <input type="checkbox" data-scanner-param="${safeName}" ${value === true ? "checked" : ""} />
        <span>${label}</span>
      </label>
    `;
  }
  const inputType = field.type === "number" ? "number" : "text";
  return `
    <label class="scanner-parameter-field">
      <span>${label}</span>
      <div class="scanner-parameter-input">
        <input class="field" type="${inputType}" data-scanner-param="${safeName}" value="${escapeHtml(value ?? "")}" ${field.min !== undefined ? `min="${escapeHtml(field.min)}"` : ""} ${field.max !== undefined ? `max="${escapeHtml(field.max)}"` : ""} ${field.step !== undefined ? `step="${escapeHtml(field.step)}"` : ""} />
        ${unit}
      </div>
    </label>
  `;
}

function renderScannerTimeframeField(field, parameters = {}) {
  const label = escapeHtml(field.label || "Timeframe");
  const value = parameters.timeframeValue ?? parseTimeframeParts(parameters.timeframe).value;
  const unit = parameters.timeframeUnit ?? parseTimeframeParts(parameters.timeframe).unit;
  return `
    <label class="scanner-parameter-field scanner-parameter-timeframe">
      <span>${label}</span>
      <div class="scanner-timeframe-input">
        <input class="field" type="number" data-scanner-param="timeframeValue" value="${escapeHtml(value)}" min="1" step="1" title="${escapeHtml(SUPPORTED_TIMEFRAME_MESSAGE)}" />
        <select class="field" data-scanner-param="timeframeUnit" title="${escapeHtml(SUPPORTED_TIMEFRAME_MESSAGE)}">
          ${TIMEFRAME_UNIT_OPTIONS.map((option) => `
            <option value="${escapeHtml(option.value)}" ${option.value === unit ? "selected" : ""}>${escapeHtml(option.label)}</option>
          `).join("")}
        </select>
      </div>
    </label>
  `;
}

function renderConditionRecipeBuilder(rows) {
  return `
    <div class="selected-condition-panel">
      <div class="condition-panel-title">
        <div>
          <span>Condition Stack</span>
          <small>Library rows combined by formula</small>
        </div>
        <strong>${rows.length}/${MAX_CONDITION_ROWS}</strong>
      </div>
      <div class="condition-rule-stack">
        ${renderConditionSetupPanel(rows)}
        <div class="condition-stack-scroll">
          ${rows.length ? rows.map((row, index) => renderConditionRecipeRow(row, index, rows.length)).join("") : `<div class="condition-stack-empty">${SCANNER_EMPTY_RECIPE_MESSAGE}</div>`}
        </div>
        <button id="addConditionButton" class="condition-add-button">+ Add blank condition</button>
        ${renderConditionLogicFormula(rows)}
      </div>
    </div>
  `;
}

function renderConditionSetupPanel(rows) {
  const activeTarget = parseConditionEditTarget();
  if (activeTarget && rows[activeTarget.index]) {
    const row = normalizeConditionRow(rows[activeTarget.index]);
    if (scannerTemplateById(row.scannerTemplateId || row.sourceTemplateId)) {
      return renderScannerConditionEditPanel(row, activeTarget.index);
    }
    return renderConditionEditPanel(row, activeTarget.field, activeTarget.index, "is-top-editor");
  }
  return renderScannerConfigurePanel(rows);
}

function conditionRuleText(row, operator) {
  const label = operator?.label || row.operator;
  return ["is_true", "is_false"].includes(row.operator) ? label : `${label} ${row.value}`;
}

function renderConditionRecipeRow(row, index, rowCount) {
  const normalized = normalizeConditionRow(row);
  const metric = CONDITION_METRICS.find((entry) => entry.id === normalized.metric);
  const operator = CONDITION_OPERATORS.find((entry) => entry.id === normalized.operator);
  const sourceLabel = normalized.sourceTemplateLabel || "";
  const specialScope = ["holdings", "watchlist", "saved_symbols"].includes(normalized.marketScope);
  const requirementLabel = conditionRequirementLabel(normalized);

  return `
    <div class="condition-rule-row" data-condition-edit-row="${index}:value" title="Edit this condition in Condition Setup">
      <div class="condition-rule-number">${conditionRuleLetter(index)}</div>
      <div class="condition-rule-body">
        <div class="condition-rule-source">
          <span>${normalized.sourceTemplateLabel ? "Library" : "Manual"}</span>
          ${sourceLabel ? `<strong>${escapeHtml(sourceLabel)}</strong>` : ""}
          ${requirementLabel ? `<em>${escapeHtml(requirementLabel)}</em>` : ""}
        </div>
        <div class="condition-chip-line">
          ${specialScope ? `${renderConditionToken(index, "marketScope", "Scope", marketScopeById(normalized.marketScope).label, "scope")}<span class="condition-plus">+</span>` : ""}
          ${renderConditionToken(index, "timeframe", "TF", normalized.timeframe, "time")}
          <span class="condition-plus">+</span>
          ${renderConditionToken(index, "metric", "Metric", metric?.label || normalized.metric, "metric")}
          <span class="condition-plus">+</span>
          ${renderConditionToken(index, "value", "Rule", conditionRuleText(normalized, operator), "value")}
        </div>
      </div>
      <button class="condition-remove-button" data-condition-remove="${index}" title="Remove condition">x</button>
    </div>
  `;
}

function conditionRequirementLabel(row = {}) {
  const requirements = Array.isArray(row.dataRequirement) ? row.dataRequirement : [];
  if (requirements.includes(DATA_REQUIREMENTS.ACCOUNT_READONLY)) return "Private";
  if (requirements.includes(DATA_REQUIREMENTS.EXTERNAL)) return "External";
  if (requirements.includes(DATA_REQUIREMENTS.OHLCV)) return "OHLC";
  if (requirements.includes(DATA_REQUIREMENTS.ORDER_BOOK)) return "Order Book";
  if (requirements.includes(DATA_REQUIREMENTS.TRADES)) return "Trades";
  if (requirements.includes(DATA_REQUIREMENTS.TICKER)) return "Ticker";
  return "";
}

function scannerDirectionConflictWarnings(rows = []) {
  const directionFilter = currentScannerDirectionFilter();
  if (directionFilter === "all") return [];
  return rows
    .map((row, index) => {
      const normalized = normalizeConditionRow(row, row.marketScope);
      const clauses = Array.isArray(normalized.scannerClauses) && normalized.scannerClauses.length
        ? normalized.scannerClauses
        : [{ metric: normalized.metric, operator: normalized.operator, value: normalized.value }];
      const conflict = clauses.find((clause) => scannerDirectionClauseConflicts(clause, directionFilter));
      if (!conflict) return "";
      return `Rule ${conditionRuleLetter(index)} may conflict with ${scannerDirectionLabel(directionFilter)} lens: ${conditionLabel(normalized)}`;
    })
    .filter(Boolean);
}

function scannerDirectionClauseConflicts(clause = {}, directionFilter = DEFAULT_SCANNER_DIRECTION_FILTER) {
  const normalizedDirection = normalizeScannerDirectionFilter(directionFilter);
  if (normalizedDirection === "all") return false;
  const metric = String(clause.metric || "").trim();
  if (metric !== "price_change_pct" && metric !== "utc_day_change_pct") return false;
  const operator = String(clause.operator || "").trim();
  const value = Number(clause.value);
  const valueMax = Number(clause.valueMax);
  if (operator === "between") {
    if (!Number.isFinite(value) || !Number.isFinite(valueMax)) return false;
    return normalizedDirection === "yes_gaining" ? Math.max(value, valueMax) <= 0 : Math.min(value, valueMax) >= 0;
  }
  if (!Number.isFinite(value)) return false;
  if (normalizedDirection === "yes_gaining") {
    return (operator === "lt" || operator === "lte") && value <= 0
      || operator === "eq" && value <= 0;
  }
  return (operator === "gt" || operator === "gte") && value >= 0
    || operator === "eq" && value >= 0;
}

function renderConditionLogicFormula(rows) {
  const tokens = currentConditionFormulaTokens(rows);
  const bounds = formulaSelectionBounds();
  const hasConditions = rows.length > 0;
  const valid = hasConditions && validateConditionFormula(tokens, rows);
  const directionWarnings = scannerDirectionConflictWarnings(rows);
  return `
    <details data-advanced-logic ${state.advancedLogicOpen ? "open" : ""}><summary>Advanced logic · AND / OR / NOT</summary><div class="condition-formula-panel">
      <div class="condition-formula-heading">
        <span>Logic Formula</span>
        <div class="condition-formula-heading-actions">
          <button class="condition-formula-wrap-button" data-formula-action="wrap" title="Toggle formula line wrapping">${state.conditionFormulaWrapped ? "Single line" : "Wrap"} v</button>
          <span class="source-pill ${valid ? "is-active" : "is-off"}">${hasConditions ? valid ? "Valid" : "Check" : "Empty"}</span>
        </div>
      </div>
      <div class="condition-formula-row ${state.conditionFormulaWrapped ? "is-wrapped" : ""}" aria-label="Logic formula">
        <button id="scannerDirectionFilterToggle" class="formula-token condition-direction-token is-${escapeHtml(currentScannerDirectionFilter())}" aria-label="Cycle Kalshi probability lens" title="Cycle Kalshi probability lens">[ ${escapeHtml(scannerDirectionLabel())} ]</button>
        <span class="condition-formula-separator">|</span>
        ${tokens.length ? tokens.map((token, index) => renderConditionFormulaToken(token, index, bounds)).join("") : `<span class="condition-formula-empty">${SCANNER_EMPTY_RECIPE_MESSAGE}</span>`}
      </div>
      ${directionWarnings.length ? `<div class="condition-formula-warning">${escapeHtml(directionWarnings.slice(0, 2).join(" / "))}</div>` : ""}
      <div class="condition-formula-toolbar" aria-label="Formula tools">
        <div class="condition-formula-tools">
          <button data-formula-action="not" title="NOT selected range" ${hasConditions ? "" : "disabled"}>!</button>
          <button data-formula-action="group" title="Group selected range" ${hasConditions ? "" : "disabled"}>( )</button>
          <button data-formula-action="ungroup" title="Remove parentheses from the selected group" ${hasConditions ? "" : "disabled"}>(x)</button>
          <button data-formula-action="delete" title="Delete selected plain tokens. If a group is selected, parentheses are removed first." ${hasConditions ? "" : "disabled"}>x</button>
          <button data-formula-action="help" title="Formula help">?</button>
        </div>
        <span class="condition-formula-hint">Drag tokens to select a range</span>
      </div>
    </div></details>
  `;
}

function renderConditionFormulaToken(token, index, bounds) {
  const selected = bounds && index >= bounds.start && index <= bounds.end;
  const typeClass = `is-${token.type}`;
  const title = token.type === "operator" ? "Double-click to switch AND / OR" : "Drag to select formula range";
  return `
    <button class="formula-token ${typeClass} ${selected ? "is-selected" : ""}" data-formula-token="${index}" data-formula-token-type="${escapeHtml(token.type)}" title="${escapeHtml(title)}">
      ${escapeHtml(formulaTokenText(token))}
    </button>
  `;
}

function renderConditionToken(index, field, label, value, tone) {
  const isActive = state.conditionEditTarget === `${index}:${field}`;
  return `
    <button class="condition-token condition-token-${tone} ${isActive ? "is-active" : ""}" data-condition-edit="${index}:${field}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </button>
  `;
}

function renderConditionEditPanel(row, field, index, extraClass = "") {
  const editor = conditionEditorConfig(row, field);
  const timeframeParts = parseTimeframeParts(row.timeframe);
  return `
    <div class="condition-edit-panel condition-edit-${escapeHtml(field)} ${escapeHtml(extraClass)}">
      <div class="condition-edit-heading">
        <strong>${escapeHtml(editor.title)}</strong>
        <button class="condition-edit-close" data-condition-edit="">Done</button>
      </div>
      ${field === "timeframe" ? `
        <div class="condition-editor-label">Timeframe</div>
        <div class="condition-timeframe-editor">
          <input id="conditionTimeframeValue" class="field" type="number" min="1" step="1" value="${escapeHtml(timeframeParts.value)}" title="${escapeHtml(SUPPORTED_TIMEFRAME_MESSAGE)}" />
          <select id="conditionTimeframeUnit" class="field" title="${escapeHtml(SUPPORTED_TIMEFRAME_MESSAGE)}">
            ${TIMEFRAME_UNIT_OPTIONS.map((option) => `
              <option value="${escapeHtml(option.value)}" ${option.value === timeframeParts.unit ? "selected" : ""}>${escapeHtml(option.label)}</option>
            `).join("")}
          </select>
          <button id="conditionTimeframeApply" class="button-primary" data-condition-index="${index}">Apply</button>
        </div>
      ` : ""}
      ${field === "value" ? `
        <div class="condition-editor-label">Operator</div>
        <div class="condition-option-grid compact">
          ${CONDITION_OPERATORS.map((option) => `
            <button class="condition-option ${option.id === row.operator ? "is-selected" : ""}" data-condition-choice="${index}:operator:${escapeHtml(option.id)}">
              ${escapeHtml(option.label)}
            </button>
          `).join("")}
        </div>
        <div class="condition-editor-label">${row.operator === "between" ? "Range (min~max, e.g. 3~48)" : ["is_true", "is_false"].includes(row.operator) ? "Value (not used)" : ["last_price", "bid_price", "ask_price"].includes(row.metric) ? "Value (dollars, 0.80 = 80c)" : "Value"}</div>
        <div class="condition-value-editor">
          <input id="conditionValueInput" class="field" type="text" value="${escapeHtml(row.value)}" placeholder="${row.operator === "between" ? "3~48" : ""}" />
          <button id="conditionValueApply" class="button-primary" data-condition-index="${index}">Apply</button>
        </div>
      ` : ""}
      <div class="condition-option-grid">
        ${editor.options.map((option) => `
          <button class="condition-option ${option.value === editor.current ? "is-selected" : ""}" data-condition-choice="${index}:${escapeHtml(field)}:${escapeHtml(option.value)}" ${option.disabled ? "disabled" : ""}>
            ${escapeHtml(option.label)}
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function conditionEditorConfig(row, field) {
  if (field === "marketScope") {
    return {
      title: "Choose scope",
      current: row.marketScope,
      options: scannerScopeSelectorOptions(row.marketScope).map((entry) => ({
        value: entry.id,
        label: entry.selectable === false ? `${entry.label} (not enabled)` : entry.label,
        disabled: entry.selectable === false
      }))
    };
  }
  if (field === "timeframe") {
    return {
      title: "Timeframe",
      current: row.timeframe,
      options: TIMEFRAMES.map((entry) => ({ value: entry, label: entry }))
    };
  }
  if (field === "metric") {
    return {
      title: "Choose metric",
      current: row.metric,
      options: CONDITION_METRICS.map((entry) => ({ value: entry.id, label: entry.label }))
    };
  }
  if (field === "operator") {
    return {
      title: "Choose operator",
      current: row.operator,
      options: CONDITION_OPERATORS.map((entry) => ({ value: entry.id, label: entry.label }))
    };
  }
  return {
    title: "Rule",
    current: row.value,
    options: conditionValueSuggestions(row).map((value) => ({ value, label: value }))
  };
}

function conditionValueSuggestions(row) {
  if (row.operator === "between") {
    const bounds = conditionValueSuggestions({ ...row, operator: "gte" });
    return bounds.slice(1).map((value, position) => `${bounds[position]}~${value}`);
  }
  // Kalshi prices are in dollars per contract: 0.80 means 80c.
  if (["last_price", "bid_price", "ask_price", "open_24h", "high_24h", "low_24h", "vwap_24h"].includes(row.metric)) return ["0.2", "0.5", "0.8", "0.9"];
  if (row.metric === "hours_to_close" || row.metric === "hours_since_listed") return ["6", "24", "48", "168"];
  if (row.metric === "liquidity" || row.metric === "open_interest") return ["100", "1000", "10000"];
  if (row.metric === "event_yes_ask_sum" || row.metric === "event_yes_bid_sum") return ["0.95", "1", "1.05"];
  if (row.metric === "price_change_pct") return ["1", "3", "5", "10"];
  if (row.metric === "abs_price_change_pct") return ["1", "3", "5", "10"];
  if (row.metric === "volume_24h" || row.metric === "quote_volume_24h") return ["1000", "10000", "100000"];
  if (row.metric === "spread_pct") return ["0.25", "0.5", "1", "2"];
  if (row.metric === "range_pct_24h") return ["2", "5", "10", "20"];
  if (row.metric === "relative_volume") return ["1.5", "2", "3", "5"];
  if (row.metric === "rsi") return ["30", "35", "65", "70"];
  return ["1", "3", "5"];
}

function renderBrokerInfoModal() {
  const settings = state.settings || {};
  const KALSHI = settings.KALSHI || {};
  const condition = normalizeConditionRow(state.brokerCondition || {}, KALSHI.marketScope || "open_markets");
  const scope = marketScopeById(condition.marketScope);
  const content = brokerInfoModalContent(state.brokerInfoModal, scope, condition);

  return `
    <div class="panel-modal-backdrop" role="presentation">
      <section class="panel-modal broker-info-modal" role="dialog" aria-modal="true" aria-label="${escapeHtml(content.title)}">
        <div class="modal-header">
          <div>
            <h2>${escapeHtml(content.title)}</h2>
            <p>${escapeHtml(content.subtitle)}</p>
          </div>
          <button class="icon-action" data-modal-action="close" title="Close" aria-label="Close">${renderIcon("close")}</button>
        </div>
        <div class="modal-body">
          ${content.body}
        </div>
        <div class="modal-actions">
          <button class="button-primary" data-modal-action="close">Close</button>
        </div>
      </section>
    </div>
  `;
}

function brokerInfoModalContent(modal, scope, condition) {
  if (modal === "results") {
    return {
      title: "Condition Results Help",
      subtitle: "How to read Kalshi result cards",
      body: `
        <p>Condition Results show Kalshi contracts that matched the current read-only Scanner Lab formula. The numbers stay visible, while Market Health adds plain-English context for common bid/ask and liquidity states.</p>
        <h3 class="modal-section-title">Market Health labels</h3>
        <div class="broker-symbol-grid">
          <div class="is-not"><strong>No active bid/ask</strong><span>The market is active, but currently has no usable bid/ask quote.</span></div>
          <div class="is-liquidity"><strong>Illiquid market</strong><span>Volume and visible liquidity are very low or zero.</span></div>
          <div class="is-spread"><strong>Wide spread</strong><span>The bid/ask gap is large. The quote may be expensive or hard to use.</span></div>
          <div class="is-row"><strong>Tight spread</strong><span>The bid/ask gap is small compared with the quote midpoint.</span></div>
          <div class="is-help"><strong>No recent volume</strong><span>No public 24h trading volume is visible for the contract.</span></div>
          <div class="is-group"><strong>No open interest</strong><span>No visible open contract interest is reported for the market.</span></div>
        </div>
        <h3 class="modal-section-title">Common result fields</h3>
        <ul class="modal-warning-list">
          <li>YES Bid and YES Ask are the visible YES-side bid/ask quote.</li>
          <li>NO Bid and NO Ask are the visible NO-side bid/ask quote.</li>
          <li>Last is the last traded YES price. 0c can mean there is no meaningful recent last trade.</li>
          <li>24h Vol, Liquidity, and Open Int describe activity and participation, not a recommendation.</li>
          <li>Spread is the bid/ask gap as a percent of the midpoint. 200% usually means the quote is effectively unusable.</li>
          <li>Matched Rule shows which Scanner Lab condition row caused the contract to appear.</li>
        </ul>
        <p class="modal-caution">These labels are read-only market observations. They are not buy/sell signals and do not place or prepare orders.</p>
      `
    };
  }

  if (modal === "scope") {
    return {
      title: "Market Scope Guide",
      subtitle: `${scope.label} · ${scope.estimatedSymbols} · ${scope.estimatedScanTime}`,
      body: `
        <p>Market Scope decides which Kalshi event contracts a read-only scan will inspect.</p>
        <ul class="modal-warning-list">
          <li>Open Markets uses public Kalshi market data and keeps browser scans bounded.</li>
          <li>Closing scopes narrow the universe by market close time.</li>
          <li>Multivariate scopes help distinguish related-event structures from ordinary binary contracts.</li>
          <li>Watchlist scopes use locally saved Kalshi market tickers.</li>
          <li>Estimated time can change with API limits, cache freshness, and selected metrics.</li>
          <li>Private account and position context stays opt-in.</li>
        </ul>
        <div class="broker-info-panel">
          <strong>Current scope</strong>
          <span>${escapeHtml(scope.description)}</span>
        </div>
      `
    };
  }

  if (modal === "condition") {
    return {
      title: "Condition Builder Examples",
      subtitle: "Condition rows plus a logic formula",
      body: `
        <p>Build one observation row, then combine rows with the logic formula below. A match only narrows market rows; it does not create a recommendation.</p>
        <div class="broker-info-panel is-current">
          <strong>Current condition</strong>
          <span>${escapeHtml(conditionLabel(condition))}</span>
        </div>
        <h3 class="modal-section-title">Formula symbols</h3>
        <div class="broker-symbol-grid">
          <div class="is-row"><strong><span class="broker-symbol">A</span> <span class="broker-symbol">B</span> <span class="broker-symbol">C</span></strong><span>Each letter points to one condition row.</span></div>
          <div class="is-logic"><strong><span class="broker-symbol">and</span> <span class="broker-symbol">or</span></strong><span>Use and when all rows must match; use or when any row can match.</span></div>
          <div class="is-not"><strong><span class="broker-symbol">!</span></strong><span>NOT. Excludes the selected row or selected group.</span></div>
          <div class="is-group"><strong><span class="broker-symbol">( )</span></strong><span>Groups the selected range, for example (A and B).</span></div>
          <div class="is-remove"><strong><span class="broker-symbol">(x)</span> <span class="broker-symbol">x</span></strong><span>Remove selected parentheses first; use x again on plain tokens to delete conditions.</span></div>
          <div class="is-help"><strong><span class="broker-symbol">?</span></strong><span>Opens this symbol reference.</span></div>
        </div>
        <h3 class="modal-section-title">Example rows</h3>
        <div class="broker-example-grid">
          <div class="is-momentum"><strong>Probability check</strong><span>Open Markets / YES bid >= 0.60</span></div>
          <div class="is-liquidity"><strong>Liquidity check</strong><span>Open Markets / 24h Volume >= 1000</span></div>
          <div class="is-spread"><strong>Spread check</strong><span>Open Markets / YES Spread % <= 5</span></div>
          <div class="is-rsi"><strong>Flow watch</strong><span>Watchlist / Recent YES flow >= 0.60</span></div>
        </div>
        <p class="modal-caution">Observation only. No buy/sell signals, orders, or auto-trading actions.</p>
      `
    };
  }

  if (modal === "logic") {
    return {
      title: "Logic Formula",
      subtitle: "Kalshi probability lens plus condition expression tools",
      body: `
        <p>Use the Kalshi probability lens to choose the first market universe, then combine A-Z condition rows with the logic formula. Drag across formula tokens to select a range, then use the symbol buttons. Double-click and/or in the formula row to switch the relation.</p>
        <div class="broker-symbol-grid">
          <div class="is-spread"><strong><span class="broker-symbol">All contracts</span> <span class="broker-symbol">YES gaining</span> <span class="broker-symbol">NO gaining</span></strong><span>Filters the market first by Kalshi YES probability change before A-Z formula rows run. All contracts applies no probability-change lens.</span></div>
          <div class="is-row"><strong><span class="broker-symbol">A</span> <span class="broker-symbol">B</span> <span class="broker-symbol">C</span></strong><span>Each letter points to one condition row.</span></div>
          <div class="is-logic"><strong><span class="broker-symbol">and</span> <span class="broker-symbol">or</span></strong><span>All selected rows must match, or any selected row may match.</span></div>
          <div class="is-not"><strong><span class="broker-symbol">!</span></strong><span>Applies NOT to the selected row or selected group.</span></div>
          <div class="is-group"><strong><span class="broker-symbol">( )</span></strong><span>Groups the selected range so it is evaluated together.</span></div>
          <div class="is-remove"><strong><span class="broker-symbol">(x)</span> <span class="broker-symbol">x</span></strong><span>Remove selected parentheses first; use x again on plain tokens to delete conditions.</span></div>
          <div class="is-help"><strong><span class="broker-symbol">?</span></strong><span>Opens this formula reference.</span></div>
        </div>
        <h3 class="modal-section-title">Examples</h3>
        <div class="broker-example-grid">
          <div class="is-momentum"><strong>A and B</strong><span>Rows A and B must both match.</span></div>
          <div class="is-spread"><strong>(A and B) or C</strong><span>Rows A and B together, or row C by itself.</span></div>
          <div class="is-rsi"><strong>A and !(B or C)</strong><span>Row A must match while B or C is excluded.</span></div>
        </div>
        <p class="modal-caution">YES gaining and NO gaining are read-only probability-change lenses, not recommendations. Formula results remain observations and do not produce buy/sell actions.</p>
      `
    };
  }

  if (modal === "scanner-loop") {
    return {
      title: "Scanner Lab Help",
      subtitle: "Run once, repeat, rescan, review, and API pacing",
      body: `
        <p>Scanner Lab is a read-only condition search tool. It finds Kalshi market contracts that match the current Observation Library stack and Logic Formula.</p>
        <h3 class="modal-section-title">Control buttons</h3>
        <div class="broker-symbol-grid">
          <div class="is-row"><strong>Run Once</strong><span>Runs the current recipe one time, then writes the matches to Results.</span></div>
          <div class="is-help"><strong>Repeat</strong><span>Registers background polling. It continues with the panel closed while Chrome is running and the PC is awake. Stop or a recipe edit ends monitoring. Sleep, shutdown and offline periods delay checks.</span></div>
          <div class="is-not"><strong>Stop</strong><span>Cancels the current Run Once scan or stops the active scan loop and next scheduled rescan.</span></div>
          <div class="is-spread"><strong>Rescan</strong><span>Rebuilds the full selected-market target set every 15m, 30m, 1h, 2h, or 3h.</span></div>
          <div class="is-logic"><strong>Auto Results</strong><span>When on, Run Once and the first Repeat full scan open Results automatically. Turn it off to stay on Scanner Lab.</span></div>
          <div class="is-group"><strong>? Help</strong><span>Opens this reference window.</span></div>
        </div>
        <h3 class="modal-section-title">How the loop works</h3>
        <ul class="modal-warning-list">
          <li>Repeat first scans the selected market scope with REST API data.</li>
          <li>If Auto Results is on, the completed first scan opens Results so Stop Scanner and matched cards are available together.</li>
          <li>Matched market tickers are monitored between full rescans.</li>
          <li>If there are no matches, the loop stays active and waits for the next full rescan.</li>
          <li>When the rescan timer is due, Scanner Lab reloads the full selected scope and rebuilds the match set.</li>
          <li>A single scan failure is recorded and the next scheduled rescan is kept unless Stop is pressed.</li>
        </ul>
        <h3 class="modal-section-title">REST and WebSocket routing</h3>
        <ul class="modal-warning-list">
          <li>Market-wide scans, broad prompts, more than 10 contracts, and OHLC indicators use REST mode.</li>
          <li>Live observation for 10 or fewer selected Kalshi market tickers can use WebSocket mode after signed-header support is verified.</li>
          <li>Kalshi REST calls are paced through a queue to avoid rate-limit bursts.</li>
        </ul>
        <p class="modal-caution">Read-only observation only. No buy/sell signals, no order placement, and no auto-trading actions.</p>
      `
    };
  }

  if (modal === "boundary") {
    return {
      title: "Privacy & Boundary",
      subtitle: "Read-only, opt-in, no trading actions",
      body: `
        <ul class="modal-warning-list">
          <li>API keys and secrets must stay out of Chat and Deep context.</li>
          <li>Account and positions snapshot is only included after explicit opt-in.</li>
          <li>Condition matches are observations, not buy/sell signals.</li>
          <li>No order placement, auto-trading, or account-changing action is part of this extension.</li>
        </ul>
      `
    };
  }

  return {
    title: "Kalshi Guide",
    subtitle: "Compact read-only broker workspace",
    body: `
      <p>Kalshi is an event-contract observation workspace for public market data and optional signed read-only account snapshots. Trading and order placement are excluded.</p>
      <ul class="modal-warning-list">
        <li>REST polling will handle scans, account snapshots, OHLC, and cache refreshes.</li>
        <li>WebSocket updates can be added later for selected contracts and visible result rows.</li>
        <li>Deep uses the typed question, recent chat and your connected AI, and reads up to 6 searches in your own browser through Browser research.</li>
        <li>Trading actions remain outside this product.</li>
      </ul>
    `
  };
}





function renderAnalysisTranslation(translation) {
  if (!translation) return "";
  if (translation.loading) {
    return `<div class="analysis-translation is-loading">Translating analysis...</div>`;
  }
  if (translation.error) {
    return `<div class="analysis-translation is-error">${escapeHtml(translation.error)}</div>`;
  }
  if (!translation.visible || !translation.text) return "";

  return `
    <div class="analysis-translation">
      <div class="analysis-translation-label">AI analysis · ${escapeHtml(translation.targetName || "Translated")}</div>
      <p>${escapeHtml(translation.text)}</p>
    </div>
  `;
}

function analysisTranslationForItem(item) {
  return state.analysisTranslations[analysisTranslationKey(item)] || null;
}

function analysisTranslationKey(item) {
  return String(item?.id ?? item?.url ?? item?.title ?? "");
}

function canTranslateAnalysis() {
  return Boolean(translationDisabled(state.settings) && translationUnavailable());
}

function renderListFooter(kind) {
  const isBusy = state.busy === `${kind}-more` || state.translationBusy === kind;
  if (isBusy) {
    const label = state.translationBusy === kind ? "Translating..." : "Loading more...";
    return `<div class="load-more-row">${escapeHtml(label)}</div>`;
  }
  return "";
}





function renderSavedNotePreview(notes) {
  const ordered = [...notes].reverse();
  const latest = ordered[0];
  return `
    <details class="saved-note-preview">
      <summary>
        <span>${escapeHtml(clampText(latest.text, 96))}</span>
        <small>${escapeHtml(formatDate(latest.createdAt))}${notes.length > 1 ? ` (${notes.length})` : ""}</small>
      </summary>
      <div class="saved-note-list">
        ${ordered.map((note) => `
          <div class="saved-note-entry">
            <small>${escapeHtml(formatDate(note.createdAt))}</small>
            <p>${escapeHtml(note.text).replaceAll("\n", "<br>")}</p>
          </div>
        `).join("")}
      </div>
    </details>
  `;
}

function renderSettingsTab() {
  const settings = state.settings || {};
  const sections = [["ai", "AI Connections"], ["agents", "AI Agents (MCP)"], ["kalshi", "Kalshi Connection"], ["monitor", "Alerts & Monitoring"], ["appearance", "Appearance"], ["help", "Help & Privacy"]];
  let content;
  if (state.settingsSection === "ai") content = renderAISettings(settings, state) + renderBrowserResearchCard(settings) ;
  else if (state.settingsSection === "agents") content = renderMcpAgentsCard(settings);
  else if (state.settingsSection === "kalshi") content = renderKALSHIApiCard(settings);
  else if (state.settingsSection === "appearance") content = `<div class="settings-card"><h2>Appearance</h2><div class="radio-row" role="radiogroup" aria-label="Appearance">${["system", "light", "dark"].map((value) => renderAppearanceRadio(value, value[0].toUpperCase() + value.slice(1), settings.appearance || "dark")).join("")}</div><p class="provider-note">The interface is in English. System follows your browser theme.</p></div>`;
  else if (state.settingsSection === "monitor") content = renderDesktopNotificationCard(settings) + `<div class="settings-card"><h2>Monitoring & Scanner Data</h2>
    <p>Monitoring: ${escapeHtml(state.backgroundMonitor?.enabled ? MONITOR_STATUS_TEXT[state.backgroundMonitor.status] || state.backgroundMonitor.status : "Off")}. Full rescan: ${state.scannerRescanIntervalMinutes} minutes.</p>
    <p class="provider-note">Previously matched markets are checked about every minute. Chrome shutdown, sleep and offline periods delay observations. Missing data preserves match states and the last usable full result.</p>
    <button id="exportScannerBackupButton">Export scanner backup</button><button id="importScannerBackupButton">Restore scanner backup</button><input id="importScannerDataFile" type="file" accept=".json,application/json" hidden><button id="recoverScannerDataButton">Recover previous scanner data</button>
    <p class="provider-note">Backups contain conditions, watchlist, results and alerts. Keys and connection settings are excluded. Restore stops monitoring.</p>
    <button data-about="monitor" aria-label="About monitoring and alerts">! About monitoring</button>
    <h3>Website slide-down alerts (optional)</h3><p>Off by default. Allow only sites where you want condition details displayed. Existing AI endpoint permissions do not enable these alerts.</p>
    <label>Site origin<input id="notificationSiteOrigin" class="field" placeholder="https://example.com"></label><button data-site-allow>Allow website alerts on this site</button>
    <ul>${(settings.notificationSites || []).map(origin=>`<li>${escapeHtml(origin)} <button data-site-remove="${escapeHtml(origin)}">Disable site alerts</button></li>`).join("")}</ul></div>`;
  else content = `<div class="settings-card"><h2>Help & Privacy</h2><p>Public market searches work without a Kalshi key. AI requests go directly to the selected provider. Keys stay in this extension's local settings and are excluded from scanner backups. Monitoring runs on this computer.</p><p>There is no news feed, external news search or advertising tracker. Existing saved news remains locally stored; export it below if needed.</p><p>License: open source under the MIT License (free for personal and commercial use). Inquiries &amp; sponsorship: contact@axnli.com.</p><p>Storage: Chrome gives each extension about 10 MB, so only the latest ${CHAT_LOG_LIMIT} chat messages are kept and older ones are removed automatically. Use the download button at the bottom left of the chat to save a full copy, and Alerts &amp; Monitoring to back up conditions and alerts.</p><p class="disclaimer">${escapeHtml(DISCLAIMER)}</p><button id="exportLegacyNewsButton">Export legacy saved items</button><button data-subscription-action="help">User guide</button><button data-product="guide">? Actual photo guide</button><button data-about="capture">! Photograph privacy</button><button data-subscription-action="privacy">Privacy summary</button></div>`;
  return `<section class="panel-section side-settings"><nav class="settings-navigation" aria-label="Settings sections">${sections.map(([id, label]) => `<button data-settings-section="${id}" aria-current="${state.settingsSection === id ? "page" : "false"}"><span class="toolbar-label">${escapeHtml(label).replaceAll("&amp;", '<span class="toolbar-symbol">&amp;</span>')}</span></button>`).join("")}</nav>${content}<button id="saveSettingsButton" class="button-primary full-width" ${state.settingsSaving || state.aiConnectionBusy ? "disabled" : ""}>${state.settingsSaving ? "Saving…" : "Save settings"}</button>${state.settingsSaveResult ? renderActionResult(state.settingsSaveResult.text, state.settingsSaveResult.tone) : ""}</section>`;
}

function renderMcpAgentsCard(settings) {
  const enabled = settings.mcpBridgeEnabled === true;
  const status = state.mcpBridgeStatus;
  const statusText = state.mcpBridgeBusy ? "Checking…"
    : !status ? "Not checked"
    : status.connected ? `Connected${status.syncedAt ? ` · last shared ${formatDate(status.syncedAt)}` : ""}`
    : status.detail;
  const extensionId = globalThis.chrome?.runtime?.id || "";
  return `<div class="settings-card"><h2>AI Agents (MCP)</h2>
    <p>Use Kalshi Screener from Claude, ChatGPT, Grok, Meta Muse, Cursor or VS Code. The MCP server runs on your computer or on your own Cloudflare account. Nothing runs on our servers, and it can never trade.</p>
    <h3>1. Desktop AI apps (Claude Desktop, Claude Code, Cursor, VS Code)</h3>
    <p>The server runs from a folder on your computer. Node.js 20 or later is required.</p>
    <ol class="provider-note">
      <li>Download the Kalshi Screener MCP server from <a href="${escapeHtml(PROJECT_REPO_URL)}" target="_blank" rel="noopener noreferrer">GitHub</a> (Code, Download ZIP) and unzip it.</li>
      <li>Open a terminal in that folder and run <code>npm install</code> once.</li>
      <li>Paste the full path of that folder below, then copy the settings into your AI app and restart it.</li>
    </ol>
    <label>MCP server folder<input id="settingMcpServerFolder" class="field" type="text" spellcheck="false" placeholder="${escapeHtml(MCP_FOLDER_PLACEHOLDER)}" value="${escapeHtml(settings.mcpServerFolder || "")}" /></label>
    <pre class="provider-note" id="mcpConfigPreview">${escapeHtml(mcpClientConfig(settings))}</pre>
    <button id="copyMcpConfigButton">Copy MCP settings</button>
    ${state.mcpCopyResult ? renderActionResult(state.mcpCopyResult.text, state.mcpCopyResult.tone) : ""}
    <p class="provider-note">Claude Code: <code id="mcpClaudeCodeCommand">${escapeHtml(mcpClaudeCodeCommand(settings))}</code></p>
    <h3>2. Share your conditions, watchlist and alerts</h3>
    <label class="inline-check"><input id="settingMcpBridgeEnabled" type="checkbox" ${enabled ? "checked" : ""} /> Share with the MCP server on this computer</label>
    <label>Port<input id="settingMcpBridgePort" class="field" type="number" min="1024" max="65535" value="${mcpBridgePort(settings)}" /></label>
    ${renderStatusLine("Server", Boolean(status?.connected), statusText)}
    <button id="mcpBridgeSyncButton" ${state.mcpBridgeBusy ? "disabled" : ""}>${state.mcpBridgeBusy ? "Checking…" : "Check and share now"}</button>
    ${state.mcpBridgeResult ? renderActionResult(state.mcpBridgeResult.text, state.mcpBridgeResult.tone) : ""}
    <p class="provider-note">Data goes only to 127.0.0.1. API keys and AI settings are never shared.</p>
    <h3>3. Web AI apps (ChatGPT, Grok, Meta Muse, Claude on the web)</h3>
    <p>These apps need a web address. Deploy your own free copy of the server to Cloudflare, set an access key, then add <code>https://&lt;your-worker&gt;/mcp?key=&lt;your key&gt;</code> as a custom connector. Steps are in the README of the same download.</p>
    <h3>4. What you can ask your AI (Prompt &amp; Preset combinations)</h3>
    <p class="provider-note">Once connected, your AI can both run your saved presets and automatically combine 17 market filters on the fly from plain-language prompts: ask <em>"Find Kalshi markets closing within 48h priced 80c+ with spread under 5% that are the #1 favorite in their event"</em> (<code>search_markets</code>), tell it <em>"Save that filter combination as 'Closing Favorites'"</em> (<code>save_screen</code>), ask <em>"Run my saved screen"</em> (<code>run_saved_screen</code>), or ask <em>"How often do markets at this price in this series settle YES?"</em> (<code>get_market_evidence</code>).</p>
    ${extensionId ? `<p class="provider-note">"Open in Kalshi Screener" links from AI apps open this extension (ID ${escapeHtml(extensionId)}).</p>` : ""}
  </div>`;
}

async function syncMcpNow({ silent = false } = {}) {
  const settings = state.settings || {};
  if (!silent) { state.mcpBridgeBusy = true; render({ preserveScroll: true }); }
  try {
    const status = await checkMcpBridge(settings);
    if (status.connected && settings.mcpBridgeEnabled === true) {
      const synced = await syncMcpBridge(settings, await readScannerDocument());
      status.syncedAt = synced.syncedAt;
    }
    state.mcpBridgeStatus = status;
    if (!silent) state.mcpBridgeResult = mcpBridgeResult(status, settings);
  } catch (error) {
    state.mcpBridgeStatus = { connected: false, detail: error.message || String(error) };
    if (!silent) state.mcpBridgeResult = { tone: "warn", text: state.mcpBridgeStatus.detail };
  } finally {
    state.mcpBridgeBusy = false;
    if (!silent || state.activeTab === "settings") render({ preserveScroll: true });
  }
}

function mcpBridgeResult(status, settings) {
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (!status.connected) return { tone: "warn", text: status.detail || "The MCP server on this computer did not answer. Start your AI app, then try again." };
  if (settings.mcpBridgeEnabled !== true) return { tone: "warn", text: "Server found, but sharing is off. Tick Share with the MCP server on this computer and press Save settings first." };
  return { tone: "ok", text: `Shared with the MCP server at ${time}. Your AI app can now use your conditions, watchlist and alerts.` };
}

let mcpSyncTimer = null;
function scheduleMcpSync() {
  if (state.settings?.mcpBridgeEnabled !== true) return;
  clearTimeout(mcpSyncTimer);
  mcpSyncTimer = setTimeout(() => void syncMcpNow({ silent: true }), 1500);
}

function browserResearchFootnote(web) {
  if (web?.provider !== "browser") return "";
  const read = (web.results || []).map((result) => result.url).filter(Boolean);
  const lines = [`\n\nBrowser research: read ${read.length} page${read.length === 1 ? "" : "s"} in your browser.`];
  for (const url of read) lines.push(url);
  for (const error of web.errors || []) lines.push(`Skipped ${error}`);
  return lines.join("\n");
}

async function refreshBrowserPermissions() {
  const api = globalThis.chrome;
  const contains = (origins) => api?.permissions?.contains ? api.permissions.contains({ origins }).catch(() => false) : Promise.resolve(false);
  const entries = await Promise.all(BROWSER_RESEARCH_SITES.map(async (site) => [site.id, await contains(site.origins)]));
  state.browserPermissions = { ...Object.fromEntries(entries), any: await contains(ANY_SITE_ORIGINS) };
  render({ preserveScroll: true });
}

// One place to switch desktop notifications and check that Windows actually shows them.
function renderDesktopNotificationCard(settings) {
  return `<div class="settings-card"><h2>How alerts appear</h2>
    <label class="inline-check"><input id="settingAlertWindow" type="checkbox" ${settings.alertWindow !== false ? "checked" : ""} /> Open an alert window with market details when a market matches</label>
    <label class="inline-check"><input id="settingAlertSound" type="checkbox" ${settings.alertSound !== false ? "checked" : ""} /> Play a sound</label>
    <label class="inline-check"><input id="settingDesktopNotifications" type="checkbox" ${settings.desktopNotifications === true ? "checked" : ""} /> Also show a small Windows notification</label>
    <div class="alert-bg-row"><span>Alert window background</span>${renderBackgroundSwatches(settings.alertWindowBackground)}</div>
    <p class="provider-note">Alerts start when you press Repeat in Scanner, or ask the chat "Alert me when ...". They appear while Chrome is running. Every match is also listed in the Alerts tab.</p>
    <button id="testNotificationButton">Show a test alert</button>
    ${renderNotificationCheck()}
  </div>`;
}

// Windows can switch Chrome's notifications off without Chrome knowing, so ask the person whether the test appeared.
function renderNotificationCheck() {
  const result = state.notificationTestResult ? renderActionResult(state.notificationTestResult.text, state.notificationTestResult.tone) : "";
  if (state.notificationCheckAsk) return `${result}<div class="notification-check" role="group" aria-label="Did the test notification appear?">
    <p><strong>A test Windows notification was just sent. Did you see it at the bottom right of your screen?</strong></p>
    <button data-notification-seen="yes">Yes, I saw it</button><button data-notification-seen="no">No</button></div>`;
  if (state.notificationCheckHelp) {
    const windows = /Windows/i.test(globalThis.navigator?.userAgent || "");
    return `${result}<div class="notification-check">
      <p>${windows ? "Windows is hiding Chrome's notifications. To show them:" : "Your system is hiding Chrome's notifications. Allow notifications for Google Chrome in your system settings."}</p>
      ${windows ? `<ol><li>Press the button below, or open Settings &gt; System &gt; Notifications.</li><li>Turn on Notifications at the top, and turn on Google Chrome in the app list.</li><li>Turn off Do not disturb.</li><li>Come back and press Send a test notification.</li></ol>
      <a class="button" href="ms-settings:notifications" target="_blank" rel="noopener">Open Windows notification settings</a>` : ""}</div>`;
  }
  return result;
}

async function answerNotificationCheck(seen) {
  state.notificationCheckAsk = false;
  state.notificationCheckHelp = !seen;
  state.notificationTestResult = seen ? { tone: "ok", text: "Desktop notifications work." } : null;
  try { state.settings = await saveSettings({ notificationCheck: seen ? "seen" : "not_seen" }); } catch {}
  render({ preserveScroll: true });
}

async function removeAlerts(ids) {
  try {
    const updated = await deleteAlerts(ids, state.brokerDataGeneration);
    state.scannerAlerts = updated.data.alerts;
    state.alertDeleteError = "";
  } catch (error) {
    state.alertDeleteError = error.message || String(error);
  }
  render({ preserveScroll: true });
}

async function sendTestNotification() {
  try {
    const level = await globalThis.chrome?.notifications?.getPermissionLevel?.();
    const windowOn = state.settings?.alertWindow !== false, notificationOn = state.settings?.desktopNotifications === true;
    if (!windowOn && !notificationOn) throw new Error("Both are off, so matches only appear in the Alerts tab. Tick one of the options above.");
    // The chime plays first so a window that cannot open does not also silence the test.
    if (state.settings?.alertSound !== false) { try { playChime(); } catch {} }
    if (windowOn) await openAlertWindow(chrome, { test: true });
    state.notificationCheckHelp = false;
    state.notificationCheckAsk = false;
    state.notificationTestResult = windowOn ? { tone: "ok", text: "A test alert window opened at the bottom right of your Chrome window." } : null;
    if (!notificationOn) return;
    if (level === "denied") throw new Error("Chrome is blocking notifications from Kalshi Screener. Allow them in Chrome, then try again.");
    await chrome.notifications.create(`test-${Date.now()}`, { type: "basic", iconUrl: "icons/128X128.png", title: "Kalshi Screener test", message: "Desktop notifications work. Alerts for your conditions will look like this.", priority: 1 });
    // Windows can hide Chrome's notifications without Chrome knowing, so ask.
    state.notificationCheckAsk = true;
  } catch (error) {
    state.notificationCheckAsk = false;
    state.notificationTestResult = { tone: "warn", text: error.message || String(error) };
  } finally {
    render({ preserveScroll: true });
  }
}

function renderBrowserResearchCard(settings) {
  if (!state.browserPermissions) setTimeout(() => void refreshBrowserPermissions(), 0);
  const permissions = state.browserPermissions || {};
  const chosen = new Set(Array.isArray(settings.browserResearchSites) ? settings.browserResearchSites : []);
  return `<div class="settings-card browser-research-card"><h2>Browser research</h2>
    <p>Lets the chat AI search the web in your own Chrome before it answers. Sign in to sites such as X or Naver in Chrome as usual; the AI uses those sessions without seeing your password. Pages open in background tabs, are read, then closed. It never types, clicks or posts.</p>
    <label class="inline-check"><input id="settingBrowserResearchEnabled" type="checkbox" ${settings.browserResearchEnabled === true ? "checked" : ""} /> Let the chat AI search in my browser</label>
    <p class="provider-note">Choose sites. Chrome asks once for permission to read each site.</p>
    ${BROWSER_RESEARCH_SITES.map((site) => `<label class="inline-check"><input type="checkbox" data-browser-site="${escapeHtml(site.id)}" ${chosen.has(site.id) && permissions[site.id] !== false ? "checked" : ""} /> ${escapeHtml(site.label)}${chosen.has(site.id) && permissions[site.id] === false ? " (permission removed, tick again to allow)" : ""}</label>`).join("")}
    <p class="provider-note">Links you paste into chat are read only if you allow their site. ${permissions.any ? "All https sites are allowed." : ""}</p>
    <button data-browser-any="${permissions.any ? "remove" : "allow"}">${permissions.any ? "Stop reading any https site" : "Allow reading links on any https site"}</button>
    <p class="provider-note">Page text goes to the AI connection you selected, with your question. Search uses your AI provider for one extra short request. Works with every connection, including local models.</p>
  </div>`;
}

async function toggleBrowserResearchSite(input) {
  const site = BROWSER_RESEARCH_SITES.find((entry) => entry.id === input.dataset.browserSite);
  if (!site) return;
  const wanted = input.checked;
  try {
    // Request first, inside the click, so Chrome shows its permission prompt.
    const granted = wanted ? await globalThis.chrome.permissions.request({ origins: site.origins }) : true;
    if (wanted && !granted) throw new Error(`Chrome did not allow reading ${site.label}.`);
    const current = new Set(Array.isArray(state.settings?.browserResearchSites) ? state.settings.browserResearchSites : []);
    wanted ? current.add(site.id) : current.delete(site.id);
    state.settings = await saveSettings({ browserResearchSites: BROWSER_RESEARCH_SITES.map((entry) => entry.id).filter((id) => current.has(id)) });
    state.status = wanted ? `${site.label} added to browser research` : `${site.label} removed from browser research`;
  } catch (error) {
    state.status = error.message || String(error);
  }
  await refreshBrowserPermissions();
}

async function toggleAnySitePermission(action) {
  try {
    const api = globalThis.chrome;
    if (action === "allow" && !await api.permissions.request({ origins: ANY_SITE_ORIGINS })) throw new Error("Chrome did not allow reading all https sites.");
    if (action === "remove") await api.permissions.remove({ origins: ANY_SITE_ORIGINS });
    state.status = action === "allow" ? "Links on any https site can be read" : "Stopped reading links on other sites";
  } catch (error) {
    state.status = error.message || String(error);
  }
  await refreshBrowserPermissions();
}

function normalizeResearchTicker(value = "") {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 120);
}

async function openResearch(value) {
  const ticker = normalizeResearchTicker(value);
  if (!ticker) return;
  const target = { ticker, market: null, series: null, loading: true, error: "" };
  state.researchTarget = target;
  render({ preserveScroll: true });
  try {
    const [market] = await getTickerSnapshot([ticker], { settings: state.settings?.KALSHI || {} });
    if (!market) throw new Error(`Kalshi market ${ticker} was not found.`);
    target.market = market;
    // Settlement sources are optional context; the prompt still works without them.
    target.series = await getSeriesInfo(market.seriesTicker).catch(() => null);
  } catch (error) {
    target.error = `Could not load ${ticker}: ${error.message || String(error)}. The prompt below uses the ticker only.`;
  } finally {
    target.loading = false;
    if (state.researchTarget === target) render({ preserveScroll: true });
  }
}

function researchPromptText(target = state.researchTarget) {
  if (!target) return "";
  return buildResearchPrompt(target.market || { symbol: target.ticker }, target.series);
}

async function copyResearchText(text, done) {
  try {
    await navigator.clipboard.writeText(text);
    state.status = done;
  } catch (error) {
    state.status = `Could not copy: ${error.message || String(error)}`;
  }
  render({ preserveScroll: true });
}

function renderResearchModal() {
  const target = state.researchTarget;
  const display = contractDisplayModel(target.market || { marketTicker: target.ticker });
  const sources = (target.series?.settlementSources || []).filter((source) => /^https:\/\//i.test(source.url));
  const terms = [target.series?.contractTermsUrl, target.series?.contractUrl].find((url) => /^https:\/\//i.test(String(url || "")));
  return `
    <div class="panel-modal-backdrop" role="presentation">
      <section class="panel-modal research-modal" role="dialog" aria-modal="true" aria-label="Research with AI">
        <div class="modal-header">
          <div>
            <h2>Research with AI</h2>
            <p>${escapeHtml(display.marketTitle || display.marketTicker)}</p>
          </div>
          <button class="icon-action" data-modal-action="close" title="Close" aria-label="Close">${renderIcon("close")}</button>
        </div>
        <div class="modal-body">
          <p>Copy this prompt into the AI app you use (Claude, ChatGPT, Grok or a local model). Most AI apps can search the web on their own. For news sites, X or forums that need a login, add one of the browser tools below.</p>
          ${target.loading ? `<p class="provider-note">Loading market rules and settlement sources…</p>` : ""}
          ${target.error ? `<div class="error-box">${escapeHtml(target.error)}</div>` : ""}
          ${target.market ? `<div class="broker-result-metrics">${contractMetricGrid(display)}</div>` : ""}
          ${sources.length || terms ? `<div class="deep-context-summary"><strong>Settlement sources</strong>${sources.map((source) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.name || source.url)}</a>`).join("")}${terms ? `<a href="${escapeHtml(terms)}" target="_blank" rel="noopener noreferrer">Contract terms</a>` : ""}</div>` : ""}
          <label>Prompt<textarea id="researchPromptText" class="field research-prompt" rows="9" readonly>${escapeHtml(researchPromptText(target))}</textarea></label>
          <button id="copyResearchPromptButton" class="button-primary" ${target.loading ? "disabled" : ""}>Copy prompt</button>
          <h3>Browser tools for sites that need a login</h3>
          <p class="provider-note">${escapeHtml(RESEARCH_LOGIN_WARNING)}</p>
          ${RESEARCH_TOOLS.map(renderResearchTool).join("")}
          <button id="copyResearchMcpButton">Copy MCP settings (Kalshi Screener + Playwright)</button>
          <p class="panel-disclaimer">Research only. Not financial advice. Not affiliated with Kalshi.</p>
        </div>
        <div class="modal-actions">
          <button data-modal-action="close">Close</button>
        </div>
      </section>
    </div>
  `;
}

function renderResearchTool(tool) {
  return `<article class="research-tool">
    <div class="settings-card-heading"><strong>${escapeHtml(tool.name)}</strong><span class="source-pill is-muted">${escapeHtml(tool.kind)}</span></div>
    <p>${escapeHtml(tool.summary)}</p>
    <p class="provider-note">Works with: ${escapeHtml(tool.worksWith)}. ${escapeHtml(RESEARCH_DISCLAIMER)}</p>
    <p><a href="${escapeHtml(tool.url)}" target="_blank" rel="noopener noreferrer">Get ${escapeHtml(tool.name)}</a>${tool.sourceUrl ? ` · <a href="${escapeHtml(tool.sourceUrl)}" target="_blank" rel="noopener noreferrer">Source code</a>` : ""}</p>
  </article>`;
}

function renderLinkedMarketCard() {
  const data = state.linkedMarketData;
  const display = contractDisplayModel(data || { marketTicker: state.linkedMarket });
  return `<div class="settings-card broker-card linked-market-card">
    <div class="settings-card-heading"><h2>${escapeHtml(display.marketTitle || display.marketTicker)}</h2><span class="source-pill">From AI agent</span></div>
    <p>${escapeHtml(display.marketTicker)}${display.eventTicker ? ` / ${escapeHtml(display.eventTicker)}` : ""}${display.closeTime ? ` · Closes ${escapeHtml(formatDate(display.closeTime))}` : ""}</p>
    ${data?.error ? `<div class="error-box">${escapeHtml(data.error)}</div>` : data ? `<div class="broker-result-metrics">${contractMetricGrid(display)}</div>` : `<small>Loading market…</small>`}
    ${data?.rulesSummary ? `<p class="provider-note">${escapeHtml(String(data.rulesSummary).slice(0, 600))}</p>` : ""}
    <div class="broker-result-actions"><button data-research-market="${escapeHtml(display.marketTicker)}">Research with AI</button><button data-linked-market-watch ${data && !data.error ? "" : "disabled"}>Add to Watchlist</button><button data-linked-market-dismiss>Dismiss</button></div>
  </div>`;
}

async function loadLinkedMarket() {
  const ticker = state.linkedMarket;
  try {
    const [row] = await getTickerSnapshot([ticker]);
    state.linkedMarketData = row || { error: `Kalshi market ${ticker} was not found or is no longer open.` };
  } catch (error) {
    state.linkedMarketData = { error: `Could not load ${ticker}: ${error.message || String(error)}` };
  }
  if (state.linkedMarket === ticker) render({ preserveScroll: true });
}

function renderKALSHIApiCard(settings) {
  const KALSHI = settings.KALSHI || {};
  const gate = portfolioSnapshotGate(KALSHI);
  const statusOn = gate.hasCredentials;
  const environmentLabel = kalshiEnvironmentLabel(KALSHI);
  const testing = state.kalshiConnectionTesting === true;
  const connectionMessage = testing
    ? "Testing Production/Demo read-only access..."
    : KALSHI.connectionMessage || "Not tested";
  const testButtonLabel = testing ? renderLoadingLabel("Testing") : "Test Connection";
  const keyTypeLabel = gate.hasCredentials
    ? "Production/Demo read-only readiness will be auto-detected"
    : "Public REST available without keys";
  return `
    <div class="settings-card side-settings-card settings-section-kalshi">
      <div class="settings-card-heading">
        <h2>Kalshi API</h2>
        <span class="subscription-badge ${statusOn ? "is-active" : "is-muted"}">${statusOn ? "Kalshi On" : "Kalshi Off"}</span>
      </div>
      ${renderStatusLine("API credentials", gate.hasCredentials, gate.hasCredentials ? "Stored locally" : "Not configured")}
      ${renderStatusLine("Read-only key", gate.readOnly, gate.readOnly ? "Confirmed by user" : "Confirmation needed")}
      ${renderStatusLine("Connection test", testing || KALSHI.connectionStatus === "connected", connectionMessage)}
      ${renderStatusLine("Environment", true, environmentLabel)}
      ${renderStatusLine("Private readiness", gate.hasCredentials, keyTypeLabel)}
      ${renderStatusLine("Public market data", true, "No API key required")}
      ${renderStatusLine("Orders / execution", false, "Excluded")}
      <label>API Key ID <input id="settingKALSHIApiKey" class="field" type="password" value="${escapeHtml(KALSHI.apiKey || "")}" autocomplete="off" /></label>
      <label class="secret-label">
        <span class="secret-field-head">
          <span>RSA Private Key</span>
          <button type="button" class="secret-toggle-button" data-kalshi-secret-toggle aria-pressed="${state.kalshiSecretVisible === true ? "true" : "false"}">${state.kalshiSecretVisible === true ? "Hide" : "Show"}</button>
        </span>
        <textarea id="settingKALSHIApiSecret" class="field${state.kalshiSecretVisible === true ? "" : " is-masked"}" rows="5" autocomplete="off" spellcheck="false">${escapeHtml(KALSHI.apiSecret || "")}</textarea>
      </label>
      <label class="inline-check${KALSHI.connectionStatus === "read_only_unconfirmed" && !KALSHI.readOnlyConfirmed ? " needs-attention" : ""}"><input id="settingKALSHIReadOnly" type="checkbox" ${KALSHI.readOnlyConfirmed ? "checked" : ""} /> I confirm these Kalshi credentials are used only for read-only observation.</label>
      <label class="inline-check"><input id="settingKALSHIContextOptIn" type="checkbox" ${KALSHI.includePortfolioContext ? "checked" : ""} /> Allow read-only account/position snapshot as optional Chat/Deep context when I ask for it.</label>
      <div class="notice">
        Public Kalshi market data works without an API key where the endpoint allows it. API Key ID and RSA Private Key are optional and used only for read-only account, position, API-limit, and WebSocket readiness checks. Trading, order placement, order amendment, order cancellation, RFQ, quote, transfer, deposit, and withdrawal flows remain excluded.
      </div>
      <div class="settings-actions kalshi-settings-actions">
        <button id="testKALSHIConnectionButton" class="button-primary kalshi-test-button ${testing ? "is-testing" : ""}" ${testing ? "disabled" : ""} aria-busy="${testing ? "true" : "false"}">${testButtonLabel}</button>
      </div>
      ${testing || state.kalshiConnectionTested ? renderActionResult(connectionMessage, testing ? "busy" : KALSHI.connectionStatus === "connected" || KALSHI.connectionStatus === "public_connected" ? "ok" : "warn") : ""}
      <p class="provider-note">Use Test Connection to verify the current Key ID and RSA Private Key; the detected Production/Demo status is saved automatically. Use the bottom Save Settings button for normal settings changes. Private keys are never sent to Chat or Deep Research.</p>
    </div>
  `;
}

function renderSubscriptionCard(settings) {
  const access = freeAccessView(settings);
  return `
    <div class="settings-card side-settings-card subscription-card settings-section-subscription">
      <div class="settings-card-heading">
        <h2>Free Access</h2>
        <span class="subscription-badge ${access.badgeClass}">${escapeHtml(access.statusLabel)}</span>
      </div>
      ${renderStatusLine("Edition", true, access.planLabel)}
      ${renderStatusLine(access.dateLabel, access.dateActive, access.dateValue)}
      <div class="subscription-actions">
        <button class="button-primary" data-subscription-action="plan">${escapeHtml(access.primaryLabel)}</button>
        <button data-subscription-action="privacy">Privacy Summary</button>
        <button data-subscription-action="policy">Full Policy</button>
        <button class="help-cta-button" data-subscription-action="help">Help</button>
      </div>
    </div>
  `;
}

function renderLocalAgentCard(settings) {
  const enabled = settings.localAgentEnabled === true;
  const url = normalizeLocalAgentUrl(settings.localAgentUrl);
  const status = localAgentStatusView(settings);
  const canRunAiTagging = enabled && status.connected && isChatReady(settings) && settings.localAgentAiTaggingEnabled !== false;
  return `
    <div class="settings-card side-settings-card local-agent-card settings-section-local">
      <div class="settings-card-heading">
        <h2>Local Memory</h2>
        <span class="subscription-badge ${status.badgeClass}">${escapeHtml(status.badgeLabel)}</span>
      </div>
      ${renderStatusLine("Agent", status.connected, status.agentLabel)}
      ${renderStatusLine("Endpoint", enabled, enabled ? url : "Browser only")}
      ${renderStatusLine("AI Tagging", canRunAiTagging, localAgentAiTaggingLabel(settings, status))}
      <label class="inline-check"><input id="settingLocalAgentEnabled" type="checkbox" ${enabled ? "checked" : ""} /> Enable Local Agent</label>
      <label>Agent URL <input id="settingLocalAgentUrl" class="field" type="url" value="${escapeHtml(url)}" autocomplete="off" /></label>
      <div class="local-agent-actions">
        <button id="checkLocalAgentButton" ${enabled ? "" : "disabled"}>Check Agent</button>
      </div>
      <p class="provider-note">Local Agent stores long-term memory in the user's local folder. AI Tagging uses the selected Chat AI provider after the agent is connected.</p>
    </div>
  `;
}

function localAgentStatusView(settings) {
  const status = state.localAgentStatus || localAgentDisabledStatus();
  if (!settings.localAgentEnabled) {
    return {
      connected: false,
      badgeClass: "is-muted",
      badgeLabel: "Off",
      agentLabel: "Browser only"
    };
  }
  if (status.state === "checking") {
    return {
      connected: false,
      badgeClass: "is-muted",
      badgeLabel: "Checking",
      agentLabel: "Checking..."
    };
  }
  if (status.ok) {
    return {
      connected: true,
      badgeClass: "is-active",
      badgeLabel: "Connected",
      agentLabel: status.detail || "Connected"
    };
  }
  return {
    connected: false,
    badgeClass: "is-off",
    badgeLabel: status.label || "Offline",
    agentLabel: status.detail || "Not reachable"
  };
}

function localAgentAiTaggingLabel(settings, status) {
  if (!settings.localAgentEnabled) return "Off";
  if (!status.connected) return "Waiting for agent";
  if (settings.localAgentAiTaggingEnabled === false) return "Off";
  if (!isChatReady(settings)) return "Chat AI needed";
  return "Chat AI provider";
}

function freeAccessView(settings = {}) {
  return {
    statusLabel: "Free forever",
    badgeClass: "is-active",
    planLabel: settings.subscriptionPlan || "Kalshi Screener",
    primaryLabel: "Access Details",
    dateLabel: "Cost",
    dateValue: "No payment required",
    dateActive: true
  };
}

// Results appear next to the button that caused them; the panel status line is often scrolled out of view.
function renderActionResult(text, tone = "ok") {
  return `<p class="action-result is-${tone}" role="status" aria-live="polite">${escapeHtml(text)}</p>`;
}

function renderStatusLine(label, enabled, detail) {
  return `
    <div class="setting-status">
      <span>${escapeHtml(label)}</span>
      <strong class="${enabled ? "is-on" : "is-muted"}">${escapeHtml(detail)}</strong>
    </div>
  `;
}



function renderAppearanceRadio(value, label, current) {
  return `
    <label class="radio-pill ${current === value ? "is-active" : ""}">
      <input type="radio" name="appearanceMode" value="${value}" ${current === value ? "checked" : ""} />
      <span>${label}</span>
    </label>
  `;
}

function appearanceLabel(value) {
  if (value === "light") return "Light";
  if (value === "dark") return "Dark";
  return "System";
}



function getAiProvider(provider) {
  return AI_PROVIDER_BY_ID.get(provider) || AI_PROVIDER_BY_ID.get("none");
}

function defaultModelForProvider(provider) {
  return getAiProvider(provider)?.defaultModel || "";
}

function defaultBaseUrlForProvider(provider) {
  return getAiProvider(provider)?.defaultBaseUrl || "";
}

function shouldShowBaseUrl(provider) {
  return provider.kind === "openai-compatible" || provider.kind === "local";
}

function providerHint(provider) {
  if (provider.kind === "local") return "Ollama or LM Studio OpenAI-compatible host.";
  if (provider.kind === "openai-compatible") return "Uses the OpenAI-compatible chat/completions format.";
  if (provider.kind === "anthropic") return "Uses Anthropic Messages API.";
  if (provider.kind === "gemini") return "Uses Google Gemini generateContent API.";
  return "";
}

function googleGeminiApiKeyLooksPlausible(apiKey = "") {
  const key = String(apiKey || "").trim();
  if (!key) return true;
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(key);
}

function deepResearchKeyHealth(settings = {}) {
  // Deep is the connected chat AI plus a wider browser research pass, so it needs no separate key.
  const safeSettings = settings && typeof settings === "object" ? settings : {};
  const aiReady = isChatReady(safeSettings);
  const browserOn = isBrowserResearchOn(safeSettings);
  return {
    ready: aiReady && browserOn,
    aiReady,
    browserOn,
    detail: !aiReady ? "AI connection needed" : browserOn ? "Ready" : "Browser research is off"
  };
}

function chatModeCount(mode) {
  if (mode === "triple") return 3;
  if (mode === "dual") return 2;
  return 1;
}

function getChatProviders(settings) {
  const slots = selectedAIConnections(settings || {});
  return [0, 1, 2].map((index) => slots[index] || { provider: "none", model: "", apiKey: "" });
}

function normalizeLegacyModel(provider, source, model) {
  const isPersistedFromOlderVersion = source && !Object.prototype.hasOwnProperty.call(source, "customModel");
  if (isPersistedFromOlderVersion && LEGACY_PROVIDER_DEFAULTS[provider.id]?.includes(model)) {
    return provider.defaultModel || model;
  }
  return model;
}

function isChatReady(settings) {
  return isChatConfigured(settings);
}

function chatProviderLabel(settings) {
  const providers = getChatProviders(settings)
    .slice(0, 3)
    .filter((slot) => slot.provider && slot.provider !== "none")
    .map((slot) => getAiProvider(slot.provider).label);
  return providers.length ? providers.join(" -> ") : "Off";
}

function renderChatAttachments() {
  if (!state.chatAttachments.length) return "";
  return `
    <div class="chat-attachments" aria-label="Attached chat files">
      ${state.chatAttachments.map((attachment) => {
        const preview = attachment.kind === "image" && attachment.dataUrl
          ? `<img src="${escapeHtml(attachment.dataUrl)}" alt="" />`
          : `<span class="chat-attachment-type">${escapeHtml(attachment.kind.toUpperCase())}</span>`;
        return `
          <div class="chat-attachment-chip">
            ${preview}
            <span class="chat-attachment-name">${escapeHtml(attachment.name)}</span>
            ${attachment.kind === "image" ? `<button data-edit-photo="${escapeHtml(attachment.id)}">Edit</button>` : ""}
            <button type="button" data-chat-attachment-remove="${escapeHtml(attachment.id)}" title="Remove attached file" aria-label="Remove attached file">x</button>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderPanelChat() {
  const deepReady = deepResearchKeyHealth(state.settings).ready;
  const deepCanStart = deepReady && Boolean(String(state.chatDraft || "").trim());
  const chatRunning = chatOperationActive();
  const contextLabel = state.selected
    ? clampText(state.selected.title, 44)
    : state.brokerConditionResults.length
      ? `${state.brokerConditionResults.length} Kalshi matches`
      : state.brokerWatchlist.length
        ? `${state.brokerWatchlist.length} watchlist contracts`
        : "No context";
  return `
    <section id="panelChatShell" class="panel-chat ${state.chatOpen ? "is-open" : ""}" style="${state.chatOpen ? `--panel-chat-height: ${Number(state.chatHeight || CHAT_DEFAULT_HEIGHT)}px;` : ""}">
      ${state.chatOpen ? `<div id="chatResizeHandle" class="panel-chat-resize" role="separator" aria-orientation="horizontal" title="Drag to resize chat"></div>` : ""}
      <div class="panel-chat-tab">
        <button id="chatToggleButton" class="chat-title-button">
          <span>Kalshi Screener Chat</span>
          <small>${escapeHtml(contextLabel)}</small>
        </button>
        ${state.chatOpen ? `
          <div class="chat-tab-actions">
            <button id="chatInfoButton" class="chat-info-button" title="About this chat" aria-label="About this chat">?</button>
            <button id="clearChatButton" class="chat-clear-button" title="Clear current chat" aria-label="Clear current chat" ${state.chatLog.length && !chatRunning ? "" : "disabled"}>
              ${renderIcon("trash")}
              <span>Clear Chat</span>
            </button>
          </div>
        ` : ""}
      </div>
      ${state.chatOpen ? `
        <div id="panelChatLog" class="panel-chat-log">
      ${state.chatLog.length >= CHAT_LOG_LIMIT ? `<p class="provider-note">Only the latest ${CHAT_LOG_LIMIT} messages are kept on this computer; older ones are removed. Use Save chat to a file (download button below) to keep a full copy.</p>` : ""}
      ${state.chatLog.length ? state.chatLog.map(renderChatMessage).join("") : `<div class="empty panel-chat-empty">Ask from a card, type in your language, build Scanner Lab recipes in natural language, or attach a chart image.</div>`}
        </div>
        <div id="panelChatDropTarget" class="panel-chat-input">
          ${renderChatAttachments()}
          <button id="downloadChatButton" class="icon-action chat-io-button" title="Save chat to a file" aria-label="Save chat to a file" ${state.chatLog.length ? "" : "disabled"}>${renderIcon("download")}</button>
          <button id="chatAttachMenuButton" class="icon-action chat-io-button chat-plus-button" title="Attach a photo or file" aria-label="Attach a photo or file" aria-haspopup="menu" aria-expanded="${state.chatAttachMenuOpen === true}" ${chatRunning ? "disabled" : ""}>+</button>
          ${state.chatAttachMenuOpen && !chatRunning ? `<div class="chat-attach-menu" role="menu" aria-label="Attach">
            <button id="loadChatButton" role="menuitem">Photo or file<small>Images, PDF, text, or a saved chat</small></button>
            <button data-product="capture" role="menuitem">Capture this tab<small>Click the Kalshi Screener toolbar icon on the page first</small></button>
          </div>` : ""}
          <textarea id="chatInput" class="field chat-textarea" rows="1" placeholder="Ask about markets or describe conditions. Drop or paste a photo to attach it." ${chatRunning ? "disabled" : ""}>${escapeHtml(state.chatDraft)}</textarea>
          <button id="sendChatButton" class="button-primary ${chatRunning ? "chat-stop-button" : ""}" data-chat-control="${chatRunning ? "stop" : "send"}">${chatRunning ? "Stop" : "Send"}</button>
          <button id="draftConditionsButton" class="chat-draft-button" ${chatRunning ? "disabled" : ""} title="Turn the input into a Scanner Lab condition draft. Nothing runs until you apply it.">Draft</button>
          <button id="deepResearchButton" class="deep-button ${deepCanStart ? "is-ready" : "is-off"}" data-deep-control="${deepCanStart ? "start" : "explain"}" ${chatRunning ? "disabled" : ""} title="${deepCanStart ? "Run Deep Research from the input prompt" : "Deep Research setup and usage"}">Deep</button>
          <input id="chatLoadFileInput" class="chat-load-file" type="file" multiple accept="${CHAT_ATTACHMENT_ACCEPT_ATTRIBUTE}" />
        </div>
      ` : ""}
    </section>
  `;
}

function renderSaveModal() {
  const item = state.saveTarget?.item;
  return `
    <div class="panel-modal-backdrop" role="presentation">
      <section class="panel-modal" role="dialog" aria-modal="true" aria-label="Save to group">
        <div class="modal-header">
          <div>
            <h2>Save to group</h2>
            <p>${escapeHtml(clampText(item?.title || "Selected news", 80))}</p>
          </div>
          <button class="icon-action" data-modal-action="close" title="Close" aria-label="Close">${renderIcon("close")}</button>
        </div>
        <div class="modal-group-list">
          ${state.groups.map((group) => `
            <button class="modal-group-button" data-modal-action="save-group" data-group-id="${escapeHtml(group.id)}">
              <span>${escapeHtml(group.name)}</span>
              <small>${state.savedItems.filter((savedItem) => savedItem.groupId === group.id).length}</small>
            </button>
          `).join("")}
        </div>
        <div class="modal-create-row">
          <input id="saveGroupNameInput" class="field" placeholder="New group" />
          <button id="createAndSaveButton">Create & Save</button>
        </div>
      </section>
    </div>
  `;
}

function renderNoteModal() {
  const item = state.noteTarget;
  const notes = Array.isArray(item?.notes) ? item.notes : [];
  return `
    <div class="panel-modal-backdrop" role="presentation">
      <section class="panel-modal" role="dialog" aria-modal="true" aria-label="Saved card note">
        <div class="modal-header">
          <div>
            <h2>Card note</h2>
            <p>${escapeHtml(clampText(item?.title || "Saved card", 90))}</p>
          </div>
          <button class="icon-action" data-modal-action="close" title="Close" aria-label="Close">${renderIcon("close")}</button>
        </div>
        <div class="modal-body note-modal-body">
          <textarea id="savedNoteInput" class="field note-textarea" placeholder="Write a note for this saved card"></textarea>
          ${notes.length ? `
            <div class="note-history">
              <strong>Previous notes</strong>
              ${[...notes].reverse().map((note) => `
                <div class="saved-note-entry">
                  <small>${escapeHtml(formatDate(note.createdAt))}</small>
                  <p>${escapeHtml(note.text).replaceAll("\n", "<br>")}</p>
                </div>
              `).join("")}
            </div>
          ` : ""}
        </div>
        <div class="modal-actions">
          <button data-modal-action="close">Cancel</button>
          <button class="button-primary" data-modal-action="save-note">Save Note</button>
        </div>
      </section>
    </div>
  `;
}

function renderGroupModal() {
  return `
    <div class="panel-modal-backdrop" role="presentation">
      <section class="panel-modal" role="dialog" aria-modal="true" aria-label="New saved group">
        <div class="modal-header">
          <div>
            <h2>New group</h2>
            <p>Create a saved research group.</p>
          </div>
          <button class="icon-action" data-modal-action="close" title="Close" aria-label="Close">${renderIcon("close")}</button>
        </div>
        <div class="modal-create-row single">
          <input id="groupNameInput" class="field" placeholder="Group name" />
          <button id="createGroupButton" class="button-primary">Create</button>
        </div>
      </section>
    </div>
  `;
}

function renderChatSwitchModal() {
  const item = state.chatSwitchTarget;
  return `
    <div class="panel-modal-backdrop" role="presentation">
      <section class="panel-modal compact-modal" role="dialog" aria-modal="true" aria-label="Save current chat">
        <div class="modal-header">
          <div>
            <h2>Save current chat?</h2>
            <p>${escapeHtml(clampText(item?.title || "Selected news", 90))}</p>
          </div>
          <button class="icon-action" data-modal-action="cancel-chat-switch" title="Cancel" aria-label="Cancel">${renderIcon("close")}</button>
        </div>
        <div class="modal-body">
          <p>The next AI Ask will start a fresh chat for this news card.</p>
        </div>
        <div class="modal-actions three-actions">
          <button class="button-primary" data-modal-action="save-chat-switch">Save</button>
          <button data-modal-action="discard-chat-switch">No</button>
          <button data-modal-action="cancel-chat-switch">Cancel</button>
        </div>
      </section>
    </div>
  `;
}

function renderClearChatModal() {
  return `
    <div class="panel-modal-backdrop" role="presentation">
      <section class="panel-modal compact-modal" role="dialog" aria-modal="true" aria-label="Clear current chat">
        <div class="modal-header">
          <div>
            <h2>Clear current chat?</h2>
            <p>${escapeHtml(state.chatLog.length ? `${state.chatLog.length} messages will be removed from this chat.` : "There are no chat messages to clear.")}</p>
          </div>
          <button class="icon-action" data-modal-action="close" title="Close" aria-label="Close">${renderIcon("close")}</button>
        </div>
        <div class="modal-body">
          <p>This only clears the local chat history. Scanner Lab, Watchlist, saved presets, settings, and Kalshi data stay unchanged.</p>
        </div>
        <div class="modal-actions">
          <button data-modal-action="close">Cancel</button>
          <button class="button-primary danger-button" data-modal-action="clear-chat-confirm" ${state.chatLog.length && !chatOperationActive() ? "" : "disabled"}>Clear Chat</button>
        </div>
      </section>
    </div>
  `;
}

async function ensureModalTranslation(key, texts) {
  const settings = state.settings || {};
  if (!translationDisabled(settings) || !translationUnavailable()) return;
  const target = translationEnglish(settings);
  const code = target && target.code;
  if (!code || code === "en") return;
  state.modalTranslations = state.modalTranslations || {};
  state.modalTranslating = state.modalTranslating || {};
  const cacheKey = `${key}:${code}`;
  if (state.modalTranslations[cacheKey] || state.modalTranslating[cacheKey]) return;
  state.modalTranslating[cacheKey] = true;
  try {
    const out = {};
    for (const [field, text] of Object.entries(texts)) {
      const value = String(text || "");
      if (!value.trim()) {
        out[field] = text;
        continue;
      }
      const res = await originalAnalysisText(value, settings).catch(() => ({ text: value }));
      out[field] = (res && res.text) || value;
    }
    state.modalTranslations[cacheKey] = out;
  } catch (error) {
    // English content stays on any failure
  } finally {
    delete state.modalTranslating[cacheKey];
    setTimeout(() => render({ preserveScroll: true }), 0);
  }
}

function tModal(key, texts, field) {
  const target = translationEnglish(state.settings || {});
  const code = (target && target.code) || "en";
  const cached = state.modalTranslations?.[`${key}:${code}`];
  return (cached && typeof cached[field] === "string") ? cached[field] : texts[field];
}

const DEEP_INFO_TEXTS = {
  title: "Deep",
  subAi: "Connect an AI first",
  subBrowser: "Turn on browser research",
  subPrompt: "Type a research question first",
  intro: "Deep uses your connected AI and searches more pages in your own browser than a normal Send, then writes a longer report with the pages it read.",
  builtLabel: "How Deep works",
  step1: "1. Your AI plans up to 6 searches across news, the settlement source and social posts.",
  step2: "2. Kalshi Screener opens them in background tabs of this Chrome, reads the text and closes them.",
  step3: "3. Your AI writes a report from those pages and lists them at the end.",
  warnAi: "Add and select an AI connection in Settings, AI Connections. GPT, Claude, Gemini and local AI all work.",
  warnBrowser: "In Settings, AI Connections, turn on \"Let the chat AI search in my browser\" and choose at least one site.",
  warnPrompt: "Write a clear research question in the input box, then press Deep.",
  warn2: "Deep is slower than Send and uses more of your AI usage.",
  warn3: "Kalshi API Key and Secret are never included in the research context.",
  gotIt: "Got it"
};

function renderDeepResearchInfoModal() {
  const deepHealth = deepResearchKeyHealth(state.settings);
  const reason = state.deepInfoModal || (deepHealth.ready ? "prompt" : deepHealth.aiReady ? "browser" : "ai");
  ensureModalTranslation("deepInfo", DEEP_INFO_TEXTS);
  const t = (field) => tModal("deepInfo", DEEP_INFO_TEXTS, field);
  const subtitle = reason === "ai" ? t("subAi") : reason === "browser" ? t("subBrowser") : t("subPrompt");
  const firstWarn = reason === "ai" ? t("warnAi") : reason === "browser" ? t("warnBrowser") : t("warnPrompt");
  return `
    <div class="panel-modal-backdrop" role="presentation">
      <section class="panel-modal" role="dialog" aria-modal="true" aria-label="Deep guide">
        <div class="modal-header">
          <div>
            <h2>${escapeHtml(t("title"))}</h2>
            <p>${escapeHtml(subtitle)}</p>
          </div>
          <button class="icon-action" data-modal-action="close" title="Close" aria-label="Close">${renderIcon("close")}</button>
        </div>
        <div class="modal-body">
          <p>${escapeHtml(t("intro"))}</p>
          <div class="deep-context-summary">
            <strong>${escapeHtml(t("builtLabel"))}</strong>
            <span>${escapeHtml(t("step1"))}</span>
            <span>${escapeHtml(t("step2"))}</span>
            <span>${escapeHtml(t("step3"))}</span>
          </div>
          <ul class="modal-warning-list">
            <li>${escapeHtml(firstWarn)}</li>
            <li>${escapeHtml(t("warn2"))}</li>
            <li>${escapeHtml(t("warn3"))}</li>
          </ul>
        </div>
        <div class="modal-actions">
          <button class="button-primary" data-modal-action="close">${escapeHtml(t("gotIt"))}</button>
        </div>
      </section>
    </div>
  `;
}

function buildDeepResearchConversationContext() {
  const messages = state.chatLog
    .filter((message) => message && !message.pending && String(message.text || "").trim())
    .slice(-DEEP_RESEARCH_CHAT_CONTEXT_MESSAGE_LIMIT);
  const lines = [];
  let totalChars = 0;

  for (const message of messages) {
    const role = message.role === "user" ? "User" : "Kalshi Screener";
    const createdAt = message.createdAt ? formatDate(message.createdAt) : "";
    const text = clampText(message.text || "", DEEP_RESEARCH_CHAT_MESSAGE_CHAR_LIMIT);
    const line = [`[${role}${createdAt ? ` - ${createdAt}` : ""}]`, text].join("\n");
    if (totalChars + line.length > DEEP_RESEARCH_CHAT_CONTEXT_CHAR_LIMIT) break;
    lines.push(line);
    totalChars += line.length;
  }

  return {
    messageCount: lines.length,
    text: lines.join("\n\n")
  };
}

function renderSubscriptionModal() {
  if (state.subscriptionModal === "help") return renderHelpModal();
  return state.subscriptionModal === "privacy"
    ? renderPrivacyModal()
    : renderPlanDetailsModal();
}

const ACCESS_TEXTS = {
  title: "Kalshi Screener Free Access",
  subtitle: "All current extension features are available without payment.",
  bodyIntro: "is a free read-only Kalshi observation workspace. Public market data does not require an account, checkout, or subscription.",
  warn1: "No paid plan, trial period, checkout, billing, or license unlock is required.",
  warn2: "Optional Kalshi API credentials stay local and are used only for read-only private snapshots and readiness checks.",
  warn3: "Trading, orders, transfers, deposits, withdrawals, and buy/sell signals remain excluded.",
  caution: "Future paid products, if any, should be separate from this free public release.",
  close: "Close",
  openPrivacy: "Open Privacy Policy"
};

const PRIVACY_TEXTS = {
  title: "Privacy",
  subtitle: "Short summary for Kalshi Screener Chrome Extension.",
  body: "Kalshi Screener stores extension settings locally in your browser.",
  warn1: "AI requests and attachments go directly to your selected provider; fallback providers receive the same request.",
  warn2: "Keys stay in local extension settings and are excluded from scanner backups. Provider usage may incur charges.",
  warn3: "We do not sell personal data or collect browsing history.",
  caution: "The full Privacy Policy opens in a browser tab.",
  close: "Close",
  openFull: "Open Full Policy"
};

function renderPlanDetailsModal() {
  const settings = state.settings || {};
  const access = freeAccessView(settings);
  ensureModalTranslation("access", ACCESS_TEXTS);
  const t = (field) => tModal("access", ACCESS_TEXTS, field);
  return `
    <div class="panel-modal-backdrop" role="presentation">
      <section class="panel-modal" role="dialog" aria-modal="true" aria-label="Kalshi Screener free access">
        <div class="modal-header">
          <div>
            <h2>${escapeHtml(t("title"))}</h2>
            <p>${escapeHtml(t("subtitle"))}</p>
          </div>
          <button class="icon-action" data-modal-action="close" title="Close" aria-label="Close">${renderIcon("close")}</button>
        </div>
        <div class="modal-body">
          <p>${escapeHtml(access.planLabel)} ${escapeHtml(t("bodyIntro"))}</p>
          <ul class="modal-warning-list">
            <li>${escapeHtml(t("warn1"))}</li>
            <li>${escapeHtml(t("warn2"))}</li>
            <li>${escapeHtml(t("warn3"))}</li>
          </ul>
          <p class="modal-caution">${escapeHtml(t("caution"))}</p>
        </div>
        <div class="modal-actions">
          <button data-modal-action="close">${escapeHtml(t("close"))}</button>
          <button class="button-primary" data-modal-action="open-privacy">${escapeHtml(t("openPrivacy"))}</button>
        </div>
      </section>
    </div>
  `;
}

function renderPrivacyModal() {
  const settings = state.settings || {};
  const policyUrl = configuredPrivacyPolicyUrl(settings);
  const canOpenPolicy = Boolean(policyUrl);
  ensureModalTranslation("privacy", PRIVACY_TEXTS);
  const t = (field) => tModal("privacy", PRIVACY_TEXTS, field);
  return `
    <div class="panel-modal-backdrop" role="presentation">
      <section class="panel-modal" role="dialog" aria-modal="true" aria-label="Privacy">
        <div class="modal-header">
          <div>
            <h2>${escapeHtml(t("title"))}</h2>
            <p>${escapeHtml(t("subtitle"))}</p>
          </div>
          <button class="icon-action" data-modal-action="close" title="Close" aria-label="Close">${renderIcon("close")}</button>
        </div>
        <div class="modal-body">
          <p>${escapeHtml(t("body"))}</p>
          <ul class="modal-warning-list">
            <li>${escapeHtml(t("warn1"))}</li>
            <li>${escapeHtml(t("warn2"))}</li>
            <li>${escapeHtml(t("warn3"))}</li>
          </ul>
          <p class="modal-caution">${escapeHtml(t("caution"))}</p>
        </div>
        <div class="modal-actions">
          <button data-modal-action="close">${escapeHtml(t("close"))}</button>
          <button class="button-primary" data-modal-action="open-privacy" ${canOpenPolicy ? "" : "disabled"}>${escapeHtml(t("openFull"))}</button>
        </div>
      </section>
    </div>
  `;
}

const HELP_BANNER_BY_LANG = {
  en: "New here? You don't have to read all of this. If anything is unclear, just ask the AI in the chat below, in your own language. It can see the Kalshi data on your screen, explain it, and help you build searches in plain words.",
  ko: "처음이신가요? 다 읽지 않으셔도 됩니다. 이해 안 되는 부분이 있으면 아래 채팅의 AI에게 당신의 언어로 물어보세요. 화면의 Kalshi 데이터를 보고 설명해주고, 검색도 쉬운 말로 같이 만들어 줍니다.",
  es: "¿Primera vez? No hace falta leer todo esto. Si algo no queda claro, pregúntale a la IA en el chat de abajo, en tu propio idioma. Puede ver los datos de Kalshi en tu pantalla, explicarlos y ayudarte a crear búsquedas con palabras sencillas.",
  zh: "第一次使用？不必读完全部内容。如有不清楚的地方，直接用你的语言在下方聊天框里问 AI。它能看到你屏幕上的 Kalshi 数据，为你解释，并用简单的话帮你建立筛选条件。",
  ja: "はじめてですか？すべて読む必要はありません。わからないことがあれば、下のチャットの AI にあなたの言語で質問してください。画面の Kalshi データを見て説明し、やさしい言葉で検索づくりも手伝います。"
};

const HELP_CLOSING_BY_LANG = {
  en: "If you remember only one thing: when something here is unclear, ask the AI in the chat below, in your own language. That is what it is there for.",
  ko: "딱 하나만 기억하세요: 여기서 뭔가 막히면, 아래 채팅의 AI에게 당신의 언어로 물어보세요. 그러라고 있는 겁니다.",
  es: "Si recuerdas solo una cosa: cuando algo no quede claro, pregúntale a la IA en el chat de abajo, en tu propio idioma. Para eso está.",
  zh: "如果只记住一件事：当这里有不清楚的地方时，用你的语言在下方聊天框里问 AI。它就是为此而存在的。",
  ja: "ひとつだけ覚えるなら：ここでわからないことがあれば、下のチャットの AI にあなたの言語で質問してください。そのためにあります。"
};

const HELP_SECTIONS = [
  { id: "scanner", title: "1. Find markets manually (Scanner Lab)", body: "Choose a Default Scope (Open Markets, Closing in 24 Hours, Closing in 7 Days, Recently Opened, Settled Markets, All Statuses, or Multivariate Only), pick any of the 45 templates in the Observation Library, and press Run Once; no AI is needed. Use Add to Stack to combine up to 26 rows (A–Z) with AND, OR, NOT and parentheses (for example: A AND (B OR C) AND NOT D)." },
  { id: "chat", title: "2. Build screens & control the app in Chat (Send, Draft, Deep)", body: "Open Kalshi Screener Chat at the bottom and type in any language (requires an AI connected in Settings, AI Connections):\n• Send: Ask for markets (for example \"markets closing in 24 hours over 85c with 24h volume >= 1000\"). The AI automatically combines the conditions, scans live Kalshi markets, lists the busiest matches in chat, and gives you [Apply to Scanner Lab] and [Apply and Run Once] buttons. You can also ask \"Is <ticker> likely to settle YES?\" (checks past settlements in that series), \"add <ticker> to my watchlist\", \"show all markets in event <ticker>\", \"alert me when...\", or \"stop my alerts\".\n• Draft: Translates your plain-language request directly into Scanner Lab condition rows and formula without running a chat reply.\n• Deep: Uses your connected AI plus optional Browser research (reads up to 6 live searches in your own Chrome on sites you allow in Settings, AI Connections).\n• + Button (Photos & Files): Capture the current tab or attach an image, crop and draw opaque masks over private areas before sending, or load a saved chat file." },
  { id: "results", title: "3. See every match, Save Presets & Research with AI", body: "Run Once shows every match in Results, sorted by 24h volume, 100 at a time, with the exact condition values that matched. Markets missing data for a condition are counted as could not be checked, not as non-matches. Save Preset keeps up to 10 condition sets; Set as default makes Scanner open with that preset. On any result or alert card, press Add to Watchlist, Send to Chat, or Research with AI (which loads official contract rules and settlement sources and builds a ready-to-copy research prompt)." },
  { id: "monitor", title: "4. Background monitoring (Repeat) & alerts", body: "Repeat keeps checking your conditions in the background, even with the side panel closed, while Chrome runs and the PC is awake. Previously matched markets are re-checked about every minute between full rescans. A market triggers an alert when it first matches, and again only after it stops matching and matches again. Alerts open a bottom-right popup window with a short sound (or slide down inside the panel when focused); at the top of Alerts you can toggle the window, sound, and optional Windows notification, choose the window color, and press Show a test alert. Alerts keeps the latest 100 matches. Stop or editing conditions ends monitoring." },
  { id: "ai", title: "5. How to enter AI API Keys or use a free Local LLM", body: "1) Open Settings -> AI Connections and press Add connection.\n2) Pick a provider (OpenAI, Anthropic Claude, Google Gemini, xAI Grok, OpenRouter, or Custom) and paste your API key—or choose Ollama / Local Server (http://localhost:11434) to use a free model on your computer with no API key.\n3) Press Load models (or type the model ID, such as gpt-4.1-mini, claude-sonnet-4-20250514, gemini-2.5-flash, or llama3.3), then press Test response. The first verified connection is saved automatically as Primary.\n4) Optionally select Fallback 1 and Fallback 2 under Execution order for automatic failover, then press Save settings. Note: API billing is separate from web chat subscriptions." },
  { id: "kalshi", title: "6. How to enter Kalshi API Keys (Optional)", body: "Public market screening, background monitoring, and MCP require NO Kalshi account or API key. If you want optional read-only account/position snapshots or authenticated WebSocket readiness checks: open Settings -> Kalshi Connection, paste your Kalshi API Key ID and RSA or Ed25519 Private Key (beginning with -----BEGIN RSA PRIVATE KEY----- or -----BEGIN PRIVATE KEY-----), check \"I confirm these Kalshi credentials are used only for read-only observation\", press Test Connection, and press Save settings. Private keys sign requests locally in your browser and are never sent to AI providers, MCP, or scanner backups." },
  { id: "mcp", title: "7. How to use AI Agents / MCP (Claude, ChatGPT, Grok, Cursor, VS Code)", body: "Open Settings -> AI Agents (MCP) to connect external AI apps:\n1) Download the kalshi-screener-mcp folder from GitHub, open a terminal in that folder, and run npm install once.\n2) Paste that folder path into MCP server folder, press Copy MCP settings, and paste into Claude Desktop, Cursor, or VS Code (or run the shown claude mcp add command for Claude Code). For web AI apps (ChatGPT, Grok, Meta Muse, Claude Web), deploy your own free copy to Cloudflare Workers as explained in the README.\n3) Check \"Share with the MCP server on this computer\" and press Check and share now to sync your presets, watchlist, and latest 200 alerts over 127.0.0.1.\n4) Prompting your AI: Your AI can both run your saved presets (run_saved_screen) AND automatically combine 17 filter parameters on the fly from plain-language prompts (search_markets—for example: \"Find Kalshi markets closing in 48h over 80c with spread under 5% that are the #1 favorite in their event\"), save new screens by voice/text (\"Save that filter as...\" via save_screen), and check historical series settlement rates (get_market_evidence)." },
  { id: "privacy", title: "8. Privacy & licensing", body: "AI requests go directly to your selected provider; fallbacks receive the same request on failure. Keys, conditions, results, and alerts stay on this computer. Crop and opaque-mask photographs in the built-in editor and confirm the preview and AI destinations before sending. Website slide-down alerts and Browser research are off by default and require explicit site permission. License: open source under the MIT License (free for personal and commercial use; contact@axnli.com for questions). There are no ads." },
  { id: "storage", title: "9. Storage limits & backups", body: "Chrome gives each extension about 10 MB of local storage, so Kalshi Screener keeps only the latest " + CHAT_LOG_LIMIT + " chat messages; older messages are removed automatically. Use the download button at the bottom left of the chat (Save chat to a file) to keep a full copy and load it later from the + menu (Load chat from a file). Conditions, up to 10 presets, watchlist, and the latest 100 alerts are stored in local IndexedDB; use Settings -> Alerts & Monitoring to export, restore, or recover scanner backups." }
];

function helpLocaleCode() {
  const target = translationEnglish(state.settings || {});
  return (target && target.code) || "en";
}

function helpBannerText() {
  return HELP_BANNER_BY_LANG[helpLocaleCode()] || HELP_BANNER_BY_LANG.en;
}

function helpClosingText() {
  return HELP_CLOSING_BY_LANG[helpLocaleCode()] || HELP_CLOSING_BY_LANG.en;
}

function helpSectionView(section) {
  const translated = state.helpTranslation && state.helpTranslation[section.id];
  return {
    title: (translated && translated.title) || section.title,
    body: (translated && translated.body) || section.body
  };
}

async function ensureHelpTranslation() {
  const settings = state.settings || {};
  if (!translationDisabled(settings) || !translationUnavailable()) return;
  const target = translationEnglish(settings);
  const code = target && target.code;
  if (!code || code === "en") return;
  if (state.helpTranslatedFor === code || state.helpTranslating) return;
  state.helpTranslating = true;
  if (state.subscriptionModal === "help") render({ preserveScroll: true });
  try {
    const translated = {};
    for (const section of HELP_SECTIONS) {
      const [titleRes, bodyRes] = await Promise.all([
        originalAnalysisText(section.title, settings).catch(() => ({ text: section.title })),
        originalAnalysisText(section.body, settings).catch(() => ({ text: section.body }))
      ]);
      translated[section.id] = { title: titleRes.text, body: bodyRes.text };
    }
    state.helpTranslation = translated;
    state.helpTranslatedFor = code;
  } catch (error) {
    // English content stays on any failure
  } finally {
    state.helpTranslating = false;
    if (state.subscriptionModal === "help") render({ preserveScroll: true });
  }
}

function renderHelpModal() {
  const banner = helpBannerText();
  const closing = helpClosingText();
  const translatingHint = state.helpTranslating
    ? `<p class="help-translating">Translating to your language...</p>`
    : "";
  const sections = HELP_SECTIONS.map((section) => {
    const view = helpSectionView(section);
    return `
      <section class="help-section">
        <h3>${escapeHtml(view.title)}</h3>
        <div class="help-body">${escapeHtml(view.body).replaceAll("\n", "<br>")}</div>
      </section>
    `;
  }).join("");
  return `
    <div class="panel-modal-backdrop" role="presentation">
      <section class="panel-modal help-modal" role="dialog" aria-modal="true" aria-label="Kalshi Screener help">
        <div class="modal-header">
          <div>
            <h2>Help</h2>
            <p>Kalshi Screener quick guide.</p>
          </div>
          <button class="icon-action" data-modal-action="close" title="Close" aria-label="Close">${renderIcon("close")}</button>
        </div>
        <div class="modal-body help-modal-body">
          <div class="help-banner">${escapeHtml(banner)}</div>
          ${translatingHint}
          ${sections}
          <div class="help-closing">${escapeHtml(closing)}</div>
        </div>
        <div class="modal-actions">
          <button class="button-primary" data-modal-action="close">Got it</button>
        </div>
      </section>
    </div>
  `;
}

const CHAT_INFO_TEXT = `1. Search & Combine Conditions with Send: Type what you want in any language (for example "markets closing in 24h over 85c with volume >= 1000") and press Send. The AI automatically combines Scanner Lab conditions, scans live Kalshi markets, lists the busiest matches in chat, and shows [Apply to Scanner Lab] and [Apply and Run Once] buttons.

2. Direct Market Questions & App Commands: Put a ticker in your question (or press Send to Chat on a result card) to ask about a specific market. Ask "Is it likely to settle YES?" to check how past events in that series settled. You can also say "add <ticker> to my watchlist", "remove <ticker> from my watchlist", "show all markets in event <ticker>", "alert me when...", or "stop my alerts".

3. Draft Button (Condition Builder Only): Press Draft to translate your natural-language prompt directly into Scanner Lab condition rows (A–Z) and a boolean formula (AND / OR / NOT) without running a chat reply.

4. Deep Button (Browser Research): Turn on Deep to let your connected AI read up to 6 live searches in your own Chrome browser on sites you enabled in Settings -> AI Connections -> Browser research.

5. Photos & Chat Files (+ Button): Press + to capture the current tab, attach an image (cropped and opaque-masked in the editor before sending), or load a saved chat file.

6. Setup & Storage Limits: Connect an AI in Settings -> AI Connections (API key or free local Ollama server). Requests go directly to your provider; Stop cancels an active request. Chrome limits extension storage to about 10 MB, so only the latest ${CHAT_LOG_LIMIT} messages are kept; use the download button (bottom left) to save a full copy. Never paste secret keys into chat.`

async function ensureChatInfoTranslation() {
  const settings = state.settings || {};
  if (!translationDisabled(settings) || !translationUnavailable()) return;
  const target = translationEnglish(settings);
  const code = target && target.code;
  if (!code || code === "en") return;
  if (state.chatInfoTranslatedFor === code || state.chatInfoTranslating) return;
  state.chatInfoTranslating = true;
  if (state.chatInfoModal) render({ preserveScroll: true });
  try {
    const res = await originalAnalysisText(CHAT_INFO_TEXT, settings).catch(() => ({ text: CHAT_INFO_TEXT }));
    state.chatInfoTranslation = (res && res.text) || CHAT_INFO_TEXT;
    state.chatInfoTranslatedFor = code;
  } catch (error) {
    // English content stays on any failure
  } finally {
    state.chatInfoTranslating = false;
    if (state.chatInfoModal) render({ preserveScroll: true });
  }
}

function renderChatInfoModal() {
  const body = state.chatInfoTranslation || CHAT_INFO_TEXT;
  const translatingHint = state.chatInfoTranslating
    ? `<p class="help-translating">Translating to your language...</p>`
    : "";
  return `
    <div class="panel-modal-backdrop" role="presentation">
      <section class="panel-modal help-modal" role="dialog" aria-modal="true" aria-label="About this chat">
        <div class="modal-header">
          <div>
            <h2>About this chat</h2>
            <p>How to search markets, draft conditions, attach photos, and run commands in chat.</p>
          </div>
          <button class="icon-action" data-modal-action="close" title="Close" aria-label="Close">${renderIcon("close")}</button>
        </div>
        <div class="modal-body help-modal-body">
          ${translatingHint}
          <div class="help-body">${escapeHtml(body).replaceAll("\n", "<br>")}</div>
        </div>
        <div class="modal-actions">
          <button class="button-primary" data-modal-action="close">Got it</button>
        </div>
      </section>
    </div>
  `;
}

function renderChatMessage(message) {
  const pending = Boolean(message.pending);
  const pendingDots = pending ? renderThinkingDots() : "";
  const removable = Boolean(message.removable && message.id && !pending);
  const text = message.displayText || message.text || "";

  return `
    <div class="chat-message ${escapeHtml(message.role || "assistant")} ${pending ? "is-pending" : ""}">
      <div class="chat-message-meta">
        <span>${escapeHtml(message.role === "user" ? "You" : PRODUCT_NAME)} - ${escapeHtml(formatDate(message.createdAt))}</span>
        ${removable ? `<button class="chat-message-remove" data-chat-remove-message="${escapeHtml(message.id)}" title="Remove this chat context" aria-label="Remove this chat context"><span class="remove-icon">x</span><span class="remove-label">Remove</span></button>` : ""}
      </div>
      <div class="chat-message-text">${escapeHtml(text).replaceAll("\n", "<br>")}${pendingDots}</div>
    </div>
  `;
}

function bindEvents() {
  bindCurrentProductEvents();
  document.querySelector("[data-linked-market-watch]")?.addEventListener("click", () => {
    if (state.linkedMarketData && !state.linkedMarketData.error) void saveWatchlistSymbol(state.linkedMarketData);
  });
  document.querySelector("[data-linked-market-dismiss]")?.addEventListener("click", () => {
    state.linkedMarket = "";
    state.linkedMarketData = null;
    history.replaceState(null, "", location.pathname);
    render({ preserveScroll: true });
  });
  document.querySelector("#mcpBridgeSyncButton")?.addEventListener("click", async () => {
    captureSettingsDraftFromDom();
    state.settings = await saveSettings(state.settings);
    await syncMcpNow();
  });
  document.querySelector("#settingDesktopNotifications")?.addEventListener("change", async (event) => {
    state.settings = await saveSettings({ desktopNotifications: event.target.checked });
    state.notificationTestResult = { tone: "ok", text: event.target.checked ? "Windows notifications on." : "Windows notifications off." };
    render({ preserveScroll: true });
  });
  document.querySelector("#testNotificationButton")?.addEventListener("click", () => void sendTestNotification());
  document.querySelector("#settingAlertSound")?.addEventListener("change", async (event) => {
    state.settings = await saveSettings({ alertSound: event.target.checked });
    if (event.target.checked) { try { playChime(); } catch {} }
    state.notificationTestResult = { tone: "ok", text: event.target.checked ? "Alert sound on." : "Alert sound off." };
    render({ preserveScroll: true });
  });
  document.querySelectorAll("[data-delete-alert]").forEach((button) => button.addEventListener("click", () => void removeAlerts([button.dataset.deleteAlert])));
  document.querySelector("[data-delete-all-alerts]")?.addEventListener("click", () => {
    if (confirm(`Delete all ${(state.scannerAlerts || []).length} alerts? This cannot be undone.`)) void removeAlerts(null);
  });
  document.querySelectorAll(".bg-swatch[data-alert-bg]").forEach((button) => button.addEventListener("click", async () => {
    state.settings = await saveSettings({ alertWindowBackground: button.dataset.alertBg });
    render({ preserveScroll: true });
  }));
  document.querySelector("#settingAlertWindow")?.addEventListener("change", async (event) => {
    state.settings = await saveSettings({ alertWindow: event.target.checked });
    state.notificationTestResult = { tone: "ok", text: event.target.checked ? "An alert window will open when a market matches." : "Alert window off. Matches still appear in the Alerts tab." };
    render({ preserveScroll: true });
  });
  document.querySelectorAll("[data-notification-seen]").forEach((button) => button.addEventListener("click", () => void answerNotificationCheck(button.dataset.notificationSeen === "yes")));
  document.querySelector("#settingBrowserResearchEnabled")?.addEventListener("change", async (event) => {
    state.settings = await saveSettings({ browserResearchEnabled: event.target.checked });
    state.status = event.target.checked ? "Browser research on" : "Browser research off";
    render({ preserveScroll: true });
  });
  document.querySelectorAll("[data-browser-site]").forEach((input) => input.addEventListener("change", () => void toggleBrowserResearchSite(input)));
  document.querySelector("[data-browser-any]")?.addEventListener("click", (event) => void toggleAnySitePermission(event.currentTarget.dataset.browserAny));
  document.querySelector("#copyResearchPromptButton")?.addEventListener("click", () => copyResearchText(researchPromptText(), "Research prompt copied. Paste it into your AI app."));
  document.querySelector("#copyResearchMcpButton")?.addEventListener("click", () => copyResearchText(researchMcpConfig(mcpServerEntry(state.settings || {})), "MCP settings with Playwright copied"));
  // The folder is typed before Save settings, so the preview and the copy follow the field as it changes.
  document.querySelector("#settingMcpServerFolder")?.addEventListener("input", (event) => {
    const draft = { mcpServerFolder: event.target.value };
    document.querySelector("#mcpConfigPreview").textContent = mcpClientConfig(draft);
    document.querySelector("#mcpClaudeCodeCommand").textContent = mcpClaudeCodeCommand(draft);
  });
  document.querySelector("#copyMcpConfigButton")?.addEventListener("click", async () => {
    const folder = document.querySelector("#settingMcpServerFolder")?.value.trim() || "";
    try {
      await navigator.clipboard.writeText(mcpClientConfig({ mcpServerFolder: folder }));
      state.mcpCopyResult = folder
        ? { tone: "ok", text: "MCP settings copied. Paste them into your AI app's MCP settings and restart it." }
        : { tone: "warn", text: "Copied, but the folder is still the example path. Paste your mcp-server folder above and copy again." };
    } catch (error) {
      state.mcpCopyResult = { tone: "warn", text: `Could not copy: ${error.message || String(error)}` };
    }
    captureSettingsDraftFromDom();
    render({ preserveScroll: true });
  });


  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", async () => {
      captureSettingsDraftFromDom();
      state.activeTab = button.dataset.tab;
      // Results has its own top tab; clicking the top Scanner tab opens Scanner Lab directly.
      if (state.activeTab === "broker") state.brokerSubTab = "scanner";
      state.status = "";
      render();

    });
  });
  document.querySelectorAll("[data-broker-subtab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.brokerSubTab = button.dataset.brokerSubtab || "overview";
      state.activeTab = state.brokerSubTab === "results" ? "results" : "broker";
      state.status = "";
      state.conditionEditTarget = null;
      state.scannerEditTargetIndex = null;
      state.scannerEditDraftParameters = {};
      render();
    });
  });

  document.querySelector("#brokerMarketScope")?.addEventListener("change", () => {
    const marketScope = document.querySelector("#brokerMarketScope")?.value || "open_markets";
    const scope = marketScopeById(marketScope);
    if (!scannerScopeIsSelectable(scope.id)) {
      state.status = `${scope.label} is separated as a Kalshi market, but it is not enabled in this Scanner Lab build.`;
      render({ preserveScroll: true });
      return;
    }
    setConditionRows(currentConditionRows(marketScope).map((row) => ({ ...row, marketScope })), { marketScope });
    state.conditionEditTarget = null;
    state.scannerEditTargetIndex = null;
    state.scannerEditDraftParameters = {};
    render({ preserveScroll: true });
  });
  const observationSearch = document.querySelector("#observationLibrarySearch");
  observationSearch?.addEventListener("input", (event) => {
    state.observationLibraryDraftQuery = event.currentTarget?.value || "";
  });
  observationSearch?.addEventListener("search", () => {
    applyObservationLibrarySearch({ preserveFocus: true });
  });
  observationSearch?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyObservationLibrarySearch({ preserveFocus: true });
  });
  document.querySelector("#observationLibrarySearchButton")?.addEventListener("click", () => {
    applyObservationLibrarySearch({ preserveFocus: true });
  });

  document.querySelectorAll("[data-observation-category]").forEach((details) => {
    details.addEventListener("toggle", () => {
      const categoryId = details.dataset.observationCategory;
      if (!categoryId) return;
      const openCategoryIds = new Set(state.observationLibraryOpenCategoryIds);
      if (details.open) openCategoryIds.add(categoryId);
      else openCategoryIds.delete(categoryId);
      state.observationLibraryOpenCategoryIds = Array.from(openCategoryIds);
    });
  });
  document.querySelectorAll("[data-observation-template]").forEach((button) => {
    button.addEventListener("click", () => applyObservationTemplate(button.dataset.observationTemplate));
  });
  document.querySelectorAll("[data-scanner-param]").forEach((input) => {
    input.addEventListener("input", () => updateScannerDraftParameter(input));
    input.addEventListener("change", () => updateScannerDraftParameter(input));
  });
  document.querySelector("#addConfiguredScannerConditionButton")?.addEventListener("click", addConfiguredScannerCondition);
  document.querySelector("#updateConfiguredScannerConditionButton")?.addEventListener("click", updateConfiguredScannerCondition);
  document.querySelector("#cancelScannerEditButton")?.addEventListener("click", closeConditionEditor);
  document.querySelector("#clearScannerTemplateButton")?.addEventListener("click", () => {
    state.scannerSelectedTemplateId = "";
    state.scannerDraftParameters = {};
    state.scannerEditTargetIndex = null;
    state.scannerEditDraftParameters = {};
    render({ preserveScroll: true });
  });
  document.querySelectorAll("[data-condition-preset]").forEach((button) => {
    button.addEventListener("click", () => applyConditionQuickPreset(button.dataset.conditionPreset));
  });
  document.querySelectorAll("[data-condition-edit]").forEach((button) => {
    button.addEventListener("click", () => {
      openConditionEditorFromTarget(button.dataset.conditionEdit || null);
    });
  });
  document.querySelectorAll("[data-condition-edit-row]").forEach((row) => {
    row.addEventListener("click", (event) => {
      if (event.target?.closest?.("[data-condition-edit], [data-condition-remove]")) return;
      openConditionEditorFromTarget(row.dataset.conditionEditRow || null);
    });
  });
  document.querySelectorAll("[data-condition-choice]").forEach((button) => {
    button.addEventListener("click", () => applyConditionChoice(button.dataset.conditionChoice));
  });
  document.querySelector("#conditionValueApply")?.addEventListener("click", applyConditionValueFromInput);
  document.querySelector("#conditionValueInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyConditionValueFromInput();
    }
  });
  document.querySelector("#conditionTimeframeApply")?.addEventListener("click", applyConditionTimeframeFromInput);
  document.querySelector("#conditionTimeframeValue")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyConditionTimeframeFromInput();
    }
  });
  document.querySelectorAll("[data-condition-remove]").forEach((button) => {
    button.addEventListener("click", () => removeConditionRow(Number(button.dataset.conditionRemove)));
  });
  document.querySelector("#addConditionButton")?.addEventListener("click", addConditionRow);
  document.querySelectorAll("[data-formula-token]").forEach((button) => {
    const tokenIndex = Number(button.dataset.formulaToken);
    button.addEventListener("mousedown", (event) => {
      if (window.PointerEvent) return;
      beginFormulaSelectionDrag(tokenIndex, event);
    });
    button.addEventListener("mouseover", () => extendFormulaSelection(tokenIndex));
    button.addEventListener("mouseup", stopFormulaDrag);
    button.addEventListener("pointerdown", (event) => beginFormulaSelectionDrag(tokenIndex, event));
    button.addEventListener("pointerenter", () => extendFormulaSelection(tokenIndex));
    button.addEventListener("pointerup", stopFormulaDrag);
    button.addEventListener("click", () => {
      if (!formulaSelectionBounds()) startFormulaSelection(tokenIndex);
      stopFormulaDrag();
    });
    button.addEventListener("dblclick", (event) => {
      event.preventDefault();
      toggleFormulaOperator(tokenIndex);
    });
  });
  document.querySelectorAll("[data-formula-action]").forEach((button) => {
    button.addEventListener("click", () => applyConditionFormulaAction(button.dataset.formulaAction));
  });
  document.querySelector("#scannerDirectionFilterToggle")?.addEventListener("click", toggleScannerDirectionFilter);
  document.querySelector("#runConditionButton")?.addEventListener("click", runBrokerCondition);
  document.querySelector("#startScannerLoopButton")?.addEventListener("click", startScannerLoop);
  document.querySelector("#stopScannerLoopButton")?.addEventListener("click", stopScannerObservation);
  document.querySelector("#stopScannerLoopFromResultsButton")?.addEventListener("click", () => stopScannerLoop());
  document.querySelector("#scannerRescanInterval")?.addEventListener("change", (event) => {
    const minutes = Number(event.currentTarget?.value || 15);
    state.scannerRescanIntervalMinutes = SCANNER_RESCAN_OPTIONS_MINUTES.includes(minutes) ? minutes : 15;
    if (scannerLoopActive()) {
      state.scannerLoopNextRescanAt = new Date(Date.now() + state.scannerRescanIntervalMinutes * 60 * 1000).toISOString();
      void updateBackgroundMonitorInterval();
    }
    render({ preserveScroll: true });
  });
  document.querySelector("#scannerAutoResultsMode")?.addEventListener("change", async (event) => {
    state.scannerAutoResultsMode = Boolean(event.currentTarget?.checked);
    state.settings = await saveSettings({
      KALSHI: {
        ...(state.settings?.KALSHI || {}),
        scannerAutoResultsMode: state.scannerAutoResultsMode
      }
    });
    render({ preserveScroll: true });
  });
  document.querySelector("#scannerLoopHelpButton")?.addEventListener("click", () => {
    state.brokerInfoModal = "scanner-loop";
    render({ preserveScroll: true });
  });
  document.querySelector("#saveConditionButton")?.addEventListener("click", saveBrokerConditionPreset);
  document.querySelectorAll("[data-condition-saved-preset]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target?.closest?.("button")) return;
      loadBrokerConditionPreset(card.dataset.conditionSavedPreset);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target?.closest?.("button")) return;
      event.preventDefault();
      loadBrokerConditionPreset(card.dataset.conditionSavedPreset);
    });
  });
  document.querySelectorAll("[data-condition-preset-load]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      loadBrokerConditionPreset(button.dataset.conditionPresetLoad);
    });
  });
  document.querySelectorAll("[data-condition-preset-default]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      void toggleDefaultConditionPreset(button.dataset.conditionPresetDefault);
    });
  });
  document.querySelectorAll("[data-condition-preset-delete]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      await deleteBrokerConditionPreset(button.dataset.conditionPresetDelete);
    });
  });
  document.querySelector("#sendConditionToChatButton")?.addEventListener("click", () => sendConditionResultsToChat());
  document.querySelector("#toggleWatchlistTickerButton")?.addEventListener("click", toggleWatchlistTickerStream);
  document.querySelector("#loadPortfolioSnapshotButton")?.addEventListener("click", () => refreshPortfolioSnapshot({ startAuto: true }));
  document.querySelector("#stopPortfolioAutoRefreshButton")?.addEventListener("click", () => stopPortfolioAutoRefresh());
  document.querySelectorAll("[data-holding-send-chat]").forEach((button) => {
    button.addEventListener("click", () => sendPortfolioHoldingToChat(button.dataset.holdingSendChat));
  });
  document.querySelectorAll("[data-result-send-chat]").forEach((button) => {
    button.addEventListener("click", () => sendSingleConditionResultToChat(button.dataset.resultSendChat));
  });
  document.querySelectorAll("[data-chat-remove-message]").forEach((button) => {
    button.addEventListener("click", () => removeChatMessage(button.dataset.chatRemoveMessage));
  });
  document.querySelectorAll("[data-result-save-market]").forEach((button) => {
    button.addEventListener("click", () => {
      const result = findConditionResult(button.dataset.resultSaveMarket);
      saveWatchlistSymbol(result || button.dataset.resultSaveMarket);
    });
  });
  document.querySelector("#addWatchlistSymbolButton")?.addEventListener("click", addWatchlistSymbolFromDom);
  document.querySelector("#refreshWatchlistButton")?.addEventListener("click", () => refreshWatchlistTickers());
  document.querySelector("#watchlistSymbolInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addWatchlistSymbolFromDom();
    }
  });
  document.querySelectorAll("[data-watchlist-send-chat]").forEach((button) => {
    button.addEventListener("click", () => sendWatchlistSymbolsToChat([button.dataset.watchlistSendChat]));
  });
  document.querySelectorAll("[data-watchlist-remove]").forEach((button) => {
    button.addEventListener("click", () => removeWatchlistSymbol(button.dataset.watchlistRemove));
  });
  document.querySelectorAll("[data-group-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.savedGroupId = button.dataset.groupId;
      render();
    });
  });

  document.querySelectorAll("[data-open-id]").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (event.target.closest("button, .saved-note-preview")) return;
      const item = findItem(card.dataset.openId, card.dataset.pool);
      if (item?.url) window.open(item.url, "_blank", "noopener,noreferrer");
    });
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      event.stopPropagation();
      await handleAction(button.dataset.action, button.dataset.id, button.dataset.pool);
    });
  });

  document.querySelector("#newGroupButton")?.addEventListener("click", () => {
    state.groupDialogOpen = true;
    render();
  });
  document.querySelector("#exportScannerBackupButton")?.addEventListener("click", async () => {
    try {
      const blob = new Blob([await exportScannerBackup()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `kalshi-scanner-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      state.status = "Scanner backup exported. API keys and connection settings are excluded.";
    } catch (error) { state.status = `Backup failed: ${error.message}`; }
    render({ preserveScroll: true });
  });
  document.querySelector("#importScannerBackupButton")?.addEventListener("click", () => {
    document.querySelector("#importScannerDataFile")?.click();
  });
  document.querySelector("#importScannerDataFile")?.addEventListener("change", async (event) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 50 * 1024 * 1024) throw new Error("Backup must be smaller than 50 MB.");
      const text = await file.text();
      const preview = inspectScannerBackup(text);
      const { revision } = await readScannerDocument();
      if (!window.confirm(`Replace scanner data with ${preview.presets} saved conditions, ${preview.watchlist} watchlist entries, ${preview.results} results and ${preview.alerts} alerts? Monitoring will be stopped. Connection settings and API keys will be kept.`)) return;
      await importScannerBackup(text, { expectedRevision: revision });
      await loadData();
      state.status = "Scanner backup restored.";
      render({ preserveScroll: true });
    } catch (error) { state.status = `Restore failed: ${error.message}`; render({ preserveScroll: true }); }
  });
  document.querySelector("#recoverScannerDataButton")?.addEventListener("click", async () => {
    if (!window.confirm("Recover the scanner data saved before the last restore? Connection settings and API keys will be kept.")) return;
    try {
      await recoverScannerData();
      await loadData();
      state.status = "Previous scanner data recovered.";
      render({ preserveScroll: true });
    }
    catch (error) { state.status = `Recovery failed: ${error.message}`; render({ preserveScroll: true }); }
  });
  document.querySelectorAll("input[name='chatMode']").forEach((radio) => {
    radio.addEventListener("change", () => {
      captureSettingsDraftFromDom();
      state.settings = {
        ...state.settings,
        chatMode: radio.value,
        chatProviders: readChatProvidersFromDom()
      };
      render({ preserveScroll: true });
    });
  });
  document.querySelectorAll("input[name='appearanceMode']").forEach((radio) => {
    radio.addEventListener("change", () => {
      captureSettingsDraftFromDom();
      state.settings = {
        ...state.settings,
        appearance: radio.value
      };
      applyAppearance(state.settings);
      render({ preserveScroll: true });
    });
  });
  document.querySelectorAll(".settingChatProvider").forEach((select) => {
    select.addEventListener("change", () => {
      captureSettingsDraftFromDom();
      const slotIndex = Number(select.dataset.slot);
      const chatProviders = readChatProvidersFromDom();
      const provider = getAiProvider(select.value);
      chatProviders[slotIndex] = {
        ...chatProviders[slotIndex],
        provider: provider.id,
        model: provider.defaultModel || chatProviders[slotIndex]?.model || "",
        baseUrl: provider.defaultBaseUrl || chatProviders[slotIndex]?.baseUrl || "",
        localHost: provider.kind === "local"
          ? provider.defaultBaseUrl || chatProviders[slotIndex]?.localHost || "http://localhost:11434"
          : chatProviders[slotIndex]?.localHost || "http://localhost:11434",
        localModel: provider.kind === "local"
          ? provider.defaultModel || chatProviders[slotIndex]?.localModel || "llama3.1"
          : chatProviders[slotIndex]?.localModel || "llama3.1",
        customModel: false
      };
      state.settings = {
        ...state.settings,
        chatProviders
      };
      render({ preserveScroll: true });
    });
  });
  document.querySelectorAll(".settingChatModelSelect").forEach((select) => {
    select.addEventListener("change", () => {
      captureSettingsDraftFromDom();
      const slotIndex = Number(select.dataset.slot);
      const chatProviders = readChatProvidersFromDom();
      chatProviders[slotIndex] = {
        ...chatProviders[slotIndex],
        model: select.value === CUSTOM_MODEL_VALUE ? chatProviders[slotIndex]?.model || "" : select.value,
        customModel: select.value === CUSTOM_MODEL_VALUE
      };
      state.settings = {
        ...state.settings,
        chatProviders
      };
      render({ preserveScroll: true });
    });
  });
  document.querySelector("#createGroupButton")?.addEventListener("click", createGroup);
  document.querySelector("#createAndSaveButton")?.addEventListener("click", createAndSaveGroup);
  document.querySelector("#importSavedButton")?.addEventListener("click", importSavedCards);
  document.querySelector("#savedLoadFileInput")?.addEventListener("change", importSavedCardsFromFileInput);
  document.querySelectorAll("[data-broker-info]").forEach((button) => {
    button.addEventListener("click", () => {
      state.brokerInfoModal = button.dataset.brokerInfo || "overview";
      render({ preserveScroll: true });
    });
  });
  document.querySelectorAll("[data-modal-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = button.dataset.modalAction;
      if (action === "close") {
        closeModal();
        return;
      }
      if (action === "save-group") {
        await saveTargetToGroup(button.dataset.groupId);
        return;
      }
      if (action === "save-note") {
        await saveNoteForTarget();
        return;
      }
      if (action === "save-chat-switch") {
        await saveCurrentChatAndSwitch();
      }
      if (action === "discard-chat-switch") {
        await discardCurrentChatAndSwitch();
      }
      if (action === "cancel-chat-switch") {
        state.chatSwitchTarget = null;
        render();
      }
      if (action === "clear-chat-confirm") {
        await clearChat();
      }
      if (action === "open-checkout") {
        state.subscriptionModal = "plan";
        render();
      }
      if (action === "open-privacy") {
        openConfiguredUrl(configuredPrivacyPolicyUrl(state.settings), "Privacy Policy URL is not connected yet.");
      }
    });
  });
  document.querySelectorAll("[data-subscription-action]").forEach((button) => {
    button.addEventListener("click", () => handleSubscriptionAction(button.dataset.subscriptionAction));
  });
  document.querySelector("#settingLocalAgentEnabled")?.addEventListener("change", (event) => {
    captureSettingsDraftFromDom();
    state.settings = {
      ...state.settings,
      localAgentEnabled: Boolean(event.currentTarget.checked),
      localAgentUrl: normalizeLocalAgentUrl(document.querySelector("#settingLocalAgentUrl")?.value)
    };
    state.localAgentStatus = state.settings.localAgentEnabled
      ? { ...state.localAgentStatus, state: "unchecked", label: "Not checked", detail: "Check Local Agent" }
      : localAgentDisabledStatus();
    render({ preserveScroll: true });
  });
  document.querySelector("#checkLocalAgentButton")?.addEventListener("click", async () => {
    captureSettingsDraftFromDom();
    const nextLocalSettings = readLocalAgentSettingsFromDom();
    state.settings = {
      ...state.settings,
      ...nextLocalSettings
    };
    await refreshLocalAgentStatus({ settings: state.settings });
  });
  document.querySelector("#testKALSHIConnectionButton")?.addEventListener("click", testKALSHISettingsFromDom);
  document.querySelector("[data-kalshi-secret-toggle]")?.addEventListener("click", () => {
    captureSettingsDraftFromDom();
    state.kalshiSecretVisible = !state.kalshiSecretVisible;
    render({ preserveScroll: true });
  });

  document.querySelector("#saveSettingsButton")?.addEventListener("click", persistSettings);
  document.querySelector("#chatToggleButton")?.addEventListener("click", () => {
    state.chatOpen = !state.chatOpen;
    if (state.chatOpen) state.chatHeight = clampChatHeight(state.chatHeight || CHAT_DEFAULT_HEIGHT);
    render({ preserveScroll: true });
  });
  document.querySelector("#clearChatButton")?.addEventListener("click", requestClearChat);
  document.querySelector("#chatInfoButton")?.addEventListener("click", () => {
    state.chatInfoModal = true;
    render({ preserveScroll: true });
    ensureChatInfoTranslation();
  });
  document.querySelector("#chatResizeHandle")?.addEventListener("pointerdown", startChatResize);
  document.querySelector("#deepResearchButton")?.addEventListener("click", handleDeepResearchButtonClick);
  document.querySelector("#downloadChatButton")?.addEventListener("click", downloadChatFile);
  document.querySelector("#chatAttachMenuButton")?.addEventListener("click", () => {
    state.chatAttachMenuOpen = !state.chatAttachMenuOpen;
    render({ preserveScroll: true });
  });
  document.querySelector("#loadChatButton")?.addEventListener("click", () => {
    state.chatAttachMenuOpen = false;
    render({ preserveScroll: true });
    void loadChatFile();
  });
  // Capture runs through the shared product handler; the menu only needs to close.
  document.querySelector('.chat-attach-menu [data-product="capture"]')?.addEventListener("click", () => {
    state.chatAttachMenuOpen = false;
    setTimeout(() => render({ preserveScroll: true }), 0);
  });
  document.querySelector("#chatLoadFileInput")?.addEventListener("change", loadChatFromFileInput);
  document.querySelectorAll("[data-chat-attachment-remove]").forEach((button) => {
    button.addEventListener("click", () => removeChatAttachment(button.dataset.chatAttachmentRemove));
  });
  bindChatFileDropTarget(document.querySelector("#panelChatShell"));
  document.querySelector("#sendChatButton")?.addEventListener("click", (event) => {
    if (event.currentTarget?.dataset.chatControl === "stop") {
      stopChatOperation();
      return;
    }
    sendChat();
  });
  const chatInput = document.querySelector("#chatInput");
  resizeChatInput(chatInput);
  updateDeepResearchButtonState(chatInput);
  chatInput?.addEventListener("input", () => {
    state.chatDraft = chatInput.value;
    resizeChatInput(chatInput);
    updateDeepResearchButtonState(chatInput);
  });
  chatInput?.addEventListener("paste", async (event) => {
    const files = Array.from(event.clipboardData?.files || []);
    if (!files.length) return;
    event.preventDefault();
    await addChatFiles(files);
  });
  chatInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendChat();
    }
  });

  scrollChatToBottom();
}

function readAISettingsDraft(current) {
  const next = { ...current, ...normalizeAIConfiguration(current) };
  const editor = document.querySelector("[data-ai-editor]");
  if (editor) {
    next.aiConnections = next.aiConnections.map((slot) => {
      if (slot.id !== editor.dataset.aiEditor) return slot;
      const updated = { ...slot, label: document.querySelector("#aiConnectionLabel")?.value.trim() || slot.label,
        model: document.querySelector("#aiConnectionModel")?.value.trim() || "",
        imageSupport: document.querySelector("#aiConnectionImageSupport")?.value || slot.imageSupport || "unknown",
        apiKey: document.querySelector("#aiConnectionKey")?.value.trim() || "",
        baseUrl: document.querySelector("#aiConnectionBase")?.value.trim() ?? slot.baseUrl };
      if (aiConnectionIdentity(updated) !== aiConnectionIdentity(slot)) Object.assign(updated, { testStatus: "not_tested", testedAt: "", testMessage: "" });
      return updated;
    });
  }
  next.aiRouting = { ...next.aiRouting };
  document.querySelectorAll("[data-ai-route]").forEach((select) => { next.aiRouting[select.dataset.aiRoute] = select.value; });
  const enabled = document.querySelector("#aiFallbackEnabled");
  if (enabled) next.aiRouting.fallbackEnabled = enabled.checked;
  // New connections own credentials. Retire duplicated legacy slot/key fields on save.
  Object.assign(next, { chatProviders: [], chatProvider: "none", chatApiKey: "", chatModel: "", chatBaseUrl: "", localLlmModel: "", localLlmHost: "" });
  return next;
}

function aiConnectionIdentity(slot) {
  return JSON.stringify([slot.provider, slot.model, slot.apiKey, slot.baseUrl]);
}

function scannerDraftBaseline() {
  return JSON.stringify([currentConditionRows(), currentConditionFormulaTokens(currentConditionRows()), currentScannerDirectionFilter(), state.settings?.KALSHI?.marketScope || "open_markets"]);
}

function renderScannerRequest() {
  const draft = state.pendingScannerPlan;
  const preview = draft ? scannerChatRowsFromConditionCommands(draft.plan.conditions || [], draft.plan.scopeId, 0) : null;
  // Drafts are requested from the bottom chat; this card only appears while one waits for review.
  if (!draft) return "";
  return `<section class="settings-card scanner-request-card"><h2>Condition draft from chat</h2>
    ${draft ? `<div class="scanner-draft-review" role="region" aria-label="Condition draft review"><h3>Review condition draft</h3><p>Source: ${escapeHtml(draft.plan.plannerProvider || draft.plan.planSource || "Local parser")}. Scope: ${escapeHtml(marketScopeById(draft.plan.scopeId).label)}. Mode: ${escapeHtml(draft.plan.mode)}.</p>
      <ul>${preview.rows.map((row, index) => `<li>${conditionRuleLetter(index)}: ${escapeHtml(conditionLabel(row))}</li>`).join("")}</ul>
      <p>Logic: ${escapeHtml(draft.plan.formulaText || draft.plan.formulaJoiner)}. Direction: ${escapeHtml(draft.plan.directionFilter || "All contracts")}.</p>
      ${preview.rejected.length ? `<p role="alert">Needs correction: ${escapeHtml(preview.rejected.join("; "))}</p>` : ""}
      ${(draft.plan.notes || []).map((note) => `<p>${escapeHtml(note)}</p>`).join("")}
      <p>Apply and run once searches with these conditions one time. Apply only puts them in the editor without searching.</p>
      <button id="applyAndRunScannerDraft" class="button-primary">Apply and run once</button><button id="applyScannerDraft">Apply only</button><button id="discardScannerDraft">Discard draft</button></div>` : ""}</section>`;
}

async function applyPendingScannerDraft() {
  const draft = state.pendingScannerPlan;
  if (!draft) return;
  if (draft.generation !== state.brokerDataGeneration || draft.baseline !== scannerDraftBaseline()) {
    state.status = "The conditions or scanner data changed. Create a new draft before applying."; render(); return;
  }
  const built = scannerChatRowsFromConditionCommands(draft.plan.conditions || [], draft.plan.scopeId, 0);
  const resultingCount = draft.plan.mode === "append" ? currentConditionRows().length + built.rows.length : built.rows.length || currentConditionRows().length;
  if (built.rejected.length || draft.plan.invalidConditionCount || resultingCount > MAX_CONDITION_ROWS) {
    state.status = `Draft needs correction: ${built.rejected.join("; ") || "invalid or too many conditions"}`; render(); return;
  }
  if (draft.plan.formulaText) {
    try {
      const validation = validateFormulaTokens(parseFormulaText(draft.plan.formulaText), resultingCount);
      if (!validation.valid) throw new Error(validation.message);
    } catch (error) { state.status = `Draft formula needs correction: ${error.message}`; render(); return; }
  }
  const plan = structuredClone(draft.plan);
  plan.actions = { ...plan.actions, runOnce: false, startLoop: false, stopLoop: false, sendResults: false };
  try {
    const text = await applyScannerChatCommandPlan(plan);
    state.pendingScannerPlan = null;
    state.chatLog = await updateChatMessage(draft.messageId, { text: `${text}\nUse Run Once or Repeat when ready.`, pending: false });
    render();
    return true;
  } catch (error) { state.status = error.message || "Draft could not be applied."; }
  render();
  return false;
}

// One explicit click applies the reviewed draft and runs a single read-only scan.
async function applyAndRunScannerDraft() {
  if (await applyPendingScannerDraft()) await runBrokerCondition();
}

async function runAIConnectionAction(action) {
  if (state.aiConnectionBusy) return;
  const next = captureSettingsDraftFromDom();
  const connection = next.aiConnections.find((slot) => slot.id === state.editingConnectionId);
  if (!connection) return;
  const access = requestConnectionAccess(connection); // User gesture is still active here.
  const identity = aiConnectionIdentity(connection);
  const controller = new AbortController();
  state.aiConnectionController = controller; state.aiConnectionBusy = true; render({ preserveScroll: true });
  try {
    if (!await access) throw new Error("Endpoint access was not granted. Connection remains untested.");
    const result = action === "models" ? await listAIConnectionModels(connection, { signal: controller.signal }) : await testAIConnection(connection, { signal: controller.signal });
    const current = state.settings.aiConnections.find((slot) => slot.id === connection.id);
    if (current && aiConnectionIdentity(current) === identity && !controller.signal.aborted) {
      Object.assign(current, action === "models" ? { availableModels: result, testMessage: `${result.length} model IDs loaded. Choose a model, then test its response.` }
        : { testStatus: result.status, testedAt: result.testedAt, testMessage: result.message });
      const draft = readAISettingsDraft(state.settings);
      // A first working connection becomes Primary, so it is used without a separate Execution order step.
      if (action === "test" && !draft.aiRouting.primary) {
        draft.aiRouting = { ...draft.aiRouting, primary: connection.id };
        current.testMessage = `${result.message} Saved and set as Primary, so chat now uses it.`;
      }
      state.settings = await saveSettings(draft);
    }
  } catch (error) {
    const current = state.settings.aiConnections.find((slot) => slot.id === connection.id);
    const failureMessage = error.message || "Connection request failed. Check model, key, endpoint, permissions and provider availability. You can enter the model ID directly.";
    if (current && aiConnectionIdentity(current) === identity) Object.assign(current, { testStatus: "not_tested", testedAt: "", testMessage: controller.signal.aborted ? "Request cancelled." : failureMessage });
    state.status = controller.signal.aborted ? "Request cancelled." : "AI connection request failed.";
  } finally { state.aiConnectionBusy = false; state.aiConnectionController = null; render({ preserveScroll: true }); }
}

function bindCurrentProductEvents() {
  document.querySelector("#aiConnectionModel")?.addEventListener("change", () => {
    const select = document.querySelector("#aiConnectionImageSupport");
    if (select) select.value = "unknown";
  });
  document.querySelector("[data-advanced-logic]")?.addEventListener("toggle", (event) => { state.advancedLogicOpen = event.target.open; });
  document.querySelectorAll("[data-settings-section]").forEach((button) => button.addEventListener("click", () => {
    captureSettingsDraftFromDom(); state.settingsSection = button.dataset.settingsSection; render();
  }));
  document.querySelector("#addAIConnection")?.addEventListener("click", () => {
    captureSettingsDraftFromDom(); const id = crypto.randomUUID();
    state.settings.aiConnections.push({ id, provider: "openai", label: "OpenAI API", apiKey: "", model: "", baseUrl: "https://api.openai.com", testStatus: "not_tested", customModel: true });
    state.editingConnectionId = id; render();
    // The editor renders below the cards; bring it into view so the Provider list is seen.
    document.querySelector("[data-ai-editor]")?.scrollIntoView({ block: "start", behavior: "smooth" });
  });
  document.querySelectorAll("[data-ai-edit]").forEach((button) => button.addEventListener("click", () => {
    captureSettingsDraftFromDom(); state.editingConnectionId = button.dataset.aiEdit; render();
    document.querySelector("[data-ai-editor]")?.scrollIntoView({ block: "start", behavior: "smooth" });
  }));
  document.querySelectorAll("[data-ai-delete]").forEach((button) => button.addEventListener("click", () => {
    captureSettingsDraftFromDom(); state.settings.aiConnections = state.settings.aiConnections.filter((slot) => slot.id !== button.dataset.aiDelete);
    Object.assign(state.settings, normalizeAIConfiguration(state.settings)); render();
  }));
  document.querySelector("#aiConnectionProvider")?.addEventListener("change", (event) => {
    captureSettingsDraftFromDom(); const config = getAiProvider(event.target.value);
    const slot = state.settings.aiConnections.find((connection) => connection.id === state.editingConnectionId);
    Object.assign(slot, { provider: config.id, label: config.label, model: config.defaultModel || "", imageSupport: "unknown", apiKey: "", baseUrl: config.defaultBaseUrl || "", availableModels: [...(config.models || [])], testStatus: "not_tested", testedAt: "", testMessage: "" }); render();
  });
  document.querySelector("#loadAIModels")?.addEventListener("click", () => void runAIConnectionAction("models"));
  document.querySelector("#testAIResponse")?.addEventListener("click", () => void runAIConnectionAction("test"));
  document.querySelector("#cancelAIRequest")?.addEventListener("click", () => state.aiConnectionController?.abort());
  document.querySelector("#draftConditionsButton")?.addEventListener("click", () => {
    const text = String(document.querySelector("#chatInput")?.value || state.chatDraft || "").trim();
    if (!text) { state.status = "Describe your conditions in the chat input, then choose Draft."; render({ preserveScroll: true }); return; }
    state.chatDraft = /^set scanner lab:/i.test(text) ? text : `Set Scanner Lab: ${text}`;
    state.chatOpen = true; render({ preserveScroll: true }); void sendChat();
  });
  document.querySelector("#applyScannerDraft")?.addEventListener("click", () => void applyPendingScannerDraft());
  document.querySelector("#applyAndRunScannerDraft")?.addEventListener("click", () => void applyAndRunScannerDraft());
  document.querySelector("#showMoreResultsButton")?.addEventListener("click", () => {
    state.resultsShownCount = (state.resultsShownCount || RESULTS_PAGE_SIZE) + RESULTS_PAGE_SIZE;
    render({ preserveScroll: true });
  });
  document.querySelector("#discardScannerDraft")?.addEventListener("click", () => { state.pendingScannerPlan = null; render(); });
  document.querySelector("#exportLegacyNewsButton")?.addEventListener("click", async () => {
    const items = await getSavedNews(); const groups = await getSavedGroups();
    const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, groups, items }, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = url; link.download = "legacy-saved-items.json"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    state.status = "Legacy saved items exported."; render({ preserveScroll: true });
  });
}

function readBrokerConditionFromDom() {
  return currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets")[0];
}

function startFormulaSelection(index) {
  if (!Number.isInteger(index)) return;
  state.conditionFormulaSelectionStart = index;
  state.conditionFormulaSelectionEnd = index;
  state.conditionFormulaDragging = true;
  updateFormulaSelectionDom();
}

function beginFormulaSelectionDrag(index, event) {
  event.preventDefault();
  startFormulaSelection(index);
  document.addEventListener("pointermove", trackFormulaSelectionFromPoint);
  document.addEventListener("mousemove", trackFormulaSelectionFromPoint);
  document.addEventListener("pointerup", stopFormulaDrag, { once: true });
  document.addEventListener("mouseup", stopFormulaDrag, { once: true });
}

function extendFormulaSelection(index) {
  if (!state.conditionFormulaDragging || !Number.isInteger(index)) return;
  state.conditionFormulaSelectionEnd = index;
  updateFormulaSelectionDom();
}

function stopFormulaDrag() {
  state.conditionFormulaDragging = false;
  document.removeEventListener("pointermove", trackFormulaSelectionFromPoint);
  document.removeEventListener("mousemove", trackFormulaSelectionFromPoint);
}

function trackFormulaSelectionFromPoint(event) {
  if (!state.conditionFormulaDragging) return;
  const token = document.elementFromPoint(event.clientX, event.clientY)?.closest?.("[data-formula-token]");
  const index = Number(token?.dataset?.formulaToken);
  if (Number.isInteger(index)) extendFormulaSelection(index);
}

function updateFormulaSelectionDom() {
  const bounds = formulaSelectionBounds();
  document.querySelectorAll("[data-formula-token]").forEach((button) => {
    const index = Number(button.dataset.formulaToken);
    button.classList.toggle("is-selected", Boolean(bounds && index >= bounds.start && index <= bounds.end));
  });
}

function toggleFormulaOperator(index) {
  const rows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets");
  const tokens = currentConditionFormulaTokens(rows).map((token) => ({ ...token }));
  if (tokens[index]?.type !== "operator") return;
  tokens[index] = {
    type: "operator",
    value: tokens[index].value === "AND" ? "OR" : "AND"
  };
  setConditionFormulaTokens(tokens, rows);
  render({ preserveScroll: true });
}

function toggleScannerDirectionFilter() {
  state.scannerDirectionFilter = nextScannerDirectionFilter();
  clearBrokerConditionResults(`Kalshi lens set to ${scannerDirectionLabel()}. Run Once again.`);
  state.status = `Kalshi probability lens set to ${scannerDirectionLabel()}.`;
  render({ preserveScroll: true });
}

function applyConditionFormulaAction(action) {
  const rows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets");
  let tokens = currentConditionFormulaTokens(rows).map((token) => ({ ...token }));
  let nextStatus = "";
  if (action === "wrap") {
    state.conditionFormulaWrapped = !state.conditionFormulaWrapped;
    render({ preserveScroll: true });
    return;
  }
  if (action === "help") {
    state.brokerInfoModal = "logic";
    render({ preserveScroll: true });
    return;
  }

  const bounds = formulaSelectionBounds();
  if (!bounds) {
    state.status = "Select a formula token or drag a formula range first.";
    render({ preserveScroll: true });
    return;
  }

  if (action === "not") {
    if (tokens[bounds.start - 1]?.type === "not") {
      tokens.splice(bounds.start - 1, 1);
    } else {
      tokens.splice(bounds.start, 0, { type: "not", value: "!" });
    }
  }

  if (action === "group") {
    tokens.splice(bounds.start, 0, { type: "open", value: "(" });
    tokens.splice(bounds.end + 2, 0, { type: "close", value: ")" });
  }

  if (action === "ungroup") {
    const result = removeSelectedUiFormulaParentheses(tokens, bounds);
    tokens = result.tokens;
    if (!result.changed) nextStatus = "No parentheses selected.";
  }

  if (action === "delete") {
    const result = deleteSelectedUiFormulaTokens(tokens, bounds);
    tokens = result.tokens;
    if (result.removedParenthesesOnly) {
      nextStatus = "Removed selected parentheses. Select plain tokens again to delete conditions.";
    }
  }

  state.status = nextStatus;
  setConditionFormulaTokens(tokens, rows);
  render({ preserveScroll: true });
}

function applyObservationTemplate(templateId) {
  const template = scannerTemplateById(templateId);
  if (!template) return;
  state.scannerSelectedTemplateId = template.id;
  state.scannerDraftParameters = normalizeTemplateParameters(template, template.defaultParameters || {});
  state.conditionEditTarget = null;
  state.scannerEditTargetIndex = null;
  state.scannerEditDraftParameters = {};
  state.status = template.action === "scope"
    ? `${template.title} selected. Apply it from Condition Setup.`
    : `${template.title} selected. Press Run Once to search with it, or Add to Stack to combine it with more conditions.`;
  render({ preserveScroll: true });
}

function updateScannerDraftParameter(input) {
  const name = input?.dataset?.scannerParam;
  if (!name) return;
  const value = input.type === "checkbox" ? input.checked : input.value;
  if (parseConditionEditTarget()?.field === "template" && state.scannerEditTargetIndex !== null) {
    state.scannerEditDraftParameters = {
      ...state.scannerEditDraftParameters,
      [name]: value
    };
    return;
  }
  state.scannerDraftParameters = {
    ...state.scannerDraftParameters,
    [name]: value
  };
}

function addConfiguredScannerCondition() {
  const template = scannerTemplateById(state.scannerSelectedTemplateId);
  if (!template) return;
  const rows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets");
  const parameters = scannerParametersForAdd(template);
  if (!parameters) {
    state.status = SUPPORTED_TIMEFRAME_MESSAGE;
    render({ preserveScroll: true });
    return;
  }

  if (template.action === "scope") {
    const marketScope = parameters.scope || template.defaultParameters?.scope || "open_markets";
    const scope = marketScopeById(marketScope);
    if (!scannerScopeIsSelectable(scope.id)) {
      state.status = `${scope.label} is separated as an Kalshi market, but this Scanner Lab build does not run it yet.`;
      render({ preserveScroll: true });
      return;
    }
    const scopedRows = rows.map((row) => ({ ...row, marketScope }));
    setConditionRows(scopedRows, { marketScope });
    state.scannerSelectedTemplateId = "";
    state.scannerDraftParameters = {};
    state.conditionEditTarget = null;
    state.scannerEditTargetIndex = null;
    state.scannerEditDraftParameters = {};
    state.status = `Scope applied: ${template.title}`;
    render({ preserveScroll: true });
    return;
  }

  if (rows.length >= MAX_CONDITION_ROWS) {
    state.status = `Up to ${MAX_CONDITION_ROWS} condition rows are supported (A-Z).`;
    render({ preserveScroll: true });
    return;
  }

  const instanceIndex = rows.length;
  const instance = createConditionInstance(template, parameters, instanceIndex);
  const fallbackScope = rows[0]?.marketScope || state.settings?.KALSHI?.marketScope || "open_markets";
  const nextRow = conditionRowFromScannerInstance(instance, fallbackScope);
  const nextRows = [...rows, nextRow].slice(0, MAX_CONDITION_ROWS);

  setConditionRows(nextRows);
  state.conditionEditTarget = null;
  state.scannerSelectedTemplateId = "";
  state.scannerDraftParameters = {};
  state.scannerEditTargetIndex = null;
  state.scannerEditDraftParameters = {};
  state.status = `${template.title} added to Scanner Lab stack`;
  render({ preserveScroll: true });
}

function updateConfiguredScannerCondition() {
  const target = parseConditionEditTarget();
  if (!target || target.field !== "template") return;

  const rows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets");
  const existingRow = rows[target.index] ? normalizeConditionRow(rows[target.index]) : null;
  if (!existingRow) return;

  const template = scannerTemplateById(existingRow.scannerTemplateId || existingRow.sourceTemplateId);
  if (!template) return;

  const parameters = scannerParametersForEdit(template);
  if (!parameters) {
    state.status = SUPPORTED_TIMEFRAME_MESSAGE;
    render({ preserveScroll: true });
    return;
  }

  if (template.action === "scope") {
    const marketScope = parameters.scope || template.defaultParameters?.scope || existingRow.marketScope || "open_markets";
    const scope = marketScopeById(marketScope);
    if (!scannerScopeIsSelectable(scope.id)) {
      state.status = `${scope.label} is separated as an Kalshi market, but this Scanner Lab build does not run it yet.`;
      render({ preserveScroll: true });
      return;
    }
    rows[target.index] = normalizeConditionRow({ ...existingRow, marketScope }, marketScope);
  } else {
    const instance = createConditionInstance(template, parameters, target.index);
    const fallbackScope = existingRow.marketScope || rows[0]?.marketScope || state.settings?.KALSHI?.marketScope || "open_markets";
    rows[target.index] = {
      ...conditionRowFromScannerInstance(instance, fallbackScope),
      id: existingRow.id || instance.id
    };
  }

  setConditionRows(rows);
  state.conditionEditTarget = null;
  state.scannerEditTargetIndex = null;
  state.scannerEditDraftParameters = {};
  state.status = `${template.title} updated in Scanner Lab stack`;
  render({ preserveScroll: true });
}

function openConditionEditorFromTarget(targetValue) {
  if (!targetValue) {
    closeConditionEditor();
    return;
  }

  const [indexValue, field = "template"] = String(targetValue).split(":");
  const index = Number(indexValue);
  if (!Number.isInteger(index)) return;

  const rows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets");
  const row = rows[index] ? normalizeConditionRow(rows[index]) : null;
  if (!row) return;

  const template = scannerTemplateById(row.scannerTemplateId || row.sourceTemplateId);
  if (template) {
    state.conditionEditTarget = `${index}:template`;
    state.scannerEditTargetIndex = index;
    state.scannerEditDraftParameters = scannerParametersFromRow(row, template);
    state.scannerSelectedTemplateId = "";
    state.scannerDraftParameters = {};
    render({ preserveScroll: true });
    return;
  }

  state.conditionEditTarget = `${index}:${field || "value"}`;
  state.scannerEditTargetIndex = null;
  state.scannerEditDraftParameters = {};
  render({ preserveScroll: true });
}

function closeConditionEditor() {
  state.conditionEditTarget = null;
  state.scannerEditTargetIndex = null;
  state.scannerEditDraftParameters = {};
  render({ preserveScroll: true });
}

function conditionRowFromScannerInstance(instance, fallbackScope = "open_markets") {
  const clause = instance.clauses?.[0] || {};
  const operator = CONDITION_OPERATORS.some((entry) => entry.id === clause.operator) ? clause.operator : "gte";
  const value = clause.operator === "between"
    ? `${clause.value ?? ""}~${clause.valueMax ?? ""}`
    : String(clause.value ?? instance.parameters?.value ?? "1");
  return normalizeConditionRow({
    id: instance.id,
    marketScope: instance.parameters?.scope || fallbackScope,
    timeframe: clause.timeframe || instance.parameters?.timeframe || "1h",
    metric: clause.metric || "last_price",
    operator,
    value,
    sourceTemplateId: instance.templateId,
    sourceTemplateLabel: instance.label,
    dataRequirement: instance.dataRequirement,
    scannerTemplateId: instance.templateId,
    scannerParameters: instance.parameters,
    scannerClauses: instance.clauses
  }, fallbackScope);
}

function scannerChatMatches(text, patterns = []) {
  return patterns.some((pattern) => {
    if (pattern instanceof RegExp) return pattern.test(text);
    return String(text).toLowerCase().includes(String(pattern || "").toLowerCase());
  });
}

function isScannerChatCommandIntent(text = "", attachments = []) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  const hasVisualAttachment = attachments.some((attachment) => attachment.kind === "image" || attachment.kind === "pdf");
  const looksLikeQuestion = /[?]|(?:what|why|how|explain|tell\s+me|question)/i.test(raw);
  const hasImperative = scannerChatMatches(raw, [
    /\b(set|add|create|make|update|edit|change|replace|clear|reset|apply|run|start|repeat|stop|turn|enable|disable|send|find|search|scan|screen|filter|show|list)\b/i,
    /\b(on|off)\b/i,
    // Korean requests: find, tell me, show, search, pick, list.
    /찾아|알려|보여|검색|골라|추려|목록|뽑아/
  ]);
  const hasScannerSubject = scannerChatMatches(lower, [
    /scanner\s*lab|scanner|observation|condition|formula|recipe|rescan|review|run once/i,
    /\brsi\b|\bsma\b|\bema\b|\bmacd\b|\bspread\b|\bvolume\b|price\s*change/i,
    /\b(yes|no)\s+(bid|ask)\b|\b(markets?|contracts?)\s+(with|where|that)\b/i,
    /\b(markets?|contracts?)\b.*(\d+\s*(c|cents?|%)|\bclos(e|ing)\b|\bexpir|\bvolume\b)/i,
    // Korean: market or contract together with a price, close time or volume.
    /(시장|마켓|계약).*(\d+\s*(센트|c|%)|마감|만기|거래량|가격|확률)|(\d+\s*(센트|%)|마감|거래량).*(시장|마켓|계약)/
  ]);

  if (hasVisualAttachment && /[\uCC28\uD2B8\uD0C0\uC810\uC870\uAC74\uC870\uD569\uAC80\uC0C9]|\b(chart|entry|setup|scan|scanner|condition)\b/i.test(raw)) {
    return true;
  }
  // "Which markets close today over 80c?" is a search even when phrased as a question.
  if (!/^\s*(why|how|explain|what\s+(is|does|are))\b/i.test(raw) && /\bmarkets\b.*(\d+\s*(c|cents?|%)|\bclos(e|es|ing)\b|\bexpir|\bvolume\b|\bliquid)|\b(which|any|top|list|give me|show me)\b[^?]*\bmarkets\b/i.test(raw)) return true;
  if (looksLikeQuestion && !hasImperative) return false;
  return hasImperative && hasScannerSubject;
}

function parseScannerChatScope(text = "", fallbackScope = "open_markets") {
  const raw = String(text || "");
  const lower = raw.toLowerCase();
  const direct = MARKET_SCOPES.find((scope) => {
    if (scope.hidden || scope.selectable === false) return false;
    const idText = scope.id.replaceAll("_", " ");
    return lower.includes(scope.label.toLowerCase()) || lower.includes(idText);
  });
  if (direct) return { scopeId: direct.id, explicit: true };

  const scopePatterns = [
    { id: "open_markets", patterns: [/open\s*markets?/i, /public\s*markets?/i] },
    { id: "closing_24h", patterns: [/closing\s*(?:in|within)?\s*24h/i, /24\s*hours?/i, /today/i] },
    { id: "closing_7d", patterns: [/closing\s*(?:in|within)?\s*7d/i, /7\s*days?/i, /this\s*week/i] },
    { id: "multivariate_only", patterns: [/multivariate/i, /\bmve\b/i] },
    { id: "exclude_multivariate", patterns: [/exclude\s*multivariate/i, /without\s*multivariate/i] },
    { id: "watchlist", patterns: [/watchlist/i] },
    { id: "saved_symbols", patterns: [/saved\s*(?:symbols?|markets?|contracts?)/i] },
    { id: "open_markets", patterns: [/all\s*kalshi|all\s*markets?|kalshi\s*all/i] }
  ];
  const matched = scopePatterns.find((entry) => scannerChatMatches(raw, entry.patterns));
  return { scopeId: matched?.id || fallbackScope, explicit: Boolean(matched) };
}

function parseScannerChatTimeframe(text = "", fallback = "1h") {
  const raw = String(text || "");
  const patterns = [
    { value: "1mo", pattern: /\b1\s*(?:mo|month|months)\b/i },
    { value: "1w", pattern: /\b1\s*(?:w|week|weeks)\b/i },
    { value: "1d", pattern: /\b1\s*(?:d|day|days)\b/i },
    { value: "4h", pattern: /\b4\s*(?:h|hr|hour|hours)\b/i },
    { value: "1h", pattern: /\b1\s*(?:h|hr|hour|hours)\b/i },
    { value: "30m", pattern: /\b30\s*(?:m|min|minute|minutes)\b/i },
    { value: "15m", pattern: /\b15\s*(?:m|min|minute|minutes)\b/i },
    { value: "5m", pattern: /\b5\s*(?:m|min|minute|minutes)\b/i },
    { value: "1m", pattern: /\b1\s*(?:m|min|minute|minutes)\b/i }
  ];
  return patterns.find((entry) => entry.pattern.test(raw))?.value || fallback;
}

function parseScannerChatRescanMinutes(text = "") {
  const raw = String(text || "");
  const rescanSegment = scannerChatSegment(raw, [/rescan|repeat|loop/i], 50);
  const hourMatch = rescanSegment.match(/\b([123])\s*(?:h|hr|hour|hours)\b/i);
  if (hourMatch) {
    const minutes = Number(hourMatch[1]) * 60;
    return SCANNER_RESCAN_OPTIONS_MINUTES.includes(minutes) ? minutes : null;
  }
  const minuteMatch = rescanSegment.match(/\b(15|30|60|120|180)\s*(?:m|min|minute|minutes)\b/i);
  if (!minuteMatch) return null;
  const minutes = Number(minuteMatch[1]);
  return SCANNER_RESCAN_OPTIONS_MINUTES.includes(minutes) ? minutes : null;
}

function scannerChatSegment(text = "", patterns = [], width = SCANNER_CHAT_CONDITION_WIDTH) {
  const raw = String(text || "");
  for (const pattern of patterns) {
    const match = pattern.exec(raw);
    if (!match) continue;
    const start = Math.max(0, match.index - 18);
    const end = Math.min(raw.length, match.index + match[0].length + width);
    return raw.slice(start, end);
  }
  return raw;
}

function parseScannerChatOperator(segment = "", fallback = "gte") {
  const raw = String(segment || "");
  if (/(<=|below|under|less\s*than|at\s*most)/i.test(raw)) return "lte";
  if (/(<)/i.test(raw)) return "lt";
  if (/(>=|above|over|at\s*least|greater\s*than)/i.test(raw)) return "gte";
  if (/(>)/i.test(raw)) return "gt";
  return fallback;
}

function parseScannerChatNumber(segment = "", fallback = null, { percentOnly = false, allowUnits = true } = {}) {
  const raw = String(segment || "");
  if (percentOnly) {
    const percentMatch = raw.match(/(-?\d+(?:,\d{3})*(?:\.\d+)?)\s*%/);
    return percentMatch ? Number(percentMatch[1].replaceAll(",", "")) : fallback;
  }

  const numberPattern = /(-?\d+(?:,\d{3})*(?:\.\d+)?)\s*(billion|bn|million|m|thousand|k|b)?/gi;
  let match = numberPattern.exec(raw);
  while (match) {
    const tail = raw.slice(numberPattern.lastIndex);
    if (!allowUnits && /^(?:h|hr|hour|hours|m|min|minute|minutes|d|day|days|w|week|weeks|mo|month|months)\b/i.test(tail)) {
      match = numberPattern.exec(raw);
      continue;
    }
    const base = Number(match[1].replaceAll(",", ""));
    if (!Number.isFinite(base)) {
      match = numberPattern.exec(raw);
      continue;
    }
    const unit = allowUnits ? String(match[2] || "").toLowerCase() : "";
    const multiplier = {
      thousand: 1_000,
      k: 1_000,
      million: 1_000_000,
      m: 1_000_000,
      billion: 1_000_000_000,
      bn: 1_000_000_000,
      b: 1_000_000_000
    }[unit] || 1;
    return base * multiplier;
  }
  return fallback;
}

function parseScannerChatLength(segment = "", fallback = 14) {
  const raw = String(segment || "");
  const lengthMatch = raw.match(/(?:length|period|lookback)\s*(\d{1,3})/i);
  if (lengthMatch) return Math.max(1, Math.min(300, Number(lengthMatch[1])));
  const shortMatch = raw.match(/\b(?:sma|ema|rsi)\s*(\d{1,3})\b/i);
  if (shortMatch) return Math.max(1, Math.min(300, Number(shortMatch[1])));
  return fallback;
}

function scannerChatJoiner(text = "") {
  return scannerChatMatches(text, [
    /\bor\b|\|\|/i,
    /any\s*of/i
  ]) ? "OR" : "AND";
}

function scannerChatBuildCondition(templateId, parameters = {}, source = "") {
  return { templateId, parameters, source };
}

function parseScannerChatConditions(text = "", scopeId = "open_markets") {
  const raw = String(text || "");
  const timeframe = parseScannerChatTimeframe(raw);
  const conditions = [];

  if (scannerChatMatches(raw, [/price\s*change|change\s*%|utc\s*day|rolling\s*24h/i])) {
    const segment = scannerChatSegment(raw, [/price\s*change|change\s*%|utc\s*day|rolling\s*24h/i]);
    const bearish = scannerChatMatches(segment, [/below|under|drop|fall|negative|bearish/i]);
    const value = Math.abs(parseScannerChatNumber(segment, 3, { percentOnly: true, allowUnits: false }) ?? 3);
    conditions.push(scannerChatBuildCondition(
      bearish ? "utc-day-change-below" : "utc-day-change-above",
      {
        scope: scopeId,
        timeframe,
        operator: bearish ? "lte" : "gte",
        value: bearish ? -value : value
      },
      "price change"
    ));
  }

  if (scannerChatMatches(raw, [/quote\s*volume|quote-volume|turnover/i])) {
    const segment = scannerChatSegment(raw, [/quote\s*volume|quote-volume|turnover/i]);
    const operator = parseScannerChatOperator(segment, "gte");
    const below = operator === "lte" || operator === "lt";
    conditions.push(scannerChatBuildCondition(
      below ? "quote-volume-below" : "quote-volume-above",
      {
        scope: scopeId,
        timeframe,
        operator,
        value: parseScannerChatNumber(segment, below ? 100_000 : 1_000_000)
      },
      "quote volume"
    ));
  }

  if (scannerChatMatches(raw, [/relative\s*volume|rel\s*volume|relvol/i])) {
    const segment = scannerChatSegment(raw, [/relative\s*volume|rel\s*volume|relvol/i]);
    conditions.push(scannerChatBuildCondition(
      "relative-volume-above",
      {
        scope: scopeId,
        timeframe,
        lookback: parseScannerChatLength(segment, 20),
        operator: parseScannerChatOperator(segment, "gte"),
        value: parseScannerChatNumber(segment, 2)
      },
      "relative volume"
    ));
  } else if (scannerChatMatches(raw, [/\bvolume\b|base\s*volume/i]) && !scannerChatMatches(raw, [/quote\s*volume|turnover/i])) {
    const segment = scannerChatSegment(raw, [/\bvolume\b|base\s*volume/i]);
    const operator = parseScannerChatOperator(segment, "gte");
    const below = operator === "lte" || operator === "lt";
    conditions.push(scannerChatBuildCondition(
      below ? "base-volume-below" : "base-volume-above",
      {
        scope: scopeId,
        timeframe,
        operator,
        value: parseScannerChatNumber(segment, below ? 1_000 : 10_000)
      },
      "base volume"
    ));
  }

  if (scannerChatMatches(raw, [/\bspread\b/i])) {
    const segment = scannerChatSegment(raw, [/\bspread\b/i]);
    const operator = parseScannerChatOperator(segment, "lte");
    const below = operator === "lte" || operator === "lt";
    conditions.push(scannerChatBuildCondition(
      below ? "spread-percent-below" : "spread-percent-above",
      {
        scope: scopeId,
        timeframe,
        operator,
        value: parseScannerChatNumber(segment, below ? 1 : 3, { percentOnly: scannerChatMatches(segment, [/%/]), allowUnits: false })
      },
      "spread"
    ));
  }

  if (scannerChatMatches(raw, [/\brsi\b/i])) {
    const segment = scannerChatSegment(raw, [/\brsi\b/i]);
    const overbought = scannerChatMatches(segment, [/overbought/i]);
    const oversold = scannerChatMatches(segment, [/oversold/i]);
    const operator = overbought ? "gte" : oversold ? "lte" : parseScannerChatOperator(segment, "lte");
    const defaultValue = operator === "gte" || operator === "gt" ? 70 : 30;
    conditions.push(scannerChatBuildCondition(
      "rsi-condition",
      {
        scope: scopeId,
        timeframe,
        source: "close",
        length: parseScannerChatLength(segment, 14),
        operator,
        value: parseScannerChatNumber(segment, defaultValue, { allowUnits: false })
      },
      "RSI"
    ));
  }

  if (scannerChatMatches(raw, [/\bsma\b|simple\s*moving\s*average/i])) {
    const segment = scannerChatSegment(raw, [/\bsma\b|simple\s*moving\s*average/i]);
    conditions.push(scannerChatBuildCondition(
      "sma-value",
      {
        scope: scopeId,
        timeframe,
        source: "close",
        length: parseScannerChatLength(segment, 20),
        operator: parseScannerChatOperator(segment, "gte"),
        value: parseScannerChatNumber(segment, 1, { allowUnits: false })
      },
      "SMA"
    ));
  }

  if (scannerChatMatches(raw, [/\bema\b|exponential\s*moving\s*average/i])) {
    const segment = scannerChatSegment(raw, [/\bema\b|exponential\s*moving\s*average/i]);
    conditions.push(scannerChatBuildCondition(
      "ema-value",
      {
        scope: scopeId,
        timeframe,
        source: "close",
        length: parseScannerChatLength(segment, 20),
        operator: parseScannerChatOperator(segment, "gte"),
        value: parseScannerChatNumber(segment, 1, { allowUnits: false })
      },
      "EMA"
    ));
  }

  if (
    scannerChatMatches(raw, [/last\s*price|\bprice\b/i])
    && !scannerChatMatches(raw, [/price\s*change|change\s*%/i])
  ) {
    const segment = scannerChatSegment(raw, [/last\s*price|\bprice\b/i]);
    const value = parseScannerChatNumber(segment, null, { allowUnits: false });
    if (Number.isFinite(Number(value))) {
      const operator = parseScannerChatOperator(segment, "gte");
      const below = operator === "lte" || operator === "lt";
      conditions.push(scannerChatBuildCondition(
        below ? "last-price-below" : "last-price-above",
        {
          scope: scopeId,
          timeframe,
          operator,
          value
        },
        "last price"
      ));
    }
  }

  return conditions;
}

function buildScannerChatCommandPlan(text = "") {
  if (!isScannerChatCommandIntent(text)) return null;
  const currentRows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets");
  const fallbackScope = currentRows[0]?.marketScope || state.settings?.KALSHI?.marketScope || "open_markets";
  const scope = parseScannerChatScope(text, fallbackScope);
  const conditions = parseScannerChatConditions(text, scope.scopeId);
  const appendMode = scannerChatMatches(text, [/\badd\b|\bappend\b/i]);
  const clearMode = scannerChatMatches(text, [/\bclear\b|\breset\b|\bdelete\b|\bempty\b/i]);
  const formulaJoiner = scannerChatJoiner(text);
  const rescanMinutes = parseScannerChatRescanMinutes(text);
  const autoResultsOff = scannerChatMatches(text, [/auto\s*results[^.\n]*(?:off|disable|disabled)|(?:off|disable|disabled)[^.\n]*auto\s*results|stay[^.\n]*scanner/i]);
  const autoResultsOn = scannerChatMatches(text, [/auto\s*results|open[^.\n]*results|results[^.\n]*(?:auto|on|enable)/i]) && !autoResultsOff;
  const startLoop = scannerChatMatches(text, [/\bstart\b|start\s*scanner|start\s*loop|\brepeat\b|repeat\s*scanner|repeat\s*loop/i]);
  const stopLoop = scannerChatMatches(text, [/\bstop\b|stop\s*scanner|stop\s*loop/i]);
  const runOnce = !startLoop && !stopLoop && scannerChatMatches(text, [/run\s*once|one\s*scan|run\s*observation|\brun\b/i]);
  const sendResults = scannerChatMatches(text, [/send[^.\n]*chat|chat[^.\n]*send|send[^.\n]*results/i]);
  const formulaOnly = !conditions.length && currentRows.length > 1 && scannerChatMatches(text, [/\bformula\b|\blogic\b/i]);
  const directionFilter = inferScannerDirectionFilterFromConditions(conditions, null);
  const mode = clearMode ? "clear" : conditions.length ? appendMode ? "append" : "replace" : "control";
  const hasAnyAction = runOnce || startLoop || stopLoop || sendResults || autoResultsOn || autoResultsOff || Number.isFinite(rescanMinutes);
  const hasAnyEdit = mode !== "control" || scope.explicit || formulaOnly || Boolean(directionFilter);

  if (!hasAnyAction && !hasAnyEdit) {
    return {
      mode: "unrecognized",
      scopeId: scope.scopeId,
      scopeExplicit: scope.explicit,
      directionFilter,
      formulaJoiner,
      conditions: [],
      actions: {}
    };
  }

  return {
    mode,
    scopeId: scope.scopeId,
    scopeExplicit: scope.explicit,
    directionFilter,
    formulaJoiner,
    formulaOnly,
    conditions,
    actions: {
      runOnce,
      startLoop,
      stopLoop,
      sendResults,
      autoResultsMode: autoResultsOn ? true : autoResultsOff ? false : null,
      rescanMinutes
    }
  };
}

function normalizeScannerChatPlanMode(value, fallback = "control") {
  const mode = String(value || fallback).toLowerCase();
  return ["replace", "append", "clear", "control", "unrecognized"].includes(mode) ? mode : fallback;
}

function normalizeScannerChatPlanJoiner(value) {
  return String(value || "AND").toUpperCase() === "OR" ? "OR" : "AND";
}

function normalizeScannerChatPlanScope(value, fallback = "open_markets") {
  const id = String(value || fallback).trim();
  const scope = marketScopeById(id);
  return scannerScopeIsSelectable(scope.id) ? scope.id : fallback;
}

function normalizeScannerChatPlanActionBoolean(value) {
  return value === true || value === "true";
}

function normalizeScannerChatAutoResultsMode(value) {
  if (value === true || value === "true" || value === "on" || value === "enabled") return true;
  if (value === false || value === "false" || value === "off" || value === "disabled") return false;
  return null;
}

function normalizeScannerChatDirectionFilter(value, fallback = null) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["all", "any", "all contracts", "all_contracts", "no lens", "no_lens"].includes(normalized)) return "all";
  if (["yes", "yes gaining", "yes_gaining", "yes rising", "yes_rising", "up", "rising", "bullish"].includes(normalized)) return "yes_gaining";
  if (["no", "no gaining", "no_gaining", "no rising", "no_rising", "down", "falling", "bearish"].includes(normalized)) return "no_gaining";
  return fallback ? normalizeScannerDirectionFilter(fallback, null) : null;
}

function inferScannerDirectionFilterFromConditions(conditions = [], fallback = null) {
  for (const condition of conditions || []) {
    const templateId = String(condition?.templateId || "").trim();
    const changeTemplate = templateId === "utc-day-change-above"
      || templateId === "utc-day-change-below"
      || templateId === "rolling-change-above"
      || templateId === "rolling-change-below";
    const operator = String(condition?.parameters?.operator || "").trim();
    const value = Number(condition?.parameters?.value);
    if (!changeTemplate) continue;
    if (templateId.endsWith("-below") || (operator === "lte" && value < 0) || (operator === "lt" && value <= 0)) return "no_gaining";
    if (templateId.endsWith("-above") || (operator === "gte" && value > 0) || (operator === "gt" && value >= 0)) return "yes_gaining";
  }
  return normalizeScannerChatDirectionFilter(fallback, null);
}

function normalizeScannerChatPlanActions(actions = {}) {
  const minutes = Number(actions?.rescanMinutes);
  return {
    runOnce: normalizeScannerChatPlanActionBoolean(actions?.runOnce),
    startLoop: normalizeScannerChatPlanActionBoolean(actions?.startLoop),
    stopLoop: normalizeScannerChatPlanActionBoolean(actions?.stopLoop),
    sendResults: normalizeScannerChatPlanActionBoolean(actions?.sendResults),
    autoResultsMode: normalizeScannerChatAutoResultsMode(actions?.autoResultsMode ?? actions?.reviewMode),
    rescanMinutes: SCANNER_RESCAN_OPTIONS_MINUTES.includes(minutes) ? minutes : null
  };
}

function normalizeScannerChatPlanParameters(parameters = {}) {
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) return {};
  return Object.entries(parameters).reduce((normalized, [key, value]) => {
    const safeKey = String(key || "").trim();
    if (!safeKey || safeKey.length > 40) return normalized;
    if (typeof value === "number" || typeof value === "boolean") {
      normalized[safeKey] = value;
      return normalized;
    }
    if (typeof value === "string") {
      normalized[safeKey] = value.slice(0, 160);
    }
    return normalized;
  }, {});
}

function normalizeScannerChatCommandPlan(plan = null, fallbackText = "") {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return null;
  const currentRows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets");
  const fallbackScope = currentRows[0]?.marketScope || state.settings?.KALSHI?.marketScope || "open_markets";
  const localFallback = buildScannerChatCommandPlan(fallbackText);
  let scopeId = normalizeScannerChatPlanScope(plan.scopeId, localFallback?.scopeId || fallbackScope);
  const actions = normalizeScannerChatPlanActions(plan.actions || {});
  const rawConditions = Array.isArray(plan.conditions) ? plan.conditions : [];
  const conditions = rawConditions
    .map((condition) => ({
      templateId: String(condition?.templateId || "").trim(),
      parameters: normalizeScannerChatPlanParameters(condition?.parameters),
      source: String(condition?.reason || condition?.source || "ai planner").slice(0, 120)
    }))
    .filter((condition) => condition.templateId);
  // "Closes within 3 hours" over Open Markets scans 165,000 markets for the same matches the
  // Closing in 24h scope finds in seconds, so a close-time limit narrows the scope.
  const closeLimit = Math.min(...conditions.filter((condition) => condition.templateId === "hours-to-close-below" && ["", "lte", "lt"].includes(String(condition.parameters.operator || "")))
    .map((condition) => Number(condition.parameters.value)).filter((hours) => hours > 0));
  if (scopeId === "open_markets" && closeLimit <= 168) scopeId = closeLimit <= 24 ? "closing_24h" : "closing_7d";
  const directionFilter = normalizeScannerChatDirectionFilter(
    plan.directionFilter,
    localFallback?.directionFilter || inferScannerDirectionFilterFromConditions(conditions, null)
  );
  const explicitMode = normalizeScannerChatPlanMode(plan.mode, conditions.length ? "replace" : "control");
  const hasAction = actions.runOnce || actions.startLoop || actions.stopLoop || actions.sendResults || actions.autoResultsMode !== null || Number.isFinite(actions.rescanMinutes);
  const mode = explicitMode === "control" && conditions.length ? "replace" : explicitMode;
  // Smaller models sometimes write condition names ("volume-24h-above AND ...") instead of letters.
  // Such a formula would block Apply, so the draft falls back to joining the conditions.
  let formulaText = String(plan.formulaText || plan.formula || "").trim().slice(0, 120);
  const notes = Array.isArray(plan.notes) ? plan.notes.map((note) => String(note).slice(0, 180)).filter(Boolean).slice(0, 5) : [];
  if (formulaText) {
    try { parseFormulaText(formulaText); } catch {
      formulaText = "";
      notes.push("The AI's logic formula was not valid, so the conditions are joined with AND.");
    }
  }
  const hasEdit = conditions.length || mode !== "control" || plan.scopeExplicit === true || Boolean(formulaText) || Boolean(directionFilter);

  return {
    mode: hasAction || hasEdit ? mode : "unrecognized",
    scopeId,
    scopeExplicit: plan.scopeExplicit === true || Boolean(localFallback?.scopeExplicit),
    directionFilter,
    formulaJoiner: normalizeScannerChatPlanJoiner(plan.formulaJoiner || localFallback?.formulaJoiner),
    formulaText,
    formulaOnly: Boolean(formulaText),
    conditions,
    invalidConditionCount: rawConditions.length - conditions.length,
    actions,
    notes,
    plannerProvider: String(plan.plannerProvider || "").slice(0, 80),
    planSource: "ai-planner"
  };
}

function scannerChatFormulaTokensForRows(rows = [], joiner = "AND") {
  const operator = joiner === "OR" ? "OR" : "AND";
  return rows.flatMap((_, index) => {
    const token = { type: "condition", value: conditionRuleLetter(index) };
    return index === 0 ? [token] : [{ type: "operator", value: operator }, token];
  });
}

function scannerChatFormulaTokensFromText(text = "", rows = []) {
  if (!String(text).trim()) return [];
  const validation = validateFormulaTokens(parseFormulaText(text), rows.length);
  if (!validation.valid) throw new Error(validation.message);
  return validation.tokens.map((token) => {
    if (token.type === "condition") return { type: "condition", value: token.letter };
    if (token.type === "operator") return { type: "operator", value: token.value.toUpperCase() };
    if (token.type === "not") return { type: "not", value: "NOT" };
    return { type: token.value === "(" ? "open" : "close", value: token.value };
  });
}

function setScannerChatFormulaFromPlan(plan = {}, rows = []) {
  const formulaTokens = scannerChatFormulaTokensFromText(plan.formulaText, rows);
  if (formulaTokens.length) {
    setConditionFormulaTokens(formulaTokens, rows);
    return conditionFormulaText(formulaTokens);
  }
  const defaultTokens = scannerChatFormulaTokensForRows(rows, plan.formulaJoiner);
  setConditionFormulaTokens(defaultTokens, rows);
  return conditionFormulaText(defaultTokens);
}

function scannerChatRowsFromConditionCommands(commands = [], scopeId = "open_markets", startIndex = 0) {
  const rows = [];
  const rejected = [];
  commands.forEach((command) => {
    const template = scannerTemplateById(command.templateId);
    if (!template) {
      rejected.push(`${command.templateId}: missing template`);
      return;
    }
    if (!scannerTemplateIsExecutable(template)) {
      rejected.push(`${template.title}: planned template`);
      return;
    }
    const parameters = normalizeTemplateParameters(template, {
      ...(command.parameters || {}),
      scope: scopeId
    });
    const instance = createConditionInstance(template, parameters, startIndex + rows.length);
    rows.push(conditionRowFromScannerInstance(instance, scopeId));
  });
  return { rows, rejected };
}

function clearScannerChatEditState() {
  state.conditionEditTarget = null;
  state.scannerSelectedTemplateId = "";
  state.scannerDraftParameters = {};
  state.scannerEditTargetIndex = null;
  state.scannerEditDraftParameters = {};
}

async function applyScannerChatCommandPlan(plan = {}, { signal = null, onStatus = null } = {}) {
  if (signal?.aborted) throw abortError();
  if (!plan || plan.mode === "unrecognized") {
    return [
      "Scanner Lab command was not specific enough.",
      "Include a supported condition, scope, or control action.",
      "",
      "Examples:",
      ...SCANNER_CHAT_COMMAND_EXAMPLES.map((example, index) => `${index + 1}. ${example}`)
    ].join("\n");
  }

  const messages = [];
  const currentRows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets");
  let nextRows = currentRows.map((row) => normalizeConditionRow(row, row.marketScope));
  const previousTokens = currentConditionFormulaTokens(nextRows).map((token) => ({ ...token }));
  const scope = marketScopeById(plan.scopeId);

  // Prepare and validate the complete edit before changing any editor/results state.
  const conditions = plan.conditions || [];
  const built = scannerChatRowsFromConditionCommands(conditions, plan.scopeId,
    plan.mode === "append" ? nextRows.length : 0);
  if (built.rejected.length || plan.invalidConditionCount) {
    throw new Error(`Draft needs correction: ${built.rejected.join("; ") || "invalid conditions"}`);
  }
  if (plan.mode === "clear") nextRows = [];
  else {
    if (plan.scopeExplicit) nextRows = nextRows.map((row) => normalizeConditionRow({ ...row, marketScope: plan.scopeId }, plan.scopeId));
    if (built.rows.length) nextRows = plan.mode === "append" ? [...nextRows, ...built.rows] : built.rows;
  }
  if (nextRows.length > MAX_CONDITION_ROWS) throw new Error("Draft exceeds the maximum condition count.");
  let nextTokens = previousTokens;
  if (plan.mode === "clear") nextTokens = [];
  else if (plan.formulaText) nextTokens = scannerChatFormulaTokensFromText(plan.formulaText, nextRows);
  else if (built.rows.length && plan.mode === "append") {
    const oldTokens = previousTokens.length ? previousTokens : scannerChatFormulaTokensForRows(currentRows, "AND");
    const addedTokens = built.rows.flatMap((_, index) => {
      const condition = { type: "condition", value: conditionRuleLetter(currentRows.length + index) };
      return index ? [{ type: "operator", value: plan.formulaJoiner }, condition] : [condition];
    });
    // Group both operands: appending never changes the meaning of the existing expression.
    nextTokens = oldTokens.length ? [
      { type: "open", value: "(" }, ...oldTokens, { type: "close", value: ")" },
      { type: "operator", value: plan.formulaJoiner },
      { type: "open", value: "(" }, ...addedTokens, { type: "close", value: ")" }
    ] : addedTokens;
  } else if (built.rows.length || plan.formulaOnly) nextTokens = scannerChatFormulaTokensForRows(nextRows, plan.formulaJoiner);
  // The same strict parser/validator also checks assembled UI tokens before committing.
  if (nextRows.length) nextTokens = scannerChatFormulaTokensFromText(conditionFormulaText(nextTokens), nextRows);

  clearScannerChatEditState();
  state.activeTab = "broker";
  state.brokerSubTab = "scanner";
  if (plan.directionFilter) {
    state.scannerDirectionFilter = normalizeScannerDirectionFilter(plan.directionFilter, DEFAULT_SCANNER_DIRECTION_FILTER);
    clearBrokerConditionResults();
    messages.push(`Kalshi lens set to ${scannerDirectionLabel(plan.directionFilter)}.`);
  }
  if (plan.mode === "clear" || built.rows.length || plan.scopeExplicit || plan.formulaOnly || plan.formulaText) {
    setConditionRows(nextRows, { marketScope: plan.scopeId });
    setConditionFormulaTokens(nextTokens, nextRows);
  }
  if (plan.mode === "clear") messages.push("Cleared the Scanner Lab stack.");
  else {
    if (plan.scopeExplicit) messages.push(`Scope set to ${scope.label}.`);
    if (built.rows.length) messages.push(plan.mode === "append"
      ? `Added ${built.rows.length} condition${built.rows.length === 1 ? "" : "s"} to Scanner Lab.`
      : `Rebuilt Scanner Lab with ${nextRows.length} condition${nextRows.length === 1 ? "" : "s"}.`);
    if (plan.formulaOnly || plan.formulaText || built.rows.length) messages.push(`Logic Formula set to ${conditionFormulaText(nextTokens)}.`);
  }

  if (plan.planSource === "ai-planner") {
    messages.unshift(`AI planner produced a validated Scanner Lab plan${plan.plannerProvider ? ` via ${plan.plannerProvider}` : ""}.`);
  }
  if (Array.isArray(plan.notes) && plan.notes.length) {
    messages.push(`Planner notes: ${plan.notes.join(" ")}`);
  }

  if (Number.isFinite(plan.actions.rescanMinutes)) {
    state.scannerRescanIntervalMinutes = plan.actions.rescanMinutes;
    if (scannerLoopActive()) {
      state.scannerLoopNextRescanAt = new Date(Date.now() + state.scannerRescanIntervalMinutes * 60 * 1000).toISOString();
      void updateBackgroundMonitorInterval();
    }
    messages.push(`Rescan interval set to ${plan.actions.rescanMinutes}m.`);
  }

  if (plan.actions.autoResultsMode !== null) {
    state.scannerAutoResultsMode = plan.actions.autoResultsMode;
    state.settings = await saveSettings({
      KALSHI: {
        ...(state.settings?.KALSHI || {}),
        scannerAutoResultsMode: state.scannerAutoResultsMode
      }
    });
    messages.push(`Auto Results ${state.scannerAutoResultsMode ? "enabled" : "disabled"}.`);
  }

  if (plan.actions.stopLoop) {
    await stopScannerLoop();
    messages.push("Scanner loop stopped.");
  }

  if (plan.actions.runOnce) {
    messages.push("Run Once requested.");
    await Promise.resolve(onStatus?.("AI planning complete. Running Scanner Lab with Kalshi data...")).catch(() => {});
    const scan = await executeBrokerConditionScan({
      preserveScannerTab: !state.scannerAutoResultsMode
    });
    if (signal?.aborted) throw abortError();
    messages.push(scan ? `Observation completed with ${state.brokerConditionResults.length} matched contract${state.brokerConditionResults.length === 1 ? "" : "s"}.` : "Observation did not complete.");
  }

  if (plan.actions.startLoop && !plan.actions.stopLoop) {
    if (signal?.aborted) throw abortError();
    messages.push("Repeat requested.");
    await startScannerLoop();
    if (signal?.aborted) throw abortError();
    messages.push(`Scanner loop status: ${scannerLoopStatusLabel()}.`);
  }

  if (plan.actions.sendResults) {
    if (signal?.aborted) throw abortError();
    if (state.brokerConditionResults.length) {
      await sendConditionResultsToChat();
      messages.push(`Sent ${state.brokerConditionResults.length} current result${state.brokerConditionResults.length === 1 ? "" : "s"} to Chat.`);
    } else {
      messages.push("No current Scanner Lab results are available to send.");
    }
  }

  const finalRows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets");
  const formula = conditionFormulaText(currentConditionFormulaTokens(finalRows));
  const formulaDisplay = scannerDirectionFormulaText(formula);
  const conditionLines = finalRows.map((row, index) => `Rule ${conditionRuleLetter(index)}: ${conditionLabel(row)}`);
  state.status = messages[0] || "Scanner Lab updated from Chat.";
  render({ preserveScroll: true });

  return [
    "Scanner Lab updated from Chat.",
    "",
    ...messages,
    "",
    `Scope: ${marketScopeById(finalRows[0]?.marketScope || plan.scopeId).label}`,
    `Formula: ${formulaDisplay}`,
    ...conditionLines
  ].join("\n");
}

async function tryHandleScannerChatCommand(text, pendingMessage, { signal = null, attachments = [], requestSettingsOverride = null, force = false } = {}) {
  if (!force && !isScannerChatCommandIntent(text, attachments)) return false;

  // Capture the entire request before the first await, not when its response arrives.
  const requestBaseline = scannerDraftBaseline();
  const requestGeneration = state.brokerDataGeneration;
  const requestContext = structuredClone(currentBrokerContextPackage());
  const requestSettings = structuredClone(requestSettingsOverride || state.settings);
  state.pendingScannerPlan = null;

  state.chatLog = await updateChatMessage(pendingMessage?.id, {
    text: "Planning the Scanner Lab command with the validated read-only dispatcher...",
    provider: SCANNER_CHAT_RESOLVE_PROVIDER,
    pending: true
  });
  render();

  let plan = null;
  if (isChatConfigured(requestSettings)) {
    const plannerResult = await planScannerLabCommand({
      userMessage: text,
      settings: requestSettings,
      brokerContext: requestContext,
      attachments,
      signal,
      onStatus: async (statusText) => {
        state.chatLog = await updateChatMessage(pendingMessage?.id, {
          text: statusText,
          provider: SCANNER_CHAT_RESOLVE_PROVIDER,
          pending: true
        });
        render();
      }
    });
    if (requestGeneration !== state.brokerDataGeneration || requestBaseline !== scannerDraftBaseline()) {
      state.chatLog = await updateChatMessage(pendingMessage?.id, { text: "Conditions or scanner data changed while planning. Discarded the outdated response; create a new draft.",
        provider: SCANNER_CHAT_RESOLVE_PROVIDER, pending: false });
      render();
      return true;
    }
    plan = normalizeScannerChatCommandPlan(
      plannerResult?.plan ? { ...plannerResult.plan, plannerProvider: requestSettings.aiConnections?.find((slot) => slot.id === plannerResult.connectionId)?.label || plannerResult.provider } : null,
      text
    );
  }

  // A model-flagged search that does not plan into conditions falls back to a normal answer.
  if (force && (!plan || plan.mode === "unrecognized")) return false;
  if (!plan || plan.mode === "unrecognized") {
    state.chatLog = await updateChatMessage(pendingMessage?.id, { text: isChatConfigured(state.settings)
      ? "No usable condition draft was returned. Check the request or AI connection and try again; your conditions are unchanged."
      : "Configure and select a Primary AI connection in Settings to create a natural-language draft. You can build conditions directly with the library without AI.",
      provider: SCANNER_CHAT_RESOLVE_PROVIDER, pending: false });
    return true;
  }
  if (signal?.aborted) throw abortError();

  state.pendingScannerPlan = { plan: structuredClone(plan), messageId: pendingMessage?.id,
    baseline: requestBaseline, generation: requestGeneration };
  state.activeTab = "broker"; state.brokerSubTab = "scanner";
  // A question sent with Send is answered with live matches; the Draft button only prepares conditions.
  if (!/^set scanner lab:/i.test(text) && await answerChatWithQuickSearch(plan, pendingMessage, signal)) {
    if (CHAT_ALERT_INTENT.test(text)) await startChatAlerts(plan, pendingMessage, state.chatLog.find((message) => message.id === pendingMessage?.id)?.text || "");
    return true;
  }
  state.chatLog = await updateChatMessage(pendingMessage?.id, { text: "Condition draft ready in Scanner. Check the conditions, then choose Apply and run once to search.",
    provider: plan.plannerProvider || SCANNER_CHAT_RESOLVE_PROVIDER, pending: false });
  render();
  return true;
}

const CHAT_SEARCH_TOP = 10;
const CHAT_WATCHLIST_INTENT = /watch\s*-?list|관심\s*목록/i;
const CHAT_REMOVE_INTENT = /\b(remove|delete|drop|unwatch|take\b.*\boff)\b|삭제|빼/i;
const CHAT_EVENT_LIST_INTENT = /\b(show|list|all|every|outcomes?|markets?|event)\b|보여|목록|전체/i;
const CHAT_ALERT_INTENT = /\b(alert|notify|let me know|ping me|tell me when|watch for|monitor)\b|알림|알려\s*줘.*(되면|때)/i;
const CHAT_STOP_ALERTS_INTENT = /\b(stop|turn off|cancel|pause|disable|end)\b.*\b(alerts?|notifications?|notifying|monitor(ing)?|watching|repeat)\b|알림.*(꺼|끄|중지|멈|그만)/i;
const CHAT_HISTORY_INTENT = /\b(likely|likelihood|chance|odds|probab|history|historical|past|settle|win|will (it|this))\b|가능성|확률|과거|이길/i;

// Watchlist edits and event listings run directly from chat instead of pointing to another tab.
async function tryHandleChatAppAction(text, pendingMessage, { signal = null, action = "" } = {}) {
  const reply = async (message) => {
    state.chatLog = await updateChatMessage(pendingMessage?.id, { text: message, provider: "Kalshi Screener", pending: false });
    render({ preserveScroll: true });
    return true;
  };
  if (CHAT_STOP_ALERTS_INTENT.test(text)) {
    if (!scannerLoopActive()) return reply("Alerts are not running, so there is nothing to stop.");
    await stopScannerLoop();
    return reply(scannerLoopActive() ? `${state.status || "Monitoring could not be stopped."} Press Stop in Scanner.` : "Alerts are off. Background monitoring has stopped; past alerts stay in the Alerts tab.");
  }
  const symbols = parseChatMarketSymbols(text);
  if (!symbols.length) return false;
  const watchAction = action || (CHAT_WATCHLIST_INTENT.test(text) ? (CHAT_REMOVE_INTENT.test(text) ? "remove" : "add") : "");
  if (watchAction === "remove") {
    const present = symbols.filter((symbol) => findWatchlistEntry(symbol));
    for (const symbol of present) await removeWatchlistSymbol(symbol);
    const missing = symbols.filter((symbol) => !present.includes(symbol));
    return reply([present.length ? `Removed from Watchlist: ${present.join(", ")}.` : "", missing.length ? `Not in Watchlist: ${missing.join(", ")}.` : ""].filter(Boolean).join(" "));
  }
  const rows = await getTickerSnapshot(symbols, { signal, settings: state.settings?.KALSHI || {} }).catch((error) => { if (isAbortError(error)) throw error; return []; });
  const found = new Set(rows.map((row) => normalizeWatchlistSymbol(row.symbol)));
  if (watchAction === "add") {
    for (const row of rows) await saveWatchlistSymbol(row);
    const missing = symbols.filter((symbol) => !found.has(normalizeWatchlistSymbol(symbol)));
    return reply([rows.length ? `Added to Watchlist: ${rows.map((row) => `${row.symbol} (${row.marketTitle || row.title || "market"})`).join(", ")}. Open Scanner, Watchlist to follow live prices.` : "",
      missing.length ? `Not found on Kalshi as a market ticker: ${missing.join(", ")}.` : ""].filter(Boolean).join(" "));
  }
  // An event ticker (no market of that name) asked to be shown lists its markets by YES price.
  const eventTicker = symbols.find((symbol) => !found.has(normalizeWatchlistSymbol(symbol)));
  if (!eventTicker || !CHAT_EVENT_LIST_INTENT.test(text)) return false;
  const markets = await getEventMarkets(eventTicker, { signal }).catch((error) => { if (isAbortError(error)) throw error; return []; });
  if (!markets.length) return false;
  const cents = (value) => Number.isFinite(Number(value)) ? `${Math.round(Number(value) * 100)}c` : "-";
  const ordered = markets.slice().sort((a, b) => (Number(b.yesBid ?? b.last) || 0) - (Number(a.yesBid ?? a.last) || 0));
  const lines = ordered.slice(0, 20).map((market, index) => `${index + 1}. ${market.yesOutcome || market.marketTitle || market.symbol}: YES ${cents(market.yesBid)}/${cents(market.yesAsk)}, last ${cents(market.last)}, 24h volume ${Math.round(Number(market.volume24h) || 0).toLocaleString("en-US")}, ${market.symbol}`);
  return reply([`${markets[0].eventTitle ? `${markets[0].eventTitle} (${eventTicker})` : `Event ${eventTicker}`}: ${markets.length} open markets, highest YES first.`, "", ...lines,
    markets.length > 20 ? `\n${markets.length - 20} more not shown.` : "", "\nAsk about one of them with its ticker, or say \"add <ticker> to my watchlist\". Market information only, not financial advice."].join("\n"));
}

// "Alert me when..." starts background monitoring for the planned conditions after one search.
async function startChatAlerts(plan, pendingMessage, quickSearchText = "") {
  if (!state.pendingScannerPlan) return false;
  if (!await applyPendingScannerDraft()) return false;
  await startScannerLoop();
  const started = scannerLoopActive() || /^Background monitoring started/.test(state.status || "");
  const conditions = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets").map(conditionLabel).join("; ");
  state.chatLog = await updateChatMessage(pendingMessage?.id, {
    text: [started
      ? `Alerts are on for: ${conditions}. New matches appear in an alert window and the Alerts tab while Chrome is running. Press Stop in Scanner to end them. These conditions replaced the ones in Scanner.${state.notificationCheckAsk ? " A test notification was sent; if you did not see it, answer No in Scanner to get help turning notifications on." : ""}`
      : `${state.status || "Monitoring could not start."} The conditions are in Scanner; press Repeat to try again.`,
    quickSearchText ? `\n${quickSearchText}` : ""].join("\n"),
    provider: plan.plannerProvider || SCANNER_CHAT_RESOLVE_PROVIDER, pending: false });
  render();
  return true;
}

// Runs the planned conditions once and lists the top matches in chat. The Scanner editor and
// Results stay untouched; the draft card remains for anyone who wants all matches or monitoring.
async function answerChatWithQuickSearch(plan, pendingMessage, signal) {
  const built = scannerChatRowsFromConditionCommands(plan.conditions || [], plan.scopeId, 0);
  if (!built.rows.length || built.rejected.length || plan.mode === "clear") return false;
  const formula = plan.formulaText || built.rows.map((_, index) => conditionRuleLetter(index)).join(plan.formulaJoiner === "OR" ? " OR " : " AND ");
  state.chatLog = await updateChatMessage(pendingMessage?.id, { text: `Searching Kalshi: ${built.rows.map(conditionLabel).join("; ")}`, provider: SCANNER_CHAT_RESOLVE_PROVIDER, pending: true });
  render();
  let scan;
  try {
    scan = await runScannerLabObservation({ rows: built.rows, formula, directionFilter: plan.directionFilter || "all", settings: state.settings?.KALSHI || {}, signal });
  } catch (error) {
    if (isAbortError(error) || signal?.aborted) throw error;
    state.chatLog = await updateChatMessage(pendingMessage?.id, { text: `The search could not finish: ${error.message || "Kalshi request failed"}. The conditions are ready in Scanner as a draft.`,
      provider: SCANNER_CHAT_RESOLVE_PROVIDER, pending: false });
    render();
    return true;
  }
  const matches = (scan.results || [])
    .map((result) => contractDisplayModel(result))
    .sort((a, b) => (Number(b.volume24h) || 0) - (Number(a.volume24h) || 0));
  const cents = (value) => Number.isFinite(Number(value)) && value !== null && value !== "" ? `${Math.round(Number(value) * 100)}c` : "-";
  const closes = (time) => { const hours = (Date.parse(time) - Date.now()) / 3600000; return Number.isFinite(hours) ? (hours < 48 ? `${Math.max(0, hours).toFixed(1)}h` : `${(hours / 24).toFixed(1)}d`) : "-"; };
  const lines = matches.slice(0, CHAT_SEARCH_TOP).map((market, index) =>
    `${index + 1}. ${[market.eventTitle, market.marketTitle].filter(Boolean).join(" - ") || market.marketTicker}${market.yesOutcome && market.yesOutcome !== "YES" ? ` (${market.yesOutcome})` : ""}\n   YES ${cents(market.yesBid)}/${cents(market.yesAsk)}, last ${cents(market.last)}, 24h volume ${Math.round(Number(market.volume24h) || 0).toLocaleString("en-US")}, closes in ${closes(market.closeTime)}, ${market.marketTicker}`);
  const text = matches.length
    ? [`Found ${matches.length} markets (checked ${scan.scannedSymbols || matches.length}). ${matches.length > CHAT_SEARCH_TOP ? `Top ${CHAT_SEARCH_TOP} by 24h volume:` : "By 24h volume:"}`, "", ...lines, "",
      "Conditions: " + built.rows.map(conditionLabel).join("; "),
      "To see every match or keep watching, use Apply and run once or Repeat on the draft in Scanner. Market information only, not financial advice."].join("\n")
    : `No markets matched right now (checked ${scan.scannedSymbols || 0}). Conditions: ${built.rows.map(conditionLabel).join("; ")}. Try a looser price or a longer time window.`;
  state.chatLog = await updateChatMessage(pendingMessage?.id, { text, provider: plan.plannerProvider || SCANNER_CHAT_RESOLVE_PROVIDER, pending: false });
  render();
  return true;
}

function applyConditionQuickPreset(presetId) {
  const preset = CONDITION_QUICK_PRESETS.find((entry) => entry.id === presetId);
  if (!preset) return;
  const rows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets");
  const fallbackScope = rows[0]?.marketScope || state.settings?.KALSHI?.marketScope || "open_markets";
  rows[0] = normalizeConditionRow({
    ...(rows[0] || defaultConditionRow(fallbackScope)),
    ...preset.row
  }, fallbackScope);
  setConditionRows(rows);
  state.conditionEditTarget = null;
  state.scannerEditTargetIndex = null;
  state.scannerEditDraftParameters = {};
  state.status = `${preset.label} condition applied`;
  render({ preserveScroll: true });
}

function applyConditionChoice(choice) {
  const [indexValue, field, ...valueParts] = String(choice || "").split(":");
  const index = Number(indexValue);
  const value = valueParts.join(":");
  if (!Number.isInteger(index) || !field || !value) return;
  updateConditionRow(index, { [field]: value });
  state.conditionEditTarget = field === "operator" ? `${index}:value` : null;
  state.scannerEditTargetIndex = null;
  state.scannerEditDraftParameters = {};
  render({ preserveScroll: true });
}

function applyConditionValueFromInput() {
  const target = parseConditionEditTarget();
  const activeTarget = target || { index: 0, field: "value" };
  const value = document.querySelector("#conditionValueInput")?.value.trim();
  if (!value) return;
  updateConditionRow(activeTarget.index, { value });
  state.conditionEditTarget = null;
  state.scannerEditTargetIndex = null;
  state.scannerEditDraftParameters = {};
  render({ preserveScroll: true });
}

function applyConditionTimeframeFromInput() {
  const target = parseConditionEditTarget();
  if (!target || target.field !== "timeframe") return;
  const value = document.querySelector("#conditionTimeframeValue")?.value;
  const unit = document.querySelector("#conditionTimeframeUnit")?.value || "h";
  const timeframe = timeframeFromParts(value, unit);
  if (!TIMEFRAMES.includes(timeframe)) {
    state.status = SUPPORTED_TIMEFRAME_MESSAGE;
    render({ preserveScroll: true });
    return;
  }
  updateConditionRow(target.index, { timeframe });
  state.conditionEditTarget = null;
  state.scannerEditTargetIndex = null;
  state.scannerEditDraftParameters = {};
  render({ preserveScroll: true });
}

function addConditionRow() {
  const rows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets");
  if (rows.length >= MAX_CONDITION_ROWS) {
    state.status = `Up to ${MAX_CONDITION_ROWS} condition rows are supported (A-Z).`;
    render({ preserveScroll: true });
    return;
  }
  rows.push(defaultConditionRow(rows[0]?.marketScope || state.settings?.KALSHI?.marketScope || "open_markets"));
  setConditionRows(rows);
  state.conditionEditTarget = `${rows.length - 1}:metric`;
  state.scannerEditTargetIndex = null;
  state.scannerEditDraftParameters = {};
  render({ preserveScroll: true });
}

function removeConditionRow(index) {
  const rows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets");
  if (!rows[index]) return;
  rows.splice(index, 1);
  setConditionRows(rows);
  state.conditionEditTarget = null;
  state.scannerEditTargetIndex = null;
  state.scannerEditDraftParameters = {};
  render({ preserveScroll: true });
}

async function refreshPortfolioSnapshot({ auto = false, startAuto = false } = {}) {
  const KALSHI = state.settings?.KALSHI || {};
  const gate = portfolioSnapshotGate(KALSHI);
  if (!gate.ready) {
    stopPortfolioAutoRefresh({ silent: true });
    state.brokerPortfolioSnapshot = null;
    state.brokerPortfolioUpdatedAt = "";
    state.status = gate.message;
    render({ preserveScroll: true });
    return;
  }
  if (state.busy === "portfolio") return;
  if (startAuto) state.brokerPortfolioAutoRefreshActive = true;
  if (state.busy) {
    schedulePortfolioAutoRefresh();
    return;
  }
  if (state.brokerPortfolioAutoRefreshTimer) {
    clearTimeout(state.brokerPortfolioAutoRefreshTimer);
    state.brokerPortfolioAutoRefreshTimer = null;
  }

  state.busy = "portfolio";
  state.status = auto
    ? "Auto-refreshing read-only Kalshi account/positions..."
    : "Loading read-only Kalshi account/positions snapshot...";
  render({ preserveScroll: true });

  try {
    const snapshot = await getAccountSnapshot(KALSHI);
    state.brokerPortfolioSnapshot = snapshot;
    state.brokerPortfolioUpdatedAt = snapshot.checkedAt || new Date().toISOString();
    const positionCount = portfolioPositions(snapshot).length;
    state.status = portfolioAutoRefreshActive()
      ? `Account/positions refreshed (${positionCount} non-zero positions). Refreshing again in 3 seconds.`
      : `Account/positions snapshot loaded (${positionCount} non-zero positions).`;
  } catch (error) {
    stopPortfolioAutoRefresh({ silent: true });
    state.brokerPortfolioSnapshot = null;
    state.brokerPortfolioUpdatedAt = "";
    state.status = auto || startAuto
      ? `Account/positions auto-refresh stopped after failure: ${error.message || String(error)}`
      : `Account/positions snapshot failed: ${error.message || String(error)}`;
  } finally {
    state.busy = "";
    schedulePortfolioAutoRefresh();
    render({ preserveScroll: true });
  }
}

function portfolioAutoRefreshActive() {
  return state.brokerPortfolioAutoRefreshActive === true;
}

function stopPortfolioAutoRefresh({ silent = false } = {}) {
  if (state.brokerPortfolioAutoRefreshTimer) {
    clearTimeout(state.brokerPortfolioAutoRefreshTimer);
    state.brokerPortfolioAutoRefreshTimer = null;
  }
  state.brokerPortfolioAutoRefreshActive = false;
  if (!silent) {
    state.status = "Account/positions auto-refresh stopped.";
    render({ preserveScroll: true });
  }
}

function schedulePortfolioAutoRefresh() {
  if (!portfolioAutoRefreshActive()) return;
  const gate = portfolioSnapshotGate(state.settings?.KALSHI || {});
  if (!gate.ready) {
    stopPortfolioAutoRefresh({ silent: true });
    return;
  }
  if (state.brokerPortfolioAutoRefreshTimer) {
    clearTimeout(state.brokerPortfolioAutoRefreshTimer);
  }
  state.brokerPortfolioAutoRefreshTimer = setTimeout(() => {
    state.brokerPortfolioAutoRefreshTimer = null;
    refreshPortfolioSnapshot({ auto: true });
  }, PORTFOLIO_AUTO_REFRESH_MS);
}

async function sendPortfolioSnapshotToChat() {
  const KALSHI = state.settings?.KALSHI || {};
  const gate = portfolioSnapshotGate(KALSHI);
  if (!gate.ready || !state.brokerPortfolioSnapshot) {
    state.status = gate.ready ? "Load Account/Positions first." : gate.message;
    render({ preserveScroll: true });
    return;
  }
  if (KALSHI.includePortfolioContext !== true) {
    state.status = "Enable account/positions Chat/Deep context opt-in in Settings before sending the snapshot to Chat.";
    render({ preserveScroll: true });
    return;
  }
  state.chatOpen = true;
  state.chatLog = await appendChatMessage({
    role: "user",
    text: portfolioSnapshotChatText(state.brokerPortfolioSnapshot),
    contextType: "portfolio",
    removable: true
  });
  state.status = "Account/positions snapshot context added to chat";
  render();
}

function portfolioSnapshotChatText(snapshot = {}) {
  const positions = portfolioPositions(snapshot);
  const summary = snapshot.summary || {};
  const positionLines = positions.length
    ? positions.slice(0, 20).map((position) => [
      `- ${position.marketTicker || position.displayAsset || position.asset}: ${formatPortfolioAmount(position.amount)}`,
      Number.isFinite(Number(position.avgEntryPriceUsd)) ? `avg price ${formatUsdValue(position.avgEntryPriceUsd)}` : "",
      Number.isFinite(Number(position.currentPriceUsd)) ? `mark ${formatUsdValue(position.currentPriceUsd)}` : "",
      Number.isFinite(Number(position.currentValueUsd)) ? `exposure ${formatUsdValue(position.currentValueUsd)}` : "",
      Number.isFinite(Number(position.profitLossUsd)) ? `P/L ${formatSignedUsdValue(position.profitLossUsd)}` : ""
    ].filter(Boolean).join(" / "))
    : ["- No open positions returned."];
  return [
    "Kalshi Account & Positions Snapshot",
    `Updated: ${snapshot.checkedAt || "unknown"}`,
    `Account Type: ${snapshot.accountType || snapshot.portfolioValue || "Kalshi read-only"}`,
    `Read-only mode: ${snapshot.canTrade === true ? "Check permissions" : "On"}`,
    `Portfolio Value: ${formatUsdValue(summary.portfolioValueUsd || snapshot.portfolioValue)}`,
    `Cash Balance: ${formatUsdValue(summary.cashUsd || snapshot.cash)}`,
    `Market Exposure: ${formatUsdValue(summary.totalMarketValueUsd)}`,
    `Open P/L: ${formatSignedUsdValue(summary.totalProfitLossUsd)}`,
    "",
    "Positions:",
    ...positionLines,
    "",
    "Boundary:",
    "Read-only account and position observation only. No trading action, account-changing action, buy/sell signal, recommendation, or investment advice."
  ].join("\n");
}

function portfolioHoldingKey(holding = {}) {
  return normalizeWatchlistSymbol(holding.marketTicker || holding.displayAsset || holding.asset || "");
}

function findPortfolioHolding(key) {
  const target = normalizeWatchlistSymbol(key);
  const positions = portfolioPositions(state.brokerPortfolioSnapshot);
  return positions.find((position) => portfolioHoldingKey(position) === target) || null;
}

async function sendPortfolioHoldingToChat(key) {
  const holding = findPortfolioHolding(key);
  if (!holding) {
    state.status = "Position was not found in the loaded account snapshot.";
    render({ preserveScroll: true });
    return;
  }
  if (state.settings?.KALSHI?.includePortfolioContext !== true) {
    state.status = "Enable account/positions Chat/Deep context opt-in in Settings before sending a position to Chat.";
    render({ preserveScroll: true });
    return;
  }
  state.chatOpen = true;
  state.chatLog = await appendChatMessage({
    role: "user",
    text: portfolioHoldingChatText(holding, state.brokerPortfolioSnapshot),
    contextType: "portfolio-holding",
    removable: true
  });
  state.status = `${holding.marketTicker || holding.displayAsset || holding.asset} position context added to chat`;
  render();
}

function portfolioHoldingChatText(holding = {}, snapshot = {}) {
  return [
    "Kalshi Position Context",
    `Market Ticker: ${holding.marketTicker || holding.displayAsset || holding.asset || "unknown"}`,
    `Position: ${formatPortfolioAmount(holding.amount)}`,
    `Average Price: ${formatUsdValue(holding.avgEntryPriceUsd)}`,
    `Mark Price: ${formatUsdValue(holding.currentPriceUsd)}`,
    `Exposure: ${formatUsdValue(holding.currentValueUsd)}`,
    `Open P/L: ${formatSignedUsdValue(holding.profitLossUsd)}`,
    `Snapshot updated: ${snapshot.checkedAt || "unknown"}`,
    "",
    "Boundary:",
    "Read-only position observation only. No trading action, account-changing action, buy/sell signal, recommendation, or investment advice."
  ].join("\n");
}

function useHoldingsInScanner() {
  const positions = portfolioPositions(state.brokerPortfolioSnapshot);
  if (!positions.length) {
    state.status = "Load Account/Positions before using private positions in Scanner Lab.";
    render({ preserveScroll: true });
    return;
  }
  const rows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets").map((row) => ({
    ...row,
    marketScope: "holdings"
  }));
  setConditionRows(rows, { marketScope: "holdings" });
  state.settings = {
    ...state.settings,
    KALSHI: {
      ...(state.settings?.KALSHI || {}),
      marketScope: "holdings"
    }
  };
  state.brokerSubTab = "scanner";
  state.status = "Scanner Lab scope is now My Positions. Run Once to scan loaded positions.";
  render({ preserveScroll: true });
}
// A condition picked in the library but not yet added counts when it is the only one: people expect
// "pick one, press Run" to work without Add to Stack.
function pendingSetupTemplate(rows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets")) {
  const template = scannerTemplateById(state.scannerSelectedTemplateId);
  return !rows.length && template && template.action !== "scope" ? template : null;
}

function addPendingSetupCondition() {
  if (pendingSetupTemplate()) addConfiguredScannerCondition();
}

async function runBrokerCondition() {
  addPendingSetupCondition();
  const scan = await executeBrokerConditionScan({
    preserveScannerTab: !state.scannerAutoResultsMode
  });
  if (scan && state.scannerAutoResultsMode) { state.activeTab = "results"; state.brokerSubTab = "results"; }
  render();
}

async function executeBrokerConditionScan({ symbols = [], signal = null, preserveScannerTab = false } = {}) {
  const rows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets");
  if (!rows.length) {
    state.status = SCANNER_EMPTY_RECIPE_MESSAGE;
    state.brokerResultsStatus = "idle";
    state.brokerResultsMessage = SCANNER_EMPTY_RECIPE_MESSAGE;
    render({ preserveScroll: true });
    return null;
  }
  const privateConditionMessage = scannerPrivateConditionMessage(rows);
  if (privateConditionMessage) {
    state.status = privateConditionMessage;
    state.brokerResultsStatus = "idle";
    state.brokerResultsMessage = privateConditionMessage;
    render({ preserveScroll: true });
    return null;
  }
  const formulaTokens = currentConditionFormulaTokens(rows);
  if (!validateConditionFormula(formulaTokens, rows)) {
    state.status = "Logic Formula is invalid. Adjust the formula tokens before running observation.";
    render({ preserveScroll: true });
    return null;
  }
  const formula = conditionFormulaText(formulaTokens);
  const directionFilter = currentScannerDirectionFilter();
  const scanRecipeHash = scannerRecipeHashForRows(rows, formula, directionFilter);
  const ownController = signal ? null : new AbortController();
  const runSignal = signal || ownController.signal;
  let stoppedByAbort = false;
  setConditionRows(rows, { clearResults: false });
  if (ownController) state.scannerRunController = ownController;
  state.busy = "broker-scan";
  state.brokerResultsStatus = "loading";
  state.brokerResultsMessage = "Running read-only Kalshi observation...";
  state.status = "Running read-only Kalshi observation...";
  render({ preserveScroll: true });

  try {
    const scan = await executeScannerObservation({
      expectedGeneration: state.brokerDataGeneration,
      rows,
      formula,
      directionFilter,
      formulaTokens: formulaTokens.map((token) => ({
        type: token.type === "open" || token.type === "close" ? "paren" : token.type,
        value: token.type === "open" ? "(" : token.type === "close" ? ")" : token.value,
        letter: token.type === "condition" ? token.value : undefined
      })),
      symbols,
      watchlist: watchlistMarketTickers(),
      settings: state.settings?.KALSHI || {},
      maxSymbols: Number.POSITIVE_INFINITY,
      signal: runSignal,
      isCurrent: () => scanRecipeHash === currentScannerRecipeHash(),
      onProgress: (progress) => {
        if (runSignal?.aborted) return;
        const message = scannerProgressMessage(progress);
        if (!message) return;
        state.brokerResultsMessage = message;
        state.status = message;
        render({ preserveScroll: true });
      }
    });
    if (scanRecipeHash !== currentScannerRecipeHash()) {
      state.brokerResultsStatus = "idle";
      state.brokerResultsMessage = "Scanner recipe changed while the previous observation was running. Run Once again.";
      state.status = state.brokerResultsMessage;
      return null;
    }
    state.brokerConditionResults = Array.isArray(scan.results) ? scan.results : [];
    state.resultsShownCount = RESULTS_PAGE_SIZE;
    state.brokerResultsRunId = scan.runId;
    state.brokerResultsStatus = scan.status === "partial" ? "partial" : state.brokerConditionResults.length ? "live" : "empty";
    state.brokerResultsMessage = scan.message || "Read-only Kalshi observation completed.";
    state.brokerResultsSavedAt = scan.observedAt || new Date().toISOString();
    state.brokerResultsRestored = false;
    state.brokerResultsRecipe = currentScannerResultRecipeSnapshot({ rows, formulaText: formula, directionFilter });
    state.status = state.brokerResultsMessage;
    return scan;
  } catch (error) {
    const stopped = error?.name === "AbortError";
    stoppedByAbort = stopped;
    state.brokerResultsStatus = stopped ? "idle" : "error";
    state.brokerResultsMessage = stopped
      ? "Scanner observation stopped."
      : `Read-only Kalshi observation failed: ${error.message || String(error)}`;
    state.brokerResultsSavedAt = stopped ? "" : new Date().toISOString();
    state.brokerResultsRestored = false;
    state.brokerResultsRecipe = stopped ? null : currentScannerResultRecipeSnapshot({ rows, formulaText: formula, directionFilter });
    state.status = state.brokerResultsMessage;
    // The common executor preserves the last successful results on failure.
    return null;
  } finally {
    state.busy = "";
    if (ownController && state.scannerRunController === ownController) {
      state.scannerRunController = null;
    }
    if (!preserveScannerTab && !stoppedByAbort) { state.activeTab = "results"; state.brokerSubTab = "results"; }
  }
}

function scannerProgressMessage(progress = {}) {
  if (progress.message) return progress.message;
  if (progress.phase === "ohlcv") {
    const current = Number(progress.current) || 0;
    const total = Number(progress.total) || 0;
    const timeframe = progress.timeframe || "OHLC";
    const symbol = progress.symbol ? ` - ${progress.symbol}` : "";
    return `Loading ${timeframe} OHLC ${current}/${total}${symbol}`;
  }
  if (progress.phase === "ticker") {
    return `Loading market snapshots for ${progress.total || 0} contracts.`;
  }
  return "";
}

async function monitorRequest(type, extra = {}) {
  if (!globalThis.chrome?.runtime?.sendMessage) throw new Error("Background monitoring requires the Chrome extension.");
  const response = await chrome.runtime.sendMessage({ type, ...extra });
  if (!response?.ok) {
    const error = new Error(response?.error || "Background monitor did not respond.");
    error.name = response?.name || "Error";
    throw error;
  }
  return response;
}

// Plain words for the background monitor's internal status codes.
const MONITOR_STATUS_TEXT = { scheduled: "Waiting for first scan", discovering: "Finding markets", scanning: "Checking markets", waiting: "Waiting for next scan",
  live: "Up to date", partial: "Some markets could not be checked", unknown: "Could not check markets", retrying: "Retrying after an error" };

function applyBackgroundMonitor(monitor) {
  state.backgroundMonitor = monitor;
  state.scannerLoopStatus = monitor?.enabled ? "waiting" : "off";
  state.scannerLoopMessage = monitor?.enabled
    ? `${MONITOR_STATUS_TEXT[monitor.status] || monitor.status}${monitor.job ? ` (${monitor.job.offset}/${monitor.job.symbols.length} checked)` : ""}${monitor.lastIncompleteCount ? ` / ${monitor.lastIncompleteCount} unknown; previous states kept` : ""}${monitor.lastError ? ` / ${monitor.lastError}` : ""}`
    : "Background monitoring off";
  state.scannerLoopRunCount = monitor?.cycleCount || 0;
  state.scannerLoopNextRescanAt = monitor?.enabled ? new Date(monitor.nextFullAt).toISOString() : "";
  state.scannerLoopTargetSymbols = Object.entries(monitor?.states || {}).filter(([, row]) => row.match).map(([symbol]) => symbol);
  if (monitor?.enabled) state.scannerRescanIntervalMinutes = monitor.rescanMinutes;
}

async function refreshBackgroundMonitor() {
  const data = await getBrokerData();
  if (data.generation !== state.brokerDataGeneration) {
    state.status = "Scanner data was restored. Reload this page before saving or running.";
    applyBackgroundMonitor(null);
    render({ preserveScroll: true });
    return;
  }
  applyBackgroundMonitor(data.monitor);
  state.scannerAlerts = data.alerts;
  state.scannerLoopHistory = normalizeStoredScannerLoopHistory(data.scannerState?.loopHistory);
  if (data.scannerState?.runId !== state.brokerResultsRunId) restoreScannerLabState(data.scannerState);
  // Result restoration resets legacy loop fields; persistent registration is authoritative.
  applyBackgroundMonitor(data.monitor);
  render({ preserveScroll: true });
}

async function startScannerLoop() {
  if (scannerLoopActive() || state.busy === "broker-scan") return;
  addPendingSetupCondition();
  try {
    const rows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets");
    if (!rows.length) throw new Error(SCANNER_EMPTY_RECIPE_MESSAGE);
    const privateMessage = scannerPrivateConditionMessage(rows);
    if (privateMessage) throw new Error(privateMessage);
    const tokens = currentConditionFormulaTokens(rows);
    if (!validateConditionFormula(tokens, rows)) throw new Error("Logic Formula is invalid.");
    const response = await monitorRequest("scanner-monitor-start", {
      recipe: { rows, formula: conditionFormulaText(tokens), directionFilter: currentScannerDirectionFilter(),
        formulaTokens: tokens.map((token) => ({ type: ["open", "close"].includes(token.type) ? "paren" : token.type,
          value: token.type === "open" ? "(" : token.type === "close" ? ")" : token.value,
          letter: token.type === "condition" ? token.value : undefined })), watchlist: watchlistMarketTickers() },
      options: { ...scannerWriteOptions(), rescanMinutes: state.scannerRescanIntervalMinutes }
    });
    applyBackgroundMonitor(response.monitor);
    state.status = "Background monitoring started. Continues with the panel closed while Chrome is running and the PC is awake.";
    // The first time alerts start, check that desktop notifications really appear.
    if (state.settings?.desktopNotifications === true && state.settings?.notificationCheck !== "seen") await sendTestNotification();
  } catch (error) { state.status = `Could not start monitoring: ${error.message}`; }
  render({ preserveScroll: true });
}

async function stopScannerLoop({ silent = false } = {}) {
  if (silent) { applyBackgroundMonitor(null); return; }
  try {
    const response = await monitorRequest("scanner-monitor-stop", { options: scannerWriteOptions() });
    applyBackgroundMonitor(response.monitor);
    if (!state.brokerConditionResults.length && state.brokerResultsStatus === "idle") {
      const data = await getBrokerData();
      // Only bring back saved results that belong to the conditions on screen; edited conditions stay empty.
      const saved = normalizeStoredScannerRecipe(data.scannerState?.recipe);
      const savedHash = saved?.conditionRows.length ? scannerRecipeHashForRows(saved.conditionRows, saved.formulaText, saved.directionFilter) : "";
      if (data.generation === state.brokerDataGeneration && savedHash === currentScannerRecipeHash()) restoreScannerLabState(data.scannerState);
      applyBackgroundMonitor(response.monitor);
    }
    state.status = "Background monitoring stopped.";
  } catch (error) { state.status = `Could not stop monitoring: ${error.message}`; }
  render({ preserveScroll: true });
}

async function updateBackgroundMonitorInterval() {
  if (!scannerLoopActive()) return;
  try {
    const response = await monitorRequest("scanner-monitor-interval", { options: { ...scannerWriteOptions(), rescanMinutes: state.scannerRescanIntervalMinutes } });
    applyBackgroundMonitor(response.monitor);
  } catch (error) { state.status = error.message; }
  render({ preserveScroll: true });
}

function stopScannerObservation() {
  void cancelScannerExecution(null, scannerWriteOptions()).catch((error) => {
    state.status = `Could not persist scanner stop: ${error.message}`;
    render({ preserveScroll: true });
  });
  if (scannerLoopActive() || state.scannerLoopController) {
    stopScannerLoop();
    return;
  }

  if (state.busy === "broker-scan" && state.scannerRunController) {
    state.scannerRunController.abort();
    state.busy = "";
    state.brokerResultsStatus = "idle";
    state.brokerResultsMessage = "Stopping scanner observation...";
    state.status = state.brokerResultsMessage;
    render({ preserveScroll: true });
  }
}

function appendScannerLoopHistory(entry = {}) {
  const results = Array.isArray(entry.results) ? entry.results : [];
  const seen = new Set(state.scannerLoopSeenMatchKeys || []);
  let newMatches = Number(entry.newMatches) || 0;
  if (results.length) {
    newMatches = 0;
    results.forEach((result) => {
      const key = scannerReviewKey(result);
      if (!seen.has(key)) {
        seen.add(key);
        newMatches += 1;
      }
    });
    state.scannerLoopSeenMatchKeys = Array.from(seen).slice(-500);
  }
  state.scannerLoopHistory = [
    {
      id: `loop-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      cycle: Number(entry.cycle) || state.scannerLoopRunCount || 0,
      mode: entry.mode || "Loop",
      status: entry.status || "idle",
      observedAt: new Date().toISOString(),
      scannedSymbols: Number(entry.scannedSymbols) || 0,
      resolvedSymbols: Number(entry.resolvedSymbols) || 0,
      matches: Number(entry.matches) || results.length || 0,
      newMatches,
      message: String(entry.message || "").slice(0, 220)
    },
    ...(Array.isArray(state.scannerLoopHistory) ? state.scannerLoopHistory : [])
  ].slice(0, SCANNER_LOOP_HISTORY_LIMIT);
  void persistScannerLoopHistory(state.scannerLoopHistory[0]);
}

function scannerReviewKey(result = {}) {
  return [
    currentScannerRecipeHash(),
    normalizeWatchlistSymbol(result.marketTicker || result.symbol),
    result.ruleLetter || "",
    result.formula || ""
  ].join("|");
}

function currentScannerRecipeHash() {
  const rows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets");
  const formula = conditionFormulaText(currentConditionFormulaTokens(rows));
  return scannerRecipeHashForRows(rows, formula, currentScannerDirectionFilter());
}

function scannerRecipeHashForRows(rows = [], formula = "", directionFilter = currentScannerDirectionFilter()) {
  return JSON.stringify({
    formula,
    directionFilter,
    rows: rows.map((row) => ({
      marketScope: row.marketScope,
      metric: row.metric,
      operator: row.operator,
      value: row.value,
      timeframe: row.timeframe,
      scannerTemplateId: row.scannerTemplateId,
      scannerParameters: row.scannerParameters,
      scannerClauses: row.scannerClauses
    }))
  });
}

async function saveBrokerConditionPreset() {
  if (state.brokerConditionPresets.length >= PRESET_LIMIT) {
    state.presetActionResult = { tone: "warn", text: `You can keep up to ${PRESET_LIMIT} presets. Delete one below to save a new one.` };
    render({ preserveScroll: true });
    return;
  }
  const rows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets");
  if (!rows.length) {
    state.status = SCANNER_EMPTY_RECIPE_MESSAGE;
    render({ preserveScroll: true });
    return;
  }
  const formulaTokens = currentConditionFormulaTokens(rows);
  if (!validateConditionFormula(formulaTokens, rows)) {
    state.status = "Logic Formula is invalid. Adjust the formula tokens before saving a preset.";
    render({ preserveScroll: true });
    return;
  }
  const formula = conditionFormulaText(formulaTokens);
  const directionFilter = currentScannerDirectionFilter();
  const recipeKey = (preset) => JSON.stringify([(preset.rows || []).map((row) => normalizeConditionRow(row)), preset.logic || "", preset.directionFilter || DEFAULT_SCANNER_DIRECTION_FILTER]);
  if (state.brokerConditionPresets.some((preset) => recipeKey(preset) === recipeKey({ rows, logic: formula, directionFilter }))) {
    state.presetActionResult = { tone: "warn", text: "These conditions are already saved as a preset." };
    render({ preserveScroll: true });
    return;
  }
  setConditionRows(rows);
  const preset = rows.length === 1
    ? {
      ...createConditionPreset(rows[0]),
      name: scannerDirectionFormulaText(formula, directionFilter),
      directionFilter,
      logic: formula
    }
    : {
      id: `preset-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: scannerDirectionFormulaText(formula, directionFilter),
      createdAt: new Date().toISOString(),
      rows,
      logic: formula,
      directionFilter
    };
  state.brokerConditionPresets = await saveScannerUiValue(saveConditionPresets, [
    ...state.brokerConditionPresets,
    preset
  ]);
  state.status = "Condition preset saved";
  state.presetActionResult = { tone: "ok", text: `Saved (${state.brokerConditionPresets.length}/${PRESET_LIMIT}). Find it under Saved Presets.` };
  render({ preserveScroll: true });
}

function findBrokerConditionPreset(presetId) {
  const targetId = String(presetId || "");
  return state.brokerConditionPresets.find((preset) => String(preset?.id || "") === targetId) || null;
}

// Fills Scanner with a saved recipe ({ rows, logic, directionFilter }). Opening the panel keeps the last results.
function applyScannerRecipe(preset, { clearResults = true } = {}) {
  const rows = Array.isArray(preset.rows) && preset.rows.length
    ? preset.rows.map((row) => normalizeConditionRow(row, row.marketScope || state.settings?.KALSHI?.marketScope || "open_markets"))
    : [normalizeConditionRow({}, state.settings?.KALSHI?.marketScope || "open_markets")];
  const marketScope = rows[0]?.marketScope || state.settings?.KALSHI?.marketScope || "open_markets";
  let formulaTokens;
  try {
    if (rows.length > MAX_CONDITION_ROWS) throw new Error("Preset exceeds the maximum condition count.");
    formulaTokens = scannerChatFormulaTokensFromText(preset.logic, rows);
  } catch (error) {
    return `Saved preset needs correction: ${error.message}`;
  }
  state.scannerDirectionFilter = normalizeScannerDirectionFilter(preset.directionFilter, DEFAULT_SCANNER_DIRECTION_FILTER);
  setConditionRows(rows, { marketScope, clearResults });

  const normalizedRows = currentConditionRows(marketScope);
  setConditionFormulaTokens(
    formulaTokens.length ? formulaTokens : scannerChatFormulaTokensForRows(normalizedRows),
    normalizedRows,
    { clearResults }
  );
  state.conditionEditTarget = null;
  state.scannerEditTargetIndex = null;
  state.scannerEditDraftParameters = {};
  state.scannerSelectedTemplateId = "";
  state.scannerDraftParameters = {};
  return "";
}

function loadBrokerConditionPreset(presetId) {
  const preset = findBrokerConditionPreset(presetId);
  const error = preset ? applyScannerRecipe(preset) : "Saved preset was not found.";
  if (!error) state.brokerSubTab = "scanner";
  state.status = error || "Condition preset loaded.";
  render(error ? { preserveScroll: true } : {});
}

// The default preset fills Scanner when the panel opens; clicking again clears it.
async function toggleDefaultConditionPreset(presetId) {
  const targetId = String(presetId || "");
  const wasDefault = findBrokerConditionPreset(targetId)?.isDefault === true;
  state.brokerConditionPresets = await saveScannerUiValue(saveConditionPresets,
    state.brokerConditionPresets.map((preset) => ({ ...preset, isDefault: !wasDefault && String(preset?.id || "") === targetId })));
  state.presetActionResult = { tone: "ok", text: wasDefault ? "No default preset. Scanner opens with your last conditions." : "Default set. Scanner opens with this preset." };
  render({ preserveScroll: true });
}

// What Scanner shows when the panel opens: a running monitor's recipe, else the default preset, else the last conditions.
function restoreScannerRecipeOnOpen(settings) {
  const preset = state.brokerConditionPresets.find((entry) => entry?.isDefault === true) || settings?.scannerLastRecipe;
  if (preset?.rows?.length) applyScannerRecipe(preset, { clearResults: false });
}

let lastSavedRecipe = "";
// Remembers the current conditions so they come back next time the panel opens.
function rememberScannerRecipe() {
  if (!state.scannerRecipeReady || !state.settings) return;
  const rows = currentConditionRows(state.settings.KALSHI?.marketScope || "open_markets");
  const tokens = currentConditionFormulaTokens(rows);
  const recipe = { rows, logic: rows.length && validateConditionFormula(tokens, rows) ? conditionFormulaText(tokens) : "", directionFilter: currentScannerDirectionFilter() };
  const key = JSON.stringify(recipe);
  if (key === lastSavedRecipe) return;
  lastSavedRecipe = key;
  void saveSettings({ scannerLastRecipe: recipe }).then((saved) => { if (state.settings) state.settings.scannerLastRecipe = saved.scannerLastRecipe; }).catch(() => {});
}

async function deleteBrokerConditionPreset(presetId) {
  const targetId = String(presetId || "");
  if (!targetId) return;
  const currentLength = state.brokerConditionPresets.length;
  const nextPresets = state.brokerConditionPresets.filter((preset) => String(preset?.id || "") !== targetId);
  if (nextPresets.length === currentLength) {
    state.status = "Saved preset was not found.";
    render({ preserveScroll: true });
    return;
  }
  state.brokerConditionPresets = await saveScannerUiValue(saveConditionPresets, nextPresets);
  state.status = "Condition preset deleted.";
  render({ preserveScroll: true });
}

function findConditionResult(id) {
  return state.brokerConditionResults.find((result) => result.id === id);
}

function scannerResultChatSymbols(results = state.brokerConditionResults) {
  const selectedResults = Array.isArray(results) ? results : [];
  return Array.from(new Set(selectedResults.map((result) => normalizeWatchlistSymbol(result?.marketTicker || result?.symbol || "")).filter(Boolean)));
}

function scannerResultChatDisplayText(results = state.brokerConditionResults) {
  const symbols = scannerResultChatSymbols(results);
  if (symbols.length === 1) return `Kalshi contract attached: ${symbols[0]}`;
  return `Kalshi contracts attached: ${symbols.join(", ") || "No contracts"}`;
}

function buildScannerResultChatContextPayload(results = state.brokerConditionResults) {
  const selectedResults = Array.isArray(results) ? results.filter(Boolean) : [];
  const contracts = selectedResults.map(contractContextFromResult);
  const marketTickers = contracts.map((contract) => contract.marketTicker).filter(Boolean);
  return {
    type: "scanner-result-contracts",
    source: "Kalshi Scanner Lab",
    marketTickers,
    symbols: marketTickers,
    contracts,
    boundary: {
      readOnlyOnly: true,
      noBuySell: true,
      noOrderPlacement: true,
      note: "Read-only Kalshi event-contract context only. The chat may explain market data, rules, and settlement context, but it must not recommend or execute trades."
    }
  };
}

function kalshiEnvironmentLabel(KALSHI = {}) {
  if (KALSHI.detectedAccountMode === "demo") return "Auto (Demo detected)";
  if (KALSHI.detectedAccountMode === "production") return "Auto (Production detected)";
  return "Auto by key";
}

function contractContextFromResult(result = {}) {
  const display = contractDisplayModel(result);
  return {
    marketTicker: display.marketTicker,
    eventTicker: display.eventTicker,
    seriesTicker: display.seriesTicker,
    eventTitle: display.eventTitle,
    marketTitle: display.marketTitle,
    marketType: display.marketType,
    yesOutcome: display.yesOutcome,
    noOutcome: display.noOutcome,
    yesBid: display.yesBid,
    yesAsk: display.yesAsk,
    noBid: display.noBid,
    noAsk: display.noAsk,
    last: display.last,
    priceChangePct: display.priceChangePct,
    volume24h: display.volume24h,
    quoteVolume24h: display.quoteVolume24h,
    liquidity: display.liquidity,
    openInterest: display.openInterest,
    spreadPct: display.spreadPct,
    status: display.status,
    closeTime: display.closeTime,
    rulesSummary: String(result.rulesSummary || "").slice(0, 700),
    settlementSource: String(result.settlementSource || ""),
    result: String(result.result || ""),
    canCloseEarly: result.canCloseEarly === true,
    relatedMarketCount: result.relatedMarketCount,
    isMultivariate: display.isMultivariate,
    scope: String(result.scope || ""),
    formula: String(result.formula || ""),
    matchedRule: String(result.matchedRule || result.match || ""),
    observedAt: display.observedAt,
    refreshed: result.refreshed === true
  };
}

async function sendConditionResultsToChat(results = state.brokerConditionResults) {
  const selectedResults = Array.isArray(results) ? results.filter(Boolean) : [];
  if (!selectedResults.length) return;
  const displayText = scannerResultChatDisplayText(selectedResults);
  state.chatOpen = true;
  state.chatLog = await appendChatMessage({
    role: "user",
    text: displayText,
    displayText,
    contextType: "scanner-results",
    contextPayload: buildScannerResultChatContextPayload(selectedResults),
    removable: true
  });
  state.status = "Scanner result contract attached to chat";
  render();
}

async function sendSingleConditionResultToChat(id) {
  const result = findConditionResult(id);
  if (!result) return;
  await sendConditionResultsToChat([result]);
}

async function removeChatMessage(messageId) {
  if (!messageId) return;
  const nextLog = state.chatLog.filter((message) => message.id !== messageId);
  if (nextLog.length === state.chatLog.length) return;
  state.chatLog = await saveChatLog(nextLog);
  state.status = "Chat context removed";
  render({ preserveScroll: true });
}

function chatOperationActive() {
  return Boolean(state.chatRunController) || state.busy === "chat";
}

function isAbortError(error) {
  return error?.name === "AbortError";
}

function abortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

function stopChatOperation() {
  if (!chatOperationActive() && state.busy !== "broker-scan") return;
  state.chatRunController?.abort?.();
  state.scannerRunController?.abort?.();
  state.status = "Chat operation stopped.";
  render({ preserveScroll: true });
}

function requestClearChat() {
  if (chatOperationActive()) {
    state.status = "Wait until the current chat finishes before clearing.";
    render({ preserveScroll: true });
    return;
  }
  if (!state.chatLog.length) return;
  state.chatClearConfirm = true;
  render({ preserveScroll: true });
}

async function clearChat() {
  if (state.busy === "chat") {
    state.chatClearConfirm = false;
    state.status = "Wait until the current chat finishes before clearing.";
    render({ preserveScroll: true });
    return;
  }
  state.chatLog = await saveChatLog([]);
  state.chatClearConfirm = false;
  state.status = "Chat cleared";
  render({ preserveScroll: true });
}

function wantsKALSHIMarketPrice(text = "") {
  return /price|ticker|quote/i.test(text);
}

function wantsKALSHIWebSocketStatus(text = "") {
  return /websocket|\bws\b|live/i.test(text);
}

function parseChatMarketSymbols(text = "") {
  const source = String(text || "");
  const symbols = new Set();
  const ignoredTickerWords = new Set([
    "PRICE",
    "QUOTE",
    "TICKER",
    "LIVE",
    "USD",
    "US",
    "YES",
    "NO"
  ]);
  const tickerPattern = /\b([A-Z][A-Z0-9]{2,}(?:-[A-Z0-9]+){1,})\b/g;
  for (const match of source.matchAll(tickerPattern)) {
    const symbol = normalizeWatchlistSymbol(match[1]);
    if (symbol && !ignoredTickerWords.has(symbol)) symbols.add(symbol);
  }
  CHAT_MARKET_SYMBOL_ALIASES.forEach((entry) => {
    if (entry.patterns.some((pattern) => pattern.test(source))) symbols.add(entry.symbol);
  });
  return Array.from(symbols).slice(0, KALSHI_LIVE_TICKER_SYMBOL_LIMIT);
}

async function tryHandleKALSHIMarketChatQuestion(text, pendingMessage, { signal = null } = {}) {
  const wantsPrice = wantsKALSHIMarketPrice(text);
  const wantsWs = wantsKALSHIWebSocketStatus(text);
  const symbols = parseChatMarketSymbols(text);
  if (!wantsPrice && !wantsWs) return false;
  if (wantsPrice && !symbols.length) return false;

  state.chatLog = await updateChatMessage(pendingMessage?.id, {
    text: "Checking Kalshi market data and WebSocket status...",
    provider: "KALSHI-market-data",
    pending: true
  });
  render();

  let tickers = [];
  let errorMessage = "";
  if (symbols.length) {
    try {
      tickers = await getTickerSnapshot(symbols, { signal, settings: state.settings?.KALSHI || {} });
    } catch (error) {
      if (isAbortError(error)) throw error;
      errorMessage = error.message || "Kalshi ticker snapshot failed.";
    }
  }

  state.chatLog = await updateChatMessage(pendingMessage?.id, {
    text: buildKALSHIMarketChatAnswer({ symbols, tickers, errorMessage, wantsPrice, wantsWs }),
    provider: "KALSHI-market-data",
    pending: false
  });
  return true;
}

function buildKALSHIMarketChatAnswer({ symbols = [], tickers = [], errorMessage = "", wantsPrice = false, wantsWs = false } = {}) {
  const tickerMap = new Map(tickers.map((ticker) => [normalizeWatchlistSymbol(ticker.symbol), ticker]));
  const priceLines = symbols.map((symbol) => {
    const liveTicker = tickerStreamIncludesSymbol(symbol) ? watchlistTickerForSymbol(symbol) : null;
    const ticker = liveTicker || tickerMap.get(normalizeWatchlistSymbol(symbol));
    if (!ticker) return `- ${symbol}: Kalshi ticker snapshot unavailable${errorMessage ? ` (${errorMessage})` : ""}.`;
    const source = liveTicker ? "Kalshi WebSocket market update" : "Kalshi REST market snapshot";
    const parts = [
      `- ${ticker.symbol || symbol}: ${formatTickerLastPrice(ticker)}`,
      Number.isFinite(Number(ticker.priceChangePct)) ? `change ${formatNumber(ticker.priceChangePct, 2)}%` : "",
      Number.isFinite(Number(ticker.spreadPct)) ? `spread ${formatSpreadPct(ticker.spreadPct)}%` : "",
      `source: ${source}`
    ].filter(Boolean);
    return parts.join(", ");
  });
  const streamSymbols = state.brokerTickerStreamSymbols.length
    ? state.brokerTickerStreamSymbols.join(", ")
    : "none";
  const streamLine = tickerStreamActive()
    ? `WebSocket live market stream is ${state.brokerTickerStreamStatus}. Subscribed contracts: ${streamSymbols}.`
    : "WebSocket live market stream is off. No contracts are currently subscribed.";
  const requestedCoverage = symbols.length
    ? symbols.map((symbol) => `- ${symbol}: ${tickerStreamIncludesSymbol(symbol) ? "subscribed over WebSocket" : "not subscribed over WebSocket"}`)
    : [];

  return [
    wantsPrice ? "1. Kalshi price check" : "",
    wantsPrice ? priceLines.join("\n") : "",
    wantsWs ? "" : "",
    wantsWs ? `${wantsPrice ? "2" : "1"}. WebSocket status` : "",
    wantsWs ? streamLine : "",
    wantsWs && state.brokerTickerStreamUpdatedAt ? `Last WebSocket update: ${formatDate(state.brokerTickerStreamUpdatedAt)}.` : "",
    wantsWs && requestedCoverage.length ? requestedCoverage.join("\n") : "",
    wantsWs && !tickerStreamActive() && symbols.length ? "To observe a contract over WebSocket, add it to Watchlist and press Start Live." : "",
    errorMessage && !priceLines.length ? `Kalshi error: ${errorMessage}` : ""
  ].filter(Boolean).join("\n");
}

function formatTickerLastPrice(ticker = {}) {
  const value = Number(ticker.last);
  if (!Number.isFinite(value)) return "last price unavailable";
  return formatProbabilityPrice(value);
}

function formatSpreadPct(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  const absolute = Math.abs(number);
  if (absolute > 0 && absolute < 0.001) {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 6,
      maximumFractionDigits: 6
    }).format(number);
  }
  if (absolute > 0 && absolute < 0.01) {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4
    }).format(number);
  }
  return formatNumber(number, 3);
}

function normalizeWatchlistSymbol(symbol) {
  const value = symbol && typeof symbol === "object"
    ? symbol.marketTicker || symbol.symbol || symbol.ticker || ""
    : symbol;
  return String(value || "").trim().toUpperCase().replace(/\//g, ".").replace(/[^A-Z0-9.-]/g, "");
}

function watchlistMarketTickers(entries = state.brokerWatchlist) {
  return Array.from(new Set((Array.isArray(entries) ? entries : []).map(normalizeWatchlistSymbol).filter(Boolean)));
}

function findWatchlistEntry(symbol) {
  const normalized = normalizeWatchlistSymbol(symbol);
  return state.brokerWatchlist.find((entry) => normalizeWatchlistSymbol(entry) === normalized) || null;
}

function watchlistEntryFromContract(contract, existing = null) {
  const display = contractDisplayModel(contract || {});
  if (!display.marketTicker) return null;
  return {
    marketTicker: display.marketTicker,
    symbol: display.marketTicker,
    eventTicker: display.eventTicker || existing?.eventTicker || "",
    seriesTicker: display.seriesTicker || existing?.seriesTicker || "",
    eventTitle: display.eventTitle || existing?.eventTitle || "",
    marketTitle: display.marketTitle || existing?.marketTitle || display.marketTicker,
    status: display.status || existing?.status || "",
    closeTime: display.closeTime || existing?.closeTime || "",
    savedAt: existing?.savedAt || new Date().toISOString()
  };
}

async function saveWatchlistSymbol(symbol) {
  const normalized = normalizeWatchlistSymbol(symbol);
  if (!normalized) return;
  const existing = findWatchlistEntry(normalized);
  const existed = Boolean(existing);
  if (!existed && state.brokerWatchlist.length >= BROKER_WATCHLIST_MAX_SYMBOLS) {
    state.status = `Watchlist is full (${BROKER_WATCHLIST_MAX_SYMBOLS} contracts). Remove a contract before adding another.`;
    render({ preserveScroll: true });
    return;
  }
  const source = symbol && typeof symbol === "object"
    ? symbol
    : findConditionResult(String(symbol || "")) || watchlistTickerForSymbol(normalized) || { marketTicker: normalized };
  const nextEntry = watchlistEntryFromContract(source, existing);
  state.brokerWatchlist = await saveScannerUiValue(saveWatchlist, existed
    ? state.brokerWatchlist.map((entry) => normalizeWatchlistSymbol(entry) === normalized ? nextEntry : entry)
    : [...state.brokerWatchlist, nextEntry]
  );
  if (source && typeof source === "object" && (source.last !== undefined || source.yesBid !== undefined)) {
    state.brokerWatchlistTickers = {
      ...state.brokerWatchlistTickers,
      [normalized]: contractDisplayModel(source)
    };
  }
  state.status = existed ? `${normalized} is already in Watchlist` : `${normalized} saved to Watchlist`;
  render({ preserveScroll: true });
}

async function addWatchlistSymbolFromDom() {
  const input = document.querySelector("#watchlistSymbolInput");
  const symbol = normalizeWatchlistSymbol(input?.value);
  if (!symbol) {
    state.status = "Enter a Kalshi market ticker first";
    render({ preserveScroll: true });
    return;
  }
  await saveWatchlistSymbol(symbol);
}

async function removeWatchlistSymbol(symbol) {
  const normalized = normalizeWatchlistSymbol(symbol);
  state.brokerWatchlist = await saveScannerUiValue(saveWatchlist, state.brokerWatchlist.filter((entry) => normalizeWatchlistSymbol(entry) !== normalized));
  delete state.brokerWatchlistTickers[normalized];
  state.status = `${normalized} removed from Watchlist`;
  render({ preserveScroll: true });
}

function tickerStreamActive() {
  return ["connecting", "subscribing", "live"].includes(state.brokerTickerStreamStatus);
}

function tickerStreamLabel() {
  if (!tickerStreamActive()) return state.brokerTickerStreamMessage || "Off";
  const updated = state.brokerTickerStreamUpdatedAt ? `, ${formatDate(state.brokerTickerStreamUpdatedAt)}` : "";
  return `${state.brokerTickerStreamMessage || state.brokerTickerStreamStatus}${updated}`;
}

function brokerResultsStatusLabel() {
  // The "Last run" row right below already shows the time.
  const savedLabel = "";
  const restoredLabel = state.brokerResultsRestored ? " Restored after refresh." : "";
  if (state.busy === "broker-scan") return "Loading";
  if (state.brokerResultsStatus === "partial") return `${state.brokerResultsMessage || "Search incomplete: required data is unavailable."}${restoredLabel}${savedLabel}`.trim();
  if (state.brokerResultsStatus === "error") return `${state.brokerResultsMessage || "Failed"}${restoredLabel}${savedLabel}`.trim();
  if (state.brokerResultsStatus === "empty") return `${state.brokerResultsMessage || "No matches"}${restoredLabel}${savedLabel}`.trim();
  if (state.brokerResultsStatus === "stale") return `${state.brokerResultsMessage || "Showing last scanner results."}${restoredLabel}${savedLabel}`.trim();
  if (state.brokerResultsStatus === "live") return `${state.brokerResultsMessage || "Live REST results"}${savedLabel}`.trim();
  return "Idle";
}

function brokerResultsEmptyMessage() {
  if (state.busy === "broker-scan") return "Running read-only Kalshi observation...";
  if (state.brokerResultsStatus === "partial") return state.brokerResultsMessage || "Some contracts could not be evaluated. Missing data is not a confirmed non-match.";
  if (state.brokerResultsStatus === "error") return state.brokerResultsMessage || "Read-only Kalshi observation failed.";
  if (state.brokerResultsStatus === "empty") {
    return state.brokerResultsRestored
      ? "Last scanner run had no matches. See the background monitoring status for the next check."
      : scannerLoopActive() ? scannerZeroResultWaitMessage() : "No matches for the current formula. Adjust Scanner Lab conditions or run again.";
  }
  if (state.brokerResultsStatus === "stale") return "Last scanner results are restored after refresh. Background monitoring status is loaded separately; these are saved observations.";
  return "No results yet. Set conditions in Scanner and press Run Once.";
}

function tickerStreamIncludesSymbol(symbol) {
  const key = normalizeWatchlistSymbol(symbol);
  return Boolean(key && tickerStreamActive() && state.brokerTickerStreamSymbols.some((streamSymbol) => normalizeWatchlistSymbol(streamSymbol) === key));
}

async function toggleWatchlistTickerStream() {
  if (tickerStreamActive()) {
    stopTickerStream();
    return;
  }
  await startTickerStream(watchlistMarketTickers(), "Watchlist");
}

async function startTickerStream(symbols = [], label = "Symbols") {
  const candidateSymbols = Array.from(new Set(symbols.map(normalizeWatchlistSymbol).filter(Boolean)));
  const selectedSymbols = candidateSymbols.slice(0, KALSHI_LIVE_TICKER_SYMBOL_LIMIT);
  if (!selectedSymbols.length) {
    state.status = `No ${label} contracts available for live market streaming.`;
    render({ preserveScroll: true });
    return;
  }
  stopTickerStream({ silent: true });
  state.busy = "ticker";
  state.brokerTickerStreamStatus = "connecting";
  state.brokerTickerStreamMessage = `Connecting ${label} live market stream (${selectedSymbols.length}/${KALSHI_LIVE_TICKER_SYMBOL_LIMIT})...`;
  state.brokerTickerStreamSymbols = selectedSymbols;
  render({ preserveScroll: true });

  try {
    state.brokerTickerStream = await createKalshiTickerStream(selectedSymbols, {
      onTicker: handleTickerStreamUpdate,
      onStatus: handleTickerStreamStatus,
      onError: handleTickerStreamError
    }, {
      settings: state.settings?.KALSHI || {}
    });
    state.brokerTickerStreamSymbols = state.brokerTickerStream.symbols || selectedSymbols;
    state.busy = "";
    state.status = candidateSymbols.length > selectedSymbols.length
      ? `${label} live market stream started for ${selectedSymbols.length}/${candidateSymbols.length} contracts. Only the first ${KALSHI_LIVE_TICKER_SYMBOL_LIMIT} saved contracts are live.`
      : `${label} live market stream started.`;
  } catch (error) {
    state.brokerTickerStream = null;
    state.brokerTickerStreamStatus = "error";
    state.brokerTickerStreamMessage = error.message || "Live market stream failed.";
    state.busy = "";
    state.status = `Live market stream failed: ${error.message || String(error)}`;
  }
  render({ preserveScroll: true });
}

function stopTickerStream({ silent = false } = {}) {
  const stream = state.brokerTickerStream;
  state.brokerTickerStream = null;
  if (stream && typeof stream.close === "function") stream.close();
  state.brokerTickerStreamStatus = "off";
  state.brokerTickerStreamMessage = "Live market stream off";
  state.brokerTickerStreamSymbols = [];
  state.busy = state.busy === "ticker" ? "" : state.busy;
  if (!silent) {
    state.status = "Live market stream stopped.";
    render({ preserveScroll: true });
  }
}

function handleTickerStreamUpdate(ticker) {
  const key = normalizeWatchlistSymbol(ticker.symbol);
  if (!key) return;
  const observedAt = ticker.observedAt || new Date().toISOString();
  state.brokerWatchlistTickers = {
    ...state.brokerWatchlistTickers,
    [key]: ticker
  };
  state.brokerTickerStreamUpdatedAt = observedAt;
  scheduleTickerRender();
}

function handleTickerStreamStatus(info = {}) {
  state.brokerTickerStreamStatus = info.state || state.brokerTickerStreamStatus;
  state.brokerTickerStreamMessage = info.message || state.brokerTickerStreamMessage;
  if (Array.isArray(info.symbols)) state.brokerTickerStreamSymbols = info.symbols;
  if (state.brokerTickerStreamStatus === "live" || state.brokerTickerStreamStatus === "error" || state.brokerTickerStreamStatus === "off") {
    state.busy = state.busy === "ticker" ? "" : state.busy;
  }
  scheduleTickerRender();
}

function handleTickerStreamError(error) {
  state.brokerTickerStreamStatus = "error";
  state.brokerTickerStreamMessage = error.message || "Live market stream failed.";
  state.status = `Live market stream failed: ${error.message || String(error)}`;
  state.busy = state.busy === "ticker" ? "" : state.busy;
  scheduleTickerRender();
}

function scheduleTickerRender() {
  if (tickerRenderTimer) return;
  tickerRenderTimer = setTimeout(() => {
    tickerRenderTimer = null;
    render({ preserveScroll: true });
  }, 500);
}
async function refreshWatchlistTickers() {
  if (!state.brokerWatchlist.length || state.busy === "watchlist") return;
  state.busy = "watchlist";
  state.status = "Refreshing Watchlist with Kalshi market data...";
  render({ preserveScroll: true });
  try {
    const tickers = await getTickerSnapshot(watchlistMarketTickers(), { settings: state.settings?.KALSHI || {} });
    const next = {};
    tickers.forEach((ticker) => {
      next[normalizeWatchlistSymbol(ticker.symbol)] = ticker;
    });
    state.brokerWatchlistTickers = next;
    state.brokerWatchlist = await saveScannerUiValue(saveWatchlist, state.brokerWatchlist.map((entry) => {
      const key = normalizeWatchlistSymbol(entry);
      return watchlistEntryFromContract(next[key] || entry, entry) || entry;
    }));
    state.brokerWatchlistUpdatedAt = new Date().toISOString();
    state.status = tickers.length
      ? `Watchlist refreshed with ${tickers.length} public market rows`
      : "Watchlist refresh completed, but no supported Kalshi market tickers were returned.";
  } catch (error) {
    state.status = `Watchlist refresh failed: ${error.message || String(error)}`;
  } finally {
    state.busy = "";
    render({ preserveScroll: true });
  }
}

async function sendWatchlistSymbolsToChat(symbols = state.brokerWatchlist) {
  const selectedSymbols = Array.isArray(symbols) ? symbols.map(normalizeWatchlistSymbol).filter(Boolean) : [];
  if (!selectedSymbols.length) return;
  const displayText = watchlistChatDisplayText(selectedSymbols);
  state.chatOpen = true;
  state.chatLog = await appendChatMessage({
    role: "user",
    text: displayText,
    displayText,
    contextType: "watchlist",
    contextPayload: buildWatchlistChatContextPayload(selectedSymbols),
    removable: true
  });
  state.status = "Watchlist contracts attached to chat";
  render();
}

function watchlistChatDisplayText(symbols = state.brokerWatchlist) {
  const selected = Array.isArray(symbols) ? symbols.map(normalizeWatchlistSymbol).filter(Boolean) : [];
  return `Watchlist attached: ${selected.join(", ") || "No contracts"}`;
}

function buildWatchlistChatContextPayload(symbols = state.brokerWatchlist) {
  const selected = Array.isArray(symbols) ? symbols.map(normalizeWatchlistSymbol).filter(Boolean) : [];
  const contracts = selected.map((symbol) => {
    const entry = findWatchlistEntry(symbol) || { marketTicker: symbol };
    const ticker = watchlistTickerForSymbol(symbol);
    return contractContextFromResult({
      ...entry,
      ...(ticker || {}),
      marketTicker: symbol,
      refreshed: Boolean(ticker),
      observedAt: ticker?.observedAt || state.brokerWatchlistUpdatedAt || ""
    });
  });
  return {
    type: "watchlist",
    source: "Kalshi Watchlist",
    marketTickers: selected,
    symbols: selected,
    contracts,
    boundary: {
      readOnlyOnly: true,
      noBuySell: true,
      noOrderPlacement: true,
      note: "Read-only observation context only. Buying, selling, order placement, and trading execution are not available in this extension under its Chrome Web Store policy boundary."
    }
  };
}

function useWatchlistInScanner(symbol = "") {
  if (!state.brokerWatchlist.length) {
    state.status = "Add at least one Watchlist contract first.";
    render({ preserveScroll: true });
    return;
  }
  const rows = currentConditionRows(state.settings?.KALSHI?.marketScope || "open_markets").map((row) => ({
    ...row,
    marketScope: "watchlist"
  }));
  setConditionRows(rows, { marketScope: "watchlist" });
  state.settings = {
    ...state.settings,
    KALSHI: {
      ...(state.settings?.KALSHI || {}),
      marketScope: "watchlist"
    }
  };
  state.brokerSubTab = "scanner";
  state.status = symbol
    ? `${normalizeWatchlistSymbol(symbol)} selected. Scanner Lab scope is now Watchlist. Run Once to scan saved contracts.`
    : "Scanner Lab scope is now Watchlist. Run Once to scan saved contracts.";
  render({ preserveScroll: true });
}

async function testKALSHISettingsFromDom() {
  if (state.kalshiConnectionTesting) return;
  state.kalshiConnectionTesting = true;
  state.kalshiConnectionTested = true;
  const currentSettings = captureSettingsDraftFromDom();
  const KALSHI = currentSettings.KALSHI || readKALSHISettingsFromDom();
  try {
    state.settings = {
      ...currentSettings,
      KALSHI: {
        ...KALSHI,
        environment: "auto",
        connectionStatus: "testing",
        connectionMessage: "Testing Production/Demo read-only access...",
        connectionCheckedAt: "",
        detectedAccountMode: KALSHI.detectedAccountMode || ""
      }
    };
    state.status = "Testing Kalshi read-only connection...";
    render({ preserveScroll: true });

    let result = null;
    try {
      result = await testKALSHIConnection(KALSHI);
    } catch (error) {
      result = {
        status: "error",
        message: error.message || String(error),
        checkedAt: new Date().toISOString()
      };
    }

    state.settings = {
      ...currentSettings,
      KALSHI: {
        ...KALSHI,
        environment: "auto",
        connectionStatus: result.status,
        connectionMessage: result.message,
        connectionCheckedAt: result.checkedAt || new Date().toISOString(),
        detectedAccountMode: result.detectedAccountMode || KALSHI.detectedAccountMode || ""
      }
    };
    try {
      state.settings = await saveSettings(state.settings);
    } catch (error) {
      state.status = `Connection test finished, but saving failed: ${error.message || String(error)}`;
      return;
    }
    if (!portfolioSnapshotGate(state.settings.KALSHI).ready) {
      stopPortfolioAutoRefresh({ silent: true });
      state.brokerPortfolioSnapshot = null;
      state.brokerPortfolioUpdatedAt = "";
    }
    state.status = `${result.message} Settings saved.`;
  } finally {
    state.kalshiConnectionTesting = false;
    render({ preserveScroll: true });
  }
}

function startChatResize(event) {
  const chat = document.querySelector(".panel-chat.is-open");
  if (!chat) return;

  event.preventDefault();
  event.stopPropagation();

  const startY = event.clientY;
  const startHeight = chat.getBoundingClientRect().height;
  const handle = event.currentTarget;
  handle.setPointerCapture?.(event.pointerId);
  document.body.classList.add("is-resizing-chat");

  const onPointerMove = (moveEvent) => {
    const nextHeight = clampChatHeight(startHeight + startY - moveEvent.clientY);
    state.chatHeight = nextHeight;
    chat.style.setProperty("--panel-chat-height", `${nextHeight}px`);
  };

  const onPointerUp = () => {
    document.body.classList.remove("is-resizing-chat");
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
  };

  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);
}

function clampChatHeight(value) {
  const workspace = document.querySelector(".panel-workspace");
  const header = document.querySelector(".panel-header");
  const workspaceHeight = workspace?.clientHeight || window.innerHeight || 720;
  const headerHeight = header?.offsetHeight || 48;
  const maxHeight = Math.max(CHAT_MIN_HEIGHT, workspaceHeight - headerHeight - CHAT_MIN_MAIN_HEIGHT);
  return Math.min(Math.max(Number(value) || CHAT_DEFAULT_HEIGHT, CHAT_MIN_HEIGHT), maxHeight);
}

function resizeChatInput(input) {
  if (!input) return;
  const style = window.getComputedStyle(input);
  const lineHeight = Number.parseFloat(style.lineHeight) || 18;
  const padding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
  const border = Number.parseFloat(style.borderTopWidth) + Number.parseFloat(style.borderBottomWidth);
  const maxHeight = Math.ceil(lineHeight * 4 + padding + border);
  input.style.height = "auto";
  const nextHeight = Math.min(input.scrollHeight, maxHeight);
  input.style.height = `${nextHeight}px`;
  input.style.overflowY = input.scrollHeight > maxHeight ? "auto" : "hidden";
}




function isSameChatContext(item) {
  return Boolean(state.selected && item && itemKey(state.selected) === itemKey(item));
}

function hasCurrentChatToProtect() {
  return state.chatLog.some((message) => message.text && !message.pending);
}

async function switchChatContext(item, { resetChat = true } = {}) {
  state.selected = item;
  state.chatOpen = true;
  state.chatSwitchTarget = null;
  if (resetChat) {
    state.chatLog = await saveChatLog([]);
  }
  await setSelectedNews(item);
  render();
  document.querySelector("#chatInput")?.focus();
}

async function requestChatForItem(item) {
  if (state.busy === "chat") {
    state.status = "Wait until the current chat finishes.";
    render();
    return;
  }

  if (!hasCurrentChatToProtect() || isSameChatContext(item)) {
    await switchChatContext(item, { resetChat: false });
    return;
  }

  state.chatSwitchTarget = item;
  state.chatOpen = true;
  state.status = "";
  render();
}

async function saveCurrentChatAndSwitch() {
  const item = state.chatSwitchTarget;
  if (!item) return;

  try {
    await saveTextFile(chatDownloadFilename(), buildChatMarkdown());
    state.status = "Chat saved";
    await switchChatContext(item);
  } catch (error) {
    if (error?.name === "AbortError") return;
    state.status = error.message || "Chat save failed.";
    render();
  }
}

async function discardCurrentChatAndSwitch() {
  const item = state.chatSwitchTarget;
  if (!item) return;
  state.status = "Chat reset";
  await switchChatContext(item);
}

async function handleAction(action, id, pool) {
  const item = findItem(id, pool);
  if (!item) return;

  if (action === "translate-analysis") {
    await toggleAnalysisTranslation(item);
    return;
  }

  if (action === "ask") {
    await requestChatForItem(item);
    return;
  }

  if (action === "save") {
    state.saveTarget = { item };
    state.status = "";
    render();
    return;
  }

  if (action === "note") {
    state.noteTarget = item;
    state.status = "";
    render();
    document.querySelector("#savedNoteInput")?.focus();
    return;
  }

  if (action === "export-saved-card") {
    await exportSavedCard(item);
    return;
  }

  if (action === "remove") {
    state.savedItems = await removeSavedNewsItem(item, state.savedGroupId);
    state.status = "Removed";
    render();
    return;
  }

  if (action === "share") {
    await shareItem(item);
  }
}

async function toggleAnalysisTranslation(item) {
  const key = analysisTranslationKey(item);
  const existing = state.analysisTranslations[key];

  if (existing?.text && !existing.loading) {
    state.analysisTranslations = {
      ...state.analysisTranslations,
      [key]: {
        ...existing,
        visible: !existing.visible,
        error: ""
      }
    };
    render({ preserveScroll: true });
    return;
  }

  state.analysisTranslations = {
    ...state.analysisTranslations,
    [key]: {
      loading: true,
      visible: true,
      error: "",
      text: "",
      targetName: translationEnglish(state.settings)?.name || "Translated"
    }
  };
  render({ preserveScroll: true });

  try {
    const result = await originalAnalysisText(getSummary(item), state.settings);
    state.analysisTranslations = {
      ...state.analysisTranslations,
      [key]: {
        loading: false,
        visible: true,
        error: "",
        text: result.text,
        targetLanguage: result.targetLanguage,
        targetName: result.targetName
      }
    };
  } catch (error) {
    state.analysisTranslations = {
      ...state.analysisTranslations,
      [key]: {
        loading: false,
        visible: true,
        error: error.message || "Analysis translation failed.",
        text: "",
        targetName: translationEnglish(state.settings)?.name || "Translated"
      }
    };
  }
  render({ preserveScroll: true });
}

async function shareItem(item) {
  const text = item.url || buildNewsPrompt(item, state.briefingItems);
  if (navigator.share && item.url) {
    await navigator.share({ title: item.title || "Kalshi Screener news", url: item.url }).catch(() => null);
    return;
  }
  await copyPromptToClipboard(text);
  state.status = item.url ? "Link copied" : "Prompt copied";
  render();
}

function localTimestamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("") + "_" + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
}

function sanitizeFilename(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/\s+/g, "_")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 60);
}

function firstChatText() {
  return state.chatLog.find((message) => message.role === "user" && message.text)?.text
    || state.selected?.title
    || state.chatLog.find((message) => message.text)?.text
    || "KalshiScreenerChat";
}

function chatDownloadFilename() {
  const base = Array.from(firstChatText().replace(/\s+/g, " ").trim()).slice(0, 15).join("");
  return `${sanitizeFilename(base) || "KalshiScreenerChat"}_${localTimestamp()}.md`;
}

function compactChatMessage(message = {}) {
  return {
    id: message.id || `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role: message.role === "user" ? "user" : "assistant",
    text: String(message.text || ""),
    provider: message.provider || "",
    createdAt: message.createdAt || new Date().toISOString(),
    pending: Boolean(message.pending)
  };
}

function buildChatExportPayload() {
  return {
    app: "Kalshi Screener",
    type: "chat",
    version: 1,
    exportedAt: new Date().toISOString(),
    context: state.selected
      ? {
        id: state.selected.id || "",
        title: state.selected.title || "",
        url: state.selected.url || "",
        source: getSource(state.selected),
        sentimentScore: getSentimentScore(state.selected)
      }
      : null,
    messages: state.chatLog.map(compactChatMessage)
  };
}

function buildChatMarkdown() {
  const payload = buildChatExportPayload();
  const contextTitle = payload.context?.title || "No selected news";
  const lines = [
    "# Kalshi Screener Chat",
    "",
    `Exported: ${payload.exportedAt}`,
    `Context: ${contextTitle}`
  ];

  if (payload.context?.url) lines.push(`URL: ${payload.context.url}`);
  lines.push("", "## Conversation", "");

  payload.messages.forEach((message) => {
    lines.push(`### ${message.role === "user" ? "User" : "Kalshi Screener"}`);
    lines.push("");
    lines.push(`Time: ${message.createdAt}`);
    if (message.provider) lines.push(`Provider: ${message.provider}`);
    lines.push("");
    lines.push(message.text || "");
    lines.push("");
  });

  return `${lines.join("\n").trim()}\n`;
}

async function saveTextFile(filename, text, {
  mimeType = "text/markdown;charset=utf-8",
  description = "Markdown",
  accept = {
    "text/markdown": [".md"],
    "text/plain": [".txt"]
  }
} = {}) {
  const blob = new Blob([text], { type: mimeType });

  if ("showSaveFilePicker" in window) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [
          {
            description,
            accept
          }
        ]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (error) {
      if (error?.name === "AbortError") throw error;
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function savedCardFilename(item) {
  const base = Array.from(String(item?.title || "SavedCard").replace(/\s+/g, " ").trim()).slice(0, 15).join("");
  return `${sanitizeFilename(base) || "SavedCard"}_${localTimestamp()}.json`;
}

function buildSavedCardExport(item) {
  const group = state.groups.find((entry) => entry.id === item.groupId) || DEFAULT_GROUP;
  return {
    app: "Kalshi Screener",
    type: "saved-card",
    version: 1,
    exportedAt: new Date().toISOString(),
    group,
    item
  };
}

async function exportSavedCard(item) {
  try {
    await saveTextFile(
      savedCardFilename(item),
      `${JSON.stringify(buildSavedCardExport(item), null, 2)}\n`,
      {
        mimeType: "application/json;charset=utf-8",
        description: "Kalshi Screener saved card",
        accept: {
          "application/json": [".json"]
        }
      }
    );
    state.status = "Saved card exported";
  } catch (error) {
    if (error?.name === "AbortError") return;
    state.status = error.message || "Saved card export failed.";
  }
  render({ preserveScroll: true });
}

function parseSavedCardsJson(text) {
  const payload = JSON.parse(String(text || ""));
  if (Array.isArray(payload)) {
    return { groups: [DEFAULT_GROUP], items: payload };
  }
  if (payload?.type === "saved-card" && payload.item) {
    return {
      groups: payload.group ? [DEFAULT_GROUP, payload.group] : [DEFAULT_GROUP],
      items: [payload.item]
    };
  }
  if (payload?.type !== "saved-cards" && !Array.isArray(payload?.items)) {
    throw new Error("This is not an Kalshi Screener saved cards file.");
  }
  return {
    groups: Array.isArray(payload.groups) ? payload.groups : [DEFAULT_GROUP],
    items: Array.isArray(payload.items) ? payload.items : []
  };
}

async function importSavedCardsText(text) {
  const data = parseSavedCardsJson(text);
  const result = await mergeSavedData(data);
  state.groups = result.groups;
  state.savedItems = result.items;
  if (!state.groups.some((group) => group.id === state.savedGroupId)) {
    state.savedGroupId = DEFAULT_GROUP.id;
  }
  state.status = `Loaded saved cards (${result.importedCount}/${SAVED_NEWS_LIMIT})`;
  render();
}

async function importSavedCards() {
  try {
    if ("showOpenFilePicker" in window) {
      try {
        const [handle] = await window.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: "Kalshi Screener saved cards",
              accept: {
                "application/json": [".json"]
              }
            }
          ]
        });
        const file = await handle.getFile();
        await importSavedCardsText(await file.text());
        return;
      } catch (error) {
        if (error?.name === "AbortError") throw error;
      }
    }

    document.querySelector("#savedLoadFileInput")?.click();
  } catch (error) {
    if (error?.name === "AbortError") return;
    state.status = error.message || "Saved cards import failed.";
    render();
  }
}

async function importSavedCardsFromFileInput(event) {
  const file = event.currentTarget?.files?.[0];
  if (!file) return;

  try {
    await importSavedCardsText(await file.text());
  } catch (error) {
    state.status = error.message || "Saved cards import failed.";
    render();
  } finally {
    event.currentTarget.value = "";
  }
}

async function downloadChatFile() {
  if (!state.chatLog.length) {
    state.status = "No chat to save";
    render();
    return;
  }

  try {
    await saveTextFile(chatDownloadFilename(), buildChatMarkdown());
    state.status = "Chat saved";
  } catch (error) {
    if (error?.name === "AbortError") return;
    state.status = error.message || "Chat save failed.";
  }
  render({ preserveScroll: true });
}

function parseChatMarkdown(text) {
  const source = String(text || "");
  const messageHeader = /^###\s+(User|EightyPlus|KALSHI-EightyPlus|Kalshi Screener)\s*$/gmi;
  const matches = Array.from(source.matchAll(messageHeader));

  if (matches.length) {
    return matches
      .map((match, index) => {
        const start = (match.index || 0) + match[0].length;
        const end = matches[index + 1]?.index ?? source.length;
        return parseMarkdownChatMessage(match[1], source.slice(start, end));
      })
      .filter((message) => message.text);
  }

  const trimmed = source.trim();
  return trimmed
    ? [compactChatMessage({ role: "assistant", text: trimmed, provider: "loaded" })]
    : [];
}

function parseMarkdownChatMessage(label, rawContent) {
  const lines = String(rawContent || "").replace(/\r\n/g, "\n").split("\n");
  const meta = {};

  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length) {
    const line = lines[0].trim();
    if (!line) {
      lines.shift();
      break;
    }
    const timeMatch = line.match(/^Time:\s*(.+)$/i);
    if (timeMatch) {
      meta.createdAt = timeMatch[1].trim();
      lines.shift();
      continue;
    }
    const providerMatch = line.match(/^Provider:\s*(.+)$/i);
    if (providerMatch) {
      meta.provider = providerMatch[1].trim();
      lines.shift();
      continue;
    }
    break;
  }

  while (lines.length && !lines[0].trim()) lines.shift();

  const createdAt = Number.isNaN(Date.parse(meta.createdAt || ""))
    ? new Date().toISOString()
    : new Date(meta.createdAt).toISOString();

  return compactChatMessage({
    role: String(label).toLowerCase() === "user" ? "user" : "assistant",
    text: lines.join("\n").trim(),
    provider: meta.provider || "loaded",
    createdAt
  });
}

async function loadChatText(text) {
  const messages = parseChatMarkdown(text);
  if (!messages.length) throw new Error("No chat messages found in this file.");
  state.chatLog = await saveChatLog(messages);
  state.chatOpen = true;
  state.status = `Loaded ${messages.length} chat messages`;
  render();
}

function chatFileKind(file) {
  const name = String(file?.name || "").toLowerCase();
  const type = String(file?.type || "").toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (type.startsWith("text/") || name.endsWith(".md") || name.endsWith(".txt")) return "text";
  return "";
}

function scannerPrivateConditionMessage(rows = []) {
  const privateRows = rows.filter((row) => (row.dataRequirement || []).includes(DATA_REQUIREMENTS.ACCOUNT_READONLY));
  if (!privateRows.length) return "";
  const labels = privateRows.map((row) => row.sourceTemplateLabel || conditionLabel(row)).join(", ");
  return `Private Account/Positions conditions are separated from public Kalshi market scans. Remove ${labels || "the private condition"} from this public stack. Account/Positions can still be loaded in Overview and sent to Chat as private context.`;
}

function chatAttachmentMimeType(file, kind) {
  if (file?.type) return file.type;
  const name = String(file?.name || "").toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".md")) return "text/markdown";
  if (name.endsWith(".txt")) return "text/plain";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".gif")) return "image/gif";
  return kind === "text" ? "text/plain" : "application/octet-stream";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result || "")));
    reader.addEventListener("error", () => reject(reader.error || new Error("File read failed.")));
    reader.readAsDataURL(file);
  });
}

function splitDataUrl(dataUrl = "") {
  const match = String(dataUrl || "").match(/^data:([^;,]+)?(?:;base64)?,(.*)$/);
  return {
    mimeType: match?.[1] || "",
    data: match?.[2] || ""
  };
}

function chatDropPayloadAvailable(dataTransfer) {
  if (!dataTransfer) return false;
  if (dataTransfer.files?.length) return true;
  const types = Array.from(dataTransfer.types || []);
  if (types.includes("Files") || types.includes("text/uri-list") || types.includes("DownloadURL")) return true;
  return Array.from(dataTransfer.items || []).some((item) => item.kind === "file");
}

function chatDataTransferFiles(dataTransfer) {
  const files = [
    ...Array.from(dataTransfer?.files || []),
    ...Array.from(dataTransfer?.items || [])
      .filter((item) => item.kind === "file")
      .map((item) => item.getAsFile?.())
      .filter(Boolean)
  ];
  const seen = new Set();
  return files.filter((file) => {
    const key = `${file.name || "file"}:${file.size || 0}:${file.lastModified || 0}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function chatDroppedUrl(dataTransfer) {
  const downloadUrl = dataTransfer?.getData?.("DownloadURL") || "";
  if (downloadUrl) {
    const match = downloadUrl.match(/^[^:]+:[^:]*:(.+)$/);
    if (match?.[1]) return match[1];
  }
  const uriList = dataTransfer?.getData?.("text/uri-list") || "";
  const uri = uriList.split(/\r?\n/).find((line) => line && !line.startsWith("#"));
  return uri || dataTransfer?.getData?.("text/plain") || "";
}

function fileFromDataUrl(dataUrl = "", name = "dropped-image.png") {
  const match = String(dataUrl || "").match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return null;
  const mimeType = match[1] || "application/octet-stream";
  const raw = match[2] ? atob(match[3] || "") : decodeURIComponent(match[3] || "");
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return new File([bytes], name, { type: mimeType });
}

function isChatTranscriptText(text) {
  return /^#\s+EightyPlus.*Chat/im.test(text) || /^###\s+(User|EightyPlus|KALSHI-EightyPlus|Kalshi Screener)\s*$/gmi.test(text);
}

async function createChatAttachment(file) {
  const kind = chatFileKind(file);
  if (!kind) throw new Error(`${file.name || "File"} is not a supported chat attachment.`);
  if (file.size > CHAT_ATTACHMENT_MAX_BYTES) {
    throw new Error(`${file.name || "File"} is larger than 8 MB.`);
  }

  const mimeType = chatAttachmentMimeType(file, kind);
  const base = {
    id: `att-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: file.name || `attachment.${kind}`,
    kind,
    mimeType,
    size: file.size || 0
  };

  if (kind === "text") {
    const text = await file.text();
    return {
      ...base,
      text: text.slice(0, 16000)
    };
  }

  const dataUrl = await readFileAsDataUrl(file);
  if (kind === "image") return productUX.editAttachment({ ...base, dataUrl });
  const data = splitDataUrl(dataUrl).data;
  return {
    ...base,
    data,
    dataUrl: kind === "image" ? dataUrl : ""
  };
}

function bindChatFileDropTarget(target) {
  if (!target) return;
  let dragResetTimer = null;

  const showDropState = () => {
    window.clearTimeout(dragResetTimer);
    target.classList.add("is-dragging-file");
    dragResetTimer = window.setTimeout(() => target.classList.remove("is-dragging-file"), 150);
  };
  const clearDropState = () => {
    window.clearTimeout(dragResetTimer);
    target.classList.remove("is-dragging-file");
  };

  target.addEventListener("dragenter", (event) => {
    if (!chatDropPayloadAvailable(event.dataTransfer) || chatOperationActive()) return;
    event.preventDefault();
    showDropState();
  });

  target.addEventListener("dragover", (event) => {
    if (!chatDropPayloadAvailable(event.dataTransfer) || chatOperationActive()) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    showDropState();
  });

  target.addEventListener("drop", async (event) => {
    if (!chatDropPayloadAvailable(event.dataTransfer) || chatOperationActive()) return;
    event.preventDefault();
    event.stopPropagation();
    clearDropState();
    await addChatDroppedDataTransfer(event.dataTransfer);
  });

  target.addEventListener("dragleave", (event) => {
    if (!target.contains(event.relatedTarget)) clearDropState();
  });
}

async function addChatDroppedDataTransfer(dataTransfer) {
  const files = chatDataTransferFiles(dataTransfer);
  if (files.length) {
    await addChatFiles(files);
    return;
  }

  const droppedUrl = chatDroppedUrl(dataTransfer).trim();
  if (droppedUrl.startsWith("data:image/")) {
    const file = fileFromDataUrl(droppedUrl);
    if (file) {
      await addChatFiles([file]);
      return;
    }
  }

  state.status = droppedUrl.startsWith("file:")
    ? "Browser image tabs cannot expose local file contents. Drop the original file here or use the folder button."
    : "Drop an image, PDF, Markdown, or text file here.";
  render({ preserveScroll: true });
}

async function addChatFiles(files = []) {
  const selectedFiles = Array.from(files).filter(Boolean);
  if (!selectedFiles.length || chatOperationActive() || state.photoImportPending) return;
  state.photoImportPending = true;

  try {
    let loadedTranscript = false;
    const nextAttachments = [];
    for (const file of selectedFiles) {
      const kind = chatFileKind(file);
      if (!kind) throw new Error(`${file.name || "File"} is not supported. Use image, PDF, Markdown, or text files.`);

      if (kind === "text" && selectedFiles.length === 1) {
        const text = await file.text();
        if (isChatTranscriptText(text)) {
          await loadChatText(text);
          loadedTranscript = true;
          continue;
        }
        nextAttachments.push({
          id: `att-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: file.name || "notes.txt",
          kind,
          mimeType: chatAttachmentMimeType(file, kind),
          size: file.size || 0,
          text: text.slice(0, 16000)
        });
      } else {
        const attachment = await createChatAttachment(file);
        if (attachment) nextAttachments.push(attachment);
      }
    }

    if (nextAttachments.length + state.chatAttachments.length > CHAT_ATTACHMENT_MAX_FILES) {
      throw new Error(`Attach up to ${CHAT_ATTACHMENT_MAX_FILES} files at a time.`);
    }

    state.chatAttachments = [...state.chatAttachments, ...nextAttachments];
    if (!loadedTranscript) {
      state.chatOpen = true;
      state.status = `${selectedFiles.length} file${selectedFiles.length === 1 ? "" : "s"} attached to chat`;
      render({ preserveScroll: true });
    }
  } catch (error) {
    state.status = error.message || "File attach failed.";
    render({ preserveScroll: true });
  } finally { state.photoImportPending = false; }
}

function removeChatAttachment(id) {
  state.chatAttachments = state.chatAttachments.filter((attachment) => attachment.id !== id);
  state.status = state.chatAttachments.length ? "File removed from chat" : "No attached chat files";
  render({ preserveScroll: true });
}

function chatAttachmentDisplayText(attachments = []) {
  if (!attachments.length) return "";
  return [
    "Attached files:",
    ...attachments.map((attachment) => `- ${attachment.name} (${attachment.mimeType || attachment.kind})`)
  ].join("\n");
}

async function loadChatFile() {
  if (state.busy === "chat") return;

  try {
    if ("showOpenFilePicker" in window) {
      try {
        const handles = await window.showOpenFilePicker({
          multiple: true,
          types: [
            {
              description: "Chat files",
              accept: {
                "text/markdown": [".md"],
                "text/plain": [".txt"],
                "image/png": [".png"],
                "image/jpeg": [".jpg", ".jpeg"],
                "image/webp": [".webp"],
                "image/gif": [".gif"],
                "application/pdf": [".pdf"]
              }
            }
          ]
        });
        const files = await Promise.all(handles.map((handle) => handle.getFile()));
        await addChatFiles(files);
        return;
      } catch (error) {
        if (error?.name === "AbortError") throw error;
      }
    }

    document.querySelector("#chatLoadFileInput")?.click();
  } catch (error) {
    if (error?.name === "AbortError") return;
    state.status = error.message || "Chat load failed.";
    render();
  }
}

async function loadChatFromFileInput(event) {
  const files = Array.from(event.currentTarget?.files || []);
  if (!files.length) return;

  try {
    await addChatFiles(files);
  } catch (error) {
    state.status = error.message || "Chat load failed.";
    render();
  } finally {
    event.currentTarget.value = "";
  }
}

async function sendChat({ deep = false } = {}) {
  const input = document.querySelector("#chatInput");
  let text = input?.value.trim() || state.chatDraft.trim() || "";
  const attachments = state.chatAttachments.slice();
  if (!text && attachments.length) text = "Please review the attached file.";
  if ((!text && !attachments.length) || chatOperationActive() || state.photoImportPending) return;
  if (state.photoConfirmPending) return;
  const sendingSettings = structuredClone(state.settings);
  if (attachments.some(item => item.kind === "image")) {
    const identity = imageRequestIdentity(sendingSettings, attachments);
    state.photoConfirmPending = true;
    try {
      if (!await productUX.confirmImages(attachments, sendingSettings)) return;
      if (identity !== imageRequestIdentity(state.settings, state.chatAttachments) || chatOperationActive()) throw new Error("Images or AI destinations changed. Review the request again.");
    } catch (error) { state.status = error.message; render({ preserveScroll: true }); return; }
    finally { state.photoConfirmPending = false; }
  }
  const displayText = [deep ? `Deep: ${text}` : text, chatAttachmentDisplayText(attachments)].filter(Boolean).join("\n\n");
  const conversation = deep ? buildDeepResearchConversationContext() : null;
  const userMessage = deep ? [
    "Deep research request. Read every page provided, compare sources, and write a structured report: summary, key findings with dates, what the official settlement source says, what is still uncertain, and the sources you used. Market information only, not financial advice.",
    conversation?.text ? `Recent chat for background:\n${conversation.text}` : "",
    `Research question: ${text}`
  ].filter(Boolean).join("\n\n") : text;

  const chatController = new AbortController();
  state.chatRunController = chatController;
  let pendingMessage;
  try {
  state.chatLog = await appendChatMessage({ role: "user", text: displayText });
  state.chatLog = await appendChatMessage({
    role: "assistant",
    text: "Preparing your market question or condition draft",
    provider: "thinking",
    pending: true
  });
  pendingMessage = state.chatLog.at(-1);
  if (input) input.value = "";
  state.chatDraft = "";
  state.chatAttachments = [];
  resizeChatInput(input);
  state.busy = "chat";
  render();

    if (!deep && await tryHandleChatAppAction(text, pendingMessage, { signal: chatController.signal })) return;
    if (!deep && await tryHandleScannerChatCommand(text, pendingMessage, { signal: chatController.signal, attachments, requestSettingsOverride: sendingSettings })) return;
    if (!deep && !attachments.some(item => item.kind === "image") && await tryHandleKALSHIMarketChatQuestion(text, pendingMessage, { signal: chatController.signal })) return;

    // A ticker in the question brings its live snapshot, so "Why did X move?" is answered from real prices.
    const mentionedTickers = deep ? [] : parseChatMarketSymbols(text).slice(0, 5);
    const mentionedMarkets = mentionedTickers.length
      ? await getTickerSnapshot(mentionedTickers, { signal: chatController.signal, settings: state.settings?.KALSHI || {} })
        .then((rows) => rows.map((row) => ({ ticker: row.symbol, title: row.marketTitle, yesOutcome: row.yesOutcome, yesBid: row.yesBid, yesAsk: row.yesAsk,
          last: row.last, previousDayPrice: row.previousPrice, changePctVsPreviousDay: row.priceChangePct, volume24h: row.volume24h,
          openInterest: row.openInterest, closeTime: row.closeTime, rules: String(row.rulesSummary || "").slice(0, 600) })))
        .catch((error) => { if (isAbortError(error)) throw error; return []; })
      : [];
    // "Is X likely to settle YES?" is answered from how its series settled before, not from the price alone.
    let marketHistory = null;
    if (mentionedMarkets.length && CHAT_HISTORY_INTENT.test(text)) {
      state.chatLog = await updateChatMessage(pendingMessage?.id, { text: `Checking past settlements for ${mentionedMarkets[0].ticker}...`, provider: "thinking", pending: true });
      render();
      marketHistory = await getMarketEvidence(mentionedMarkets[0].ticker, { events: 20, signal: chatController.signal })
        .then((evidence) => ({ ...evidence, recent_events: evidence.recent_events.slice(0, 5) }))
        .catch((error) => { if (isAbortError(error)) throw error; return null; });
    }
    const recentAlerts = (state.scannerAlerts || []).slice(-10).reverse()
      .map((alert) => ({ market: alert.symbol, title: alert.title, at: alert.createdAt, conditions: alert.recipeFormula, read: Boolean(alert.readAt) }));
    const ask = (draftSignal) => answerChat({
      userMessage,
      settings: sendingSettings,
      contextItem: state.selected,
      relatedItems: state.briefingItems,
      attachments,
      brokerContext: { ...currentBrokerContextPackage({
        includeConditionResults: false,
        includeScannerLabRecipe: false
      }), draftSignal, recentAlerts, ...(mentionedMarkets.length ? { mentionedMarkets } : {}), ...(marketHistory ? { marketHistory } : {}) },
      useWeb: false,
      browse: isBrowserResearchOn(sendingSettings)
        ? { sites: browserResearchSites(sendingSettings), run: runBrowserResearch, ...(deep ? { deep: true, maxSearches: DEEP_MAX_SEARCHES } : {}) }
        : null,
      signal: chatController.signal,
      onStatus: async (statusText) => {
        state.chatLog = await updateChatMessage(pendingMessage?.id, {
          text: statusText,
          provider: "thinking",
          pending: true
        });
        render();
      }
    });
    let result = await ask(!deep);
    // The keyword check misses many phrasings and languages; the chat model flags market searches itself.
    const signalText = String(result.text || "").trim().replace(/[.`*"]/g, "");
    if (!deep && signalText === SCANNER_DRAFT_SIGNAL) {
      if (await tryHandleScannerChatCommand(text, pendingMessage, { signal: chatController.signal, attachments, requestSettingsOverride: sendingSettings, force: true })) return;
      result = await ask(false);
    } else if (!deep && (signalText === WATCHLIST_ADD_SIGNAL || signalText === WATCHLIST_REMOVE_SIGNAL)) {
      // Watchlist requests in any language arrive as a signal from the chat model.
      if (await tryHandleChatAppAction(text, pendingMessage, { signal: chatController.signal, action: signalText === WATCHLIST_ADD_SIGNAL ? "add" : "remove" })) return;
      result = await ask(false);
    }
    state.chatLog = await updateChatMessage(pendingMessage?.id, {
      text: result.text + browserResearchFootnote(result.web),
      provider: state.settings.aiConnections?.find((connection) => connection.id === result.connectionId)?.label || result.provider,
      pending: false
    });
  } catch (error) {
    const stopped = isAbortError(error) || chatController.signal.aborted;
    state.chatLog = await updateChatMessage(pendingMessage?.id, {
      text: stopped ? "Stopped." : error.message || "Chat failed.",
      provider: stopped ? "stopped" : "error",
      pending: false
    });
    if (stopped) state.status = "Chat operation stopped.";
    if (!stopped) state.chatAttachments = attachments;
  } finally {
    if (state.chatRunController === chatController) state.chatRunController = null;
    state.busy = "";
    render();
  }
}

function updateDeepResearchButtonState(input = document.querySelector("#chatInput")) {
  const button = document.querySelector("#deepResearchButton");
  if (!button) return;
  const prompt = input?.value.trim() || "";
  const deepHealth = deepResearchKeyHealth(state.settings);
  const chatRunning = chatOperationActive();
  const canStart = deepHealth.ready && Boolean(prompt) && !chatRunning;
  button.disabled = chatRunning;
  button.dataset.deepControl = canStart ? "start" : "explain";
  button.textContent = "Deep";
  button.classList.toggle("is-ready", canStart);
  button.classList.toggle("is-off", !canStart);
  button.title = canStart
    ? "Deep: search more pages in your browser and write a longer report"
    : deepHealth.ready
      ? "Type a research question before using Deep"
      : "Deep setup and usage";
}

function handleDeepResearchButtonClick() {
  if (state.chatAttachments.some(item => item.kind === "image")) {
    state.status = "Use Send to review and transmit attached photographs. Deep does not receive these photographs.";
    render({ preserveScroll: true }); return;
  }
  if (chatOperationActive()) return;
  const deepHealth = deepResearchKeyHealth(state.settings);
  if (!deepHealth.ready) {
    openDeepResearchInfo(deepHealth.aiReady ? "browser" : "ai");
    return;
  }
  const prompt = document.querySelector("#chatInput")?.value.trim() || "";
  if (!prompt) {
    openDeepResearchInfo("prompt");
    return;
  }
  void sendChat({ deep: true });
}

function openDeepResearchInfo(reason = "prompt") {
  state.deepInfoModal = reason;
  render({ preserveScroll: true });
}

async function createGroup() {
  const input = document.querySelector("#groupNameInput");
  const beforeIds = new Set(state.groups.map((group) => group.id));
  state.groups = await createSavedGroup(input?.value || "");
  const created = state.groups.find((group) => !beforeIds.has(group.id));
  if (created) state.savedGroupId = created.id;
  state.groupDialogOpen = false;
  state.status = created ? "Group created" : "";
  render();
}

async function createAndSaveGroup() {
  const input = document.querySelector("#saveGroupNameInput");
  const beforeIds = new Set(state.groups.map((group) => group.id));
  state.groups = await createSavedGroup(input?.value || "");
  const created = state.groups.find((group) => !beforeIds.has(group.id));
  if (!created) return;
  await saveTargetToGroup(created.id);
}

async function saveTargetToGroup(groupId) {
  if (!state.saveTarget?.item) return;
  state.savedItems = await saveNewsItem(state.saveTarget.item, groupId || DEFAULT_GROUP.id);
  state.savedGroupId = groupId || DEFAULT_GROUP.id;
  state.saveTarget = null;
  state.status = "Saved";
  render();
}

async function saveNoteForTarget() {
  const item = state.noteTarget;
  const text = document.querySelector("#savedNoteInput")?.value.trim() || "";
  if (!item || !text) {
    state.status = text ? "" : "Write a note first";
    render();
    return;
  }

  const notes = [
    ...(Array.isArray(item.notes) ? item.notes : []),
    {
      id: `note-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text,
      createdAt: new Date().toISOString()
    }
  ].slice(-50);
  state.savedItems = await updateSavedNewsItem(item, { notes });
  state.noteTarget = null;
  state.status = "Note saved";
  render();
}

function closeModal() {
  state.saveTarget = null;
  state.noteTarget = null;
  state.groupDialogOpen = false;
  state.deepInfoModal = "";
  state.chatSwitchTarget = null;
  state.chatClearConfirm = false;
  state.subscriptionModal = "";
  state.brokerInfoModal = "";
  state.chatInfoModal = false;
  state.researchTarget = null;
  render({ preserveScroll: true });
}

function handleSubscriptionAction(action) {
  if (action === "checkout") {
    state.subscriptionModal = "plan";
    render({ preserveScroll: true });
    return;
  }

  if (action === "manage") {
    state.subscriptionModal = "plan";
    render({ preserveScroll: true });
    return;
  }

  if (action === "privacy") {
    state.subscriptionModal = "privacy";
    render({ preserveScroll: true });
    return;
  }

  if (action === "help") {
    state.subscriptionModal = "help";
    render({ preserveScroll: true });
    ensureHelpTranslation();
    return;
  }

  if (action === "policy") {
    const opened = openConfiguredUrl(configuredPrivacyPolicyUrl(state.settings), "Privacy Policy URL is not connected yet.");
    if (!opened) render({ preserveScroll: true });
    return;
  }

  state.subscriptionModal = "plan";
  render({ preserveScroll: true });
}

function openConfiguredUrl(url, fallbackStatus = "") {
  const safeUrl = String(url || "").trim();
  if (!safeUrl) {
    if (fallbackStatus) state.status = fallbackStatus;
    return false;
  }
  window.open(safeUrl, "_blank", "noopener,noreferrer");
  return true;
}

// Older installs saved the policy link in settings; that repo is now private, so the current link always wins.
function configuredPrivacyPolicyUrl() {
  return PRIVACY_POLICY_URL;
}

async function refreshLocalAgentStatus({ settings = state.settings, silent = false } = {}) {
  const targetSettings = settings || state.settings || {};
  if (!targetSettings.localAgentEnabled) {
    state.localAgentStatus = localAgentDisabledStatus();
    if (!silent) render({ preserveScroll: true });
    return state.localAgentStatus;
  }

  state.localAgentStatus = {
    ...state.localAgentStatus,
    state: "checking",
    label: "Checking",
    detail: "Checking Local Agent..."
  };
  if (!silent) render({ preserveScroll: true });

  const result = await checkLocalAgent(targetSettings);
  state.localAgentStatus = result;
  if (!silent && !state.loading) render({ preserveScroll: true });
  if (silent && !state.loading) render({ preserveScroll: true });
  return result;
}

function readLocalAgentSettingsFromDom() {
  return {
    localAgentEnabled: Boolean(document.querySelector("#settingLocalAgentEnabled")?.checked),
    localAgentUrl: normalizeLocalAgentUrl(document.querySelector("#settingLocalAgentUrl")?.value),
    localAgentAiTaggingEnabled: true
  };
}

function settingsFormIsMounted() {
  return Boolean(document.querySelector("#saveSettingsButton"));
}

function readSettingsDraftFromDom(current = state.settings || {}) {
  const next = readAISettingsDraft(current);
  next.language = "English"; next.autoTranslate = false;
  const appearance = document.querySelector("input[name='appearanceMode']:checked")?.value;
  if (appearance) next.appearance = appearance;

  if (document.querySelector("#settingMcpBridgeEnabled")) {
    next.mcpBridgeEnabled = Boolean(document.querySelector("#settingMcpBridgeEnabled").checked);
    next.mcpBridgePort = mcpBridgePort({ mcpBridgePort: document.querySelector("#settingMcpBridgePort")?.value });
    next.mcpServerFolder = String(document.querySelector("#settingMcpServerFolder")?.value || "").trim();
  }

  if (document.querySelector("#settingLocalAgentEnabled") || document.querySelector("#settingLocalAgentUrl")) {
    Object.assign(next, readLocalAgentSettingsFromDom());
  }

  if (document.querySelector("#settingKALSHIApiKey") || document.querySelector("#settingKALSHIApiSecret")) {
    next.KALSHI = normalizeKALSHISettingsForSave(readKALSHISettingsFromDom(), current.KALSHI || {});
  }

  return next;
}

function captureSettingsDraftFromDom() {
  if (!settingsFormIsMounted()) return state.settings || {};
  const next = readSettingsDraftFromDom(state.settings || {});
  state.settings = next;
  return next;
}

function readKALSHISettingsFromDom() {
  const current = state.settings?.KALSHI || {};
  const marketScope = current.marketScope || state.brokerCondition?.marketScope || "open_markets";
  const apiKey = document.querySelector("#settingKALSHIApiKey")?.value.trim() || "";
  const apiSecret = document.querySelector("#settingKALSHIApiSecret")?.value.trim() || "";
  const keyChanged = apiKey !== current.apiKey || apiSecret !== current.apiSecret;
  return {
    ...current,
    environment: "auto",
    apiKey,
    apiSecret,
    accountMode: "auto",
    detectedAccountMode: keyChanged ? "" : current.detectedAccountMode || "",
    marketDataFeed: "rest",
    readOnlyConfirmed: Boolean(document.querySelector("#settingKALSHIReadOnly")?.checked),
    includePortfolioContext: Boolean(document.querySelector("#settingKALSHIContextOptIn")?.checked),
    marketScope: marketScopeById(marketScope).id
  };
}

function normalizeKALSHISettingsForSave(next = {}, current = {}) {
  const hasCredentials = Boolean(next.apiKey && next.apiSecret);
  const keyChanged = next.apiKey !== current.apiKey || next.apiSecret !== current.apiSecret;
  const connectionInputsChanged = keyChanged || next.readOnlyConfirmed !== current.readOnlyConfirmed;
  const base = {
    ...next,
    accountMode: "auto",
    environment: "auto",
    detectedAccountMode: keyChanged ? "" : next.detectedAccountMode || "",
    marketDataFeed: "rest"
  };
  if (!hasCredentials) {
    return {
      ...base,
      detectedAccountMode: "",
      connectionStatus: "not_configured",
      connectionMessage: "Public Kalshi market data works without an API key. Add Key ID and RSA Private Key only for optional read-only private snapshots and WebSocket readiness.",
      connectionCheckedAt: ""
    };
  }
  if (!next.readOnlyConfirmed) {
    return {
      ...base,
      connectionStatus: "read_only_unconfirmed",
      connectionMessage: "Tick \"I confirm these Kalshi credentials are used only for read-only observation\" above, then press Test Connection again.",
      connectionCheckedAt: ""
    };
  }
  if (!connectionInputsChanged) return base;
  return {
    ...base,
    connectionStatus: "not_tested",
    connectionMessage: "Saved. Test Connection will auto-detect whether this Kalshi key belongs to Production or Demo.",
    connectionCheckedAt: ""
  };
}

async function persistSettings() {
  if (state.settingsSaving) return;
  state.settingsSaving = true;
  const saveButton = document.querySelector("#saveSettingsButton");
  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "Saving...";
  }

  try {
    const nextSettings = readSettingsDraftFromDom(state.settings || {});
    state.settings = nextSettings;

    state.settings = await saveSettings(nextSettings);
    stopPortfolioAutoRefresh({ silent: true });
    state.brokerPortfolioSnapshot = null;
    state.brokerPortfolioUpdatedAt = "";
    state.localAgentStatus = state.settings.localAgentEnabled
      ? await checkLocalAgent(state.settings)
      : localAgentDisabledStatus();

    state.status = "Settings saved";
    state.settingsSaveResult = { tone: "ok", text: `Settings saved at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.` };
  } catch (error) {
    state.status = error.message || "Settings save failed.";
    state.settingsSaveResult = { tone: "warn", text: state.status };
  } finally {
    state.settingsSaving = false;
    render({ preserveScroll: true });
  }
}

function readChatProvidersFromDom() {
  const existing = getChatProviders(state.settings || {});
  return [0, 1, 2].map((index) => {
    const providerId = document.querySelector(`.settingChatProvider[data-slot="${index}"]`)?.value || existing[index]?.provider || "none";
    const provider = getAiProvider(providerId);
    const model = readChatModelFromDom(index, existing[index], provider);
    const baseUrl = document.querySelector(`.settingBaseUrl[data-slot="${index}"]`)?.value.trim()
      || existing[index]?.baseUrl
      || defaultBaseUrlForProvider(provider.id);
    return {
      provider: provider.id,
      apiKey: document.querySelector(`.settingChatKey[data-slot="${index}"]`)?.value.trim() || existing[index]?.apiKey || "",
      model,
      baseUrl,
      localHost: provider.kind === "local" ? baseUrl || "http://localhost:11434" : existing[index]?.localHost || "http://localhost:11434",
      localModel: provider.kind === "local" ? model || "llama3.1" : existing[index]?.localModel || "llama3.1",
      customModel: document.querySelector(`.settingChatModelSelect[data-slot="${index}"]`)?.value === CUSTOM_MODEL_VALUE
    };
  });
}

function readChatModelFromDom(index, existing, provider) {
  const selectedModel = document.querySelector(`.settingChatModelSelect[data-slot="${index}"]`)?.value;
  const customModel = document.querySelector(`.settingChatModelCustom[data-slot="${index}"]`)?.value.trim();
  if (selectedModel && selectedModel !== CUSTOM_MODEL_VALUE) return selectedModel;
  return customModel || existing?.model || defaultModelForProvider(provider.id);
}

function findItem(id, pool) {
  const source = pool === "saved" ? state.savedItems : state.briefingItems;
  return source.find((item) => String(item.id) === String(id));
}

function isSelected(item) {
  return state.selected && String(state.selected.id) === String(item.id);
}

function scrollChatToBottom() {
  const log = document.querySelector("#panelChatLog");
  if (log) log.scrollTop = log.scrollHeight;
}




