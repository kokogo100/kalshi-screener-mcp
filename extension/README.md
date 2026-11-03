# Kalshi Screener — Chrome Extension

Open-source (MIT) Chrome extension for screening Kalshi prediction markets with public market data, natural-language AI condition drafting, editable boolean formulas, local background monitoring, and multi-channel alerts.

> **Read-only & Independent:** Kalshi Screener never places, modifies, or cancels trades. It is not affiliated with, endorsed by, or sponsored by Kalshi. Market information only, not financial advice.

---

## Key Capabilities & How to Use

### 1. Build Screens by Prompt (`Kalshi Screener Chat`) or Manually (`Scanner Lab`)
- **Natural-Language Prompt -> Automatic Condition Stack:**
  - Open the bottom **Kalshi Screener Chat** bar and describe what you want to find in any language (e.g., *"Find markets closing in 24h priced 80c or higher with spread under 5c"*).
  - Press **`Send`** to immediately scan live markets in chat and get one-click **[Apply to Scanner Lab]** / **[Apply and Run Once]** buttons.
  - Press **`Draft`** to translate your prompt directly into a multi-row condition stack (`A AND B...`) inside **Scanner Lab**.
- **Manual Condition Stack (45 Templates + Boolean Formula):**
  - Pick from 45 Kalshi-specific templates across 9 categories (YES price, hours to close, hours since listing, 24h volume, open interest, spread, 24h price change, event favorite rank, event YES ask sum, settlement source domain, RSI/SMA/EMA/MACD/BBands, etc.).
  - Combine up to 26 rows (`A`–`Z`) with `AND`, `OR`, `NOT`, and parentheses.
  - Save up to **10 Presets** and set a default startup preset.

### 2. Background Monitoring (`Repeat`) & Alerts
- Press **`Run Once`** for an immediate scan, or **`Repeat`** to monitor continuously in the background via `chrome.alarms` and IndexedDB checkpoints.
- Full scans discover new matches at your chosen interval (`1m`–`30m`), while previously matched markets are re-checked roughly every minute.
- Matches trigger a customizable **Alert Popup Window + Chime** (bottom-right), an **In-Panel Slide-Down Banner** when the side panel is focused, an optional **Website Banner** on user-approved origins, and an optional **OS Notification**.

### 3. Connect Your Own AI & Local MCP Server
- **Settings -> AI Connections:** Add OpenAI, Anthropic Claude, Google Gemini, xAI Grok, OpenRouter, custom OpenAI-compatible endpoints, or free local models (**Ollama / Local Server**). Configure **Primary**, **Fallback 1**, and **Fallback 2** execution order.
- **Settings -> AI Agents (MCP):** Turn on **Share with the MCP server on this computer** (`127.0.0.1:47811`) so Claude, ChatGPT, Grok, Meta Muse, Cursor, and VS Code can run your saved presets, build new screens from prompts, and inspect your watchlist and recent alerts. See [`../mcp-server/README.md`](../mcp-server/README.md).

### 4. Privacy-First Photo Editor & Browser Research
- **Photo Editor:** Capture the active tab or attach local images in chat. Crop and draw **opaque masks** over sensitive areas before confirming transmission; masked pixels are permanently replaced in the outgoing PNG.
- **Research with AI:** Generate a ready-to-paste prompt with official series settlement sources and contract rules from any result or alert card.

---

## Development & Verification

- **Requirements:** Node.js 20+, Chrome 120+ (Ed25519 Kalshi keys require Chrome 137+; RSA keys work on Chrome 120+).
- **Commands:**
  ```sh
  npm ci
  npm run validate
  npm test
  ```
- **Load in Chrome:** Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select this `extension/` folder.
- **Sync shared engine to MCP server:** After modifying `src/scanner-lab/` or `src/shared/`, run `npm run sync-core` in `../mcp-server`.

---

## License

Open source under the [MIT License](../LICENSE). Free for personal and commercial use.

- **No ads:** The extension shows no advertisements and contacts no advertising network.
- **Contact & Advertising Inquiries:** **contact@axnli.com** · See [`PRIVACY.md`](PRIVACY.md).
