# Kalshi Screener user guide

## Install the local build

Open chrome://extensions, enable Developer mode, choose Load unpacked and select the extension folder. Minimum Chrome version is 120. When updating the same folder, click Reload on its extension card, then reopen the side panel. Keep the old profile data; do not remove the extension merely to update it. The release ZIP is for review and upload preparation, not an automatically published store build.

If your older installation uses a different folder, preserve it and export its data using its available backup controls before switching. A new unpacked path can create a different extension identity and separate storage. Reloading the old D-drive folder does not load the new E-drive code. Migration within the same extension storage does not automatically transfer another extension identity's data. Keep the original installed build until migration has been verified.

## Search and observe

Choose a market scope. Build conditions directly, or configure an AI connection and describe your search. Review the draft and explicitly apply it. Applying does not run the search. AND, OR, NOT and parentheses remain available in advanced logic. Missing data remains unknown even under NOT.

Run Once creates an observation. Results shows matches and incomplete data separately. Save a preset to reuse the recipe. Repeat registers local background observation; Stop ends it. Editing the recipe stops the old monitor; press Repeat again for the edited recipe. Full rediscovery and rechecks can be delayed by Chrome shutdown, sleep, offline time or required data volume.

Alerts retains first-match and confirmed re-entry events. View matching result shows the saved observation at event time. Closing an alert does not stop monitoring. A foreground extension view receives the slide-down display first; a separately permitted active website is next; otherwise the OS notification API is used. Notification submission and reading are separate states.

## Kalshi-specific screens

The condition library includes 80c or higher, closing within N hours, listed within N hours, 24h volume, change versus the previous day and event comparison. Event comparison looks at all open markets in the same event: the favorite (rank 1), the number of markets, and the totals of YES asks and bids. Totals are meaningful only when the event's outcomes are mutually exclusive. Prices are dollars from 0 to 1 and match the implied probability of YES.

## AI agents (MCP)

Settings, AI Agents (MCP) shows how to connect the free kalshi-screener-mcp server to Claude Desktop, Claude Code, Cursor, VS Code and, through your own Cloudflare deployment, ChatGPT, Grok, Meta Muse and Claude on the web. Copy the snippet into your AI app, restart it, then turn on Share with the MCP server on this computer and press Check and share now. Your presets, watchlist and recent alerts are shared with the local server; keys are never sent. AI answers include Open in Kalshi Screener links that open the market in this side panel. If a desktop app cannot open the link, paste it into Chrome's address bar. If you reinstall the extension, start the MCP server once with --pair.

## Research with AI

Press Research with AI on a result, an alert, the alert window or a market opened from an AI app. The window shows the market's prices, rules and settlement sources and builds a prompt you can paste into Claude, ChatGPT, Grok or a local model. Most AI apps search the web on their own. For sites that need a login, the window links to optional third-party browser tools (Claude in Chrome, Playwright MCP Bridge, ego lite and Aside) and copies MCP settings that add Playwright next to kalshi-screener-mcp. These tools are not affiliated with Kalshi Screener and can read sites you are signed in to. Nothing is sent anywhere until you paste the prompt yourself.

## Browser research

Settings, AI Connections, Browser research lets the chat AI search the web in your own Chrome before it answers. Turn it on and tick the sites to use (Google News, Naver News, DuckDuckGo, X, Reddit); Chrome asks once for permission to read each site. Sign in to sites such as X or Naver in Chrome as usual, and the AI uses those sessions without seeing your password. For each question the AI first decides whether it needs current information and which searches to run (at most three). The extension opens each search in a background tab, reads the visible text, closes the tab and gives the text to the AI with your question. It never types, clicks or posts. Links you paste into chat are read only if you allow their site. The answer ends with the pages that were read. This works with every AI connection, including local models.

## AI and photographs

Settings → AI Connections registers named providers and local endpoints. Enter the exact model ID and test a response. Select Primary and optional fallback connections. Image support is a declaration or unknown status; a successful text test does not verify vision support. API credentials are entered only in Settings, never in a chat transcript.

Attach a file, paste/drop a photograph, or capture the intended active web tab after clicking the extension toolbar icon to grant activeTab. Review the photo editor. Drag an area or enter percentages; crop or add one or more opaque masks. The outgoing preview shows the pixels that will be encoded. Use edited photograph, re-edit or delete the attachment as needed. Sending asks you to confirm the edited images and all possible AI destinations. Cancel keeps the attachment and sends no image. A route or attachment change during confirmation requires a new review.

Use ! for explanations and ? for the photograph guide. The guide identifies public market screenshots, local app previews and the editor test harness. These pictures are guidance, not evidence that your installed monitor or AI connection has been tested.

## Disclaimer

Kalshi Screener is an independent tool and is not affiliated with, endorsed by or sponsored by Kalshi. Results are market information, not financial advice or trade instructions.

## Data and troubleshooting

Monitoring & Data exports conditions, watchlist, results and alerts without credentials. Restore stops monitoring and invalidates older open pages. Reload those pages before saving or starting a run. Help & Privacy exports legacy saved items; active news search has been removed.

If capture is denied, bring the intended normal web tab forward, click the extension toolbar icon, and retry. If site alerts are not wanted, disable that origin in Monitoring & Data. If OS banners do not appear, inspect Chrome/Windows notification settings and the retained event in Alerts. If image support is rejected, select a model whose documentation supports image input; images are not silently discarded to make a text request appear successful.
