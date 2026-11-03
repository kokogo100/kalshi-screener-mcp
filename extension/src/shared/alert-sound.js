// A short two-note chime ("ding") made with Web Audio, so no sound file ships with the extension.
export function playChime(AudioContextClass = globalThis.AudioContext) {
  const context = new AudioContextClass();
  const start = context.currentTime + 0.02;
  [[880, 0], [1318.5, 0.16]].forEach(([frequency, delay]) => {
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start + delay);
    gain.gain.exponentialRampToValueAtTime(0.25, start + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + 0.9);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start + delay);
    oscillator.stop(start + delay + 0.95);
  });
  setTimeout(() => void context.close(), 1400);
}

// The service worker cannot play audio; an offscreen document can, without a click first.
export async function playAlertSound(api = globalThis.chrome) {
  if (!api.offscreen) { playChime(); return; }
  const url = api.runtime.getURL("offscreen.html");
  const open = await api.runtime.getContexts?.({ contextTypes: ["OFFSCREEN_DOCUMENT"], documentUrls: [url] });
  if (!open?.length) {
    try { await api.offscreen.createDocument({ url: "offscreen.html", reasons: ["AUDIO_PLAYBACK"], justification: "Play a short chime when a market matches." }); }
    catch (error) { if (!/single offscreen document/i.test(error.message)) throw error; }
  }
  await api.runtime.sendMessage({ type: "kalshi-play-alert-sound" });
}
