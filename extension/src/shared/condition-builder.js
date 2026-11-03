import { CONDITION_METRICS, CONDITION_OPERATORS, TIMEFRAMES, marketScopeById } from "./market-scopes.js";

export function defaultConditionRow(scopeId = "open_markets") {
  return {
    id: `condition-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    marketScope: scopeId,
    timeframe: "1h",
    metric: "price_change_pct",
    operator: "gte",
    value: "3"
  };
}

export function normalizeConditionRow(row = {}, fallbackScope = "open_markets") {
  const operatorIds = new Set(CONDITION_OPERATORS.map((operator) => operator.id));
  const timeframe = TIMEFRAMES.includes(row.timeframe) ? row.timeframe : "1h";
  const scope = marketScopeById(row.marketScope || fallbackScope);
  return {
    id: String(row.id || `condition-${Date.now()}`),
    marketScope: scope.id,
    timeframe,
    metric: String(row.metric || "price_change_pct").trim() || "price_change_pct",
    operator: operatorIds.has(row.operator) ? row.operator : "gte",
    value: String(row.value ?? "3").trim().slice(0, 40),
    sourceTemplateId: String(row.sourceTemplateId || "").trim().slice(0, 80),
    sourceTemplateLabel: String(row.sourceTemplateLabel || "").trim().slice(0, 80),
    dataRequirement: Array.isArray(row.dataRequirement) ? row.dataRequirement.map(String) : [],
    scannerTemplateId: String(row.scannerTemplateId || "").trim().slice(0, 100),
    scannerParameters: row.scannerParameters && typeof row.scannerParameters === "object" ? { ...row.scannerParameters } : {},
    scannerClauses: Array.isArray(row.scannerClauses) ? row.scannerClauses.map((clause) => ({ ...clause })) : []
  };
}

export function conditionLabel(row = {}) {
  const normalized = normalizeConditionRow(row);
  const scope = marketScopeById(normalized.marketScope);
  const metric = CONDITION_METRICS.find((entry) => entry.id === normalized.metric);
  const operator = CONDITION_OPERATORS.find((entry) => entry.id === normalized.operator);
  const name = metric?.label || humanizeMetricId(normalized.metric);
  const boolean = normalized.operator === "is_true" || normalized.operator === "is_false";
  // Snapshot metrics and yes/no checks ignore the candle timeframe, so showing it only confused people.
  const parts = [scope.label, metric || boolean ? "" : normalized.timeframe, `${name} ${operator?.label || normalized.operator}${boolean ? "" : ` ${normalized.value}`}`];
  return parts.filter(Boolean).join(" / ");
}

// closes_within_24h -> Closes within 24h
function humanizeMetricId(id = "") {
  const text = String(id).replace(/_/g, " ").trim();
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

export function createConditionPreset(row = {}, name = "") {
  const condition = normalizeConditionRow(row);
  return {
    id: `preset-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: String(name || conditionLabel(condition)).slice(0, 80),
    createdAt: new Date().toISOString(),
    rows: [condition],
    logic: "AND"
  };
}
