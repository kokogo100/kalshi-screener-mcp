export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function clampText(value, maxLength = 220) {
  const text = String(value ?? "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}...`;
}

export function signalKind(score) {
  const value = Number(score ?? 0);
  if (value >= 5) return "bullish";
  if (value <= -5) return "bearish";
  return "neutral";
}

export function signalLabel(score) {
  const value = Number(score ?? 0);
  const prefix = value > 0 ? "+" : "";
  const direction = signalKind(value);
  return `${prefix}${value} ${capitalize(direction)}`;
}

export function capitalize(value) {
  const text = String(value ?? "");
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : "";
}

export function formatDate(value) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function formatNumber(value, fractionDigits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: fractionDigits }).format(number);
}

export function getNewsTimestamp(item) {
  return item?.created_at || item?.collected_at || item?.createdAt || item?.collectedAt || "";
}

export function getSentimentScore(item) {
  return Number(item?.sentiment_score ?? item?.sentimentScore ?? 0);
}

export function getSource(item) {
  return item?.source || "Unknown source";
}

export function getSummary(item) {
  return item?.summary || item?.verdict || "No analysis summary available.";
}

export function getMarketLabel(item) {
  const text = `${item?.title || ""} ${item?.summary || ""} ${item?.source || ""}`.toLowerCase();
  if (text.includes("crypto") || text.includes("bitcoin") || text.includes("ethereum")) return "Crypto";
  if (text.includes("korea") || text.includes("kospi") || text.includes("samsung")) return "Korea";
  if (text.includes("japan") || text.includes("nikkei")) return "Japan";
  if (text.includes("ftse") || text.includes("uk ")) return "UK";
  return "US / Global";
}
