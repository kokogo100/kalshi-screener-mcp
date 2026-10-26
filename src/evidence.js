import { EVIDENCE_DEFAULTS, getMarketEvidence as coreMarketEvidence, wilsonRange } from "../core/shared/market-evidence.js";
import { compactMarket, defaultLink } from "./screener.js";

// The engine lives in the extension (synced into core/) so the chat and MCP tools give the same numbers.
export { EVIDENCE_DEFAULTS, wilsonRange };

export function getMarketEvidence(ticker, options = {}) {
  const { linkFor = defaultLink, ...rest } = options;
  return coreMarketEvidence(ticker, { ...rest, formatMarket: (row) => compactMarket(row, linkFor) });
}
