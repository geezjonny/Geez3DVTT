import { guard, zombie, drawCone, WALKING, LOUD } from "./minigame-ai.js";
import { MAPPED, CELL, blocked, sight, clearWalk, nextStep, centerOf, cellAt, freeSpot, nearLever, flip, drawMap, initEditor } from "./minigame-map.js";
import { watch, put, patch } from "./store.js";

const GM = new URLSearchParams(location.search).get("gm") === "jonny";   // a link, not a password
const NS = MAPPED ? "minigame2" : "minigame";   // each page has its own fight
let W = 640, H = 400;
const SPEED = 140, HERO_HP = 100;
const $ = (id) => document.getElementById(id), ctx = $("c").getContext("2d");
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// the d20 each hero rolls when the fight starts sets their words and their gauge timing
const TIERS = [
  { name: "Hard", min: 1, zone: 0.12, speed: 1.4, words: "barricade graveyard nightshade commander gauntlet pestilence mausoleum sentinel decompose fortress watchtower corruption halberdier unearthly vigilance sepulchre garrison putrefy battlement ravenous crossbowman shambling interrogate lanternlight conscript" },
  { name: "Medium", min: 8, zone: 0.2, speed: 1.1, words: "helmet rotten patrol coffin shield hunger armor crypt spear groan captain marrow lantern plague banner shamble sentry tomb gate corpse watch bones" },
  { name: "Easy", min: 15, zone: 0.3, speed: 0.8, words: "axe bat cut dig elf fog gut hit ink jab key log mud net orc pit rag saw tin urn vow wax yew zap bow cap den fin hex imp" }
];
const tierOf = (roll) => [...TIERS].reverse().find((t) => roll >= t.min) || TIERS[1];
const GAP = 34;   // how close a sword or a bite has to be
const CLASSES = {
  fighter: { attack: "Sword slash", support: "Hold the Line" },
  ranger: { attack: "Arrow shot", support: "Shadow Cloak" },
  cleric: { attack: "Sacred Flame", support: "Healing Word" },
  bard: { attack: "Cutting Words", support: "Hold Person" }
};
let map = {}, heroes = {}, foes = {}, pos = {}, running = false, tokens = {}, wave = 0, enemy = "pixel:guard";
const shown = {}, effects = [], held = new Set();
let me = null, my = null;   // my id, my local position

/* ---------- shared state ---------- */
watch(`${NS}/heroes`, (v) => { heroes = v || {}; drawPick(); drawList(); startTools(); });
watch(`${NS}/foes`, (v) => { foes = v || {}; drawList(); });
watch(`${NS}/pos`, (v) => { pos = v || {}; if (!me) drawPick(); });
let spawnSeen;
watch(`${NS}/respawn`, (v) => { if (spawnSeen !== undefined && v && v.n !== spawnSeen && me && v.at?.[me]) { my = { ...v.at[me] }; charge = line = null; } spawnSeen = v?.n ?? null; });
watch(`${NS}/wave`, (v) => { wave = v || 0; });
watch(`${NS}/running`, (v) => { running = !!v; $("run").textContent = running ? "Pause" : "Start"; });
let seenFx = null;
watch(`${NS}/fx`, (v) => {
  const first = !seenFx; seenFx ||= new Set();
  for (const f of Object.values(v || {})) if (!seenFx.has(f.n)) { seenFx.add(f.n); if (!first) effects.push({ ...f, at: performance.now() }); }
});

if (MAPPED) watch(`${NS}/map`, (v) => {
  map = { cols: 20, rows: 12, ...v, cells: v?.cells || {}, spawns: v?.spawns || {}, starts: v?.starts || {} };
  W = $("c").width = map.cols * CELL; H = $("c").height = map.rows * CELL;
  $("c").style.width = `min(100%, ${80 * W / H}vh)`;
});
const cells = () => map.cells || {};
const inPlay = (h) => h?.hp > 0 && !h.out;   // standing, and not yet escaped
let toolSig = "";
function startTools() {   // GM: one "Place" tool per hero
  const sig = JSON.stringify(Object.entries(heroes).map(([id, h]) => [id, h.name]));
  if (!GM || !MAPPED || sig === toolSig) return; toolSig = sig;
  const tool = $("tool"), was = tool.value;
  for (const old of tool.querySelectorAll("[data-start]")) old.remove();
  for (const [id, h] of Object.entries(heroes)) { const o = new Option(`Place: ${h.name}`, `start:${id}`); o.dataset.start = id; tool.add(o); }
  tool.value = [...tool.options].some((o) => o.value === was) ? was : "";
}
function heroSpot(id, i) {
  const key = MAPPED && map.starts?.[id], [x, y] = key ? key.split("_").map(Number) : [];
  return key && x < map.cols && y < map.rows ? { ...centerOf(key), face: 1 } : spawn(false, i);
}
const TOP = MAPPED ? 16 : 24;
function move(p, x, y) {   // one axis at a time, so you slide along a wall
  x = clamp(x, 16, W - 16); y = clamp(y, TOP, H - 16);
  if (!blocked(cells(), x, p.y)) p.x = x;
  if (!blocked(cells(), p.x, y)) p.y = y;
}

/* ---------- player: choose, move, type, gauge ---------- */
let picked = null;
function drawPick() {
  if (GM) return;
  if (me && !heroes[me]) { me = my = null; }
  const saved = sessionStorage.getItem("mini-me");
  if (!me && saved && heroes[saved] && pos[saved]) join(saved);
  $("pick").hidden = !!me;
  const sig = JSON.stringify(Object.entries(heroes).map(([id, h]) => [id, h.name, h.cls]));
  if (sig === picked) return; picked = sig;
  $("pick").replaceChildren(Object.keys(heroes).length ? "Who are you?" : "Waiting for the GM to bring characters in…", document.createElement("br"),
    ...Object.entries(heroes).map(([id, h]) => { const b = document.createElement("button"); b.type = "button"; b.textContent = `${h.name} (${h.cls})`; b.onclick = () => { b.blur(); join(id); }; return b; }));
}
function join(id) {
  me = id; sessionStorage.setItem("mini-me", id); my = { x: 80, y: 200, face: 1, ...pos[id] };
  rolled = null; charge = line = null; $("pick").hidden = true;
}
const words = new Map();   // hostile id -> the word over its head, on this screen only
let typed = "", rolled = null, rolledAt = 0, charge = null, line = null, cooldown = 0, note = "", noteUntil = 0;
const say = (text) => { note = text; noteUntil = performance.now() + 1500; };
const act = (k, to) => put(`${NS}/acts/${me}_${Date.now()}`, { by: me, k, to: to || null });
const sendPos = () => put(`${NS}/pos/${me}`, { x: Math.round(my.x), y: Math.round(my.y), face: my.face });
const nearest = (list, from) => list.sort((a, b) => dist(a[1], from) - dist(b[1], from))[0];
const liveFoes = () => Object.entries(foes).filter(([, f]) => f.hp > 0);
const allies = () => Object.entries(heroes).filter(([id, h]) => id !== me && inPlay(h) && pos[id] && sight(cells(), my, pos[id])).map(([id]) => [id, pos[id]]);
function giveWords(roll) {
  if (roll !== rolled) { rolled = roll; rolledAt = performance.now(); words.clear(); typed = ""; }
  for (const [id, f] of Object.entries(foes)) {
    if (f.hp <= 0 || words.has(id)) continue;
    const used = [...words.values()], free = tierOf(roll).words.split(" ").filter((w) => !used.includes(w));
    words.set(id, free[Math.random() * free.length | 0]);
  }
}
const targets = () => liveFoes().filter(([, f]) => sight(cells(), my, f)).map(([id]) => [id, words.get(id)]).filter(([, w]) => w);   // no word, no attack, through a wall
function teleport(target, gap) {
  effects.push({ type: "blink", x: my.x, y: my.y, at: performance.now() });
  const side = my.x < target.x ? -1 : 1;
  const spot = [[side, 0], [-side, 0], [0, -1], [0, 1]].map(([dx, dy]) => ({ x: clamp(target.x + dx * gap, 16, W - 16), y: clamp(target.y + dy * gap, TOP, H - 16) }))
    .find((p) => !blocked(cells(), p.x, p.y) && sight(cells(), p, target));
  if (spot) Object.assign(my, spot);   // nowhere to land: stay put
  my.face = target.x < my.x ? -1 : 1; sendPos();
}
function attack(id) {
  const foe = foes[id];
  if (heroes[me].cls === "fighter") teleport(foe, GAP); else { my.face = foe.x < my.x ? -1 : 1; sendPos(); }
  act("attack", id);
}
function support() {
  const cls = heroes[me].cls;
  if (cls === "fighter") { line = { left: 4, t: 0 }; act("line"); return; }
  if (cls === "ranger") { const ally = nearest(allies(), my); if (ally) teleport(ally[1], 24); act("cloak", ally?.[0]); }
  if (cls === "cleric") act("heal");
  if (cls === "bard") act("hold", nearest(liveFoes().filter(([, f]) => sight(cells(), my, f)), my)?.[0]);
}
const tier = () => tierOf(heroes[me]?.roll);
function zone() { const w = tier().zone; return line ? [0.48 - w / 2, 0.52 + w / 2] : [0.75 - w / 2, 0.75 + w / 2]; }
const tri = (t) => 1 - Math.abs((t % 2) - 1);   // 0 → 1 → 0
const marker = () => tri((line || charge).t * (tier().speed + (line ? 0.2 : 0)));
const canAct = () => me && inPlay(heroes[me]) && heroes[me].roll > 0 && running;
addEventListener("keydown", (e) => {
  if (GM || !me || e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key.startsWith("Arrow")) { e.preventDefault(); held.add(e.key); return; }
  if (e.key === "Enter") {
    e.preventDefault(); const lever = nearLever(cells(), my);
    if (!e.repeat && lever && inPlay(heroes[me])) act("lever", lever);
    return;
  }
  if (e.code === "Space") {
    e.preventDefault(); if (e.repeat || !canAct()) return;
    if (line) {
      const [a, b] = zone(), m = marker();
      if (m >= a && m <= b) { line.left = 4; act("line"); say("Holding!"); } else { line = null; cooldown = 3; act("lineEnd"); say("The line broke!"); }
    } else if (cooldown <= 0) charge = { t: 0 };
    return;
  }
  if (!canAct() || line || !/^[a-z]$/i.test(e.key)) return;
  const ch = e.key.toLowerCase(), starts = (text) => targets().some(([, w]) => w.startsWith(text));
  typed = starts(typed + ch) ? typed + ch : starts(ch) ? ch : "";
  const hit = targets().find(([, w]) => w === typed);
  if (hit) { attack(hit[0]); words.delete(hit[0]); typed = ""; }
});
addEventListener("keyup", (e) => {
  held.delete(e.key);
  if (e.code !== "Space") return;
  e.preventDefault(); if (!charge) return;
  const [a, b] = zone(), m = marker(); charge = null; if (!canAct()) return;
  if (m >= a && m <= b) { cooldown = heroes[me].cls === "fighter" ? 1 : 6; support(); say(CLASSES[heroes[me].cls].support + "!"); } else { cooldown = 2; say("Missed the green"); }
});
addEventListener("blur", () => { held.clear(); charge = null; });
let sent = 0, dirty = false;
function playerStep(dt) {
  const h = heroes[me]; if (!h) return;
  giveWords(h.roll);
  cooldown -= dt;
  if (charge) charge.t += dt;
  if (line) { line.t += dt; line.left -= dt; if (line.left <= 0 || h.hp <= 0 || !running) { line = null; cooldown = 3; } }
  if (inPlay(h) && !line) {
    const dx = held.has("ArrowRight") - held.has("ArrowLeft"), dy = held.has("ArrowDown") - held.has("ArrowUp");
    if (dx || dy) {
      const n = Math.hypot(dx, dy);
      move(my, my.x + dx / n * SPEED * dt, my.y + dy / n * SPEED * dt);
      if (dx) my.face = dx; dirty = true;
    }
  }
  if (dirty && performance.now() - sent > 80) { sent = performance.now(); dirty = false; sendPos(); }
}

/* ---------- GM: pick tokens, run the fight ---------- */
const queue = new Map();
if (GM) {
  $("side").hidden = false;
  watch("tokens", (v) => { tokens = v || {}; drawList(); });
  watch(`${NS}/acts`, (v) => { for (const [k, a] of Object.entries(v || {})) queue.set(k, a); });
  $("run").onclick = (e) => { e.target.blur(); put(`${NS}/running`, !running || null); };
  if ($("enemy")) {
    const pretty = (file) => file.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
    fetch("token/index.json").then((r) => r.json()).then((files) => {
      for (const kind of ["guard", "zombie"]) $("enemy").add(new Option(`Pixel ${kind}`, `pixel:${kind}`));
      for (const file of files) $("enemy").add(new Option(pretty(file), file));
      watch(`${NS}/enemy`, (v) => { enemy = v || "pixel:guard"; $("enemy").value = enemy; });
    }).catch((err) => { console.warn("token list failed", err); $("status").textContent = "Could not load the token list."; });
    $("enemy").onchange = (e) => { e.target.blur(); put(`${NS}/enemy`, e.target.value); };
  }
  // clears the fight but keeps the map and the enemy choice
  $("clear").onclick = () => patch(Object.fromEntries(["heroes", "foes", "pos", "acts", "fx", "wave", "running", "respawn"].map((k) => [`${NS}/${k}`, null])));
  const reset = () => {
    for (const [key, cell] of Object.entries(cells())) if (cell.open || cell.on) patch({ [`${NS}/map/cells/${key}/open`]: null, [`${NS}/map/cells/${key}/on`]: null });
    const c = { [`${NS}/running`]: null, [`${NS}/respawn`]: { n: Date.now(), at: Object.fromEntries(Object.keys(heroes).map((id, i) => [id, heroSpot(id, i)])) } };
    Object.keys(heroes).forEach((id, i) => { Object.assign(c, { [`${NS}/heroes/${id}/hp`]: HERO_HP, [`${NS}/heroes/${id}/cloak`]: 0, [`${NS}/heroes/${id}/line`]: 0, [`${NS}/heroes/${id}/roll`]: 0, [`${NS}/heroes/${id}/out`]: false, [`${NS}/pos/${id}`]: heroSpot(id, i) }); });
    Object.assign(c, { [`${NS}/foes`]: null, [`${NS}/wave`]: null }); nextAt = 0;
    patch(c);
  };
  $("reset").onclick = reset;
  if (MAPPED) initEditor({ NS, canvas: $("c"), map: () => map, patch, reset, occupants: Object.assign(() => [...Object.keys(heroes).filter((id) => !heroes[id].out).map((id) => pos[id]), ...Object.values(foes).filter((f) => f.hp > 0)].filter(Boolean), { foe: (id) => (foes[id]?.hp > 0 ? foes[id] : null), foes: () => Object.values(foes).filter((f) => f.hp > 0) }) });
  // a worker's timer keeps ticking when the GM looks at another tab
  const clock = new Worker(URL.createObjectURL(new Blob(["setInterval(() => postMessage(0), 100)"], { type: "text/javascript" })));
  let then = performance.now();
  clock.onmessage = () => { const now = performance.now(); gmStep(Math.min(0.5, (now - then) / 1000)); then = now; };
}
function spawn(foe, i) { if (MAPPED) return { ...freeSpot(map, foe, i), face: foe ? -1 : 1 }; return { x: (foe ? 540 : 80) + (Math.floor(i / 6) * (foe ? -50 : 50)), y: 60 + (i % 6) * 58, face: foe ? -1 : 1 }; }
function newWave(n) {   // wave 1 is three enemies, one more each wave, up to eight
  const kind = enemy.startsWith("pixel:") ? enemy.slice(6) : null, stamp = Date.now();
  const name = kind ? (kind === "guard" ? "Guard" : "Zombie") : enemy.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "), look = kind ? { kind } : { img: "token/" + encodeURIComponent(enemy) };
  return Object.fromEntries(Array.from({ length: Math.min(2 + n, 8) }, (_, i) => [`w${stamp}_${i}`, { name, ...look, hp: 36, max: 36, hold: 0, ...spawn(true, i) }]));
}
function drawList() {
  if (!GM || $("list").contains(document.activeElement)) return;
  $("list").replaceChildren(...Object.entries(tokens).sort((a, b) => String(a[1].label).localeCompare(String(b[1].label))).map(([id, t]) => {
    const row = document.createElement("label"), pick = document.createElement("select");
    for (const [value, text] of [["", "—"], ...Object.keys(CLASSES).map((c) => [c, "Hero: " + c]), ]) pick.add(new Option(text, value));
    pick.value = heroes[id]?.cls || "";
    pick.onchange = () => { bring(id, t, pick.value); pick.blur(); drawList(); };
    row.append(t.label || id, pick); return row;
  }));
}
function bring(id, t, as) {
  const c = { [`${NS}/heroes/${id}`]: null, [`${NS}/pos/${id}`]: null };
  const name = t.label || "Creature";
  if (as) {
    const m = t.mini || {};
    c[`${NS}/heroes/${id}`] = { name, cls: as, out: false, roll: 0, hp: HERO_HP, cloak: 0, line: 0, skin: m.skin || "#f1c7a5", hair: m.hairC || "#5a3a22", top: m.top || { fighter: "#7a7f8c", ranger: "#3f6b3a", cleric: "#d8d0b4", bard: "#7a2f5a" }[as], bot: m.bot || "#4a4030", trim: m.trim || "#f2c94c" };
    c[`${NS}/pos/${id}`] = heroSpot(id, Object.keys(heroes).length);
  }
  patch(c);
}
const hitAt = new Map(), brains = new Map(), wasAt = new Map(), noises = [];
// minigame2: guards and zombies come from where the GM placed them, and act on what they see and hear
function placed(c, f, h, dt) {
  const spawns = map.spawns || {};
  for (const id of Object.keys(f)) if (!spawns[id]) { delete f[id]; c[`${NS}/foes/${id}`] = null; }
  for (const [id, sp] of Object.entries(spawns)) if (!foes[id]) {
    const at = centerOf(sp.a), to = centerOf(sp.b || sp.a);
    brains.delete(id);
    c[`${NS}/foes/${id}`] = { kind: sp.kind, name: sp.kind === "guard" ? "Guard" : "Zombie", ...at, face: Math.round(Math.atan2(to.y - at.y, to.x - at.x) * 180 / Math.PI), alert: false, hp: 36, max: 36, hold: 0 };
  }
  // footsteps: whoever moved since the last tick
  const sounds = noises.splice(0), walkers = [...Object.keys(h).filter((k) => inPlay(h[k]) && !(h[k].cloak > 0) && pos[k]).map((k) => [k, pos[k]]), ...Object.entries(f).filter(([, x]) => x.hp > 0 && x.kind === "guard")];
  for (const [id, p] of walkers) { const was = wasAt.get(id); if (was && dist(was, p) > 1) sounds.push({ x: p.x, y: p.y, range: WALKING, by: id }); wasAt.set(id, { x: p.x, y: p.y }); }
  if (!running || Date.now() < goAt) return;
  for (const [id, hero] of Object.entries(h)) if (inPlay(hero) && pos[id] && cellAt(map.cells, pos[id])?.t === "exit") hero.out = true;
  const world = { map, dt, sounds, reach: GAP + 4, move, heroes: Object.entries(h).filter(([k, v]) => inPlay(v) && pos[k]).map(([id, v]) => ({ id, x: pos[id].x, y: pos[id].y, tank: v.line > 0, cloaked: v.cloak > 0 })) };
  for (const [id, foe] of Object.entries(f)) {
    if (foe.hp <= 0 || !spawns[id]) continue;
    if (foe.hold > 0) { foe.hold = Math.max(0, +(foe.hold - dt).toFixed(2)); continue; }
    let brain = brains.get(id); if (!brain) brains.set(id, brain = {});
    const hit = (foe.kind === "guard" ? guard : zombie)(world, id, foe, brain);
    for (const [oid, o] of Object.entries(f)) { const gap = dist(foe, o); if (oid !== id && o.hp > 0 && gap > 0 && gap < 24) move(foe, foe.x + (foe.x - o.x) / gap * 24 * dt, foe.y + (foe.y - o.y) / gap * 24 * dt); }
    foe.x = +foe.x.toFixed(1); foe.y = +foe.y.toFixed(1);
    if (hit && !(hitAt.get(id) > Date.now())) { hitAt.set(id, Date.now() + 1400); h[hit].hp = Math.max(0, h[hit].hp - (h[hit].line > 0 ? 2 : 8)); c[`${NS}/fx/${fxN % 24}`] = { n: `${Date.now()}_${fxN++}`, type: "bite", x: pos[hit].x, y: pos[hit].y, tx: pos[hit].x, ty: pos[hit].y }; }
  }
}
let fxN = 0, goAt = 0, nextAt = 0;
function gmStep(dt) {
  const c = {}, h = structuredClone(heroes), f = structuredClone(foes);
  const fx = (type, a, b) => { const n = `${Date.now()}_${fxN}`; c[`${NS}/fx/${fxN++ % 24}`] = { n, type, x: a.x, y: a.y, tx: b?.x ?? a.x, ty: b?.y ?? a.y }; };
  const hurt = (id, n) => { f[id].hp = Math.max(0, f[id].hp - n); };
  for (const [key, a] of queue) {
    c[`${NS}/acts/${key}`] = null;
    const who = h[a.by], at = pos[a.by];
    if (a.k === "lever") { if (inPlay(who) && at) { const change = flip(NS, cells(), a.to, at, [...Object.keys(h).filter((id) => !h[id].out).map((id) => pos[id]), ...Object.values(f).filter((x) => x.hp > 0)]); Object.assign(c, change); if (Object.keys(change).length) noises.push({ x: at.x, y: at.y, range: LOUD, by: a.by }); } continue; }
    if (!running || !who || !at || !inPlay(who)) continue;
    const foe = f[a.to];
    if (a.k !== "lineEnd") noises.push({ x: at.x, y: at.y, range: LOUD, by: a.by });
    if (a.k === "attack" && foe?.kind === "guard") Object.assign(brains.get(a.to) || {}, { last: { x: at.x, y: at.y }, look: 0 });   // a struck guard turns on them
    if (a.k === "attack" && foe?.hp > 0) { hurt(a.to, who.cls === "fighter" ? 24 : 18); who.cloak = 0; fx(who.cls, at, foe); }
    if (a.k === "line" && who.cls === "fighter") { who.line = 4.3; fx("shield", at); }   // a little slack for lag
    if (a.k === "lineEnd") who.line = 0;
    if (a.k === "cloak") for (const id of [a.by, a.to]) if (h[id]) { h[id].cloak = 6; fx("cloak", pos[id] || at); }
    if (a.k === "heal") {
      const [id, hero] = Object.entries(h).filter(([, v]) => !v.out).sort((x, y) => x[1].hp - y[1].hp)[0];
      hero.hp = Math.min(HERO_HP, hero.hp + 45); fx("heal", pos[id] || at);
    }
    if (a.k === "hold" && foe?.hp > 0) { foe.hold = 6; fx("hold", foe); }
  }
  queue.clear();
  if (running) for (const hero of Object.values(h)) if (!hero.roll) { hero.roll = 1 + (Math.random() * 20 | 0); goAt = Date.now() + 3000; }   // hostiles wait while the dice are read
  if (running && Date.now() >= goAt) {
    for (const hero of Object.values(h)) for (const k of ["cloak", "line"]) hero[k] = Math.max(0, +(hero[k] - dt).toFixed(2) || 0);
    for (const [id, foe] of MAPPED ? [] : Object.entries(f)) {
      if (foe.hp <= 0) continue;
      if (foe.hold > 0) { foe.hold = Math.max(0, +(foe.hold - dt).toFixed(2)); continue; }
      const up = Object.entries(h).filter(([k, v]) => v.hp > 0 && pos[k]);
      const tanks = up.filter(([, v]) => v.line > 0);
      const wanted = (tanks.length ? tanks : up.filter(([, v]) => !(v.cloak > 0))).map(([k]) => [k, pos[k]]).sort((a, b) => dist(a[1], foe) - dist(b[1], foe));
      let target, aim;   // the closest hero it can actually walk to
      for (const [k, p] of wanted) { aim = clearWalk(cells(), foe, p) ? p : nextStep(map, foe, p); if (aim) { target = [k, p]; break; } }
      if (!target) continue;
      const [tid, p] = target, d = dist(foe, p), reach = GAP + 4;
      if (d > reach || !sight(cells(), foe, p)) {
        const far = dist(foe, aim) || 1; let dx = (aim.x - foe.x) / far, dy = (aim.y - foe.y) / far;
        for (const [oid, o] of Object.entries(f)) { const gap = dist(foe, o); if (oid !== id && o.hp > 0 && gap > 0 && gap < 40) { dx += (foe.x - o.x) / gap * 0.7; dy += (foe.y - o.y) / gap * 0.7; } }
        move(foe, foe.x + dx * 48 * dt, foe.y + dy * 48 * dt); foe.x = +foe.x.toFixed(1); foe.y = +foe.y.toFixed(1);
      } else if (!(hitAt.get(id) > Date.now())) {
        hitAt.set(id, Date.now() + 1400); h[tid].hp = Math.max(0, h[tid].hp - (h[tid].line > 0 ? 2 : 8)); fx("bite", p);
      }
    }
  }
  if (MAPPED) placed(c, f, h, dt);
  let fresh = null;
  if (!MAPPED && running && Date.now() >= goAt && Object.values(f).every((foe) => foe.hp <= 0)) {
    nextAt ||= Date.now() + (wave ? 3000 : 0);
    if (Date.now() >= nextAt) { fresh = newWave(wave + 1); nextAt = 0; Object.assign(c, { [`${NS}/foes`]: fresh, [`${NS}/wave`]: wave + 1 }); }
  }
  for (const [group, next, was] of [["heroes", h, heroes], ...(fresh ? [] : [["foes", f, foes]])]) for (const [id, o] of Object.entries(next)) for (const [k, v] of Object.entries(o)) if (v !== was[id][k]) c[`${NS}/${group}/${id}/${k}`] = v;
  if (Object.keys(c).length) patch(c);
}

/* ---------- drawing ---------- */
// 12x14 pixel person: h hair, s skin, e eyes, t top, r trim, b legs
const BODY = ["....hhhh....", "...hhhhhh...", "...hsssse...", "...hsesse...", "....ssss....", "..ttttttt...", ".sttttttts..", ".sttrrrtts..", "..ttttttt...", "..rrrrrrr..."];
const LEGS = [["...bb.bb....", "...bb.bb....", "..bbb.bbb..."], ["..bb...bb...", ".bb.....bb..", ".bb.....bb.."]];
const px = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
function hero(h, x, y, face, step) {
  const colors = { h: h.hair, s: h.skin, e: "#222", t: h.top, r: h.trim, b: h.bot };
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(face < 0 ? -1 : 1, 1);
  if (h.hp <= 0) ctx.rotate(Math.PI / 2);
  [...BODY, ...LEGS[step]].forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ".") px((i - 6) * 3, (j - 9) * 3, 3, 3, colors[ch] || h.skin); }));
  if (h.cls === "fighter") { px(14, -21, 3, 21, "#dfe6ee"); px(11, -3, 9, 3, "#8a6a30"); if (!(h.line > 0)) { px(-18, -9, 9, 15, "#8a94a8"); px(-15, -6, 3, 9, h.trim); } }
  if (h.cls === "ranger") { for (const [i, j] of [[0, -15], [1, -12], [2, -9], [2, -6], [2, -3], [1, 0], [0, 3]]) px(12 + i * 3, j, 3, 3, "#a8743a"); px(12, -12, 1, 15, "#eee"); }
  if (h.cls === "cleric") { px(14, -9, 3, 18, "#8a6a30"); px(11, -15, 9, 9, "#c9ced6"); px(-9, -33, 18, 3, "#ffe27a"); }
  if (h.cls === "bard") { px(8, -3, 12, 12, "#b8763a"); px(11, 0, 6, 6, "#5a3416"); px(17, -15, 3, 12, "#8a5a2a"); px(-6, -33, 15, 6, h.trim); px(6, -39, 3, 6, "#e84a5f"); }
  ctx.restore();
}
const FOES = {
  guard: { h: "#8d96a8", s: "#e0ac84", e: "#222", t: "#8a2f2f", r: "#d9c36a", b: "#3a3f52" },
  zombie: { h: "#3f4a2c", s: "#8fbf6a", e: "#d92b2b", t: "#5a5348", r: "#3d382f", b: "#39434a" }
};
function hostile(kind, x, y, face, step) {
  const colors = FOES[kind];
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.scale(face, 1);
  [...BODY, ...LEGS[step]].forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== ".") px((i - 6) * 3, (j - 9) * 3, 3, 3, colors[ch]); }));
  if (kind === "zombie") { px(6, -9, 18, 4, colors.s); px(6, -2, 15, 4, colors.s); px(-9, 3, 4, 3, "#7a2020"); }
  else { px(-12, -27, 24, 3, "#8d96a8"); px(-3, -33, 6, 6, "#c0392b"); px(15, -30, 3, 48, "#8a6a30"); px(13, -39, 7, 9, "#dfe6ee"); }
  ctx.restore();
}
const sprites = new Map();
function sprite(src) {
  if (!src) return null;
  if (!sprites.has(src)) {
    const img = new Image(), small = document.createElement("canvas"); small.width = small.height = 24; sprites.set(src, null);
    img.onload = () => { small.getContext("2d").drawImage(img, 0, 0, 24, 24); sprites.set(src, small); }; img.src = src;
  }
  return sprites.get(src);
}
const label = (text, x, y, color = "#fff") => { ctx.font = "10px monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#000"; ctx.fillText(text, x + 1, y + 1); ctx.fillStyle = color; ctx.fillText(text, x, y); };
const bar = (x, y, part, color) => { px(x - 18, y, 36, 5, "#000"); px(x - 17, y + 1, Math.round(34 * clamp(part, 0, 1)), 3, color); };
function ease(id, p, dt) {   // glide towards the synced position; a big jump is a teleport
  const s = shown[id];
  if (!s || dist(s, p) > 80) return (shown[id] = { x: p.x, y: p.y, moving: false });
  const k = Math.min(1, dt * 14); s.moving = dist(s, p) > 1; s.x += (p.x - s.x) * k; s.y += (p.y - s.y) * k; return s;
}
function ring(x, y, r, color) { ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); }
function drawEffect(f, k) {
  const x = f.x + (f.tx - f.x) * k, y = f.y + (f.ty - f.y) * k;
  if (f.type === "fighter") for (let i = -6; i <= 6; i++) px(f.tx + i * 3, f.ty + i * 3 * (k < 0.5 ? 1 : -1) - 8, 4, 4, "#fff");
  if (f.type === "ranger") for (const o of [-8, 0, 8]) { px(x - 6, y + o * (1 - k) - 6, 12, 2, "#d9b070"); px(x + (f.tx > f.x ? 6 : -9), y + o * (1 - k) - 7, 4, 4, "#fff"); }
  if (f.type === "cleric") for (let i = 0; i < 14; i++) px(f.tx + Math.sin(i * 7 + k * 9) * 10, f.ty - i * 4 * k - 4, 5, 5, i % 2 ? "#ffd94a" : "#fff3b0");
  if (f.type === "bard") { label("#@!*", x, y - 10 - Math.sin(k * 9) * 6, "#ff7ad9"); label("♪ ♫", x - 14, y, "#c9a0ff"); }
  if (f.type === "shield") ring(f.x, f.y, 10 + k * 60, "#8fc8ff");
  if (f.type === "heal") for (let i = 0; i < 6; i++) label("+", f.x + (i - 3) * 8, f.y - k * 40 - (i % 3) * 6, "#7dff8a");
  if (f.type === "cloak" || f.type === "blink") ring(f.x, f.y - 6, 26 * (1 - k), "#9a6bff");
  if (f.type === "hold") ring(f.x, f.y, 40 - k * 20, "#ff7ad9");
  if (f.type === "bite") label("✖", f.x, f.y - 10 - k * 12, "#ff5050");
}
function drawWords() {   // over each head, lifted clear of the others
  const placed = []; ctx.font = "bold 14px monospace"; ctx.textAlign = "left";
  for (const [id, word] of targets()) {
    const p = shown[id]; if (!p) continue;
    const w = ctx.measureText(word).width + 8, x = clamp(p.x - w / 2, 0, W - w); let y = Math.max(0, p.y - 64);
    while (y > 0 && placed.some((o) => x < o.x + o.w && o.x < x + w && Math.abs(y - o.y) < 18)) y = Math.max(0, y - 18);
    placed.push({ x, y, w }); px(x, y, Math.ceil(w), 17, "#000c");
    const done = typed && word.startsWith(typed) ? typed : "";
    ctx.fillStyle = "#fff"; ctx.fillText(word, x + 4, y + 13); ctx.fillStyle = "#7dff8a"; ctx.fillText(done, x + 4, y + 13);
  }
}
let then = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - then) / 1000); then = now;
  if (me) playerStep(dt);
  for (let y = 0; y < H; y += 32) for (let x = 0; x < W; x += 32) px(x, y, 32, 32, (x + y) % 64 ? "#2c3a33" : "#31413a");
  if (MAPPED) {
    drawMap(ctx, cells(), GM, map.starts);
    for (const [id, f] of Object.entries(foes)) if (f.kind === "guard" && f.hp > 0) drawCone(ctx, cells(), f, shown[id] || f);
    if (GM) for (const sp of Object.values(map.spawns || {})) if (sp.b) { const a = centerOf(sp.a), b = centerOf(sp.b); ctx.strokeStyle = "#ff9a9a88"; ctx.lineWidth = 2; ctx.setLineDash([3, 6]); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]); }
  }
  const things = [
    ...Object.entries(foes).filter(([, f]) => f.hp > 0).map(([id, f]) => ({ id, y: f.y, foe: f })),
    ...Object.entries(heroes).filter(([id, h]) => pos[id] && !h.out).map(([id, h]) => ({ id, y: id === me ? my.y : pos[id].y, hero: h }))
  ].sort((a, b) => a.y - b.y);
  for (const { id, foe, hero: h } of things) {
    const p = id === me ? my : ease(id, foe || pos[id], dt);
    if (foe) {
      const img = sprite(foe.img), bob = foe.hold > 0 ? 0 : Math.sin(now / 150 + p.x) * 1.5;
      ctx.imageSmoothingEnabled = false;
      const prey = !MAPPED && nearest(Object.entries(pos).filter(([k]) => heroes[k]), p);   // token waves have no heading: look at the closest hero
      if (foe.kind) hostile(foe.kind, p.x, p.y, (MAPPED ? Math.cos(foe.face * Math.PI / 180) < 0 : prey && prey[1].x < p.x) ? -1 : 1, p.moving ? (now / 200 | 0) % 2 : 0);
      else if (img) ctx.drawImage(img, Math.round(p.x - 20), Math.round(p.y - 26 + bob), 40, 40); else px(p.x - 14, p.y - 20, 28, 28, "#a94c3d");
      if (foe.hold > 0) { ring(p.x, p.y - 6, 26, "#ff7ad9"); label("HELD", p.x, p.y + 36, "#ff7ad9"); }
      bar(p.x, p.y - 44, foe.hp / foe.max, "#ff5050"); label(foe.name, p.x, p.y + 24, "#ffb0a0");
    } else {
      const moving = id === me ? !line && [...held].length > 0 : p.moving;
      ctx.globalAlpha = h.cloak > 0 ? 0.35 : 1;
      hero(h, p.x, p.y, id === me ? my.face : pos[id].face, moving ? (now / 140 | 0) % 2 : 0);
      ctx.globalAlpha = 1;
      if (h.line > 0) { px(p.x + (pos[id].face < 0 ? -26 : 14), p.y - 16, 12, 32, "#aab6cc"); px(p.x + (pos[id].face < 0 ? -22 : 18), p.y - 10, 4, 20, h.trim); ring(p.x, p.y, 30, "#8fc8ff"); }
      bar(p.x, p.y - 46, h.hp / HERO_HP, "#5be36a"); label(`${h.name}${h.hp > 0 ? "" : " (down)"}${GM && h.roll ? ` d20:${h.roll}` : ""}`, p.x, p.y + 24, id === me ? "#ffe27a" : "#fff");
    }
  }
  for (let i = effects.length - 1; i >= 0; i--) { const k = (now - effects[i].at) / 500; if (k > 1) effects.splice(i, 1); else drawEffect(effects[i], Math.max(0, k)); }
  if (canAct() && !line) drawWords();
  if (me && running && heroes[me]?.roll && now - rolledAt < 3000) {
    px(W / 2 - 160, H / 2 - 50, 320, 90, "#000d"); ctx.textAlign = "center"; ctx.fillStyle = "#ffe27a";
    ctx.font = "34px monospace"; ctx.fillText(`d20: ${heroes[me].roll}`, W / 2, H / 2 - 8); ctx.font = "16px monospace"; ctx.fillText(`${tier().name} words and timing`, W / 2, H / 2 + 22);
  }
  const hs = Object.values(heroes), fs = Object.values(foes);
  const inside = hs.filter((h) => !h.out);
  const over = MAPPED && hs.length && !inside.length ? "Everyone escaped!" : inside.length && inside.every((h) => h.hp <= 0) ? (MAPPED ? "The party was caught" : "The party has fallen") : !MAPPED && running && wave && fs.every((f) => f.hp <= 0) ? `Wave ${wave} cleared` : "";
  if (over) { px(0, H / 2 - 30, W, 56, "#000a"); ctx.font = "32px monospace"; ctx.textAlign = "center"; ctx.fillStyle = "#ffe27a"; ctx.fillText(over, W / 2, H / 2 + 9); }
  const mine = me && heroes[me], info = mine && CLASSES[mine.cls];
  $("status").textContent = (GM ? "GM · " : mine ? `${mine.name} · ` : "") + (running ? "Fight!" : "Waiting for the GM to start") + (wave ? ` · Wave ${wave}` : "") + (MAPPED && hs.length ? ` · Escaped ${hs.length - inside.length}/${hs.length}` : "") + (mine?.roll ? ` · d20 ${mine.roll}: ${tier().name}` : "") + (now < noteUntil ? ` · ${note}` : "");
  $("help").textContent = !mine ? "" : mine.out ? "You escaped! Everyone must get out." : mine.hp <= 0 ? "You are down. A Healing Word can bring you back." : line ? "HOLD THE LINE: tap SPACE each time the marker is in the green" :
    `Arrows: move · Type the word over a hostile: ${info.attack} · Hold SPACE, release in the green: ${info.support}${cooldown > 0 ? ` (ready in ${Math.ceil(cooldown)}s)` : ""}`;
  if (inPlay(mine) && my && nearLever(cells(), my)) $("help").textContent = "Press ENTER to flip the lever";
  const g = charge || line; $("gauge").style.visibility = g ? "visible" : "hidden";
  if (g) { const [a, b] = zone(), [green, mark] = $("gauge").children; green.style.left = a * 100 + "%"; green.style.width = (b - a) * 100 + "%"; mark.style.left = marker() * 100 + "%"; }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
