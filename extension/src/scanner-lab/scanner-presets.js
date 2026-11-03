import { defaultFormulaTokens, normalizeFormulaTokens } from "./scanner-formula.js";
import { normalizeConditionInstance } from "./scanner-parameters.js";
import { DEFAULT_SCANNER_SCOPE, createScannerId } from "./scanner-types.js";

export function createScannerPreset({ name = "", scope = DEFAULT_SCANNER_SCOPE, conditions = [], formulaTokens = [], resultColumns = [] } = {}) {
  const normalizedConditions = conditions.map(normalizeConditionInstance);
  const now = new Date().toISOString();
  return {
    id: createScannerId("scanner-preset"),
    name: String(name || presetNameFromConditions(normalizedConditions)).slice(0, 80),
    createdAt: now,
    updatedAt: now,
    brokerScope: String(scope || DEFAULT_SCANNER_SCOPE),
    conditionInstances: normalizedConditions,
    formulaTokens: normalizeFormulaTokens(formulaTokens.length ? formulaTokens : defaultFormulaTokens(normalizedConditions.length)),
    resultColumns: normalizeResultColumns(resultColumns),
    notes: ""
  };
}

export function normalizeScannerPreset(preset = {}) {
  const conditions = Array.isArray(preset.conditionInstances)
    ? preset.conditionInstances
    : Array.isArray(preset.conditions)
      ? preset.conditions
      : [];
  const normalizedConditions = conditions.map(normalizeConditionInstance);
  return {
    id: String(preset.id || createScannerId("scanner-preset")),
    name: String(preset.name || presetNameFromConditions(normalizedConditions)).slice(0, 80),
    createdAt: String(preset.createdAt || new Date().toISOString()),
    updatedAt: String(preset.updatedAt || preset.createdAt || new Date().toISOString()),
    brokerScope: String(preset.brokerScope || preset.scope || DEFAULT_SCANNER_SCOPE),
    conditionInstances: normalizedConditions,
    formulaTokens: normalizeFormulaTokens(preset.formulaTokens || defaultFormulaTokens(normalizedConditions.length)),
    resultColumns: normalizeResultColumns(preset.resultColumns),
    notes: String(preset.notes || "").slice(0, 1000)
  };
}

export function presetNameFromConditions(conditions = []) {
  const labels = conditions.map((condition) => condition.label).filter(Boolean);
  if (!labels.length) return "Scanner Lab preset";
  return labels.slice(0, 2).join(" + ");
}

export function normalizeResultColumns(columns = []) {
  const defaults = ["symbol", "last", "change_pct", "volume", "spread_pct", "matched_conditions", "updated_at"];
  const input = Array.isArray(columns) && columns.length ? columns : defaults;
  return [...new Set(input.map((column) => String(column || "").trim()).filter(Boolean))];
}
