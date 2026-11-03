import { DEFAULT_SETTINGS } from "./config.js";
import { normalizeAIConfiguration } from "./ai-connections.js";

const SETTINGS_KEY = "kalshiEightyPlus.settings";
const SAVED_NEWS_KEY = "kalshiEightyPlus.savedNews";
const SAVED_GROUPS_KEY = "kalshiEightyPlus.savedGroups";
const SELECTED_NEWS_KEY = "kalshiEightyPlus.selectedNews";
const CHAT_LOG_KEY = "kalshiEightyPlus.chatLog";
// chrome.storage.local holds about 10 MB without unlimitedStorage; the panel says when older messages drop.
export const CHAT_LOG_LIMIT = 80;
const DEFAULT_GROUP_ID = "default";
export const SAVED_NEWS_LIMIT = 500;

export const DEFAULT_GROUP = {
  id: DEFAULT_GROUP_ID,
  name: "General",
  isDefault: true,
  createdAt: "2026-04-29T00:00:00.000Z"
};

function hasChromeStorage() {
  return typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
}

async function getValue(key, fallback) {
  if (hasChromeStorage()) {
    const data = await chrome.storage.local.get(key);
    return data[key] ?? fallback;
  }
  const raw = localStorage.getItem(key);
  return raw ? JSON.parse(raw) : fallback;
}

async function setValue(key, value) {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [key]: value });
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}

function itemKey(item) {
  return String(item?.id ?? item?.url ?? item?.title ?? "");
}

function normalizeSavedNotes(notes) {
  if (!Array.isArray(notes)) return [];
  return notes
    .map((note) => ({
      id: String(note?.id || `note-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      text: String(note?.text || "").trim().slice(0, 5000),
      createdAt: note?.createdAt || new Date().toISOString()
    }))
    .filter((note) => note.text)
    .slice(-50);
}

function normalizeSavedItem(item, groupId = DEFAULT_GROUP_ID) {
  return {
    ...item,
    groupId: item.groupId || groupId,
    savedAt: item.savedAt || new Date().toISOString(),
    sourceType: item.sourceType || (item.sentiment_score === undefined ? "feed" : "briefing"),
    notes: normalizeSavedNotes(item.notes)
  };
}

function normalizeSavedGroup(group) {
  if (!group || typeof group !== "object") return null;
  const id = String(group.id || "").trim();
  const name = String(group.name || "").trim();
  if (!id || !name) return null;
  return {
    id: id.slice(0, 80),
    name: name.slice(0, 40),
    isDefault: id === DEFAULT_GROUP_ID || Boolean(group.isDefault),
    createdAt: group.createdAt || new Date().toISOString()
  };
}

export async function getSettings() {
  const stored = await getValue(SETTINGS_KEY, {});
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    ...normalizeAIConfiguration(stored),
    KALSHI: {
      ...DEFAULT_SETTINGS.KALSHI,
      ...(stored.KALSHI || {})
    },
    selectedCategories: Array.isArray(stored.selectedCategories)
      ? stored.selectedCategories
      : DEFAULT_SETTINGS.selectedCategories
  };
}

export async function saveSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await setValue(SETTINGS_KEY, next);
  return next;
}

export async function getSavedGroups() {
  const groups = await getValue(SAVED_GROUPS_KEY, [DEFAULT_GROUP]);
  if (!Array.isArray(groups) || !groups.length) return [DEFAULT_GROUP];
  if (groups.some((group) => group.id === DEFAULT_GROUP_ID)) return groups;
  return [DEFAULT_GROUP, ...groups];
}

export async function createSavedGroup(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return getSavedGroups();

  const groups = await getSavedGroups();
  const group = {
    id: `group-${Date.now()}`,
    name: trimmed.slice(0, 40),
    isDefault: false,
    createdAt: new Date().toISOString()
  };
  const next = [...groups, group];
  await setValue(SAVED_GROUPS_KEY, next);
  return next;
}

export async function getSavedNews({ groupId = "" } = {}) {
  const saved = await getValue(SAVED_NEWS_KEY, []);
  const normalized = Array.isArray(saved)
    ? saved.map((item) => normalizeSavedItem(item))
    : [];
  return groupId ? normalized.filter((item) => item.groupId === groupId) : normalized;
}

export async function saveNewsItem(item, groupId = DEFAULT_GROUP_ID) {
  const saved = await getSavedNews();
  const key = itemKey(item);
  const next = [
    normalizeSavedItem(item, groupId),
    ...saved.filter((entry) => itemKey(entry) !== key || entry.groupId !== groupId)
  ].slice(0, SAVED_NEWS_LIMIT);

  await setValue(SAVED_NEWS_KEY, next);
  return next;
}

export async function updateSavedNewsItem(item, patch = {}) {
  const saved = await getSavedNews();
  const key = itemKey(item);
  const targetGroupId = item.groupId || DEFAULT_GROUP_ID;
  const next = saved.map((entry) => {
    if (itemKey(entry) !== key || entry.groupId !== targetGroupId) return entry;
    return normalizeSavedItem({ ...entry, ...patch }, targetGroupId);
  });

  await setValue(SAVED_NEWS_KEY, next);
  return next;
}

export async function mergeSavedData({ groups = [], items = [] } = {}) {
  const currentGroups = await getSavedGroups();
  const groupMap = new Map(currentGroups.map((group) => [group.id, group]));

  groups
    .map(normalizeSavedGroup)
    .filter(Boolean)
    .forEach((group) => {
      if (group.id === DEFAULT_GROUP_ID) return;
      if (!groupMap.has(group.id)) groupMap.set(group.id, { ...group, isDefault: false });
    });

  const nextGroups = [
    DEFAULT_GROUP,
    ...Array.from(groupMap.values())
      .filter((group) => group.id !== DEFAULT_GROUP_ID)
  ];
  const validGroupIds = new Set(nextGroups.map((group) => group.id));
  const currentItems = await getSavedNews();
  const importedItems = Array.isArray(items)
    ? items.map((item) => normalizeSavedItem(item, validGroupIds.has(item?.groupId) ? item.groupId : DEFAULT_GROUP_ID))
    : [];
  const deduped = [];
  const seen = new Set();

  [...importedItems, ...currentItems].forEach((item) => {
    const key = `${item.groupId}:${itemKey(item)}`;
    if (!itemKey(item) || seen.has(key)) return;
    seen.add(key);
    deduped.push(item);
  });

  const nextItems = deduped.slice(0, SAVED_NEWS_LIMIT);
  await setValue(SAVED_GROUPS_KEY, nextGroups);
  await setValue(SAVED_NEWS_KEY, nextItems);
  return {
    groups: nextGroups,
    items: nextItems,
    importedCount: Math.min(importedItems.length, SAVED_NEWS_LIMIT)
  };
}

export async function removeSavedNewsItem(item, groupId = "") {
  const saved = await getSavedNews();
  const key = itemKey(item);
  const next = saved.filter((entry) => {
    if (itemKey(entry) !== key) return true;
    return groupId ? entry.groupId !== groupId : false;
  });

  await setValue(SAVED_NEWS_KEY, next);
  return next;
}

export async function setSelectedNews(item) {
  await setValue(SELECTED_NEWS_KEY, item);
}

export async function getSelectedNews() {
  return getValue(SELECTED_NEWS_KEY, null);
}

export async function getChatLog() {
  const log = await getValue(CHAT_LOG_KEY, []);
  return Array.isArray(log) ? log : [];
}

export async function saveChatLog(log) {
  const next = Array.isArray(log) ? log.slice(-CHAT_LOG_LIMIT) : [];
  await setValue(CHAT_LOG_KEY, next);
  return next;
}

export async function appendChatMessage(message) {
  const log = await getChatLog();
  const next = [
    ...log,
    {
      id: `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      createdAt: new Date().toISOString(),
      ...message
    }
  ].slice(-CHAT_LOG_LIMIT);
  await setValue(CHAT_LOG_KEY, next);
  return next;
}

export async function updateChatMessage(id, patch) {
  if (!id) return getChatLog();

  const log = await getChatLog();
  const next = log
    .map((message) => (
      message.id === id
        ? { ...message, ...patch, updatedAt: new Date().toISOString() }
        : message
    ))
    .slice(-CHAT_LOG_LIMIT);
  await setValue(CHAT_LOG_KEY, next);
  return next;
}

export function isSaved(savedItems, item, groupId = "") {
  const key = itemKey(item);
  return savedItems.some((entry) => {
    if (itemKey(entry) !== key) return false;
    return groupId ? entry.groupId === groupId : true;
  });
}
