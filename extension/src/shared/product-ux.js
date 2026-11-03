import { escapeHtml as esc } from "./format.js";

import { selectedAIConnections } from "./ai-connections.js";
import { getSettings, saveSettings } from "./storage.js";
import { readScannerDocument } from "./scanner-store.js";
import { markAlertRead, presentationKey, websiteOrigin, pendingAlertForDocument } from "./alert-presentation.js";
import { loadPhoto, drawEditedPhoto, pngAttachment, captureActivePhoto, boundedRect } from "./photo-editor.js";

// The panel shows one slot per screen, right under the tab bar; the Alerts list places its own after the first alert.
export const productTools = () => `<nav class="product-tools" aria-label="Guides and photographs"><button data-product="guide"><span class="toolbar-symbol">?</span> <span class="toolbar-label">Photo guide</span></button><button data-about="scanner" aria-label="About search and conditions"><span class="toolbar-symbol">!</span> <span class="toolbar-label">About</span></button><input id="photoHelpFileInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden></nav>`;
const descriptions = {
  scanner: ["Search, AI chat and MCP", "Pick a condition in the library and press Run Once to see every match in Results; use Add to Stack to combine up to 26 rows with AND, OR, NOT and parentheses. Repeat keeps watching in the background and sends alerts. In the bottom chat, type what you want in any language: Send scans Kalshi live and offers [Apply to Scanner Lab] / [Apply and Run Once], while Draft builds Scanner conditions directly. In Settings -> AI Agents (MCP), connect Claude, ChatGPT, Grok, Cursor or VS Code so your external AI can also combine filters from prompts or run your saved presets. Save Preset keeps up to 10 condition sets. Missing data is unknown, including under NOT. Results are public market observations, never trade instructions."],
  ai: ["AI connections, API keys and images", "Click Add connection, pick a provider (OpenAI, Anthropic Claude, Google Gemini, xAI Grok, OpenRouter, Custom) and paste your API key—or pick Ollama / Local Server (http://localhost:11434) for a free local model with no API key. Use Load models or enter a model ID, then press Test response to verify and save. Choose Primary, Fallback 1 and Fallback 2 under Execution order and press Save settings. API access differs from a website subscription. Primary/Fallback is failure recovery, not model collaboration. A text test does not verify image support; mark text-only models as unsupported. Every image request requires your preview confirmation."],
  monitor: ["Monitoring and alerts", "Repeat checks your conditions on this computer while Chrome is running and the PC is awake, with the panel open or closed. New matches open an alert window at the bottom right with a short sound; you choose its background color in Alerts. A small Windows notification is optional. When many markets match at once they arrive as one grouped alert. If you are using Chrome with the panel open, the alert slides down inside the panel instead. The Alerts tab keeps the latest 100 alerts; delete them one by one or all at once. Stop ends monitoring; closing the panel does not."],
  capture: ["Tab capture and privacy", "On the intended web page, click the Kalshi Screener icon in Chrome's toolbar, then press + in the chat and choose Capture this tab. Chrome's activeTab grant does not come from a side-panel button alone. Capture takes the visible webpage, not the browser chrome or side panel. Images stay temporary. Crop and opaque masks are encoded into the outgoing PNG. Verify keys, private keys, email, balances and account details before sending."],
  privacy: ["Privacy", "Images go directly to the chosen AI and enabled image-capable fallbacks after confirmation. Original pixels are never included in the edited attachment. Photographs are not saved in chat history or scanner backups. There are no ads."]
};
export function imageRoutes(settings) {
  return selectedAIConnections(settings).filter(slot => slot.imageSupport !== "unsupported" && slot.model && (slot.provider === "local" || slot.apiKey));
}
export function imageRequestIdentity(settings, attachments) {
  return JSON.stringify([imageRoutes(settings).map(slot => [slot.id,slot.provider,slot.model,slot.baseUrl,slot.apiKey,slot.imageSupport]), attachments.map(item => [item.id,item.data])]);
}

export function createProductUX({ state, render, addFiles, send, read = readScannerDocument, api = globalThis.chrome }) {
  let dialogOpen = false, port, reconnect, initialAlert = false, disposed = false;
  const receipts = new Set();
  const toast = document.createElement("section"); toast.className = "condition-toast"; toast.hidden = true;
  toast.setAttribute("role", "region"); toast.setAttribute("aria-label", "Kalshi Screener condition alerts"); toast.setAttribute("aria-live", "polite"); document.body.append(toast);
  let toastGeneration;
  const notifyError = error => { state.status = error.message || "Action failed."; render({preserveScroll:true}); };
  function dialog(title, html, setup = () => {}) {
    if (dialogOpen) return Promise.resolve(null);
    dialogOpen = true; const opener = document.activeElement;
    const openerSelector = opener?.id ? `#${CSS.escape(opener.id)}` : null;
    const element = document.createElement("dialog"); element.className = "product-dialog";
    element.innerHTML = `<header><h2>${esc(title)}</h2><button data-close aria-label="Close dialog">×</button></header>${html}`;
    element.setAttribute("aria-label", title); document.body.append(element);
    return new Promise(resolve => {
      let finished = false;
      const finish = value => {
        if (finished) return; finished = true; element.close(); element.remove(); dialogOpen = false;
        const target = opener?.isConnected ? opener : openerSelector ? document.querySelector(openerSelector) : document.querySelector("[data-product='guide']");
        target?.focus(); resolve(value);
      };
      element.querySelector("[data-close]").onclick = () => finish(null);
      element.addEventListener("cancel", event => { event.preventDefault(); finish(null); });
      element.addEventListener("click", event => { if (event.target === element) { const box = element.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) finish(null); } });
      element.showModal(); setup(element, finish);
    });
  }
  async function editAttachment(original) {
    if (dialogOpen) throw new Error("Finish or cancel the current photo dialog before opening another.");
    const image = await loadPhoto(original.dataUrl || `data:${original.mimeType};base64,${original.data}`);
    let crop = {x:0,y:0,width:image.naturalWidth,height:image.naturalHeight}, redactions = [], selection = {...crop};
    return dialog("Check the photo before attaching", `<p>${esc(original.name)} · This photo goes to your AI provider when you send. If it shows anything private (balances, email, keys), drag over it and press Add opaque mask, or Crop to keep only part. Otherwise just press Attach this photo. The second preview is what will be sent.</p>
      <canvas id="photoSelectionCanvas" aria-label="Photo area selection" tabindex="0"></canvas>
      <div class="photo-coordinates">${[["x",0],["y",0],["width",100],["height",100]].map(([key,value])=>`<label>${key} %<input data-coordinate="${key}" type="number" min="0" max="100" step="0.1" value="${value}"></label>`).join("")}</div>
      <div class="product-tools"><button data-edit="crop">Crop selected area</button><button data-edit="mask">Add opaque mask</button><button data-edit="undo">Undo mask</button><button data-edit="reset">Reset edits</button></div>
      <p>Outgoing PNG preview</p><canvas id="photoOutputCanvas" aria-label="Outgoing edited photograph"></canvas><p class="photo-error" role="alert"></p>
      <button data-edit="save" class="button-primary">Attach this photo</button><button data-edit="cancel">Cancel</button>`, (element,finish)=>{
      const canvas=element.querySelector("#photoSelectionCanvas"), output=element.querySelector("#photoOutputCanvas"), error=element.querySelector(".photo-error");
      const fit = target => { target.style.width=`min(100%, ${45 * target.width / target.height}vh)`; target.style.maxHeight="none"; };
      const fields=[...element.querySelectorAll("[data-coordinate]")];
      const updateFields=()=>fields.forEach(input=>{ const key=input.dataset.coordinate; input.value=((selection[key]/(["x","width"].includes(key)?image.naturalWidth:image.naturalHeight))*100).toFixed(1); });
      function paint(){
        drawEditedPhoto(canvas,image,{x:0,y:0,width:image.naturalWidth,height:image.naturalHeight},redactions);
        const ctx=canvas.getContext("2d");ctx.strokeStyle="#EDFF20";ctx.lineWidth=Math.max(2,image.naturalWidth/200);ctx.strokeRect(selection.x,selection.y,selection.width,selection.height);
        drawEditedPhoto(output,image,crop,redactions);
        fit(canvas);fit(output);
      }
      const fromFields=()=>boundedRect(Object.fromEntries(fields.map(input=>[input.dataset.coordinate,Number(input.value)/100*(["x","width"].includes(input.dataset.coordinate)?image.naturalWidth:image.naturalHeight)])),image.naturalWidth,image.naturalHeight);
      let start;
      const point=event=>{const box=canvas.getBoundingClientRect();return {x:(event.clientX-box.left)/box.width*image.naturalWidth,y:(event.clientY-box.top)/box.height*image.naturalHeight};};
      canvas.addEventListener("pointerdown",event=>{start=point(event);canvas.setPointerCapture(event.pointerId);});
      canvas.addEventListener("pointerup",event=>{if(!start)return;const end=point(event);try{selection=boundedRect({x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),width:Math.abs(end.x-start.x),height:Math.abs(end.y-start.y)},image.naturalWidth,image.naturalHeight);updateFields();paint();}catch(e){error.textContent=e.message;}start=null;});
      fields.forEach(input=>input.addEventListener("input",()=>{try{selection=fromFields();paint();error.textContent="";}catch(e){error.textContent=e.message;}}));
      element.querySelectorAll("[data-edit]").forEach(button=>button.onclick=()=>{
        try { const action=button.dataset.edit;error.textContent="";
          if(action==="cancel")return finish(null);
          if(action==="save")return finish(pngAttachment(output,original));
          if(action==="crop")crop=fromFields();
          if(action==="mask")redactions.push(fromFields());
          if(action==="undo")redactions.pop();
          if(action==="reset"){crop={x:0,y:0,width:image.naturalWidth,height:image.naturalHeight};redactions=[];selection={...crop};updateFields();}
          paint();
        }catch(e){error.textContent=e.message;}
      });paint();
    });
  }
  async function confirmImages(attachments, settings) {
    if (!attachments.some(item=>item.kind==="image")) return true;
    const routes=imageRoutes(settings);
    if (!routes.length) throw new Error("Select an image-supporting AI connection. All selected models are off or marked image unsupported. You can keep the photo and ask a text-only question separately.");
    if (attachments.some(item=>item.kind==="image" && !item.reviewed)) throw new Error("Review each photograph before sending.");
    const result=await dialog("Confirm photograph transmission", `<p>Send these edited pixels directly to the following AI route? No image is sent until you confirm.</p>
      <ul>${routes.map(slot=>`<li>${esc(slot.routeRole)}: ${esc(slot.label)} · ${esc(slot.model)} · ${slot.imageSupport==="supported"?"Image support declared by you":"Image support unknown; provider may reject this request"}</li>`).join("")}</ul>
      <p>Enabled fallbacks receive the same images if an earlier request fails. Models marked unsupported are skipped. Check keys, email, balances and account details.</p>
      ${attachments.filter(item=>item.kind==="image").map(item=>`<figure><img src="${esc(item.dataUrl)}" alt="Outgoing ${esc(item.name)}"><figcaption>${esc(item.name)}</figcaption></figure>`).join("")}
      <button data-confirm class="button-primary">Confirm and send images</button><button data-cancel>Cancel sending</button>`,(element,finish)=>{
        element.querySelector("[data-confirm]").onclick=()=>finish(true);element.querySelector("[data-cancel]").onclick=()=>finish(null);
      });return result===true;
  }
  const ALERT_RESULT_LABELS={marketTicker:"Market",marketTitle:"Title",observedAt:"Observed",last:"Last price",yesBid:"YES bid",yesAsk:"YES ask",noBid:"NO bid",noAsk:"NO ask",volume24h:"24h volume",openInterest:"Open interest",liquidity:"Liquidity (top of book, $)",status:"Status"};
  const localTime=(value)=>{const date=new Date(value);return Number.isNaN(date.getTime())?String(value||""):date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });};
  async function openAlert(id, generation=state.brokerDataGeneration) {
    const doc=await read();if(doc.generation!==generation)throw new Error("Scanner data changed. Reload to open this alert.");
    const event=doc.data.alerts.find(item=>item.id===id);if(!event)throw new Error("This alert is no longer in history.");
    const updated = await markAlertRead(id,generation);
    state.scannerAlerts = updated.data.alerts;
    render({preserveScroll:true});
    const row=event.result || {};
    await dialog("Matching result at alert time", `<h3>${esc(event.title||event.symbol)}</h3><p>${esc(event.symbol)} · ${esc(localTime(event.createdAt))}</p><p>Saved formula: ${esc(event.recipeFormula)}</p><p>Delivery: ${esc(event.delivery==="delivered"?({os:"desktop notification",panel:"this panel",website:"open website",summary:"grouped notification"}[event.deliveryChannel]||"shown"):event.delivery||"recorded")}. This is the saved observation, not a fresh quote.</p>
      <dl>${Object.entries(ALERT_RESULT_LABELS).filter(([key])=>row[key]!=null).map(([key,label])=>`<dt>${esc(label)}</dt><dd>${esc(key==="observedAt"?localTime(row[key]):String(row[key]))}</dd>`).join("")}</dl>
      ${(row.conditionResults||[]).map((result,index)=>`<article><strong>Condition ${index+1}: ${result.state===null?"unknown":result.state?"matched":"not matched"}</strong><ul>${(result.clauseResults||[]).map(clause=>`<li>${esc(clause.metric||clause.clause?.metric||"Observation")}: ${esc(JSON.stringify(clause.value??null))} · ${clause.available?clause.matched?"matched":"not matched":"unknown"}</li>`).join("")}</ul></article>`).join("")}
      <button data-alert-results>Open current Results</button>`,(element,finish)=>{element.querySelector("[data-alert-results]").onclick=()=>{finish(true);state.activeTab="results";render();};});
  }
  async function showPanelAlert(event, expiresAt) {
    if(event.generation!==state.brokerDataGeneration || Date.now()>=expiresAt || document.visibilityState!=="visible")return false;
    const win=await api.windows.getCurrent();if(!win.focused || Date.now()>=expiresAt)return false;
    const latest=await read();if(latest.generation!==event.generation || Date.now()>=expiresAt)return false;
    const key=presentationKey(event.generation,event.id);const saved=await api.storage.session.get(key);if(saved[key]||receipts.has(key))return true;
    // Re-read after asynchronous window/document/session checks. No await between
    // this validation and DOM insertion, so a queued stopped/replaced event cannot appear.
    const current=await read();
    if(!pendingAlertForDocument(current,event) || event.generation!==state.brokerDataGeneration || Date.now()>=expiresAt || document.visibilityState!=="visible")return false;
    if(receipts.has(key))return true;
    if(toastGeneration!==event.generation || toast.hidden){toast.innerHTML=`<h2>Kalshi Screener · Condition matched</h2><button data-toast-close>Close alerts</button><div class="toast-events"></div>`;toastGeneration=event.generation;}
    const card=document.createElement("article");card.innerHTML=`<strong>${esc(event.title)}</strong><p>${esc(event.symbol)} · ${esc(event.formula)}</p><button data-open-alert="${esc(event.id)}">View matching result</button><button data-research-market="${esc(event.symbol)}">Research with AI</button>`;
    toast.querySelector(".toast-events").append(card);toast.hidden=false;receipts.add(key);
    toast.querySelector("[data-toast-close]").onclick=()=>{toast.hidden=true;};
    card.querySelector("button").onclick=()=>void openAlert(event.id,event.generation).catch(notifyError);
    await api.storage.session.set({[key]:{channel:"panel",at:Date.now()}});return true;
  }
  function connect(){
    if(!api?.runtime?.id||!api.runtime.connect)return;
    try{port=api.runtime.connect({name:"kalshi-alert-panel"});api.windows.getCurrent().then(win=>port.postMessage({type:"ready",windowId:win.id})).catch(()=>{});
      port.onMessage.addListener(async message=>{if(message.type!=="alert")return;let shown=false,uncertain=false;try{shown=await showPanelAlert(message.event,message.expiresAt);}catch{uncertain=true;}try{port.postMessage({type:"ack",id:message.event.id,shown,uncertain});}catch{}});
      port.onDisconnect.addListener(()=>{clearTimeout(reconnect);if(!disposed)reconnect=setTimeout(connect,1200);});
    }catch{clearTimeout(reconnect);reconnect=setTimeout(connect,1200);}
  }connect();
  window.addEventListener("pagehide",()=>{disposed=true;clearTimeout(reconnect);port?.disconnect();toast.remove();});
  toast.addEventListener("keydown",event=>{if(event.key==="Escape")toast.hidden=true;});
  document.addEventListener("click",event=>{
    const target=event.target.closest?.("[data-product],[data-about],[data-open-alert],[data-edit-photo],[data-site-remove],[data-site-allow]");if(!target)return;
    void (async()=>{
      if(target.dataset.about){const [title,body]=descriptions[target.dataset.about]||descriptions.scanner;await dialog(title,`<p>${esc(body)}</p>`);}
      if(target.dataset.product==="guide")await dialog("Photograph guide", `<p>Captures of the public Kalshi site and this app. App captures use example connections and a real search answer from October 2026. The photo editor was captured in the product test harness.</p>
        ${[["kalshi-public.png","1. Public Kalshi markets","Open a market and identify its YES/NO prices. These are observations, not trading instructions."],["settings-ai.png","2. Connect an AI","Settings, AI Connections, Add connection: choose a provider (or Ollama for a free local model), enter the model ID and press Test response. The first connection that answers becomes Primary. Add more as fallbacks in Execution order."],["scanner.png","3. Search","Pick a condition in Scanner and press Run Once, or type what you are looking for in the chat and press Send, for example markets closing in 24 hours over 90c. The chat lists the busiest matches and leaves the same conditions in Scanner; Run Once shows every match in Results and Repeat keeps watching."],["alerts.png","4. Get alerts","Press Repeat in Scanner. New matches open an alert window with a sound, even with the panel closed, and are listed in Alerts (latest 100). Choose how alerts appear at the top of Alerts and press Show a test alert to try it."],["photo-editor.png","5. Attach a photo","Press + in the chat, drop a photo onto the chat, or paste one. Capture this tab takes the visible page. You can crop or cover private areas such as balances or email before sending, then confirm where the photo goes."]].map(([file,title,body])=>`<figure><h3>${esc(title)}</h3><img src="help/${file}" alt="${esc(title)}"><figcaption>${esc(body)}</figcaption></figure>`).join("")}
        <button data-guide-photo>Attach your own photograph</button>`,(element,finish)=>{element.querySelector("[data-guide-photo]").onclick=()=>{finish(true);document.querySelector("#photoHelpFileInput")?.click();};});
      if(target.dataset.product==="files")document.querySelector("#photoHelpFileInput")?.click();
      if(target.dataset.product==="capture") {const photo=await captureActivePhoto(api);const edited=await editAttachment(photo);if(edited){if(state.chatAttachments.length>=4)throw new Error("Attach up to four files.");state.chatAttachments.push(edited);state.chatOpen=true;render();}}
      if(target.dataset.openAlert)await openAlert(target.dataset.openAlert);
      if(target.dataset.editPhoto){const original=state.chatAttachments.find(item=>item.id===target.dataset.editPhoto);if(original){const edited=await editAttachment(original);if(edited){state.chatAttachments=state.chatAttachments.map(item=>item.id===original.id?edited:item);render();}}}
      if(target.hasAttribute("data-site-allow")){
        const origin=websiteOrigin(document.querySelector("#notificationSiteOrigin").value);
        // Permission request runs immediately in this click's activation.
        if(!api?.permissions?.request)throw new Error("Site permission requires the installed extension.");
        const url=new URL(origin);if(!await api.permissions.request({origins:[`${url.protocol}//${url.hostname}/*`]}))throw new Error("Site access denied; website alerts remain off.");
        const latest=await getSettings();state.settings=await saveSettings({notificationSites:[...new Set([...(latest.notificationSites||[]),origin])]});render();
      }
      if(target.dataset.siteRemove){const latest=await getSettings();state.settings=await saveSettings({notificationSites:(latest.notificationSites||[]).filter(origin=>origin!==target.dataset.siteRemove)});render();}
    })().catch(notifyError);
  });
  document.addEventListener("change",event=>{if(event.target.id==="photoHelpFileInput"){const files=Array.from(event.target.files);event.target.value="";void addFiles(files).catch(notifyError);}});
  let oldModal, returnFocus;
  function afterRender(){
    if(toastGeneration && toastGeneration!==state.brokerDataGeneration)toast.hidden=true;
    // Existing explanation dialogs also retain focus and trap keyboard navigation.
    const modal=document.querySelector(".panel-modal-backdrop > section, .panel-modal-backdrop > div");
    if(modal && modal!==oldModal){if(!oldModal)returnFocus=document.activeElement;modal.setAttribute("role","dialog");modal.setAttribute("aria-modal","true");modal.tabIndex=-1;
      const controls=()=>[...modal.querySelectorAll("button,input,select,textarea,[tabindex='0']")].filter(item=>!item.disabled&&item.getClientRects().length);
      modal.addEventListener("keydown",event=>{if(event.key==="Escape"){event.preventDefault();modal.querySelector("[data-modal-action='close']")?.click();}if(event.key==="Tab"){const list=controls();if(!list.length){event.preventDefault();return;}const first=list[0],last=list.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
      (controls()[0]||modal).focus();
    }
    if(!modal&&oldModal){if(returnFocus?.isConnected)returnFocus.focus();else document.querySelector("[data-product='guide']")?.focus();}oldModal=modal;
    if(!initialAlert&&!state.loading){initialAlert=true;const id=new URLSearchParams(location.hash.split("?")[1]||"").get("event");if(id)void openAlert(id).catch(notifyError);}
  }
  return { editAttachment, confirmImages, afterRender };
}
