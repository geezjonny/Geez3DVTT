// Shared UI bits: draggable floating windows (toolbars, initiative, dice...) and small drop menus.
// Window positions and sizes are remembered per id in localStorage.
import { $, S } from "./state.js";

const KEY = (id) => `vtt-win-${id}`;
const load = (id) => { try { return JSON.parse(localStorage.getItem(KEY(id))); } catch { return null; } };
const save = (id, v) => { try { localStorage.setItem(KEY(id), JSON.stringify(v)); } catch { /* private mode: fine */ } };

const REG = new Set(), SNAP = 12;
const live = () => [...REG].filter((w) => w.el.isConnected && !w.el.hidden);
// the windows touching this one edge to edge (and the ones touching those, and so on)
function groupOf(self, alone) {
  if (alone) return [self];
  const seen = new Set([self]), q = [self], all = live();
  while (q.length) {
    const ra = q.pop().el.getBoundingClientRect();
    for (const b of all) {
      if (seen.has(b)) continue; const rb = b.el.getBoundingClientRect();
      const v = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top), h = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      if (((Math.abs(ra.right - rb.left) <= 1 || Math.abs(rb.right - ra.left) <= 1) && v > 8) || ((Math.abs(ra.bottom - rb.top) <= 1 || Math.abs(rb.bottom - ra.top) <= 1) && h > 8)) { seen.add(b); q.push(b); }
    }
  }
  return [...seen];
}
// nudge a drag so the group's edges land on another window's edge or the screen edge, when within SNAP px
function snapMove(group, dx, dy) {
  const others = live().filter((w) => !group.includes(w)).map((w) => w.el.getBoundingClientRect());
  others.push({ left: 0, top: 0, right: innerWidth, bottom: innerHeight, screen: true });
  let bx = null, by = null;
  for (const m of group) {
    const L = m.s.left + dx, R = m.s.right + dx, T = m.s.top + dy, B = m.s.bottom + dy;
    for (const o of others) {
      const nearY = T <= o.bottom + SNAP && B >= o.top - SNAP, nearX = L <= o.right + SNAP && R >= o.left - SNAP;
      if (nearY || o.screen) for (const [from, to] of o.screen ? [[L, 0], [R, innerWidth]] : [[L, o.right], [R, o.left], [L, o.left], [R, o.right]]) { const k = to - from; if (Math.abs(k) <= SNAP && (bx === null || Math.abs(k) < Math.abs(bx))) bx = k; }
      if (nearX || o.screen) for (const [from, to] of o.screen ? [[T, 0], [B, innerHeight]] : [[T, o.bottom], [B, o.top], [T, o.top], [B, o.bottom]]) { const k = to - from; if (Math.abs(k) <= SNAP && (by === null || Math.abs(k) < Math.abs(by))) by = k; }
    }
  }
  return { dx: dx + (bx || 0), dy: dy + (by || 0) };
}

// floatWindow({ id, title, x, y, closable }) -> { el, body, show(), hide(), toggle(), visible() }
// Drag it by its title strip. `body` is an empty div for the caller to fill.
export function floatWindow({ id, title, x = 20, y = 80, closable = true, hidden = false }) {
  const el = document.createElement("div"); el.className = "fwin"; el.id = "win-" + id; el.hidden = hidden;
  el.innerHTML = `<div class="fwin-bar"><span class="fwin-title"></span>${closable ? `<button class="fwin-x" title="Hide" aria-label="Hide">×</button>` : ""}</div><div class="fwin-body"></div>`;
  el.querySelector(".fwin-title").textContent = title;
  const body = el.querySelector(".fwin-body"), pos = load(id) || { x, y };
  const place = () => { el.style.left = Math.max(0, Math.min(innerWidth - 60, pos.x)) + "px"; el.style.top = Math.max(0, Math.min(innerHeight - 30, pos.y)) + "px"; };
  document.body.append(el); place();
  const entry = { el, pos, place, save: () => save(id, pos) }; REG.add(entry);
  const bar = el.querySelector(".fwin-bar"); let d = null;
  // Windows snap to each other's edges (and the screen's) while dragging, and windows left flush together move as one.
  // Hold Shift to drag just this window out of its group, Alt to drag without snapping.
  bar.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    d = { x: e.clientX, y: e.clientY, group: groupOf(entry, e.shiftKey) };
    for (const m of d.group) { const r = m.el.getBoundingClientRect(); m.s = { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; m.p0 = { x: m.pos.x, y: m.pos.y }; }
    bar.setPointerCapture(e.pointerId); el.classList.add("drag");
  });
  bar.addEventListener("pointermove", (e) => {
    if (!d) return;
    const mv = e.altKey ? { dx: e.clientX - d.x, dy: e.clientY - d.y } : snapMove(d.group, e.clientX - d.x, e.clientY - d.y);
    for (const m of d.group) { m.pos.x = m.p0.x + mv.dx; m.pos.y = m.p0.y + mv.dy; m.place(); }
  });
  bar.addEventListener("pointerup", () => { if (!d) return; for (const m of d.group) m.save(); d = null; el.classList.remove("drag"); });
  el.querySelector(".fwin-x")?.addEventListener("click", () => { el.hidden = true; el.dispatchEvent(new Event("fwin-close")); });
  addEventListener("resize", place);
  // Every window is sized from its corner and its contents scale with its width (base = the width it opened at).
  if (pos.w) { el.style.width = pos.w + "px"; if (pos.h) el.style.height = pos.h + "px"; }
  let saving = 0;
  new ResizeObserver(() => {
    const width = el.offsetWidth; if (!width) return;
    if (!el.style.width) return void (pos.base = width);   // not sized by hand yet: note its natural width
    if (!el.dataset.noscale) for (const part of el.children) part.style.zoom = width / (pos.base ||= width);
    pos.w = width; pos.h = parseFloat(el.style.height) || 0; clearTimeout(saving); saving = setTimeout(entry.save, 300);
  }).observe(el);
  return { el, body, show: () => (el.hidden = false), hide: () => (el.hidden = true), toggle: () => (el.hidden = !el.hidden), visible: () => !el.hidden };
}

// GeezVTT's toolbars: small floating windows of square icon buttons. Features register a button with addBarButton();
// an id listed in ICONS sits on the VTT toolbar (in this order), any other button stays off screen.
export const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">${d}</svg>`;
const ICONS = {
  select: '<path d="m5 3 14 9-7 1-3 7Z"/>',
  ruler: '<path d="m3 16 13-13 5 5L8 21Zm10-10 3 3m-6 0 2 2m-5 1 3 3"/>',
  ping: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/>',
  dice: '<rect x="3" y="3" width="18" height="18" rx="3"/><path stroke-linecap="round" stroke-width="3" d="M8 8h0m8 0h0m-4 4h0m-4 4h0m8 0h0"/>',
  rollcall: '<path d="M3 10v4h4l9 5V5l-9 5Zm16-1a4 4 0 0 1 0 6M7 14v5h3v-4"/>',
  token: '<path d="M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM4 21v-3a8 8 0 0 1 16 0v3Z"/>',
  me: '<path d="M12 3a4 4 0 1 1 0 8 4 4 0 0 1 0-8ZM4 21v-3a8 8 0 0 1 16 0v3Z"/>',
  fp: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  top: '<path d="m12 3 9 5-9 5-9-5Zm-9 10 9 5 9-5"/>',
  fit: '<path d="M4 9V4h5m6 0h5v5m0 6v5h-5m-6 0H4v-5"/>',
  grid: '<path d="M3 3h18v18H3ZM3 9h18M3 15h18M9 3v18M15 3v18"/>',
  time: '<circle cx="12" cy="12" r="5"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2m0-16-2 2M6 18l-2 2"/>',
  weather: '<path d="M7 18h11a4 4 0 0 0 0-8 6 6 0 0 0-11-1 4.5 4.5 0 0 0 0 9Z"/>',
};
const bars = {};
export function toolbar(id, title, x) {
  if (bars[id]) return bars[id];
  const w = bars[id] = floatWindow({ id: "bar-" + id, title, x, y: innerHeight - 190, closable: false });
  w.body.classList.add("toolbar");
  const min = Object.assign(document.createElement("button"), { type: "button", className: "fwin-x", textContent: "−", title: `Minimize ${title}` });
  min.setAttribute("aria-label", min.title); min.addEventListener("click", () => (w.body.hidden = !w.body.hidden));
  w.el.querySelector(".fwin-bar").append(min);
  return w;
}
let storeEl = null;
const barStore = () => { if (!storeEl) { storeEl = document.createElement("div"); storeEl.id = "barstore"; storeEl.hidden = true; document.body.append(storeEl); } return storeEl; };
// addBarButton({ id, label, title, onClick, gmOnly, toggle }) -> button element. onClick gets (event, button).
export function addBarButton({ id, label, title = label, onClick, gmOnly = false, toggle = false }) {
  const b = document.createElement("button"); b.id = "bar-" + id; b.className = "barbtn"; b.title = title; b.type = "button"; b.setAttribute("aria-label", label);
  b.innerHTML = `${ICONS[id] ? svg(ICONS[id]) : ""}<span class="lbl"></span>`; b.querySelector(".lbl").textContent = label;
  if (gmOnly && !S.isGM) b.hidden = true;
  b.addEventListener("click", (e) => { e.stopPropagation(); if (toggle) b.classList.toggle("on"); onClick?.(e, b); });
  if (ICONS[id]) { b.style.order = Object.keys(ICONS).indexOf(id); toolbar("vtt", "VTT Controls", 16).body.append(b); } else barStore().append(b);
  return b;
}

// menuWindow(id, title, getItems) -> click handler for a bar button: toggles a floating window of buttons instead of a dropdown.
// getItems() returns [[label, fn], ...] (null fn = heading); fn gets the clicked button so it can anchor a sub-menu.
let menuSlot = 0;
export function menuWindow(id, title, getItems) {
  let w = null;
  return () => {
    if (!w) { const n = menuSlot++; w = floatWindow({ id: "menu-" + id, title, x: 240 + 28 * n, y: 130 + 28 * n, hidden: true }); w.body.classList.add("menuwin"); }
    if (w.visible()) return w.hide();
    w.body.textContent = "";
    for (const [label, fn] of getItems()) {
      const b = document.createElement(fn ? "button" : "div"); b.textContent = label; b.type = "button";
      if (fn) b.addEventListener("click", () => fn(b)); else b.className = "dim"; w.body.append(b);
    }
    w.show();
  };
}

// dropMenu(anchorEl, [[label, fn], ...]) pops a small menu under an element; closes on pick or outside click.
// An item whose fn is null renders as a dim heading.
let openMenu = null;
export function dropMenu(anchor, items) {
  openMenu?.remove(); openMenu = null;
  const m = document.createElement("div"); m.className = "dropmenu"; m.dataset.anchor = anchor.id || ""; openMenu = m;
  for (const [label, fn] of items) {
    const b = document.createElement(fn ? "button" : "div"); b.textContent = label; if (fn) b.addEventListener("click", () => { m.remove(); openMenu = null; fn(); }); else b.className = "dim"; m.append(b);
  }
  document.body.append(m); const r = anchor.getBoundingClientRect();
  m.style.left = Math.min(r.left, innerWidth - m.offsetWidth - 8) + "px"; m.style.top = Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8) + "px";
  setTimeout(() => document.addEventListener("pointerdown", function once(e) { if (m.contains(e.target)) return; m.remove(); if (openMenu === m) openMenu = null; document.removeEventListener("pointerdown", once, true); }, true), 0);
  return m;
}
export { $ };
