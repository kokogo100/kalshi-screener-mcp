# Kalshi Screener privacy summary

Updated 2026-10-23. This extension observes markets and does not execute trades. Kalshi Screener is an independent tool and is not affiliated with, endorsed by or sponsored by Kalshi.

Public market requests go to Kalshi. Optional read-only account access uses the Key ID and RSA or Ed25519 private key you enter in Settings; the private key signs requests locally. AI connections use the API credentials and endpoint you select. A web subscription does not automatically provide API access.

AI receives the question, included market context, attached text/PDF and confirmed edited images. Enabled fallbacks receive the same request after an earlier failure. Each provider's own retention and billing rules apply. The extension does not operate its own relay server. Custom endpoints, including local HTTP endpoints, are chosen by you.

Settings and credentials are stored in this Chrome profile's local extension storage. Conditions, watchlist, successful results, monitoring checkpoints and alert history use local IndexedDB. Chat text and attachment names can remain in local chat history; photo pixels are temporary and are not saved to chat history or scanner backups. Scanner exports exclude API keys and connection settings. Existing saved news is retained locally for export; there is no active news feed.

Photographs are cropped and opaque-masked into a new PNG before attachment. Review the outgoing image and AI destinations before confirming transmission. Cancel and attachment deletion do not transmit the photograph. Visible-tab capture requires an explicit activeTab grant and captures the webpage's visible area. It is not a screenshot of the browser controls or side panel.

Website alerts are off by default. On sites you explicitly allow, matching market titles and saved formula text can appear in an isolated notification. Disable a site in Monitoring & Data to stop future site alerts. Disabling this feature does not revoke host access that an AI connection may also use; Chrome manages extension site permissions.

This version shows no advertisements and does not contact any advertising network. If ad slots are added later, they will appear only inside the extension, never in Chrome or OS notifications or on other websites, and this policy will be updated first. The extension has no added analytics service.

AI agent sharing (MCP) is off by default. When you turn on "Share with the MCP server on this computer" in Settings, AI Agents (MCP), the extension sends your condition presets, watchlist and up to 200 recent alerts to the Kalshi Screener MCP server at 127.0.0.1 (port 47811 unless you change it). This data stays on your computer; the MCP server stores it in a local file and gives it to the AI apps you connect. API keys, private keys, AI settings, chat history and photographs are never sent. The extension sends nothing over the network for this feature. Turning sharing off stops future updates; delete the MCP server's state file (~/.kalshi-screener/mcp-state.json by default) to remove data already shared.

Browser research is off by default. When you turn it on in Settings and allow a site, a chat question can make the extension open that site's search page, or a link you pasted, in a background tab of your Chrome profile, read the visible page text and close the tab. Your existing sign-ins on that site apply, the same as when you open the page yourself; the extension does not read cookies or passwords. The page text, up to about 4,000 characters per page and at most five pages per question, is sent with your question to the AI connection you selected. It is not stored apart from the chat answer. The extension never types, clicks or posts on those pages. Removing a site in Settings or in Chrome's site access stops future reads.

Research with AI loads the market and its series (settlement sources and contract terms) from Kalshi's public API and builds a prompt locally. The prompt is copied to your clipboard only when you press Copy prompt and goes to an AI only when you paste it. Links to third-party browser tools and settlement sources open only when you click them; the extension does not contact those services.

Market links from AI apps open the extension page open.html, which only reads a market ticker from the link and shows that market in the side panel. Websites cannot read extension data through it.

Stop monitoring before restoring data. Chrome shutdown, sleep and offline periods delay checks. OS notification submission does not prove that a banner was visible. Removing the extension removes its Chrome profile storage; exported files are separately under your control.

Store publication and production readiness remain subject to the integration acceptance record. This document describes the current code and does not claim an independent security audit.
