export function removeSelectedUiFormulaParentheses(tokens = [], bounds = null) {
  const normalized = cloneUiFormulaTokens(tokens);
  const selected = normalizeBounds(bounds, normalized.length);
  if (!selected) return { tokens: normalized, changed: false };

  if (normalized[selected.start - 1]?.type === "open" && normalized[selected.end + 1]?.type === "close") {
    normalized.splice(selected.end + 1, 1);
    normalized.splice(selected.start - 1, 1);
    return { tokens: normalized, changed: true };
  }

  let changed = false;
  const nextTokens = normalized.filter((token, index) => {
    const selectedParen = index >= selected.start && index <= selected.end && (token.type === "open" || token.type === "close");
    if (selectedParen) changed = true;
    return !selectedParen;
  });
  return { tokens: nextTokens, changed };
}

export function deleteSelectedUiFormulaTokens(tokens = [], bounds = null) {
  const normalized = cloneUiFormulaTokens(tokens);
  const selected = normalizeBounds(bounds, normalized.length);
  if (!selected) return { tokens: normalized, changed: false, removedParenthesesOnly: false };

  const selectedTokens = normalized.slice(selected.start, selected.end + 1);
  const hasSelectedParentheses = selectedTokens.some((token) => token.type === "open" || token.type === "close")
    || (normalized[selected.start - 1]?.type === "open" && normalized[selected.end + 1]?.type === "close");

  if (hasSelectedParentheses) {
    const result = removeSelectedUiFormulaParentheses(normalized, selected);
    return { ...result, removedParenthesesOnly: result.changed };
  }

  normalized.splice(selected.start, selected.end - selected.start + 1);
  return { tokens: normalized, changed: true, removedParenthesesOnly: false };
}

function cloneUiFormulaTokens(tokens = []) {
  return (Array.isArray(tokens) ? tokens : []).map((token) => ({ ...token }));
}

function normalizeBounds(bounds, tokenCount = 0) {
  if (!bounds || !Number.isInteger(bounds.start) || !Number.isInteger(bounds.end) || tokenCount <= 0) return null;
  const start = Math.max(0, Math.min(bounds.start, bounds.end));
  const end = Math.min(tokenCount - 1, Math.max(bounds.start, bounds.end));
  return start <= end ? { start, end } : null;
}
