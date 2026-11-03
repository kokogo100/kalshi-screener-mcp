export function boundedRect(rect, width, height) {
  const values = [rect.x, rect.y, rect.width, rect.height].map(Number);
  if (!values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0) throw new Error("Select a nonempty image area.");
  const x = Math.max(0, Math.min(width - 1, Math.floor(values[0])));
  const y = Math.max(0, Math.min(height - 1, Math.floor(values[1])));
  return { x, y, width: Math.max(1, Math.min(width - x, Math.ceil(values[2]))), height: Math.max(1, Math.min(height - y, Math.ceil(values[3]))) };
}
export function drawEditedPhoto(canvas, image, crop, redactions = []) {
  const area = boundedRect(crop, image.naturalWidth || image.width, image.naturalHeight || image.height);
  canvas.width = area.width; canvas.height = area.height;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = "#000000";
  for (const redaction of redactions) {
    const box = boundedRect(redaction, image.naturalWidth || image.width, image.naturalHeight || image.height);
    ctx.fillRect(box.x - area.x, box.y - area.y, box.width, box.height);
  }
  return area;
}
export async function loadPhoto(dataUrl) {
  const image = new Image(); image.src = dataUrl; await image.decode();
  if (image.naturalWidth * image.naturalHeight > 20_000_000) throw new Error("Image exceeds 20 megapixels. Resize it before attaching.");
  return image;
}
export function pngAttachment(canvas, original) {
  const dataUrl = canvas.toDataURL("image/png");
  const data = dataUrl.split(",")[1]; const size = Math.floor(data.length * 3 / 4);
  if (size > 8 * 1024 * 1024) throw new Error("Edited image exceeds 8 MB. Crop or resize it before attaching.");
  return { id: original.id, name: `${String(original.name || "photo").replace(/\.[^.]*$/, "")}-edited.png`,
    kind: "image", mimeType: "image/png", data, dataUrl, size, reviewed: true };
}

export async function captureActivePhoto(api = globalThis.chrome) {
  if (!api?.tabs?.captureVisibleTab) throw new Error("Tab capture is available in the installed Chrome extension.");
  const [before] = await api.tabs.query({ active: true, lastFocusedWindow: true });
  if (!before || !/^https?:\/\//.test(before.url || "")) throw new Error("Capture works on normal web pages only; Chrome does not allow capturing pages such as chrome://extensions or the new tab page. Open the page you want (for example a Kalshi market), click the Kalshi Screener icon in Chrome's toolbar, then press + in the chat and choose Capture this tab.");
  const win = await api.windows.get(before.windowId);
  if (!win.focused) throw new Error("Bring the tab's Chrome window to the front before capture.");
  let dataUrl;
  try { dataUrl = await api.tabs.captureVisibleTab(before.windowId, { format: "png" }); }
  catch { throw new Error("Chrome needs one more click first: click the Kalshi Screener icon in Chrome's toolbar while this page is open, then choose Capture this tab again."); }
  const [after] = await api.tabs.query({ active: true, windowId: before.windowId });
  if (after?.id !== before.id || after?.url !== before.url) throw new Error("The active tab changed. Capture was discarded; retry on the intended tab.");
  return { id: crypto.randomUUID(), name: "visible-tab.png", kind: "image", mimeType: "image/png", dataUrl };
}
