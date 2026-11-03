import { formatDate, getMarketLabel, getNewsTimestamp, getSentimentScore, getSource, getSummary, signalLabel } from "./format.js";

const PROMPT_BRIEF = [
  "You are Kalshi Screener, an expert assistant for read-only Kalshi briefing, information, and news analysis.",
  "Analyze the selected story, the evidence pattern, possible scenarios, risks, and follow-up questions.",
  "Answer directly from the available evidence and name what still needs verification."
].join(" ");

export function buildNewsPrompt(item, relatedItems = []) {
  const related = relatedItems
    .filter((entry) => entry && entry.id !== item?.id)
    .slice(0, 4)
    .map((entry, index) => `${index + 1}. ${entry.title} (${signalLabel(getSentimentScore(entry))})`)
    .join("\n");

  return [
    PROMPT_BRIEF,
    "",
    "Review this Kalshi Screener information and news signal.",
    "",
    `Signal: ${signalLabel(getSentimentScore(item))}`,
    `Market: ${getMarketLabel(item)}`,
    `Source: ${getSource(item)}`,
    `Time: ${formatDate(getNewsTimestamp(item))}`,
    `Original headline: ${item?.title || "Untitled"}`,
    `AI insight: ${getSummary(item)}`,
    item?.url ? `Original URL: ${item.url}` : "",
    related ? `\nRelated signals:\n${related}` : "",
    "",
    "Please summarize the narrative, explain why this signal may matter, list key risks, and suggest neutral research questions."
  ]
    .filter(Boolean)
    .join("\n");
}

export async function copyPromptToClipboard(prompt) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(prompt);
    return true;
  }
  return false;
}

export async function openGeminiWithPrompt(prompt) {
  await copyPromptToClipboard(prompt).catch(() => false);
  window.open("https://gemini.google.com/app", "_blank", "noopener,noreferrer");
}
