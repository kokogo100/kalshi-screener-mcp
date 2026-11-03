import { conditionLabel } from "./condition-builder.js";
import { marketScopeById } from "./market-scopes.js";
import { KALSHI_READ_ONLY_BOUNDARY, sanitizeKALSHISettings } from "./kalshi-adapter.js";

export function buildBrokerContextPackage({
  settings = {},
  selectedItem = null,
  conditionRow = null,
  conditionResults = [],
  watchlist = [],
  portfolioSnapshot = null
} = {}) {
  const KALSHI = sanitizeKALSHISettings(settings.KALSHI || {});
  const scope = marketScopeById(conditionRow?.marketScope || KALSHI.marketScope);
  const includePortfolio = KALSHI.includePortfolioContext === true && portfolioSnapshot;
  return {
    product: "Kalshi Screener",
    readOnly: true,
    apiSecretsIncluded: false,
    accountConnectionIncluded: false,
    brokerLinkIncluded: false,
    policyBoundary: KALSHI_READ_ONLY_BOUNDARY,
    KALSHI,
    selectedBriefing: selectedItem
      ? {
        id: selectedItem.id,
        title: selectedItem.title,
        source: selectedItem.source,
        url: selectedItem.url
      }
      : null,
    marketScope: {
      id: scope.id,
      label: scope.label,
      estimatedSymbols: scope.estimatedSymbols,
      estimatedScanTime: scope.estimatedScanTime
    },
    condition: conditionRow ? conditionLabel(conditionRow) : "",
    conditionResults: conditionResults.slice(0, 20).map((result) => ({
      marketTicker: result.marketTicker || result.symbol,
      symbol: result.marketTicker || result.symbol,
      eventTicker: result.eventTicker || "",
      seriesTicker: result.seriesTicker || "",
      eventTitle: result.eventTitle || "",
      marketTitle: result.marketTitle || "",
      marketType: result.marketType || "",
      yesOutcome: result.yesOutcome || "YES",
      noOutcome: result.noOutcome || "NO",
      scope: result.scope,
      formula: result.formula,
      ruleLetter: result.ruleLetter,
      match: result.matchedRule || result.match,
      note: result.note,
      source: result.source,
      observedAt: result.observedAt,
      last: result.last,
      yesBid: result.yesBid ?? result.bid,
      yesAsk: result.yesAsk ?? result.ask,
      noBid: result.noBid,
      noAsk: result.noAsk,
      priceChangePct: result.priceChangePct,
      volume24h: result.volume24h,
      quoteVolume24h: result.quoteVolume24h,
      liquidity: result.liquidity,
      openInterest: result.openInterest,
      spreadPct: result.spreadPct,
      status: result.status || "",
      closeTime: result.closeTime || "",
      rulesSummary: String(result.rulesSummary || "").slice(0, 700),
      settlementSource: result.settlementSource || "",
      result: result.result || "",
      canCloseEarly: result.canCloseEarly === true,
      relatedMarketCount: result.relatedMarketCount,
      isMultivariate: result.isMultivariate === true
    })),
    watchlist: normalizeWatchlistContext(watchlist),
    portfolioSnapshot: includePortfolio ? sanitizePortfolioSnapshot(portfolioSnapshot) : null
  };
}

function normalizeWatchlistContext(watchlist = []) {
  return (Array.isArray(watchlist) ? watchlist : []).slice(0, 50).map((entry) => {
    const source = entry && typeof entry === "object" ? entry : { marketTicker: entry };
    const marketTicker = String(source.marketTicker || source.symbol || source.ticker || "").trim();
    return {
      marketTicker,
      symbol: marketTicker,
      eventTicker: String(source.eventTicker || ""),
      seriesTicker: String(source.seriesTicker || ""),
      eventTitle: String(source.eventTitle || ""),
      marketTitle: String(source.marketTitle || marketTicker),
      status: String(source.status || ""),
      closeTime: String(source.closeTime || ""),
      result: String(source.result || ""),
      canCloseEarly: source.canCloseEarly === true,
      relatedMarketCount: source.relatedMarketCount,
      savedAt: String(source.savedAt || "")
    };
  }).filter((entry) => entry.marketTicker);
}

function sanitizePortfolioSnapshot(snapshot = {}) {
  const positions = Array.isArray(snapshot.positions)
    ? snapshot.positions
    : Array.isArray(snapshot.holdings) ? snapshot.holdings : [];
  const sanitizedPositions = positions.slice(0, 30).map((position) => ({
    marketTicker: position.marketTicker || position.displayAsset || position.asset || "",
    position: position.rawAmount || contextValue(position.amount),
    avgPriceUsd: contextValue(position.avgEntryPriceUsd),
    markPriceUsd: contextValue(position.currentPriceUsd),
    exposureUsd: contextValue(position.currentValueUsd),
    realizedPnlUsd: contextValue(position.profitLossUsd)
  }));
  return {
    checkedAt: snapshot.checkedAt || "",
    accountType: snapshot.accountType || "",
    canTrade: snapshot.canTrade === true,
    summary: {
      portfolioValueUsd: contextValue(snapshot.summary?.portfolioValueUsd),
      equityUsd: contextValue(snapshot.summary?.equityUsd),
      cashUsd: contextValue(snapshot.summary?.cashUsd),
      buyingPowerUsd: contextValue(snapshot.summary?.buyingPowerUsd),
      totalMarketValueUsd: contextValue(snapshot.summary?.totalMarketValueUsd),
      totalProfitLossUsd: contextValue(snapshot.summary?.totalProfitLossUsd),
      totalProfitLossPct: contextValue(snapshot.summary?.totalProfitLossPct)
    },
    positions: sanitizedPositions,
    holdings: sanitizedPositions
  };
}

function contextValue(value) {
  if (value === undefined || value === null || value === "") return "";
  const number = Number(value);
  if (typeof value === "number" && !Number.isFinite(number)) return "";
  return String(value);
}
