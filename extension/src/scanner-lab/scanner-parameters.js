import {
  DEFAULT_SCANNER_SCOPE,
  PARAMETER_FIELD_TYPES,
  createScannerId,
  normalizeDataRequirements,
  normalizeOperator,
  normalizePriceSource,
  normalizeTimeframe,
  scannerRuleLetter
} from "./scanner-types.js";

export function defaultParametersFromSchema(schema = []) {
  return (Array.isArray(schema) ? schema : []).reduce((params, field) => {
    if (!field?.name) return params;
    params[field.name] = normalizeParameterValue(field, field.defaultValue);
    return params;
  }, {});
}

export function normalizeTemplateParameters(template = {}, inputParameters = {}) {
  const defaults = {
    ...(template.defaultParameters || {}),
    ...defaultParametersFromSchema(template.parameterSchema)
  };
  const merged = { ...defaults, ...(inputParameters || {}) };
  const normalized = {};
  for (const field of template.parameterSchema || []) {
    normalized[field.name] = normalizeParameterValue(field, merged[field.name]);
  }
  Object.entries(merged).forEach(([key, value]) => {
    if (!(key in normalized)) normalized[key] = value;
  });
  if (normalized.timeframe) normalized.timeframe = normalizeTimeframe(normalized.timeframe);
  if (normalized.source) normalized.source = normalizePriceSource(normalized.source);
  if (normalized.operator) normalized.operator = normalizeOperator(normalized.operator);
  return normalized;
}

export function createConditionInstance(template = {}, inputParameters = {}, index = 0) {
  const parameters = normalizeTemplateParameters(template, inputParameters);
  const clauses = typeof template.buildClauses === "function"
    ? template.buildClauses(parameters)
    : buildDefaultClauses(template, parameters);
  return {
    id: createScannerId("condition"),
    letter: scannerRuleLetter(index),
    templateId: template.id || "",
    label: conditionInstanceLabel(template, parameters),
    categoryPath: Array.isArray(template.categoryPath) ? template.categoryPath : [],
    dataRequirement: normalizeDataRequirements(template.dataRequirement),
    supportPolicy: template.supportPolicy || "common",
    parameters,
    clauses,
    enabled: true
  };
}

export function normalizeConditionInstance(instance = {}, index = 0) {
  return {
    id: String(instance.id || createScannerId("condition")),
    letter: String(instance.letter || scannerRuleLetter(index)).slice(0, 2),
    templateId: String(instance.templateId || ""),
    label: String(instance.label || `Condition ${scannerRuleLetter(index)}`).slice(0, 160),
    categoryPath: Array.isArray(instance.categoryPath) ? instance.categoryPath.map(String) : [],
    dataRequirement: normalizeDataRequirements(instance.dataRequirement),
    supportPolicy: String(instance.supportPolicy || "common"),
    parameters: instance.parameters && typeof instance.parameters === "object" ? { ...instance.parameters } : {},
    clauses: Array.isArray(instance.clauses) ? instance.clauses.map(normalizeConditionClause) : [],
    enabled: instance.enabled !== false
  };
}

export function normalizeConditionClause(clause = {}) {
  const metric = String(clause.metric || "").trim();
  if (clause.operator && normalizeOperator(clause.operator) !== clause.operator) throw new Error(`Unsupported condition operator: ${clause.operator}`);
  if (clause.timeframe && normalizeTimeframe(clause.timeframe) !== clause.timeframe) throw new Error(`Unsupported condition timeframe: ${clause.timeframe}`);
  if (clause.source && normalizePriceSource(clause.source) !== clause.source) throw new Error(`Unsupported price source: ${clause.source}`);
  return {
    metric,
    operator: normalizeOperator(clause.operator || "gte"),
    value: clause.value,
    valueMax: clause.valueMax,
    compareTo: clause.compareTo || "",
    source: clause.source || "",
    timeframe: clause.timeframe ? normalizeTimeframe(clause.timeframe) : "",
    lookback: normalizePositiveInteger(clause.lookback, 0),
    offset: normalizePositiveInteger(clause.offset, 0),
    options: clause.options && typeof clause.options === "object" ? { ...clause.options } : {}
  };
}

export function conditionInstanceLabel(template = {}, parameters = {}) {
  if (typeof template.labelBuilder === "function") return template.labelBuilder(parameters);
  const title = template.title || template.label || "Condition";
  // Snapshot conditions ignore the candle timeframe, and "between 0.45" hid the upper bound.
  const snapshot = (template.dataRequirement || []).every((requirement) => ["ticker", "instrument"].includes(requirement));
  const timeframe = parameters.timeframe && !snapshot ? ` / ${parameters.timeframe}` : "";
  const operator = parameters.operator ? ` ${operatorLabel(parameters.operator)}` : "";
  const range = parameters.operator === "between" && parameters.valueMax !== undefined && parameters.valueMax !== "" ? `~${parameters.valueMax}` : "";
  const value = parameters.value !== undefined && parameters.value !== "" ? ` ${parameters.value}${range}` : "";
  return `${title}${timeframe}${operator}${value}`.trim();
}

export function buildDefaultClauses(template = {}, parameters = {}) {
  const metric = template.metric || parameters.metric;
  if (!metric) return [];
  return [{
    metric,
    operator: normalizeOperator(parameters.operator || template.operator || "gte"),
    value: parameters.value ?? template.value ?? "",
    valueMax: parameters.valueMax ?? template.valueMax,
    source: parameters.source || template.source || "",
    timeframe: parameters.timeframe || template.timeframe || "",
    lookback: parameters.lookback ?? template.lookback ?? 0,
    offset: parameters.offset ?? template.offset ?? 0,
    options: { ...(template.options || {}) }
  }].map(normalizeConditionClause);
}

export function scopeParameters(scopeId = DEFAULT_SCANNER_SCOPE) {
  return { scope: scopeId || DEFAULT_SCANNER_SCOPE };
}

function normalizeParameterValue(field = {}, value) {
  if (field.type === PARAMETER_FIELD_TYPES.NUMBER) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return Number(field.defaultValue ?? 0);
    const min = Number.isFinite(Number(field.min)) ? Number(field.min) : -Infinity;
    const max = Number.isFinite(Number(field.max)) ? Number(field.max) : Infinity;
    return Math.max(min, Math.min(max, parsed));
  }
  if (field.type === PARAMETER_FIELD_TYPES.BOOLEAN) return value === true || value === "true";
  if (field.type === PARAMETER_FIELD_TYPES.SELECT) {
    const choices = Array.isArray(field.choices) ? field.choices : [];
    const allowed = new Set(choices.map((choice) => String(choice.value ?? choice.id ?? choice)));
    const normalized = String(value ?? field.defaultValue ?? "");
    return allowed.size && !allowed.has(normalized)
      ? String(field.defaultValue ?? choices[0]?.value ?? choices[0]?.id ?? choices[0] ?? "")
      : normalized;
  }
  return String(value ?? field.defaultValue ?? "").slice(0, 160);
}

function normalizePositiveInteger(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.floor(parsed));
}

function operatorLabel(operator) {
  if (operator === "gte") return ">=";
  if (operator === "lte") return "<=";
  if (operator === "gt") return ">";
  if (operator === "lt") return "<";
  if (operator === "eq") return "=";
  return operator;
}
