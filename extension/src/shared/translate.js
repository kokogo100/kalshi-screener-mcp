const TRANSLATION_CACHE_LIMIT = 1000;
const TRANSLATION_BATCH_SIZE = 5;
const DEFAULT_SOURCE_LANGUAGE = "en";
const FIELD_TRANSLATION_TIMEOUT_MS = 5000;
const BRIEFING_TITLE_TIMEOUT_MS = 2500;
const ANALYSIS_TRANSLATION_TIMEOUT_MS = 12000;

const translatorCache = new Map();
const translationCache = new Map();
let detectorPromise = null;

export const TRANSLATION_LANGUAGES = [
  { name: "Arabic", code: "ar" },
  { name: "Bulgarian", code: "bg" },
  { name: "Bengali", code: "bn" },
  { name: "Czech", code: "cs" },
  { name: "Danish", code: "da" },
  { name: "German", code: "de" },
  { name: "Greek", code: "el" },
  { name: "English", code: "en" },
  { name: "Spanish", code: "es" },
  { name: "Finnish", code: "fi" },
  { name: "French", code: "fr" },
  { name: "Hindi", code: "hi" },
  { name: "Croatian", code: "hr" },
  { name: "Hungarian", code: "hu" },
  { name: "Indonesian", code: "id" },
  { name: "Italian", code: "it" },
  { name: "Hebrew", code: "iw" },
  { name: "Japanese", code: "ja" },
  { name: "Kannada", code: "kn" },
  { name: "Korean", code: "ko" },
  { name: "Lithuanian", code: "lt" },
  { name: "Marathi", code: "mr" },
  { name: "Dutch", code: "nl" },
  { name: "Norwegian", code: "no" },
  { name: "Polish", code: "pl" },
  { name: "Portuguese", code: "pt" },
  { name: "Romanian", code: "ro" },
  { name: "Russian", code: "ru" },
  { name: "Slovak", code: "sk" },
  { name: "Slovenian", code: "sl" },
  { name: "Swedish", code: "sv" },
  { name: "Tamil", code: "ta" },
  { name: "Telugu", code: "te" },
  { name: "Thai", code: "th" },
  { name: "Turkish", code: "tr" },
  { name: "Ukrainian", code: "uk" },
  { name: "Vietnamese", code: "vi" },
  { name: "Chinese", code: "zh" },
  { name: "Chinese (Traditional)", code: "zh-Hant" }
];

export const CHROME_TRANSLATOR_LANGUAGE_CODES = TRANSLATION_LANGUAGES.map((language) => language.code);
const CHROME_TRANSLATOR_LANGUAGE_CODE_SET = new Set(CHROME_TRANSLATOR_LANGUAGE_CODES);

const LANGUAGE_BY_NAME = new Map(TRANSLATION_LANGUAGES.map((language) => [language.name, language]));
const LANGUAGE_BY_CODE = new Map(TRANSLATION_LANGUAGES.map((language) => [language.code, language]));
const LANGUAGE_NAME_TO_CODE = new Map([
  ...TRANSLATION_LANGUAGES.map((language) => [language.name.toLowerCase(), language.code]),
  ["hebrew", "iw"],
  ["chinese traditional", "zh-Hant"],
  ["traditional chinese", "zh-Hant"],
  ["chinese simplified", "zh"],
  ["simplified chinese", "zh"]
]);

export function hasChromeTranslatorApi() {
  return typeof self !== "undefined" && "Translator" in self;
}

export function hasChromeLanguageDetectorApi() {
  return typeof self !== "undefined" && "LanguageDetector" in self;
}

export function translationTarget(settings = {}) {
  const browserTarget = getBrowserTranslationTarget();
  return browserTarget || LANGUAGE_BY_NAME.get("English");
}

export function isTranslationEnabled(settings = {}) {
  const target = translationTarget(settings);
  return Boolean(target?.code && target.code !== DEFAULT_SOURCE_LANGUAGE);
}

export function translationStatusLabel(settings = {}) {
  const target = translationTarget(settings);
  if (target?.code === DEFAULT_SOURCE_LANGUAGE) return "Original";
  if (!hasChromeTranslatorApi()) return "Unavailable";
  return target?.name || "Unknown";
}

export function browserLanguageLabel() {
  const target = getBrowserTranslationTarget();
  const locale = getBrowserLocale();
  return target ? `${target.name} (${locale})` : `Unsupported (${locale || "unknown"})`;
}

export async function translateNewsItems(items, settings, { kind = "briefing", onBatchReady } = {}) {
  if (!Array.isArray(items) || !items.length || !isTranslationEnabled(settings)) return items;
  if (!hasChromeTranslatorApi()) throw new Error("Chrome Translator API is not available in this browser.");

  const target = translationTarget(settings);
  const translated = [];

  for (const item of items) {
    translated.push(await translateNewsItem(item, target.code, kind));

    if (translated.length % TRANSLATION_BATCH_SIZE === 0 && typeof onBatchReady === "function") {
      onBatchReady(translated.slice());
      await yieldToUi();
    }
  }

  if (typeof onBatchReady === "function") onBatchReady(translated.slice());
  return translated;
}

export async function warmUpTranslation(settings = {}) {
  if (!isTranslationEnabled(settings) || !hasChromeTranslatorApi()) return;
  const target = translationTarget(settings);
  await getTranslator(DEFAULT_SOURCE_LANGUAGE, target.code);
}

export async function translateAnalysisText(text, settings = {}) {
  const target = translationTarget(settings);
  if (!target?.code || target.code === DEFAULT_SOURCE_LANGUAGE) {
    throw new Error("Analysis is already in English.");
  }
  if (!hasChromeTranslatorApi()) {
    throw new Error("Chrome Translator API is not available in this browser.");
  }

  const result = await translateItemField(text, target.code, "", {
    preferredSourceLanguage: DEFAULT_SOURCE_LANGUAGE,
    timeoutMs: ANALYSIS_TRANSLATION_TIMEOUT_MS
  });

  if (!result.translated) {
    throw new Error(`Translation is unavailable for English to ${target.name}.`);
  }

  return {
    text: result.text,
    sourceLanguage: result.sourceLanguage,
    targetLanguage: target.code,
    targetName: target.name
  };
}

export function primeTranslationModels(settings = {}, sourceLanguages = [DEFAULT_SOURCE_LANGUAGE]) {
  if (!isTranslationEnabled(settings) || !hasChromeTranslatorApi()) return Promise.resolve(false);

  const target = translationTarget(settings);
  const sources = Array.from(new Set(sourceLanguages
    .map(normalizeLanguageCode)
    .filter((sourceLanguage) => isSupportedTranslationSource(sourceLanguage, target.code))));

  if (!sources.length) return Promise.resolve(false);

  const tasks = sources.map((sourceLanguage) => getTranslator(sourceLanguage, target.code, { directCreate: true }));
  return Promise.allSettled(tasks).then((results) => results.some((result) => result.status === "fulfilled"));
}

async function translateNewsItem(item, targetLanguage, kind) {
  if (kind === "feed" && item?.translatedTo === targetLanguage) return item;

  const translated = { ...item };
  const sourceHint = resolveSourceLanguageHint(item, kind);
  const translatedFields = {};

  // Briefing summaries are upstream AI analysis from RagAlgo. Keep them as the
  // Supabase source of truth; Chrome's on-device translator can distort finance text.

  const titleResult = await translateItemField(item.title, targetLanguage, sourceHint, {
    timeoutMs: kind === "briefing" ? BRIEFING_TITLE_TIMEOUT_MS : FIELD_TRANSLATION_TIMEOUT_MS
  });
  translated.title = titleResult.text;
  if (titleResult.translated) translatedFields.title = titleResult.sourceLanguage;

  if (!Object.keys(translatedFields).length) return item;

  translated.translatedFrom = translatedFields;
  translated.translatedTo = targetLanguage;
  return translated;
}

async function translateItemField(text, targetLanguage, sourceHint = "", { preferredSourceLanguage = "", timeoutMs = FIELD_TRANSLATION_TIMEOUT_MS } = {}) {
  const value = String(text || "").trim();
  if (!value) {
    return { text, sourceLanguage: "", translated: false };
  }

  const sourceLanguage = await resolveFieldSourceLanguage(value, sourceHint, targetLanguage, preferredSourceLanguage);
  if (!isSupportedTranslationSource(sourceLanguage, targetLanguage)) {
    return { text, sourceLanguage, translated: false };
  }

  const translatedText = await withTimeout(
    translateText(value, sourceLanguage, targetLanguage),
    timeoutMs
  ).catch(() => text);
  return {
    text: translatedText || text,
    sourceLanguage,
    translated: translatedText !== text
  };
}

async function resolveFieldSourceLanguage(text, sourceHint, targetLanguage, preferredSourceLanguage = "") {
  const preferred = normalizeLanguageCode(preferredSourceLanguage);
  if (preferred && preferred !== targetLanguage) return preferred;

  const hintedLanguage = normalizeLanguageCode(sourceHint);
  if (isSupportedTranslationSource(hintedLanguage, targetLanguage)) return hintedLanguage;
  if (hintedLanguage === targetLanguage && isLikelyLanguage(text, targetLanguage)) return targetLanguage;
  if (isLikelyLanguage(text, targetLanguage)) return targetLanguage;

  const scriptLanguage = inferScriptLanguage(text);
  const isSpecificScript = scriptLanguage && scriptLanguage !== DEFAULT_SOURCE_LANGUAGE;
  if (isSpecificScript && scriptLanguage !== targetLanguage) return scriptLanguage;

  const detectedLanguage = await detectLanguage(text).catch(() => "");
  if (detectedLanguage) return detectedLanguage;
  if (hintedLanguage && hintedLanguage !== targetLanguage) return hintedLanguage;
  if (scriptLanguage) return scriptLanguage;
  if (hintedLanguage) return hintedLanguage;
  return DEFAULT_SOURCE_LANGUAGE;
}

function resolveSourceLanguageHint(item, kind) {
  if (kind === "feed" && item?.language) {
    const normalized = normalizeLanguageCode(item.language);
    if (normalized) return normalized;
  }

  return "";
}

async function detectLanguage(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed || trimmed.length < 12 || !hasChromeLanguageDetectorApi()) return "";

  const detector = await getLanguageDetector();
  const results = await detector.detect(trimmed.slice(0, 500));
  const best = Array.isArray(results) ? results[0] : null;
  const language = normalizeLanguageCode(best?.detectedLanguage || "");

  if (!language || Number(best?.confidence || 0) < 0.45) return "";
  return language;
}

async function getLanguageDetector() {
  if (!detectorPromise) {
    detectorPromise = self.LanguageDetector.create({
      monitor(monitorTarget) {
        monitorTarget.addEventListener("downloadprogress", () => {});
      }
    });
  }
  return detectorPromise;
}

async function translateText(text, sourceLanguage, targetLanguage) {
  const value = String(text || "").trim();
  if (!value || sourceLanguage === targetLanguage) return text;

  const cacheKey = `${sourceLanguage}>${targetLanguage}:${value}`;
  if (translationCache.has(cacheKey)) {
    const cached = translationCache.get(cacheKey);
    translationCache.delete(cacheKey);
    translationCache.set(cacheKey, cached);
    return cached;
  }

  const translator = await getTranslator(sourceLanguage, targetLanguage);
  const result = await translator.translate(value);
  rememberTranslation(cacheKey, result);
  return result;
}

async function getTranslator(sourceLanguage, targetLanguage, { directCreate = false } = {}) {
  const key = `${sourceLanguage}>${targetLanguage}`;
  if (!translatorCache.has(key)) {
    const translatorPromise = directCreate
      ? Promise.resolve().then(() => createTranslatorDirectly(sourceLanguage, targetLanguage))
      : createTranslator(sourceLanguage, targetLanguage);
    translatorCache.set(key, translatorPromise.catch((error) => {
      translatorCache.delete(key);
      throw error;
    }));
  }
  return translatorCache.get(key);
}

function createTranslatorDirectly(sourceLanguage, targetLanguage) {
  return self.Translator.create({
    sourceLanguage,
    targetLanguage,
    monitor(monitorTarget) {
      monitorTarget.addEventListener("downloadprogress", () => {});
    }
  });
}

async function createTranslator(sourceLanguage, targetLanguage) {
  const availability = typeof self.Translator.availability === "function"
    ? await self.Translator.availability({ sourceLanguage, targetLanguage })
    : "downloadable";
  if (availability === "unavailable") {
    throw new Error(`Translation is unavailable for ${sourceLanguage} to ${targetLanguage}.`);
  }

  return createTranslatorDirectly(sourceLanguage, targetLanguage);
}

function rememberTranslation(key, value) {
  translationCache.set(key, value);
  while (translationCache.size > TRANSLATION_CACHE_LIMIT) {
    const oldestKey = translationCache.keys().next().value;
    translationCache.delete(oldestKey);
  }
}

function withTimeout(promise, timeoutMs) {
  let timeoutId = 0;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Translation timed out.")), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

function normalizeLanguageCode(value) {
  const raw = String(value || "").trim();
  const namedLanguageCode = LANGUAGE_NAME_TO_CODE.get(raw.toLowerCase());
  if (namedLanguageCode) return namedLanguageCode;

  const code = raw.replace(/_/g, "-").toLowerCase();
  if (!code) return "";
  if (code === "zh-hant" || code.startsWith("zh-hant-") || code === "zh-tw" || code === "zh-hk" || code === "zh-mo") return "zh-Hant";
  if (code === "zh-cn" || code === "zh-hans" || code.startsWith("zh-hans-")) return "zh";
  if (code === "he" || code.startsWith("he-") || code === "iw" || code.startsWith("iw-")) return "iw";
  if (code === "nb" || code.startsWith("nb-") || code === "nn" || code.startsWith("nn-")) return "no";
  return code.split("-")[0];
}

function isSupportedTranslationSource(sourceLanguage, targetLanguage) {
  return Boolean(
    sourceLanguage
    && targetLanguage
    && sourceLanguage !== targetLanguage
    && CHROME_TRANSLATOR_LANGUAGE_CODE_SET.has(sourceLanguage)
    && CHROME_TRANSLATOR_LANGUAGE_CODE_SET.has(targetLanguage)
  );
}

function inferScriptLanguage(text) {
  const value = String(text || "");
  if (/[\uac00-\ud7af]/.test(value)) return "ko";
  if (/[\u3040-\u30ff]/.test(value)) return "ja";
  if (/[\u4e00-\u9fff]/.test(value)) return "zh";
  if (hasMeaningfulLatinText(value)) return DEFAULT_SOURCE_LANGUAGE;
  return "";
}

function isLikelyLanguage(text, language) {
  const value = String(text || "");
  if (language === "ko") return /[\uac00-\ud7af]/.test(value);
  if (language === "ja") return /[\u3040-\u30ff]/.test(value);
  if (language === "zh" || language === "zh-Hant") return /[\u4e00-\u9fff]/.test(value);
  if (language === DEFAULT_SOURCE_LANGUAGE) return hasMeaningfulLatinText(value);
  return false;
}

function hasMeaningfulLatinText(value) {
  const letters = String(value || "").match(/[A-Za-z]/g) || [];
  return letters.length >= 3;
}

function getBrowserTranslationTarget() {
  const code = normalizeLanguageCode(getBrowserLocale());
  if (!code) return LANGUAGE_BY_NAME.get("English");
  if (LANGUAGE_BY_CODE.has(code)) return LANGUAGE_BY_CODE.get(code);
  if (code === "zh-Hant") return LANGUAGE_BY_CODE.get("zh");
  return LANGUAGE_BY_NAME.get("English");
}

function getBrowserLocale() {
  const chromeLocale = typeof chrome !== "undefined" ? chrome.i18n?.getUILanguage?.() : "";
  return chromeLocale
    || (typeof navigator !== "undefined" ? navigator.languages?.[0] : "")
    || (typeof navigator !== "undefined" ? navigator.language : "")
    || "en";
}

function yieldToUi() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
