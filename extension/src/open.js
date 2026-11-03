// Entry for "Open in Kalshi Screener" links from AI apps; forwards only a sanitized market ticker.
const ticker = String(new URLSearchParams(location.search).get("market") || "").trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "").slice(0, 120);
location.replace(chrome.runtime.getURL(ticker ? `side_panel.html#market?ticker=${encodeURIComponent(ticker)}` : "side_panel.html"));
