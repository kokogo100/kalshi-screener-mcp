import { formatDate, getMarketLabel, getNewsTimestamp, getSentimentScore, getSource, getSummary, signalLabel } from "./format.js";

const MAX_RELATED_ITEMS = 8;
const TOKEN_PATTERN = /[\p{L}\p{N}]{3,}/gu;

function itemText(item) {
  return [
    item?.title,
    item?.summary,
    item?.verdict,
    item?.source,
    item?.category
  ].filter(Boolean).join(" ").toLowerCase();
}

function queryTerms(value) {
  return Array.from(new Set(String(value || "").toLowerCase().match(TOKEN_PATTERN) || []));
}

export function evidenceKind(score) {
  const value = Number(score || 0);
  if (value >= 5) return "bullish";
  if (value <= -5) return "bearish";
  return "neutral";
}

export function buildEvidenceMix(items = []) {
  const counts = { bullish: 0, neutral: 0, bearish: 0 };
  for (const item of items) {
    counts[evidenceKind(getSentimentScore(item))] += 1;
  }

  const total = counts.bullish + counts.neutral + counts.bearish;
  return {
    total,
    counts,
    ratios: {
      bullish: total ? Math.round((counts.bullish / total) * 100) : 0,
      neutral: total ? Math.round((counts.neutral / total) * 100) : 0,
      bearish: total ? Math.round((counts.bearish / total) * 100) : 0
    }
  };
}

export function formatEvidenceMix(mix) {
  if (!mix?.total) return "No loaded briefing signals available.";
  return [
    `Bullish ${mix.counts.bullish}/${mix.total} (${mix.ratios.bullish}%)`,
    `Neutral ${mix.counts.neutral}/${mix.total} (${mix.ratios.neutral}%)`,
    `Bearish ${mix.counts.bearish}/${mix.total} (${mix.ratios.bearish}%)`
  ].join(" | ");
}

export function searchBriefingItems(userMessage, contextItem, relatedItems = []) {
  const terms = queryTerms(`${userMessage || ""} ${contextItem?.title || ""}`);
  const selectedId = String(contextItem?.id || "");

  return relatedItems
    .filter((item) => item && String(item.id || "") !== selectedId)
    .map((item) => {
      const text = itemText(item);
      const matches = terms.reduce((count, term) => count + (text.includes(term) ? 1 : 0), 0);
      return { item, matches };
    })
    .sort((a, b) => b.matches - a.matches || Math.abs(getSentimentScore(b.item)) - Math.abs(getSentimentScore(a.item)))
    .slice(0, MAX_RELATED_ITEMS)
    .map((entry) => entry.item);
}

export function itemBrief(item) {
  if (!item) return "No selected item.";
  return [
    `Title: ${item.title || "Untitled"}`,
    `Signal: ${signalLabel(getSentimentScore(item))}`,
    `Market: ${getMarketLabel(item)}`,
    `Source: ${getSource(item)}`,
    `Time: ${formatDate(getNewsTimestamp(item))}`,
    `Summary: ${getSummary(item)}`,
    item.url ? `URL: ${item.url}` : ""
  ].filter(Boolean).join("\n");
}

export function relatedItemsBlock(items = []) {
  if (!items.length) return "No related loaded briefing items were found.";
  return items
    .map((item, index) => [
      `${index + 1}. ${item.title || "Untitled"}`,
      `Signal: ${signalLabel(getSentimentScore(item))}`,
      `Source: ${getSource(item)}`,
      `Summary: ${getSummary(item)}`,
      item.url ? `URL: ${item.url}` : ""
    ].filter(Boolean).join("\n"))
    .join("\n\n");
}

export function buildToolContext({ userMessage, contextItem, relatedItems = [], web = null, brokerContext = null }) {
  const localRelated = searchBriefingItems(userMessage, contextItem, relatedItems);
  const mixSource = localRelated.length ? [contextItem, ...localRelated].filter(Boolean) : relatedItems;
  const mix = buildEvidenceMix(mixSource);

  return [
    "Executed Kalshi Screener tools:",
    "",
    "[get_selected_item]",
    itemBrief(contextItem),
    "",
    "[search_briefing / get_related_items]",
    relatedItemsBlock(localRelated),
    "",
    "[evidence_mix]",
    formatEvidenceMix(mix),
    "",
    "[search_web]",
    `Provider: ${web?.provider || "none"}`,
    web?.error ? `Error: ${web.error}` : "",
    web?.results?.length ? "Results were supplied below by the host app." : "No external web results were supplied.",
    "",
    "[KALSHI_scanner_lab]",
    brokerContext
      ? JSON.stringify(brokerContext, null, 2)
      : "No Kalshi Scanner Lab context was supplied."
  ].filter(Boolean).join("\n");
}
