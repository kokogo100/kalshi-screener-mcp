import { scannerRuleIndex, scannerRuleLetter } from "./scanner-types.js";

const FORMULA_OPERATOR_LABELS = new Map([
  ["and", "and"],
  ["or", "or"]
]);

export function defaultFormulaTokens(conditionCount = 1) {
  const count = Math.max(0, Math.floor(Number(conditionCount) || 0));
  const tokens = [];
  for (let index = 0; index < count; index += 1) {
    if (index > 0) tokens.push({ type: "operator", value: "and" });
    tokens.push({ type: "condition", letter: scannerRuleLetter(index) });
  }
  return tokens;
}

export function formulaText(tokens = []) {
  return normalizeFormulaTokens(tokens)
    .map((token) => {
      if (token.type === "condition") return token.letter;
      if (token.type === "operator") return FORMULA_OPERATOR_LABELS.get(token.value) || "and";
      if (token.type === "not") return "!";
      if (token.type === "paren") return token.value;
      return "";
    })
    .filter(Boolean)
    .join(" ")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")");
}

export function normalizeFormulaTokens(tokens = []) {
  return (Array.isArray(tokens) ? tokens : [])
    .map((token) => {
      if (token?.type === "condition") {
        const letter = String(token.letter || "").trim().toUpperCase();
        if (!/^[A-Z]$/.test(letter) || scannerRuleIndex(letter) < 0) throw new Error(`Invalid formula condition: ${letter}`);
        return { type: "condition", letter };
      }
      if (token?.type === "operator") {
        const value = String(token.value || "and").trim().toLowerCase();
        if (!FORMULA_OPERATOR_LABELS.has(value)) throw new Error(`Invalid formula operator: ${value}`);
        return { type: "operator", value };
      }
      if (token?.type === "not") return { type: "not" };
      if (token?.type === "paren" && (token.value === "(" || token.value === ")")) {
        return { type: "paren", value: token.value };
      }
      throw new Error(`Invalid formula token: ${token}`);
    })
    .filter(Boolean);
}

export function parseFormulaText(text = "") {
  const rawTokens = String(text || "")
    .replace(/&&/g, " && ")
    .replace(/\|\|/g, " || ")
    .replace(/\+/g, " + ")
    .replace(/\(/g, " ( ")
    .replace(/\)/g, " ) ")
    .replace(/!/g, " ! ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return rawTokens
    .map((token) => {
      const normalized = token.toLowerCase();
      if (normalized === "and" || normalized === "&&" || normalized === "+") return { type: "operator", value: "and" };
      if (normalized === "or" || normalized === "||") return { type: "operator", value: "or" };
      if (normalized === "not" || normalized === "!") return { type: "not" };
      if (token === "(" || token === ")") return { type: "paren", value: token };
      if (/^[A-Z]$/i.test(token)) return { type: "condition", letter: token.toUpperCase() };
      throw new Error(`Invalid formula token: ${token}`);
    })
    .filter(Boolean);
}

export function validateFormulaTokens(tokens = [], conditionCount = 0) {
  let normalizedTokens;
  try { normalizedTokens = normalizeFormulaTokens(tokens); } catch (error) {
    return { valid: false, message: error.message, tokens: [] };
  }
  const maxIndex = Math.max(0, Math.floor(Number(conditionCount) || 0)) - 1;
  if (!normalizedTokens.length) {
    return {
      valid: conditionCount <= 0,
      message: conditionCount > 0 ? "Formula is empty." : "No conditions to evaluate.",
      tokens: normalizedTokens
    };
  }

  let balance = 0;
  let previousType = "start";
  for (const token of normalizedTokens) {
    if (token.type === "condition") {
      const index = scannerRuleIndex(token.letter);
      if (index < 0 || index > maxIndex) {
        return { valid: false, message: `Unknown condition token ${token.letter}.`, tokens: normalizedTokens };
      }
      if (previousType === "condition" || previousType === "close") {
        return { valid: false, message: "Missing operator between conditions.", tokens: normalizedTokens };
      }
      previousType = "condition";
      continue;
    }

    if (token.type === "operator") {
      if (previousType !== "condition" && previousType !== "close") {
        return { valid: false, message: "Operator must follow a condition or closing parenthesis.", tokens: normalizedTokens };
      }
      previousType = "operator";
      continue;
    }

    if (token.type === "not") {
      if (previousType === "condition" || previousType === "close") {
        return { valid: false, message: "Not operator must appear before a condition or group.", tokens: normalizedTokens };
      }
      previousType = "not";
      continue;
    }

    if (token.type === "paren" && token.value === "(") {
      if (previousType === "condition" || previousType === "close") {
        return { valid: false, message: "Missing operator before opening parenthesis.", tokens: normalizedTokens };
      }
      balance += 1;
      previousType = "open";
      continue;
    }

    if (token.type === "paren" && token.value === ")") {
      if (balance <= 0) return { valid: false, message: "Closing parenthesis has no matching open.", tokens: normalizedTokens };
      if (previousType !== "condition" && previousType !== "close") {
        return { valid: false, message: "Closing parenthesis must follow a condition or group.", tokens: normalizedTokens };
      }
      balance -= 1;
      previousType = "close";
    }
  }

  if (balance !== 0) return { valid: false, message: "Formula has unclosed parentheses.", tokens: normalizedTokens };
  if (previousType !== "condition" && previousType !== "close") {
    return { valid: false, message: "Formula cannot end with an operator.", tokens: normalizedTokens };
  }
  return { valid: true, message: "Formula is valid.", tokens: normalizedTokens };
}

export function evaluateFormulaTokens(tokens = [], matches = []) {
  return evaluateFormulaState(tokens, matches) === true;
}

// null means unknown data; negation must never turn missing data into a match.
export function evaluateFormulaState(tokens = [], matches = []) {
  const normalizedTokens = normalizeFormulaTokens(tokens);
  if (!normalizedTokens.length) {
    if (matches.some((value) => value === false)) return false;
    return matches.some((value) => value === null) ? null : matches.every(Boolean);
  }

  const validation = validateFormulaTokens(normalizedTokens, matches.length);
  if (!validation.valid) return false;

  let cursor = 0;

  function parseExpression() {
    let value = parseTerm();
    while (current()?.type === "operator" && current().value === "or") {
      cursor += 1;
      const nextValue = parseTerm();
      value = value === true || nextValue === true ? true : value === null || nextValue === null ? null : false;
    }
    return value;
  }

  function parseTerm() {
    let value = parseFactor();
    while (current()?.type === "operator" && current().value === "and") {
      cursor += 1;
      const nextValue = parseFactor();
      value = value === false || nextValue === false ? false : value === null || nextValue === null ? null : true;
    }
    return value;
  }

  function parseFactor() {
    const token = current();
    if (!token) return false;
    if (token.type === "not") {
      cursor += 1;
      const value = parseFactor();
      return value === null ? null : !value;
    }
    if (token.type === "paren" && token.value === "(") {
      cursor += 1;
      const value = parseExpression();
      if (current()?.type === "paren" && current().value === ")") cursor += 1;
      return value;
    }
    if (token.type === "condition") {
      cursor += 1;
      const value = matches[scannerRuleIndex(token.letter)];
      return value === null || value === undefined ? null : Boolean(value);
    }
    cursor += 1;
    return false;
  }

  function current() {
    return normalizedTokens[cursor];
  }

  const result = parseExpression();
  return cursor >= normalizedTokens.length ? result : false;
}

export function insertFormulaGroup(tokens = [], fromIndex = 0, toIndex = 0) {
  const normalizedTokens = normalizeFormulaTokens(tokens);
  const start = Math.max(0, Math.min(fromIndex, toIndex));
  const end = Math.min(normalizedTokens.length - 1, Math.max(fromIndex, toIndex));
  if (start > end) return normalizedTokens;
  return [
    ...normalizedTokens.slice(0, start),
    { type: "paren", value: "(" },
    ...normalizedTokens.slice(start, end + 1),
    { type: "paren", value: ")" },
    ...normalizedTokens.slice(end + 1)
  ];
}
