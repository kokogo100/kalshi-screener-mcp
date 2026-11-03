// A larger alert window beside the Windows notification. Windows draws its notifications at a fixed small size and
// they must not carry ads, so the details (and any future ad slot) live in this extension window instead.
const WINDOW_KEY = "kalshi.alertWindowId";
export const ALERT_WINDOW_SIZE = { width: 420, height: 520 };

// Backgrounds people can pick so the alert window stands out from the panel; colors live in base.css.
export const ALERT_WINDOW_BACKGROUNDS = [
  { id: "default", label: "Default (dark)", color: "#121212" },
  { id: "white", label: "White", color: "#ffffff" },
  { id: "yellow", label: "Soft yellow", color: "#fff6cc" },
  { id: "blue", label: "Soft blue", color: "#e3eeff" },
  { id: "red", label: "Soft red", color: "#ffe4e1" },
  { id: "brightYellow", label: "Bright yellow", color: "#edff20" },
  { id: "brightRed", label: "Bright red", color: "#d92d20" },
  { id: "brightBlue", label: "Bright blue", color: "#1f5fe0" }
];

export function alertWindowBackground(value) {
  return ALERT_WINDOW_BACKGROUNDS.some((entry) => entry.id === value) ? value : "default";
}

export function renderBackgroundSwatches(current) {
  const selected = alertWindowBackground(current);
  return `<div class="bg-swatches" role="radiogroup" aria-label="Alert window background">${ALERT_WINDOW_BACKGROUNDS.map((entry) =>
    `<button type="button" class="bg-swatch" role="radio" data-alert-bg="${entry.id}" aria-checked="${entry.id === selected}" title="${entry.label}" aria-label="${entry.label}" style="background:${entry.color}"></button>`).join("")}</div>`;
}

export function alertWindowUrl(api, { count = 1, test = false } = {}) {
  const params = new URLSearchParams(test ? { test: "1" } : { count: String(Math.max(1, Math.round(count) || 1)) });
  return api.runtime.getURL(`alert.html?${params}`);
}

// Opens at the bottom right of the last browser window and comes to the front; an unfocused popup opens behind
// Chrome's main window and looks like it vanished. A newer alert replaces the older window's content.
export async function openAlertWindow(api, options = {}) {
  const url = alertWindowUrl(api, options);
  const saved = (await api.storage?.session?.get(WINDOW_KEY))?.[WINDOW_KEY];
  if (saved) {
    try {
      const existing = await api.windows.get(saved, { populate: true });
      if (existing?.tabs?.[0]) { await api.tabs.update(existing.tabs[0].id, { url }); await api.windows.update(saved, { focused: true }); return saved; }
    } catch { /* The person closed it; open a new one. */ }
  }
  let anchor = null;
  try { anchor = await api.windows.getLastFocused({ windowTypes: ["normal"] }); } catch {}
  const { width, height } = ALERT_WINDOW_SIZE;
  const placement = anchor && Number.isFinite(anchor.left) && Number.isFinite(anchor.width)
    ? { left: anchor.left + anchor.width - width - 16, top: anchor.top + anchor.height - height - 16 } : {};
  let created;
  // Chrome rejects bounds that are mostly off screen (small window, monitor edge); then let Chrome place it.
  try { created = await api.windows.create({ url, type: "popup", width, height, focused: true, ...placement }); }
  catch { created = await api.windows.create({ url, type: "popup", width, height, focused: true }); }
  await api.storage?.session?.set({ [WINDOW_KEY]: created.id });
  return created.id;
}
