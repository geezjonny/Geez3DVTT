// Stealth mode (GM switch). NPC tokens tagged "guard" patrol, watch and listen. A character who is seen is stopped,
// along with the guard, until the GM rules on it. Players can sneak (C) and listen (Q). The GM page runs the guards.
import { watch, put, patch, readAt } from "../store.js";
import { S, mapSize } from "./state.js";
import { addBarButton, floatWindow } from "./ui.js";
import { isPcToken, wallPieces, doorsList } from "./draw.js";
import { doorSeg } from "./reach.js";
import { rollDice } from "./dice.js";
import { callMod } from "./rollcall.js";
import { rollContext, loadRulesData } from "./rollrules.js";
import { advance, canSee, canHear, cone, litAt, hearingRange, SIGHT, DARK, NOISE, FACE } from "./stealth-rules.js";

const SEE_THROUGH = ["window", "bars", "portcullis", "arch"];
const kindOf = (d) => d.doorKind || d.kindName;
// Walls and shut doors on a floor. `through` says which shut doors to leave out.
function blockers(lv, through) {
  const doors = doorsList().filter((d) => (d.lv ?? 0) === lv);
  return [...Object.values(S.map.walls || {}).filter((w) => (w.lv ?? 0) === lv && !w.hidden).flatMap((w) => wallPieces(w, doors)),
    ...doors.filter((d) => d.state !== "open" && !through(d)).map(doorSeg)];
}
const sightWalls = (lv) => blockers(lv, (d) => d.win || SEE_THROUGH.includes(kindOf(d)));
const openable = (d) => !d.locked && !d.hidden && !d.win && !["window", "bars", "portcullis", "arch", "secret"].includes(kindOf(d));
const walking = (lv) => ({
  walls: blockers(lv, (d) => kindOf(d) === "arch" || openable(d)),
  doors: Object.entries(S.objects).filter(([, d]) => d.kind === "door" && (d.lv ?? 0) === lv && d.state !== "open" && openable(d)).map(([id, d]) => ({ id, seg: doorSeg(d) })),
  area: mapSize()
});

export function initStealth({ myToken, toast }) {
  let on = false, drawn = "", then = performance.now();
  const brains = new Map(), held = new Set(), ignore = new Map(), cases = new Map(), moved = new Map(), sheets = new Map();
  let listen = { until: 0, ready: 0, score: 0 };
  const el = (tag, props = {}, ...kids) => { const n = Object.assign(document.createElement(tag), props); n.append(...kids); return n; };
  const name = (id) => S.tokens[id]?.label || "someone";

  async function sheetOf(pc) {   // the character sheet, read once a minute at most
    const hit = sheets.get(pc); if (hit && Date.now() - hit.at < 60000) return hit.sheet;
    const sheet = (await readAt(`characters/pcs/${pc}`)) || {}; sheets.set(pc, { sheet, at: Date.now() }); return sheet;
  }
  const bonus = (sheet, skill) => callMod(sheet, { kind: "skill", key: skill }, []).mod;
  async function check(id, skill, title) {   // a roll from the sheet, shown in the table's roll history
    const t = S.tokens[id], sheet = t.pc ? await sheetOf(t.pc) : {}; await loadRulesData();
    const how = rollContext(sheet, { kind: "skill", key: skill }, { skillAbility: skill === "stealth" ? "dex" : "wis", tokenConditions: Object.keys(t.conditions || {}), tokenEffects: t.effects }).mode;
    const mod = bonus(sheet, skill);
    const roll = await rollDice(how === "normal" ? [20] : [20, 20], mod, (dice) => {
      const faces = dice.map((d) => d.result), kept = how === "dis" ? Math.min(...faces) : Math.max(...faces);
      return { by: t.label || "Player", total: kept + mod, sub: `${title}${how === "dis" ? " (disadvantage)" : how === "adv" ? " (advantage)" : ""}` };
    });
    return { total: roll.total, passive: 10 + mod };
  }

  /* ---------------- player: the panel, sneaking and listening ---------------- */
  const status = el("b"), sneakBtn = el("button", { type: "button" }), listenBtn = el("button", { type: "button" });
  status.setAttribute("role", "status");
  const panel = el("div", { id: "stealth-badge", hidden: true }, status, sneakBtn, listenBtn); document.body.append(panel);
  let busy = false;
  async function sneak() {
    const id = myToken(); if (!on || !id || busy) return;
    if (S.tokens[id].sneak) return patch({ [`tokens/${id}/sneak`]: null, [`tokens/${id}/stealth`]: null });
    busy = true;
    try { await put(`tokens/${id}/sneak`, true); await put(`tokens/${id}/stealth`, (await check(id, "stealth", "Stealth")).total); }
    catch (err) { console.warn("Stealth roll failed", err); toast("Could not roll Stealth."); }
    busy = false;
  }
  async function listenNow() {
    const id = myToken(); if (!on || !id || busy || Date.now() < listen.ready) return;
    busy = true;
    try { const r = await check(id, "perception", "Listen"); listen = { score: r.total, until: Date.now() + 6000, ready: Date.now() + 12000 }; }
    catch (err) { console.warn("Listen roll failed", err); toast("Could not roll Listen."); }
    busy = false;
  }
  sneakBtn.addEventListener("click", () => { sneak(); sneakBtn.blur(); });
  listenBtn.addEventListener("click", () => { listenNow(); listenBtn.blur(); });
  document.addEventListener("keydown", (e) => {
    if (S.isGM || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.("input, textarea, select, dialog, [contenteditable]")) return;
    if (e.code === "KeyC") sneak(); else if (e.code === "KeyQ") listenNow();
  });

  /* ---------------- GM: the switch and the rulings ---------------- */
  const button = S.isGM && addBarButton({ id: "stealth", label: "Stealth", title: "Stealth mode: guards patrol, watch and listen", onClick: () => put("stealth", on ? null : true) });
  let win = null;
  function drawCases() {
    if (!cases.size) return win?.hide();
    win ||= floatWindow({ id: "spotted", title: "Spotted", x: 260, y: 90 });
    win.body.classList.add("invwin");
    win.body.replaceChildren(...[...cases].map(([tid, c]) => {
      const row = el("div", { className: "inv-item" }, el("span", { className: "inv-name", textContent: `${name(c.gid)} saw ${name(tid)}` }), el("div", { className: "inv-note", textContent: c.note }));
      for (const [text, ruling] of [["Not seen", "no"], ["Investigate", "look"], ["Keep stopped", "keep"]]) row.append(el("button", { type: "button", textContent: text, onclick: () => rule(tid, ruling) }));
      return row;
    }));
    win.show();
  }
  const release = (ids) => Object.fromEntries(ids.filter((id) => S.tokens[id]?.spotted).flatMap((id) => [[`tokens/${id}/spotted`, null], [`tokens/${id}/frozen`, null]]));
  function rule(tid, ruling) {
    const c = cases.get(tid); if (!c) return;
    cases.delete(tid); drawCases();
    if (ruling === "keep") return;
    const free = release([tid, c.gid]); if (Object.keys(free).length) patch(free);
    ignore.set(`${c.gid} ${tid}`, Date.now() + (ruling === "no" ? 5000 : 2500)); held.delete(`${c.gid} ${tid}`);
    if (ruling === "look") Object.assign(brains.get(c.gid) || {}, { mode: "invest", target: c.at, path: null });
  }
  function spot(gid, tid) {
    const g = S.tokens[gid], t = S.tokens[tid], changes = {};
    for (const [id, token] of [[gid, g], [tid, t]]) if (!token.frozen) Object.assign(changes, { [`tokens/${id}/frozen`]: true, [`tokens/${id}/spotted`]: true });
    if (Object.keys(changes).length) patch(changes);
    const entry = { gid, at: { x: t.x, y: t.y }, note: t.sneak ? `Sneaking, Stealth ${t.stealth ?? "?"}` : "Not sneaking" };
    cases.set(tid, entry); drawCases();
    toast(`${g.label || "A guard"} saw ${t.label || "someone"}!`);
  }

  watch("stealth", (v) => {
    on = !!v; S.stealth = on; if (button) { button.classList.toggle("on", on); button.setAttribute("aria-pressed", on); }
    if (on) return;
    brains.clear(); held.clear(); ignore.clear(); cases.clear(); moved.clear(); drawCases();
    if (!S.isGM) return;
    const changes = release(Object.keys(S.tokens));
    for (const [id, t] of Object.entries(S.tokens)) for (const k of ["sneak", "stealth", "mood"]) if (t[k] != null) changes[`tokens/${id}/${k}`] = null;
    if (Object.keys(changes).length) patch(changes);
  });

  function tick() {
    const nowMs = performance.now(), dt = Math.min(1, (nowMs - then) / 1000); then = nowMs;
    const all = Object.entries(S.tokens).filter(([, t]) => Number.isFinite(t.x));
    const guards = on ? all.filter(([, t]) => t.guard && !t.pc) : [];
    const targets = all.filter(([, t]) => !t.guard && !t.hidden && isPcToken(t));
    const cache = new Map(), walls = (lv) => { if (!cache.has(lv)) cache.set(lv, sightWalls(lv)); return cache.get(lv); };
    const routes = new Map(), ground = (lv) => { if (!routes.has(lv)) routes.set(lv, walking(lv)); return routes.get(lv); };
    const near = (g) => walls(g.lv ?? 0).filter(([a, b, c, d]) => Math.max(a, c) >= g.x - SIGHT && Math.min(a, c) <= g.x + SIGHT && Math.max(b, d) >= g.y - SIGHT && Math.min(b, d) <= g.y + SIGHT);
    // who moved since the last look (footsteps)
    const stepped = new Set();
    for (const [id, t] of all) { const was = moved.get(id); if (was && Math.hypot(t.x - was.x, t.y - was.y) > 2) { was.at = Date.now(); stepped.add(id); } moved.set(id, { x: t.x, y: t.y, at: was?.at || 0 }); }
    // darkness: by day everyone is easy to see; at night only the lit are
    const time = Number(S.atmosphere?.time ?? 12), day = time >= 6 && time < 19;
    const lights = [...Object.values(S.objects).filter((o) => o.kind === "light" && o.state === "on").map((o) => ({ x: o.x, y: o.y, lv: o.lv ?? 0, radius: o.radius || 120 })),
      ...all.filter(([, t]) => t.torch).map(([, t]) => ({ x: t.x, y: t.y, lv: t.lv ?? 0, radius: 120 }))];

    const seeing = new Set(), cones = [], marks = [], mine = S.isGM ? null : myToken(), changes = {};
    for (const [gid, g] of guards) {
      const around = near(g); let alert = false;
      for (const [tid, t] of targets) {
        const key = `${gid} ${tid}`;
        const range = day || t.torch || litAt(t, lights, around) ? SIGHT : SIGHT * DARK;
        if (!canSee(g, t, around, range)) { held.delete(key); continue; }
        alert = true; if (!g.hidden) seeing.add(tid);
        if (S.isGM && !held.has(key) && !(ignore.get(key) > Date.now())) { held.add(key); spot(gid, tid); }
      }
      if (S.isGM) {
        let brain = brains.get(gid); if (!brain) brains.set(gid, brain = {});
        if (brain.wrote && Math.hypot(g.x - brain.wrote.x, g.y - brain.wrote.y) > 6) {   // the GM dragged them: face that way, new post
          const face = Math.round(Math.atan2(g.y - brain.wrote.y, g.x - brain.wrote.x) * 180 / Math.PI);
          changes[`tokens/${gid}/face`] = face; Object.assign(brain, { path: null, mode: "home", post: { x: g.x, y: g.y, face }, wrote: { x: g.x, y: g.y } });
        } else if (!g.frozen && !S.paused && !S.combat && !S.dragging && !alert) {
          for (const [tid, t] of targets) if (stepped.has(tid) && !(brain.heard > Date.now()) && canHear(g, t, t.sneak ? NOISE.sneak : NOISE.normal, around)) {
            Object.assign(brain, { mode: "invest", target: { x: t.x, y: t.y }, path: null, heard: Date.now() + 3500 }); toast(`${g.label || "A guard"} heard something.`);
          }
          const next = advance(g, brain, dt, ground(g.lv ?? 0)), x = Math.round(next.x * 10) / 10, y = Math.round(next.y * 10) / 10, face = Math.round(next.face);
          if (x !== g.x || y !== g.y) Object.assign(changes, { [`tokens/${gid}/x`]: x, [`tokens/${gid}/y`]: y });
          if (face !== (g.face ?? FACE)) changes[`tokens/${gid}/face`] = face;
          if (next.open) changes[`objects/${next.open}/state`] = "open";
          brain.wrote = { x, y };
        } else brain.wrote = { x: g.x, y: g.y };
        const mood = brain.mode === "invest" || brain.mode === "look" ? "searching" : null;
        if (mood !== (g.mood ?? null)) changes[`tokens/${gid}/mood`] = mood;
        for (const [px, py] of Object.values(g.patrol || {})) if ((g.lv ?? 0) === (S.level ?? 0)) marks.push({ x: px, y: py, color: 0x7fc8ff });
      }
      if ((g.lv ?? 0) === (S.level ?? 0) && (S.isGM || !g.hidden)) cones.push({ points: cone(g, around), alert, searching: g.mood === "searching" });
    }
    if (Object.keys(changes).length) patch(changes);

    const t = mine && S.tokens[mine];
    panel.hidden = !on || !t;
    if (t && on) {
      const caught = !!t.spotted || seeing.has(mine);
      status.textContent = caught ? "👁 Seen!" : "Hidden"; panel.classList.toggle("seen", caught);
      sneakBtn.textContent = `${t.sneak ? `Sneaking ${t.stealth ?? ""}` : "Sneak"} (C)`; sneakBtn.setAttribute("aria-pressed", !!t.sneak);
      const left = Math.ceil((listen.ready - Date.now()) / 1000);
      listenBtn.textContent = Date.now() < listen.until ? `Listening ${listen.score}` : left > 0 ? `Listen in ${left}s` : "Listen (Q)"; listenBtn.disabled = left > 0;
      // footsteps: a ring where a walking guard is heard
      if (t.pc && !sheets.has(t.pc)) { sheets.set(t.pc, { sheet: {}, at: 0 }); sheetOf(t.pc).catch(() => sheets.delete(t.pc)); }
      const passive = 10 + bonus(sheets.get(t.pc)?.sheet || {}, "perception"), score = Date.now() < listen.until ? Math.max(passive, listen.score) : passive;
      for (const [gid, g] of guards) if (!g.hidden && Date.now() - (moved.get(gid)?.at || 0) < 600 && (g.lv ?? 0) === (S.level ?? 0) && canHear(t, g, hearingRange(score, g.mood === "searching"), near(t))) marks.push({ x: g.x, y: g.y, color: 0xffffff });
    }
    const sig = S.v3d ? JSON.stringify([cones, marks]) : "";
    if (S.v3d && sig !== drawn) { drawn = sig; S.v3d.setStealth(cones, marks); }
  }
  setInterval(tick, 100);
}
