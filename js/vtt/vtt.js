// Map events and wiring: Firebase sync, rule evaluation (GM only), pointer interaction.
import { watch, watchAt, read, readAt, txnAt, put as rawPut, patch as rawPatch } from "../store.js";
import { put, patch } from "./undo.js";
import { play } from "./fx/fx.js";
import { KINDS, SOURCES, behaviorsFor, statesOf, evaluate, onFired, newObject, demo, demoMap } from "../puzzle/index.js";
import { $, S, cellOf } from "./state.js";
import { initWalk } from "./walk.js";
// Players walk their own token smoothly with WASD / arrow keys: see walk.js.
// Space opens or closes the nearest door within reach (1.5 cells) of your token; in 1st person it prefers the one you are facing.
document.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || e.repeat || S.isGM || S.paused || e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.target.tagName) || e.target.isContentEditable) return;
  const tid = Object.keys(S.tokens).find((k) => canMove(k) && isPcToken(S.tokens[k])); if (!tid) return;
  const t = S.tokens[tid], f = S.firstPerson ? S.v3d?.facing() : null, lv = t.lv ?? 0;
  let best = null, bestScore = Infinity;
  for (const [id, o] of Object.entries(S.objects)) {
    if (o.kind !== "door" || (o.lv ?? 0) !== lv || o.win || o.doorKind === "window" || o.doorKind === "secret" || o.hidden) continue;
    const dx = o.x - t.x, dy = o.y - t.y, dist = Math.hypot(dx, dy); if (dist > 60) continue;
    const ahead = f && dist > 0 ? (dx * f.x + dy * f.y) / dist : 1; if (ahead < 0.2) continue;
    const score = dist - ahead * 10; if (score < bestScore) { bestScore = score; best = [id, o]; }
  }
  if (!best) return;
  e.preventDefault(); const [id, o] = best;
  if (o.locked) { const el = document.querySelector("#toast"); if (el) { el.textContent = "The door is locked."; el.style.display = "block"; setTimeout(() => (el.style.display = "none"), 2000); } return; }
  play("click"); put(`objects/${id}/state`, o.state === "open" ? "closed" : "open");
});
import { initView, applyView } from "./view.js";
import { CONDITIONS } from "./conditions.js";
import { initCmd } from "./cmd.js";
import { initInitiative, addToInitiative, removeFromInitiative, inInitiative, startInitiative } from "./initiative.js";
import { initScenes } from "./scenes.js";
import { initImages, imageAt, imageFields, removeImage } from "./images.js";
import { initMeasure } from "./measure.js";
import { initDice } from "./dice.js";
import { initHandouts } from "./handouts.js";
import { initRollCall } from "./rollcall.js";
import { initAtmosphere } from "./atmosphere.js";
import { openTokenPicker } from "./tokenpics.js";
import { openInventory } from "./inventory.js";
import { openEquipment } from "./equipment.js";
import { initMapImage } from "./mapimg.js";
import { initRefImage } from "./refimage.js";
import { initReplace, openReplace } from "./replace.js";
import { addBarButton, dropMenu, toolbar, floatWindow } from "./ui.js";
import { drawObjects, drawTokens, drawTray, drawMap, drawWalls, isPcToken, doorsList, wallPieces, PROPS } from "./draw.js";
import { propParts } from "./propmodels.js";
import { canReach } from "./reach.js";
import { initTools, setTool, duplicate, snapFor, toolDown, toolMove, toolUp, roofAt, fogAt, wallAt, floorAt, settingsFor } from "./tools.js";
import { renderPanel, openLogic } from "./panel.js";
import { initAttack, attackOptions, beginAttack, sheetOf } from "./attack.js";
import { initJoin } from "./join.js";
import { initTable } from "./table.js";
import { EFFECT_PRESETS, effectsOf, effectRemaining, makeEffect, damageAdjustment } from "./effects.js";
import { initExplored } from "./explored-vtt.js";
import { visibleToPlayer } from "./visibility.js";

S.refreshLighting = () => drawObjects();

const map = $("#map");
let prevStates = null, objDrag = null;
const loadedAt = Date.now();

// ---- sync -----------------------------------------------------------------
(async () => {
  if (!S.isGM) return;
  if ((await read("seeded")) == null) {   // first run only: demo content. "seeded" stops a cleared scene from being refilled
    if ((await read("objects")) == null) { const d = demo(); await rawPut("objects", d.objects); await rawPut("tokens", d.tokens); }
    if ((await read("map")) == null) await rawPut("map", demoMap());
    await rawPut("seeded", true);
  }
})();
for (const part of ["floors", "walls", "roofs", "props", "labels", "fog", "holes"]) watch(`map/${part}`, (v) => { S.map[part] = v || {}; drawMap(); drawObjects(); drawTokens(); document.dispatchEvent(new Event("vttvisibilitychange")); });
function showLevel(lv) { S.level = S.map.level = lv; drawMap(); drawObjects(); drawTokens(); drawWalls(); document.dispatchEvent(new Event("levelchange")); }
function followOwnFloor() {   // a player always looks at the floor their token is on
  const id = !S.isGM && myTokenId(); if (!id) return false;
  S.v3d?.setWalker(id);
  const lv = S.tokens[id].lv ?? 0; if (lv !== (S.level ?? 0)) showLevel(lv);
  return true;
}
watch("map/level", (v) => { if (!followOwnFloor()) showLevel(Number(v) || 0); });
addEventListener("vtt-me-changed", () => followOwnFloor());
watch("map/levelNames", (v) => { S.map.levelNames = v || {}; });
initTools(); initView(); initInitiative(); initScenes(); initImages(); initRefImage(); initMapImage(); initReplace(); initMeasure(); initDice(); initHandouts(); initRollCall(); initAtmosphere(); initAttack(); initCmd(); initTable(); initExplored();
S.exploredRedraw = () => { drawMap(); drawTokens(); };
{   // floor switcher on the VTT toolbar: players see the floor name, the GM gets up/down
  const box = document.createElement("div"); box.id = "floorsw";
  box.innerHTML = (S.isGM ? '<button type="button" data-d="1" title="Floor up">▲</button>' : "") + '<span class="fl"></span>' + (S.isGM ? '<button type="button" data-d="-1" title="Floor down">▼</button>' : "");
  toolbar("vtt", "VTT Controls", 16).body.append(box);
  const label = () => { const lv = S.level ?? S.map.level ?? 0; box.querySelector(".fl").textContent = S.map.levelNames?.[lv] || (lv === 0 ? "Ground" : `Floor ${lv}`); };
  box.addEventListener("click", (e) => { const d = Number(e.target.closest("button")?.dataset.d); if (!d) return; const lv = (S.level ?? 0) + d; S.level = lv; rawPut("map/level", lv); label(); document.dispatchEvent(new Event("levelchange")); });
  box.addEventListener("pointerdown", (e) => e.stopPropagation());
  watch("map/level", label); watch("map/levelNames", label); document.addEventListener("levelchange", label); label();
  document.addEventListener("keydown", (e) => { if (!S.isGM || e.target.closest?.("input,textarea,select,[contenteditable]")) return; if (e.key === "PageUp" || e.key === "PageDown") { box.querySelector(`button[data-d="${e.key === "PageUp" ? 1 : -1}"]`)?.click(); e.preventDefault(); } });
}
watch("map/size", (v) => { S.map.size = v || null; applyView(); drawMap(); });
watch("objects", (v) => {
  const before = prevStates; S.objects = v || {};
  if (before) for (const [id, o] of Object.entries(S.objects)) if (o.kind === "door" && before[id] && before[id] !== o.state && (S.isGM || visibleToPlayer(o, Object.values(S.map.fog || {}), false, S.currentVisible, S.map.exploredEnabled !== false))) play(o.state === "open" ? "door-open" : "door-close");
  prevStates = Object.fromEntries(Object.entries(S.objects).map(([id, o]) => [id, o.state]));
  if (S.isGM && before) for (const [id, o] of Object.entries(S.objects))   // an event output just fired
    if (KINDS[o.kind]?.role === "event" && o.state === "fired" && before[id] === "armed") { rawPatch(onFired(id, o).changes); if (o.kind === "initiative") startInitiative(); }
  drawWalls(); drawObjects(); renderPanel(); afterChange();
});
watch("tokens", (v) => { S.tokens = v || {}; followOwnFloor(); drawTokens(); drawTray(); afterChange(); document.dispatchEvent(new Event("tokenschanged")); trackPcs(); });
// Live HP: every PC token follows its sheet (characters/pcs/<id>/combat) and redraws when it changes.
S.pcLive = {}; S.tokPc = {};
const pcWatched = new Set();
let pcTrackBusy = false;
async function trackPcs() {
  if (pcTrackBusy) return; pcTrackBusy = true;
  try {
    for (const [tid, t] of Object.entries(S.tokens)) {
      if (!isPcToken(t) || S.tokPc[tid]) continue;
      const pcId = await pcIdFor(t); if (!pcId) continue;
      S.tokPc[tid] = pcId;
      if (!pcWatched.has(pcId)) { pcWatched.add(pcId); watchAt(`characters/pcs/${pcId}/combat`, (c) => { S.pcLive[pcId] = c || null; drawTokens(); liveMenu(pcId); }); }
    }
  } finally { pcTrackBusy = false; }
}
function liveMenu(pcId) {
  const live = S.pcLive[pcId];
  const c = S.pcLive[pcId], tid = tokMenu?.dataset.tid;
  if (c?.hp_max && tid && S.tokPc[tid] === pcId) tokMenu.children[1].textContent = `HP: ${c.hp_current ?? c.hp_max} / ${c.hp_max}${c.temp_hp ? ` (+${c.temp_hp} temp)` : ""}`;
}
watch("groups", (v) => { S.groups = v || {}; renderPanel(); afterChange(); });
watch("events/last", (e) => { if (S.isGM && e && e.t > loadedAt) { const t = $("#toast"); t.textContent = e.text; t.style.display = "block"; setTimeout(() => (t.style.display = "none"), 3500); } });
// Only the GM client runs the rules, so two clients never race.
function afterChange() {
  if (!S.isGM) return;
  const doors = doorsList().filter(d => (d.lv ?? 0) === (S.level ?? 0)), blockers = [...Object.values(S.map.walls || {}).filter(w => (w.lv ?? 0) === (S.level ?? 0) && !w.hidden).flatMap((w) => wallPieces(w, doors)), ...doors.filter((d) => !d.win && !["window", "bars", "portcullis", "arch"].includes(d.doorKind || d.kindName) && d.state !== "open").map((d) => d.dir === "v" ? [d.x, d.y - 20, d.x, d.y + 20] : [d.x - 20, d.y, d.x + 20, d.y])];
  const changes = evaluate({ objects: S.objects, groups: S.groups, tokens: S.tokens, blockers, props: S.map.props, walls: S.map.walls });
  if (Object.keys(changes).length) rawPatch(changes);
}

// ---- who am I (players): picks which token you may move ------------------------------
let me = null; try { me = JSON.parse(localStorage.getItem("vtt-me")); } catch { /* none */ }
function canMove(id) {
  const t = S.tokens[id]; if (!t) return false;
  if (S.isGM) return true;
  if (S.choosing) return false;      // the "Who are you?" card is still up
  if (!isPcToken(t)) return false;   // enemies and NPCs belong to the GM
  if (!me) return true;              // nobody chosen yet: any player token
  return t.pc ? t.pc === me.id : String(t.label || "").toLowerCase() === me.name.toLowerCase();
}
if (!S.isGM) addBarButton({ quick: true, id: "me", icon: "🧝", label: "Me", title: "Choose which character you move", onClick: async (e, b) => {
  const list = await loadPcs();
  dropMenu(b, [["I am…", null], ...list.filter((c) => c.name).map((c) => [c.name, () => setMe({ id: c.id, name: c.name })]), ["Anyone (no limit)", () => setMe(null)]]);
} });

// ---- map interaction -------------------------------------------------------
function mapPoint(e) {
  const p = map.createSVGPoint(); p.x = e.clientX; p.y = e.clientY;
  return p.matrixTransform(map.getScreenCTM().inverse());
}
document.addEventListener("click", (e) => { if (e.target.closest("button, select, summary")) play("click"); });
function pickSpot(p) {   // the cell a trigger rule is waiting for
  const spot = cellOf(p), { zone, id } = S.pick; S.pick = null; map.classList.remove("picking");
  if (zone === "when") S.draft.when.find((c) => c.id === id).at = spot;
  else if (zone === "then") S.draft.then.find((c) => c.id === id).to = spot;
  else if (zone === "prop") put(`objects/${id}/to`, spot);
  renderPanel();
}
function toggleSelected(id) { S.selected.has(id) ? S.selected.delete(id) : S.selected.add(id); S.lastSel = id; drawObjects(); renderPanel(true); }
map.addEventListener("pointerdown", (e) => {
  if (S.pick?.zone === "link") { if (e.button === 0) connectTo(e, e.target.closest(".obj, .prop, .wall")?.dataset.id || wallAt(mapPoint(e))); return; }
  if (e.button !== 0 || (!S.isGM && S.paused)) return;   // only the left button draws, drags or uses; right-click is the menu
  const { objects, tokens } = S;
  const p = mapPoint(e), objEl = e.target.closest(".obj"), tokEl = e.target.closest(".token");
  if (!S.pick && toolDown(e, p)) return;   // GM map-building tools
  if (!S.puzzleMode) {   // normal play: the GM clicks switches and dials; players use right-click > Interact
    const o = S.isGM && objEl && objects[objEl.dataset.id];
    if (SOURCES.includes(o?.kind)) { objDrag = { id: objEl.dataset.id, el: objEl, x0: p.x, y0: p.y, moved: false, use: true }; map.setPointerCapture(e.pointerId); return; }   // drag moves it, a click uses it
    if (o?.kind === "light" || o?.kind === "dial") return useObject(objEl.dataset.id);
  } else {
    if (S.pick) return pickSpot(p);
    if (objEl) { objDrag = { id: objEl.dataset.id, el: objEl, x0: p.x, y0: p.y, moved: false }; map.setPointerCapture(e.pointerId); return; }
  }
  if (tokEl && !S.isGM) return;   // only the GM drags tokens; players use the keyboard
  if (tokEl) { S.dragging = tokEl;tokEl.setPointerCapture(e.pointerId); e.preventDefault(); }
});
map.addEventListener("pointermove", (e) => {
  if (toolMove(e, mapPoint(e))) return;
  if (objDrag) {
    const p = mapPoint(e);
    if (Math.hypot(p.x - objDrag.x0, p.y - objDrag.y0) > 6) objDrag.moved = true;
    if (objDrag.moved) { const s = snapFor(S.objects[objDrag.id].kind, p), o = S.objects[objDrag.id];
      objDrag.snap = s; objDrag.el.setAttribute("transform", `translate(${s.x - o.x} ${s.y - o.y})`); }
    return;
  }
  const d = S.dragging;
  if (!d || !d.hasPointerCapture(e.pointerId)) return;
  const c = cellOf(mapPoint(e));
  d.dataset.x = c.x; d.dataset.y = c.y;
  d.setAttribute("transform", `translate(${d.dataset.x} ${d.dataset.y})`);
  S.v3d?.dragToken(d.dataset.id, c);
});
const release = (e) => {
  if (e.button > 0 || toolUp()) return;
  if (objDrag) {
    const { id, moved, snap, use } = objDrag; objDrag = null;
    if (moved && snap) put(`objects/${id}`, { ...S.objects[id], x: snap.x, y: snap.y, sx: snap.x, sy: snap.y, ...(snap.dir ? { dir: snap.dir } : {}) });
    else if (use) useObject(id); else toggleSelected(id);
    return;
  }
  if (!S.dragging) return;
  const { id, x, y } = S.dragging.dataset; S.dragging = null;
  if (x != null) patch({ [`tokens/${id}/x`]: +x, [`tokens/${id}/y`]: +y }); else drawTokens();
};
// GM right-click: reveal or hide an object (a passed perception roll reveals a trap).
// Right-click a token (anyone): a menu with its name, HP and actions. A PC's sheet opens only from "View sheet".
let tokMenu = null;
const closeTokMenu = () => { tokMenu?.remove(); tokMenu = null; };
document.addEventListener("pointerdown", (e) => { if (tokMenu && !tokMenu.contains(e.target)) closeTokMenu(); }, true);   // capture: map panning stops the event before it bubbles
document.addEventListener("keydown", (e) => { if (e.key !== "Escape") return; closeTokMenu(); if (S.pick?.zone === "link") { S.pick = null; map.classList.remove("picking"); } });
const SHEET_URL = "https://geezjonny.github.io/GeezSheets/companion.html";   // GeezSheets (sheet.html?char=<pc id>); change if hosted elsewhere
let pcs = null;   // player characters from the main app (read only): [{ id, name }]
function loadPcs() {   // the pending read is shared, so a second caller never gets an empty list; a failed read is retried
  return pcs ||= readAt("characters/pcs")
    .then((all) => Object.entries(all || {}).map(([id, c]) => ({ id, name: c?.name || c?.identity?.name || c?.basic?.name || "" })))
    .catch((err) => { console.warn("Could not read PCs", err); pcs = null; return []; });
}
// ---- GeezSheets write-back: a PC token's HP and conditions live on their sheet (same fields the sheet writes) ----
async function pcIdFor(t) {
  if (!t || t.npc) return null;
  if (t.pc) return t.pc;
  const nm = String(t.label || "").toLowerCase();
  return nm ? (await loadPcs()).find((c) => c.name.toLowerCase() === nm)?.id || null : null;
}
async function mirrorConditions(tokenId, key, on) {
  if (!S.isGM) return;
  try {
    const pcId = await pcIdFor(S.tokens[tokenId]); if (!pcId) return;
    const label = CONDITIONS[key][0];
    await txnAt(`characters/pcs/${pcId}/combat/conditions`, (cur) => {
      const list = (Array.isArray(cur) ? cur : Object.values(cur || {})).filter((x) => String(x).toLowerCase() !== key);
      if (on) list.push(label);
      return list.length ? list : null;
    });
  } catch (err) { console.warn("Could not write conditions to the sheet", err); }
}
// Damage / heal exactly as sheet.html does: temp HP soaks damage, death saves reset above 0.
function sheetHpChange(c, delta, heal) {
  if (!c) return c;
  const cur = Number(c.hp_current) || 0, tmp = Math.max(0, Number(c.temp_hp) || 0), n = (v) => Math.max(0, Math.min(3, Number(v) || 0));
  const hp = heal ? Math.min(Number(c.hp_max) || 1, cur + delta) : Math.max(0, cur - Math.max(0, delta - tmp));
  const saves = { success: n(c.death_saves?.success), fail: n(c.death_saves?.fail) };
  if (!heal && cur === 0) saves.fail = n(saves.fail + 1);
  return { ...c, hp_current: hp, temp_hp: heal ? tmp : Math.max(0, tmp - delta), death_saves: hp > 0 ? { success: 0, fail: 0 } : saves };
}
const sheetWins = {};   // floating GeezSheets sheet per PC; the sheet page is live from Firebase itself
function openSheetWindow(pc) {
  let w = sheetWins[pc.id];
  if (!w) {
    w = sheetWins[pc.id] = floatWindow({ id: "sheet-" + pc.id, title: pc.name || "Sheet", x: 120, y: 90 });
    w.el.dataset.noscale = "1";   // the sheet is its own page: give it the room, don't magnify it
    if (!w.el.style.width) Object.assign(w.el.style, { width: "min(560px, 90vw)", height: "min(680px, 80vh)" });
    w.body.style.cssText = "padding:0;overflow:hidden";
    w.body.innerHTML = `<iframe src="${SHEET_URL}?char=${encodeURIComponent(pc.id)}" style="width:100%;height:100%;border:0" title="Character sheet"></iframe>`;
  }
  w.show();
}
document.addEventListener("turnchanged", drawTokens);
async function showTokenMenu(e, id) {
  closeTokMenu();
  const t = S.tokens[id]; if (!t || !visibleToPlayer(t, Object.values(S.map.fog || {}), S.isGM, S.currentVisible, S.map.exploredEnabled !== false)) return;
  const x = e.clientX, y = e.clientY;
  const menu = tokMenu = document.createElement("div"); menu.id = "tokmenu"; menu.dataset.tid = id;
  document.body.appendChild(menu);
  const place = () => { const r = menu.getBoundingClientRect(); menu.style.left = Math.max(4, Math.min(innerWidth - r.width - 4, x)) + "px"; menu.style.top = Math.max(4, Math.min(innerHeight - r.height - 4, y)) + "px"; };
  const built = buildTokenMenu(menu, id, closeTokMenu, () => tokMenu === menu);
  place(); await built; place();
}
// Fills a container with a token's info and controls. done() is called after a button action; alive() says whether the container is still showing.
async function buildTokenMenu(menu, id, done, alive) {
  const t = S.tokens[id]; if (!t) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const name = t.label || id;
  menu.innerHTML = `<div><b>${esc(name)}</b></div><div>HP: ${t.hp != null ? `${t.hp} / ${t.max ?? t.hp}` : "—"}</div>`;
  if (S.isGM && t.hp != null && !S.pcLive?.[S.tokPc?.[id]]?.hp_max) {   // GM: adjust an enemy's HP (a PC's HP lives on the sheet)
    menu.insertAdjacentHTML("beforeend", `<div><button data-d="-1">−</button> <button data-d="1">+</button></div>`);
    menu.addEventListener("click", (ev) => { const b = ev.target.closest("[data-d]"); if (!b) return; const k = S.tokens[id]; if (!k) return;
      const hp = Math.max(0, Math.min(k.max ?? k.hp, k.hp + +b.dataset.d)); put(`tokens/${id}/hp`, hp); menu.children[1].textContent = `HP: ${hp} / ${k.max ?? k.hp}`; });
  }
  if (S.isGM) {
    const hb = document.createElement("button"); hb.textContent = t.hidden ? "Reveal to players" : "Hide from players";
    hb.addEventListener("click", () => { done(); put(`tokens/${id}/hidden`, t.hidden ? null : true); }); menu.append(hb);
  }
  if (S.isGM) {   // pins the token for its player (grappled, restrained...); the GM can still drag it
    const mb = document.createElement("button"); mb.textContent = t.frozen ? "Enable movement" : "Disable movement";
    mb.addEventListener("click", () => { done(); put(`tokens/${id}/frozen`, t.frozen ? null : true); }); menu.append(mb);
  }
  if (S.isGM) {   // hold a torch: lights the area around the token and clears fog as it moves
    const lb = document.createElement("button"); lb.textContent = t.torch ? "Light: put out torch" : "Light: hold torch";
    lb.addEventListener("click", () => { done(); put(`tokens/${id}/torch`, t.torch ? null : true); }); menu.append(lb);
  }
  if (S.isGM) { const pb = document.createElement("button"); pb.textContent = "Picture…"; pb.addEventListener("click", () => { done(); openTokenPicker(id); }); menu.append(pb); }
  if (S.isGM) {
    const ib = document.createElement("button"), inn = inInitiative(id); ib.textContent = inn ? "Remove from initiative" : "Add to initiative";
    ib.addEventListener("click", () => { done(); inn ? removeFromInitiative(id) : addToInitiative(id); }); menu.append(ib);
  }
  if (S.isGM) { const cb = document.createElement("button"); cb.textContent = "Duplicate"; cb.addEventListener("click", () => { done(); duplicate("token", id); }); menu.append(cb); }
  if (S.isGM) { const db = document.createElement("button"); db.textContent = "Delete token"; db.addEventListener("click", () => { done(); if (inInitiative(id)) removeFromInitiative(id); put(`tokens/${id}`, null); }); menu.append(db); }
  if (S.isGM) {   // condition > pick: toggles a coloured ring around the token
    const d = document.createElement("details"); d.innerHTML = `<summary>Condition</summary>` + Object.entries(CONDITIONS).map(([k, [n, c]]) => `<label class="cond"><input type="checkbox" data-c="${k}" ${t.conditions?.[k] ? "checked" : ""}><i style="background:${c}"></i>${n}</label>`).join("");
    d.addEventListener("change", (ev) => { const k = ev.target.dataset.c; if (!k) return; put(`tokens/${id}/conditions/${k}`, ev.target.checked ? true : null); mirrorConditions(id, k, ev.target.checked); });
    menu.append(d);
  }
  if (S.isGM) {
    const d = document.createElement("details"); d.className = "effects-box";
    const choices = Object.entries(EFFECT_PRESETS).map(([k, e]) => `<option value="${k}">${e.name}</option>`).join("");
    d.innerHTML = `<summary>Effects${effectsOf(t).length ? ` (${effectsOf(t).length})` : ""}</summary><div class="effect-add"><select data-effect-preset>${choices}</select><input data-effect-rounds type="number" min="1" placeholder="rounds" title="Blank means until removed"><button data-effect-add type="button">Add</button></div><div class="effect-custom" hidden><input data-effect-name placeholder="Name"><input data-effect-ac type="number" placeholder="AC" title="AC bonus"><input data-effect-attack type="number" placeholder="Attack" title="Attack bonus"><input data-effect-save type="number" placeholder="Save" title="Save bonus"><input data-effect-resist placeholder="Resist types"><input data-effect-vuln placeholder="Vulnerable types"><input data-effect-immune placeholder="Immune types"><input data-effect-note placeholder="Note"></div><div class="effect-list"></div>`;
    const preset = d.querySelector("[data-effect-preset]"), custom = d.querySelector(".effect-custom");
    preset.addEventListener("change", () => { custom.hidden = preset.value !== "custom"; });
    const list = d.querySelector(".effect-list");
    for (const effect of effectsOf(t)) { const row = document.createElement("div"); row.className = "effect-row"; row.textContent = `${effect.name}${effect.rounds == null ? " · ∞" : ` · ${effectRemaining(effect, S.round || 1)} rounds`}`; const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "×"; remove.title = "Remove effect"; remove.addEventListener("click", () => { put(`tokens/${id}/effects`, effectsOf(t).filter((x) => x.id !== effect.id)); done(); }); row.append(remove); list.append(row); }
    d.querySelector("[data-effect-add]").addEventListener("click", () => { const select = d.querySelector("[data-effect-preset]"), rounds = d.querySelector("[data-effect-rounds]").value, csv = (key) => d.querySelector(`[data-effect-${key}]`).value.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean), customValue = select.value === "custom" ? { name: d.querySelector("[data-effect-name]").value || "Custom", ac: +d.querySelector("[data-effect-ac]").value || 0, attack: +d.querySelector("[data-effect-attack]").value || 0, save: +d.querySelector("[data-effect-save]").value || 0, damageResist: csv("resist"), damageVuln: csv("vuln"), damageImmune: csv("immune"), note: d.querySelector("[data-effect-note]").value } : {}; const effects = [...effectsOf(t), makeEffect(select.value, rounds === "" ? null : +rounds, S.round || 1, customValue)]; put(`tokens/${id}/effects`, effects); done(); });
    menu.append(d);
  }
  if (S.isGM) addFields(menu, settingsFor("token", id).fields);
  if (S.isGM) {   // Attack > weapon / cantrip / spell, then aim on the map (attack.js)
    const ab = document.createElement("button"); ab.textContent = "⚔ Attack…";
    ab.addEventListener("click", async (ev) => { const opts = await attackOptions(t, await pcIdFor(t)); showAttackMenu(ev, id, opts); }); menu.append(ab);
  }
  if (t.npc) { const nb = document.createElement("button"); nb.textContent = "View stat block"; nb.addEventListener("click", () => openNpcWindow(id)); menu.append(nb); }
  const invBtn = (pcId) => { const b = document.createElement("button"); b.textContent = "Inventory"; b.addEventListener("click", (ev) => { openInventory({ tokenId: id, name, pcId, isGM: S.isGM, x: ev.clientX + 12, y: ev.clientY + 12 }); done(); }); menu.append(b); };
  if (t.npc) { if (S.isGM) invBtn(null); return; }
  const pc = t.pc ? { id: t.pc } : (await loadPcs()).find((c) => c.name.toLowerCase() === String(name).toLowerCase());
  if (pc) try {   // a PC's HP comes live from their sheet, not the token's copy
    const c = (await readAt(`characters/pcs/${pc.id}/combat`)) || {};
    if (c.hp_max && alive()) menu.children[1].textContent = `HP: ${c.hp_current ?? c.hp_max} / ${c.hp_max}${c.temp_hp ? ` (+${c.temp_hp} temp)` : ""}`;
  } catch (err) { console.warn("Could not read PC HP", err); }
  const viewSheet = () => { const a = document.createElement("button"); a.textContent = "View sheet"; a.addEventListener("click", () => { openSheetWindow(pc); done(); }); menu.append(a); };
  if (!S.isGM) { if (pc && alive()) viewSheet(); return; }   // players: the companion window; its inventory and equipment are inside it
  if (pc && S.isGM && alive()) {   // GM: damage / heal the real sheet, live
    const w = document.createElement("div"); w.innerHTML = `<input type="number" min="1" value="1" style="width:3.5rem"> <button data-h="dmg">Damage</button> <button data-h="heal">Heal</button>`;
    w.addEventListener("click", async (ev) => {
      const b = ev.target.closest("[data-h]"); if (!b) return; const amt = Math.floor(+w.querySelector("input").value);
      if (!(amt > 0)) return;
      try {
        const r = await txnAt(`characters/pcs/${pc.id}/combat`, (c) => sheetHpChange(c, amt, b.dataset.h === "heal"));
        const c = r.snapshot.val(); if (c && alive()) menu.children[1].textContent = `HP: ${c.hp_current ?? c.hp_max} / ${c.hp_max}${c.temp_hp ? ` (+${c.temp_hp} temp)` : ""}`;
      } catch (err) { console.warn("HP not saved", err); if (alive()) menu.children[1].textContent = "HP not saved: " + err.message; }
    });
    menu.append(w);
  }
  if (pc && alive()) invBtn(pc.id);
  if (pc && alive()) { const eb = document.createElement("button"); eb.textContent = "Equipment"; eb.addEventListener("click", (ev) => { openEquipment({ tokenId: id, name, pcId: pc.id, isGM: S.isGM, x: ev.clientX + 12, y: ev.clientY + 12 }); done(); }); menu.append(eb); }
  else if (!pc && S.isGM && alive()) invBtn(null);   // a token that is not a known PC keeps its own list
  if (pc && alive()) viewSheet();
}
map.addEventListener("contextmenu", (e) => {
  const tokEl = e.target.closest(".token");
  if (tokEl) { e.preventDefault(); return showTokenMenu(e, tokEl.dataset.id); }
  closeTokMenu();
  const objEl = e.target.closest(".obj"), propEl = e.target.closest(".prop"), p = mapPoint(e);
  if (!S.isGM) return objEl && interactMenu(e, objEl.dataset.id);
  if (objEl) {
    const id = objEl.dataset.id, o = S.objects[id]; if (!o) return; e.preventDefault();
    return showActionMenu(e, o.label || o.kind, [...(o.kind === "door" ? [[o.state === "open" ? "Close" : "Open", () => put(`objects/${id}/state`, o.state === "open" ? "closed" : "open")], [o.locked ? "Unlock" : "Lock", () => put(`objects/${id}/locked`, o.locked ? null : true)]] : []), ...(o.kind === "light" ? [[o.state === "on" ? "Turn light off" : "Turn light on", () => useObject(id)]] : []), ...(o.kind !== "door" && o.kind !== "light" ? [["Logic", () => openLogic(id)]] : []), ...(o.kind === "door" ? [["Replace all like this...", () => openReplace({ category: "door", from: o.doorKind || (o.win ? "window" : "wood") })]] : o.kind === "light" ? [["Replace all like this...", () => openReplace({ category: "light", from: o.color })]] : []), [o.hidden ? "Reveal to players" : "Hide from players", () => put(`objects/${id}/hidden`, !o.hidden)], ["Duplicate", () => duplicate("object", id)], ["Delete", () => put(`objects/${id}`, null)]], settingsFor("object", id).fields, (m) => linkMenu(m, id));
  }
  if (propEl) {
    const id = propEl.dataset.id, a = S.map.props[id]; if (!a) return; e.preventDefault();
    return showActionMenu(e, a.kind, [["Replace all like this...", () => openReplace({ category: "prop", from: a.kind })], ...lightItem(id, a), [a.hidden ? "Reveal to players" : "Hide from players", () => put(`map/props/${id}/hidden`, a.hidden ? null : true)], ["Duplicate", () => duplicate("prop", id)], ["Delete", () => put(`map/props/${id}`, null)]], settingsFor("prop", id).fields);
  }
  const labelEl = e.target.closest(".map-label");
  if (labelEl) { const id = labelEl.dataset.id, a = S.map.labels?.[id]; if (!a) return; e.preventDefault(); return showActionMenu(e, a.text || "Label", [["Delete", () => put(`map/labels/${id}`, null)]], settingsFor("label", id).fields); }
  groundMenu(e, p);
});
function groundMenu(e, p) {
  const wl = wallAt(p);
  if (wl) { e.preventDefault(); return showActionMenu(e, "Wall", [["Replace all like this...", () => openReplace({ category: "wall", from: S.map.walls[wl]?.mat || "" })], wallItem(wl), ["Delete", () => put(`map/walls/${wl}`, null)]], settingsFor("wall", wl).fields); }
  const fg = fogAt(p);
  if (fg) { e.preventDefault(); const f = S.map.fog[fg]; return showActionMenu(e, "Fog", [[f.open ? "Re-fog room" : "Reveal room", () => put(`map/fog/${fg}/open`, !f.open)], ["Delete", () => put(`map/fog/${fg}`, null)]]); }
  const r = roofAt(p);
  if (r) { e.preventDefault(); const rf = S.map.roofs[r]; return showActionMenu(e, "Roof", [["Replace all like this...", () => openReplace({ category: "roof", from: rf.mat || "" })], [rf.open ? "Drop roof" : "Lift roof", () => put(`map/roofs/${r}/open`, !rf.open)], ["Delete", () => put(`map/roofs/${r}`, null)]]); }
  const im = imageAt(p);
  if (im) { e.preventDefault(); return showActionMenu(e, "Image", [["Delete", () => removeImage(im)]], imageFields(im).map((f) => ({ ...f, path: `map/images/${im}/${f.key}`, to: (v) => (f.key === "op" ? Math.max(0, Math.min(1, v)) : Math.max(f.key === "w" || f.key === "h" ? 1 : -99, v) * 40) }))); }
  const fl = floorAt(p);
  if (fl) { e.preventDefault(); showActionMenu(e, "Floor", [["Replace all like this...", () => openReplace({ category: "floor", from: S.map.floors[fl]?.mat || "" })], ["Delete", () => put(`map/floors/${fl}`, null)]], settingsFor("floor", fl).fields); }
}
// Attack picker: one row per weapon / cantrip / spell; picking one starts aiming on the map.
function showAttackMenu(e, id, opts) {
  const hooks = { applyDamage: applyTokenDamage, sheetFor: async (tid) => sheetOf(S.tokens[tid], await pcIdFor(S.tokens[tid])) };
  showActionMenu(e, `${S.tokens[id]?.label || id} attacks`, opts.map((o) => [`${o.group === "Weapons" ? "⚔" : "✦"} ${o.label}${o.group.startsWith("Level") ? ` (L${o.level})` : o.group === "Cantrips" ? " (cantrip)" : ""}${o.dmg ? ` · ${o.dmg}` : ""}`, () => beginAttack(id, o, hooks)]));
}
// Damage from an attack: an enemy token's own HP, or a PC's sheet (temp HP soaks it first).
async function applyTokenDamage(tid, amt, type = "") {
  const t = S.tokens[tid]; if (!t || !(amt > 0)) return;
  const adjusted = damageAdjustment(t, type, amt);
  amt = adjusted.amount;
  if (adjusted.reason !== "normal") { const toast = document.getElementById("toast"); if (toast) { toast.textContent = `${t.label || tid}: ${adjusted.reason} to ${type || "damage"}`; toast.style.display = "block"; setTimeout(() => (toast.style.display = "none"), 2500); } }
  if (!(amt > 0)) return;
  if (t.hp != null && !S.pcLive?.[S.tokPc?.[tid]]?.hp_max) return put(`tokens/${tid}/hp`, Math.max(0, t.hp - amt));
  const pcId = await pcIdFor(t); if (!pcId) return;
  try { await txnAt(`characters/pcs/${pcId}/combat`, (c) => sheetHpChange(c, amt, false)); } catch (err) { console.warn("HP not saved", err); }
}
// NPCs have no GeezSheets page, so their record (characters/npcs/<id>) is shown as a movable stat-block window.
const npcWins = {};
async function openNpcWindow(tid) {
  const t = S.tokens[tid]; if (!t) return;
  const w = npcWins[tid] ||= floatWindow({ id: "npc-" + tid, title: t.label || "NPC", x: 140, y: 100 });
  w.body.style.cssText = "width:min(380px,90vw);max-height:70vh;overflow:auto"; w.body.textContent = "Loading…"; w.show();
  const c = await sheetOf(t, null), esc = (v) => String(v ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  if (!c) { w.body.textContent = "No stat block found for this token."; return; }
  const cb = c.combat || {}, st = c.stats || {}, sp = c.spellcasting;
  w.body.innerHTML = `<div style="line-height:1.45"><b style="font-size:1rem">${esc(c.name || t.label)}</b><div>${esc([c.size, c.species || c.race, c.class, c.level ? "Lv " + c.level : ""].filter(Boolean).join(" · "))}</div>
    <div>AC <b>${esc(cb.ac ?? "—")}</b> · HP <b>${esc(t.hp ?? cb.hp_max ?? "—")}${t.max ? " / " + esc(t.max) : ""}</b> · Speed ${esc(cb.speed ?? "—")}</div>
    <div>${Object.entries(st).map(([k, v]) => `${esc(k.toUpperCase())} <b>${esc(v)}</b>`).join(" · ")}</div>
    ${(c.attacks || []).length ? `<hr><b>Attacks</b>` + c.attacks.map((a) => `<div>${esc(a.name)} ${esc(a.to_hit ?? a.attack_bonus ?? "")} · ${esc(a.damage || a.damage_dice || "")} ${esc(a.damage_type || "")}</div>`).join("") : ""}
    ${sp?.spells?.length ? `<hr><b>Spells</b><div>${sp.spells.map((x) => esc(x.name)).join(", ")}</div>` : ""}</div>`;
}
// ---- connections: right-click a lever, button, plate or tripwire > Connect > click a target > pick what it does ----
const DOES = { light: "Toggle light", vis: "Toggle visibility", lock: "Toggle lock", open: "Toggle open", activate: "Toggle activate" };
const glows = (prop) => !!propParts(prop.kind)?.some((p) => p.glow);
const lightItem = (id, p) => (glows(p) ? [[p.off ? "Turn light on" : "Turn light off", () => put(`map/props/${id}/off`, !p.off)]] : []);
const wallItem = (id) => [S.map.walls[id]?.hidden ? "Show wall" : "Hide wall", () => put(`map/walls/${id}/hidden`, !S.map.walls[id]?.hidden)];
function linkTarget(id) {
  const o = S.objects[id]; if (o) return { o, type: "object", name: o.label || KINDS[o.kind]?.label || id };
  const p = S.map.props?.[id]; if (p) return { o: p, type: "prop", name: PROPS[p.kind] || p.kind, glows: glows(p) };
  const w = S.map.walls?.[id]; return w ? { o: w, type: "wall", name: `Wall at ${Math.round(w.x1 / 40)},${Math.round(w.y1 / 40)}` } : null;
}
function startConnect(id) {
  setTool(null); S.pick = { zone: "link", id }; map.classList.add("picking");   // building stops, so the click picks instead of placing
  toast("Click the object to connect (Esc cancels).");
}
function connectTo(e, tid) {
  const src = S.pick.id, t = tid !== src && linkTarget(tid);
  if (!t || !S.objects[src]) return;   // keep waiting for a click on an object, prop or wall
  S.pick = null; map.classList.remove("picking");
  showActionMenu(e, `${S.objects[src].label} → ${t.name}`, behaviorsFor(t.type, t.o, t.glows).map((does) => [DOES[does], () => patch({ [`objects/${src}/links/${tid}/${does}`]: true, [`objects/${src}/was`]: S.objects[src].state })]));
}
function linkMenu(menu, id) {
  const o = S.objects[id]; if (!SOURCES.includes(o?.kind)) return;
  const button = (label, fn, into = menu) => { const b = document.createElement("button"); b.textContent = label; b.addEventListener("click", () => { closeTokMenu(); fn(); }); into.append(b); };
  const section = (label, into) => { const d = document.createElement("details"), s = document.createElement("summary"); s.textContent = label; d.append(s); into.append(d); return d; };
  button("Connect", () => startConnect(id));
  const links = Object.entries(o.links || {}).map(([tid, does]) => [tid, does, linkTarget(tid)]).filter(([, , t]) => t);
  if (!links.length) return;
  button(links.length > 1 ? "Disconnect all" : "Disconnect", () => put(`objects/${id}/links`, null));
  const all = section("Connections", menu);
  for (const [tid, does, t] of links) {
    const one = section(t.name, all);
    for (const key of behaviorsFor(t.type, t.o, t.glows)) {
      const row = document.createElement("label"), box = Object.assign(document.createElement("input"), { type: "checkbox", checked: !!does[key] });
      box.addEventListener("change", () => put(`objects/${id}/links/${tid}/${key}`, box.checked));   // false is stored, so an unticked link stays listed
      row.append(box, ` ${DOES[key]}`); one.append(row);
    }
    button("Disconnect", () => put(`objects/${id}/links/${tid}`, null), one);
  }
}
// Generic right-click menu: items are [label, action]; stays open until you pick something or click away.
function showActionMenu(e, title, items, fields = [], extra) {
  closeTokMenu();
  const menu = tokMenu = document.createElement("div"); menu.id = "tokmenu";
  const b = document.createElement("b"); b.textContent = title; menu.append(b);
  extra?.(menu);
  for (const [label, fn] of items) { const btn = document.createElement("button"); btn.textContent = label; btn.addEventListener("click", () => { closeTokMenu(); fn(); }); menu.append(btn); }
  addFields(menu, fields);
  menu.style.left = e.clientX + "px"; menu.style.top = e.clientY + "px"; document.body.appendChild(menu);
  const r = menu.getBoundingClientRect(); menu.style.left = Math.max(4, Math.min(innerWidth - r.width - 4, e.clientX)) + "px"; menu.style.top = Math.max(4, Math.min(innerHeight - r.height - 4, e.clientY)) + "px";
}
// Settings rows: each change is written straight to the database.
function addFields(menu, fields) {
  for (const f of fields) {
    const row = document.createElement("label"), esc = (v) => String(v).replace(/"/g, "&quot;");
    row.append(f.label + " ");
    row.insertAdjacentHTML("beforeend", f.opts ? `<select>${f.opts.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(f.value) ? "selected" : ""}>${l}</option>`).join("")}</select>`
      : f.type === "check" ? `<input type="checkbox" ${f.value ? "checked" : ""}>`
      : `<input type="${f.type || "text"}" value="${esc(f.value)}" ${f.min != null ? `min="${f.min}"` : ""} ${f.max != null ? `max="${f.max}"` : ""} ${f.step != null ? `step="${f.step}"` : ""} ${f.type === "number" ? 'style="width:4rem"' : ""}>${f.type === "range" ? `<output data-range-output>${esc(f.value)}</output>` : ""}`);
    row.lastElementChild.addEventListener("change", (ev) => {
      const t = ev.target, v = t.type === "checkbox" ? t.checked : t.type === "number" ? +t.value : t.value;
      put(f.path, f.to ? f.to(v) : v === "" || v === false ? null : v);
    });
    if (f.type === "range") row.lastElementChild.previousElementSibling.addEventListener("input", (ev) => { row.querySelector("[data-range-output]").value = ev.target.value; });
    menu.append(row);
  }
}
map.addEventListener("pointerup", release); map.addEventListener("pointercancel", release);

// 3D view toggle (three.js loads on first use)
let v3d = null;
const myTokenId = () => Object.keys(S.tokens).find((id) => isPcToken(S.tokens[id]) && canMove(id)) || null;   // players: their own token; GM: the first PC token
async function setView(on, first = false) {
  if (!on) return;   // the table is always 3D; "top-down" is the flat view
  if (on === !!S.v3d) { if (on) { S.v3d.setFirstPerson(first ? myTokenId() : null); S.firstPerson = first && S.v3d.isFirstPerson(); document.dispatchEvent(new Event("view3dchange")); } return; }
  try { v3d ||= await import("./view3d.js"); } catch (err) { console.error(err); return; }
  document.body.classList.toggle("is3d", on);
  if (on) document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));   // 3D is for running the game: drop any active build tool
  S.v3d = on ? v3d : null;   // the bar tools (fit, ruler, ping) check this to act on the 3D scene instead
  on ? v3d.open() : v3d.close();
  v3d.setControls(true); v3d.setFirstPerson(on && first ? myTokenId() : null); S.firstPerson = on && first && v3d.isFirstPerson(); document.dispatchEvent(new Event("view3dchange"));
}
if (!S.isGM) {   // players can look through their character's eyes: drag to look around, walk with WASD
  const eye = addBarButton({ quick: true, id: "fp", icon: "👁", label: "First person", title: "First person: drag to look around, WASD to walk", toggle: true, onClick: async (e, b) => {
    await setView(true, b.classList.contains("on"));
    if (b.classList.contains("on") && !S.firstPerson) { b.classList.remove("on"); toast("There is no character of yours on the map to see from."); }
  } });
  document.addEventListener("topdownchange", () => { if (S.v3d?.isTopDown()) { S.firstPerson = false; eye.classList.remove("on"); } });
}
{   // the flat view is the 3D table seen straight down
  const top = addBarButton({ quick: true, id: "top", icon: "⬒", label: "Top-down", title: "Look straight down", toggle: true, onClick: (e, b) => S.v3d?.setTopDown(b.classList.contains("on")) });
  document.addEventListener("topdownchange", () => top.classList.toggle("on", !!S.v3d?.isTopDown()));
}

// Drag a token or a prop in 3D: press on it, drag along the floor, release to snap to the cell (same rules as 2D).
{
  let drag = null;
  const pieceAt = (hit) => (hit?.type === "prop" ? S.map.props?.[hit.id] : hit?.type === "object" && SOURCES.includes(S.objects[hit.id]?.kind) ? S.objects[hit.id] : null);
  document.addEventListener("pointerdown", (e) => {
    drag = null; S.moving = false;
    if (!S.v3d || S.firstPerson || (S.tool && S.tool !== "prop") || S.placing || S.puzzleMode || S.pick || e.button !== 0 || !S.isGM || !e.target.closest?.("#view3d") || S.v3d.controlsBlocked()) return;
    const token = !S.tool && S.v3d.pickToken(e.clientX, e.clientY), hit = token ? null : S.v3d.peekAt(e.clientX, e.clientY), from = pieceAt(hit);
    if (!token && !from) return;
    drag = { id: token || hit.id, piece: token ? null : hit.type, from, x0: e.clientX, y0: e.clientY, moved: false, cell: null };
    S.moving = !token;   // the Props tool must not place a second one under the drag
    S.v3d.setControls(false);   // keep the camera still while it moves
  }, true);
  document.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
    const g = S.v3d?.groundAt(e.clientX, e.clientY); if (!g) return;
    drag.moved = true; drag.cell = cellOf(g);
    if (drag.piece) S.v3d.dragPiece(drag.piece, drag.id, drag.cell, drag.from); else S.v3d.dragToken(drag.id, drag.cell);
  });
  const end = (e) => {
    if (!drag) return; const d = drag; drag = null;
    S.v3d?.setControls(true);
    if (d.moved && d.cell) {
      const path = d.piece === "prop" ? `map/props/${d.id}` : d.piece ? `objects/${d.id}` : `tokens/${d.id}`;
      patch({ [`${path}/x`]: d.cell.x, [`${path}/y`]: d.cell.y, ...(d.piece === "object" ? { [`${path}/sx`]: d.cell.x, [`${path}/sy`]: d.cell.y } : {}) });
    } else if (d.piece && S.tool === "prop" && e.type === "pointerup") { const g = S.v3d?.groundAt(e.clientX, e.clientY); if (g) toolDown(e, g); }   // a plain click still places
    S.select3d && d.moved && (S.v3d.clearSelection?.());
  };
  document.addEventListener("pointerup", end, true);
  document.addEventListener("pointercancel", end, true);
}
// 3D: the GM's plain click works doors, switches and dials; right-click (without dragging) or the Select tool opens menus.
function open3dMenu(e, hit) {
  const { type, id } = hit;
  if (type === "token") return showTokenMenu(e, id);
  if (!S.isGM) return type === "object" && interactMenu(e, id);
  if (type === "object") { const o = S.objects[id]; if (o) showActionMenu(e, o.label || o.kind, [...(o.kind === "door" ? [[o.state === "open" ? "Close" : "Open", () => put(`objects/${id}/state`, o.state === "open" ? "closed" : "open")], [o.locked ? "Unlock" : "Lock", () => put(`objects/${id}/locked`, o.locked ? null : true)]] : []), ...(o.kind === "light" ? [[o.state === "on" ? "Turn light off" : "Turn light on", () => useObject(id)]] : []), ...(o.kind !== "door" && o.kind !== "light" ? [["Logic", () => openLogic(id)]] : []), [o.hidden ? "Reveal to players" : "Hide from players", () => put(`objects/${id}/hidden`, !o.hidden)], ["Duplicate", () => duplicate("object", id)], ["Delete", () => put(`objects/${id}`, null)]], settingsFor("object", id).fields, (m) => linkMenu(m, id)); }
  else if (type === "prop") { const a = S.map.props[id]; if (a) showActionMenu(e, a.kind, [...lightItem(id, a), [a.hidden ? "Reveal to players" : "Hide from players", () => put(`map/props/${id}/hidden`, a.hidden ? null : true)], ["Duplicate", () => duplicate("prop", id)], ["Delete", () => put(`map/props/${id}`, null)]], settingsFor("prop", id).fields); }
  else if (type === "wall") showActionMenu(e, "Wall", [wallItem(id), ["Delete", () => put(`map/walls/${id}`, null)]], settingsFor("wall", id).fields);
}
const toast = (text) => { const t = $("#toast"); t.textContent = text; t.style.display = "block"; setTimeout(() => (t.style.display = "none"), 3000); };
const usable = (o) => ["switch", "button", "dial"].includes(o?.kind) || (o?.kind === "door" && !o.win && o.doorKind !== "window" && o.doorKind !== "secret");
function interactMenu(e, id) {   // players: right-click a lever, dial or door
  const o = S.objects[id]; if (!usable(o) || o.hidden) return;
  e.preventDefault(); showActionMenu(e, KINDS[o.kind].label, [["Interact", () => useObject(id)]]);
}
function useObject(id) {
  const o = S.objects[id]; if (!o || (!S.isGM && (S.paused || o.hidden))) return;
  if (S.isGM && o.kind === "light") { play("click"); return put(`objects/${id}/state`, o.state === "on" ? "off" : "on"); }
  if (!usable(o)) return;
  if (!S.isGM) { const mine = S.tokens[myTokenId()]; if (!mine || !canReach(mine, o)) return toast("You can't reach that from here."); }
  if (o.kind === "door") {
    if (o.locked && !S.isGM) return toast("The door is locked.");
    play("click"); return put(`objects/${id}/state`, o.state === "open" ? "closed" : "open");
  }
  if (o.kind === "switch") { play("click"); return put(`objects/${id}/state`, o.state === "on" ? "off" : "on"); }
  if (o.kind === "dial" || o.kind === "button") { play("click"); const st = statesOf(o); return put(`objects/${id}/state`, st[(st.indexOf(o.state) + 1) % st.length]); }
}
{
  let down = null;
  document.addEventListener("pointerdown", (e) => { down = S.v3d && e.target.closest?.("#view3d canvas") ? { x: e.clientX, y: e.clientY, button: e.button } : null; }, true);
  document.addEventListener("pointerup", (e) => {
    const d = down; down = null;
    if (!d || !S.v3d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5 || S.v3d.controlsBlocked()) return;
    if (d.button === 0 && S.pick?.zone === "link") return connectTo(e, S.v3d.peekAt(e.clientX, e.clientY)?.id);   // objects, props and walls
    if (d.button === 0 && (S.tool || S.placing)) return;   // building: that click drew something
    if (d.button === 0 && S.puzzleMode) {   // traps and triggers in the angled view: the same clicks the flat layer takes
      if (S.pick) { const p = S.v3d.groundAt(e.clientX, e.clientY); if (p) pickSpot(p); return; }
      const hit = S.v3d.pickAt(e.clientX, e.clientY); if (hit?.type === "object") toggleSelected(hit.id); return;
    }
    if (d.button === 0 && S.isGM && !S.select3d) { const hit = S.v3d.peekAt(e.clientX, e.clientY); if (hit?.type === "object") useObject(hit.id); return; }
    if (d.button !== 0 && d.button !== 2) return;
    closeTokMenu();
    const hit = S.v3d.pickAt(e.clientX, e.clientY);
    if (hit) return open3dMenu(e, hit);
    const p = S.v3d.groundAt(e.clientX, e.clientY);
    if (p && S.isGM && d.button === 2) groundMenu(e, p);
  }, true);
  document.addEventListener("contextmenu", (e) => e.preventDefault());   // no browser right-click menu anywhere on the table
  document.addEventListener("view3dchange", () => { if (!S.v3d) { S.select3d = false; document.getElementById("bar-select")?.classList.remove("on"); } });
}

// Build tools in the angled view: the left button draws on the floor under the pointer (top-down uses the flat layer).
{
  const floorUnder = (e) => S.isGM && !S.moving && (S.tool || S.placing) && S.v3d && !S.v3d.isTopDown() && e.target.closest?.("#view3d canvas") ? S.v3d.groundAt(e.clientX, e.clientY) : null;
  document.addEventListener("pointerdown", (e) => { const p = e.button === 0 && floorUnder(e); if (p) toolDown(e, p); });
  document.addEventListener("pointermove", (e) => { const p = floorUnder(e); if (p) toolMove(e, p); });
  document.addEventListener("pointerup", (e) => { if (e.button === 0 && floorUnder(e)) toolUp(); });
}

// Who this player is: kept in the browser, so walking, floors and roll call follow that character.
const setMe = (v) => { me = v; try { localStorage.setItem("vtt-me", JSON.stringify(v)); } catch { /* fine */ } const l = document.querySelector("#bar-me .lbl"); if (l) l.textContent = v ? v.name.slice(0, 8) : "Me"; dispatchEvent(new Event("vtt-me-changed")); };

// Start in 3D, walking enabled. Players choose who they are; a link may name the character instead: ?char=<id>.
const want = new URLSearchParams(location.search).get("char");
const ask = () => initJoin({ loadPcs, setMe, getMe: () => me });
if (!S.isGM) { if (want) S.choosing = true; else ask(); }
initWalk({ myToken: () => (S.isGM ? null : myTokenId()) });
setView(true).then(() => {
  if (S.isGM) return;
  followOwnFloor();
  if (want) loadPcs().then((list) => { const c = list.find((x) => x.id === want); if (!c) return ask(); S.choosing = false; setMe({ id: c.id, name: c.name }); });
});
