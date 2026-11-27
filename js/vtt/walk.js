// Players walk their own token smoothly: hold WASD or the arrow keys. Walls, closed doors and windows stop you
// and stairs, ladders and portals take you to another floor (rules in movement.js).
// The token moves on this screen at once; the position is shared about ten times a second.
import { patch } from "../store.js";
import { S, mapSize } from "./state.js";
import { solidSegments } from "./reach.js";
import { moveCircle, exitAt, leadsTo } from "./movement.js";

export const SPEED = 4 * 40, RADIUS = 12;   // px: 4 squares a second, a token 0.6 of a square wide
const SEND_EVERY = 90;
const KEYS = { KeyW: [1, 0], ArrowUp: [1, 0], KeyS: [-1, 0], ArrowDown: [-1, 0], KeyA: [0, -1], ArrowLeft: [0, -1], KeyD: [0, 1], ArrowRight: [0, 1] };   // [forward, right]

export function initWalk({ myToken, onStart, onStop }) {
  const held = new Set();
  let raf = 0, last = 0, sentAt = 0, me = null;   // me: { id, x, y, lv, mine: positions we sent, exit }
  const blocked = () => S.isGM || S.paused || S.combat;
  const round = (v) => Math.round(v * 10) / 10;
  function send() {
    if (!me || !S.tokens[me.id]) return;
    me.mine.push(`${round(me.x)},${round(me.y)}`); if (me.mine.length > 40) me.mine.shift();
    sentAt = performance.now();
    patch({ [`tokens/${me.id}/x`]: round(me.x), [`tokens/${me.id}/y`]: round(me.y), ...(me.lv !== (S.tokens[me.id].lv ?? 0) ? { [`tokens/${me.id}/lv`]: me.lv } : {}) }).catch((e) => console.warn("move not saved", e));
  }
  function direction() {
    let forward = 0, right = 0;
    const first = S.firstPerson && S.v3d?.isFirstPerson();
    for (const code of held) {
      if (first && (code === "ArrowLeft" || code === "ArrowRight")) continue;   // first person: these turn
      forward += KEYS[code][0]; right += KEYS[code][1];
    }
    const f = S.v3d?.heading() || { x: 0, y: -1 };   // "up" is away from the camera
    const x = f.x * forward - f.y * right, y = f.y * forward + f.x * right, len = Math.hypot(x, y);
    return len > 0.01 ? { x: x / len, y: y / len } : null;
  }
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const id = blocked() ? null : myToken(), t = id && S.tokens[id];
    if (!t) { held.clear(); me = null; return; }
    if (!me || me.id !== id) {
      me = { id, x: t.x, y: t.y, lv: t.lv ?? 0, mine: [] };
      me.exit = exitAt(S.map.props, me, me.lv);   // standing on stairs already: step off before they work again
      onStart?.(id);
    } else if ((t.lv ?? 0) !== me.lv || (Math.hypot(t.x - me.x, t.y - me.y) > 1 && !me.mine.includes(`${t.x},${t.y}`))) {
      me.x = t.x; me.y = t.y; me.lv = t.lv ?? 0; me.exit = exitAt(S.map.props, me, me.lv);   // someone else moved us (GM, a trap)
    }
    if (S.firstPerson && S.v3d?.isFirstPerson()) S.v3d.turn(((held.has("ArrowLeft") ? 1 : 0) - (held.has("ArrowRight") ? 1 : 0)) * 2.4 * dt);
    const dir = direction();
    let jumped = false;
    if (dir) {
      const { cols, rows } = mapSize();
      moveCircle(me, dir.x * SPEED * dt, dir.y * SPEED * dt, RADIUS, solidSegments(me.lv), cols * 40, rows * 40);
      const exit = exitAt(S.map.props, me, me.lv);
      if (exit !== me.exit) {
        me.exit = exit;
        const to = exit && leadsTo(S.map.props, exit, me, me.lv);
        if (to) { Object.assign(me, to); me.exit = exitAt(S.map.props, me, me.lv); jumped = true; }
      }
      t.x = round(me.x); t.y = round(me.y);   // show it now, don't wait for the database
      me.mine.push(`${t.x},${t.y}`); if (me.mine.length > 40) me.mine.shift();   // the 3D loop reads this every frame
    }
    if (jumped || (dir && now - sentAt >= SEND_EVERY)) send();
    if (held.size) raf = requestAnimationFrame(frame);
  }
  function stop() { if (me) { send(); onStop?.(); } me = null; }
  document.addEventListener("keydown", (e) => {
    if (!KEYS[e.code] || blocked() || e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.("input, textarea, select, [contenteditable]") || !myToken()) return;
    e.preventDefault();
    held.add(e.code);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });
  const release = () => { if (!held.size) { cancelAnimationFrame(raf); raf = 0; stop(); } };
  document.addEventListener("keyup", (e) => { if (held.delete(e.code)) release(); });
  addEventListener("blur", () => { if (held.size) { held.clear(); release(); } });
}
