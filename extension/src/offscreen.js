// Offscreen page that only plays the alert chime for the background worker.
import { playChime } from "./shared/alert-sound.js";

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "kalshi-play-alert-sound" || sender.id !== chrome.runtime.id) return;
  playChime();
});
