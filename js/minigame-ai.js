// How placed guards and zombies behave on minigame2 maps. The GM page runs this; `brain` is each one's memory.
import { CELL, blocked, sight, clearWalk, nextStep, centerOf, solidAt } from "./minigame-map.js";

export const RANGE = 170, HALF = 35;   // guard's view: distance in pixels, degrees to each side
export const WALKING = 220, LOUD = 340;   // how far footsteps and fighting carry (walls do not muffle)
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;

export function sees(cells, foe, p) {
  const d = dist(foe, p);
  if (d > RANGE || !sight(cells, foe, p)) return false;
  return d <= 36 || Math.abs(((angle(foe, p) - foe.face + 540) % 360) - 180) <= HALF;
}

// Step toward `to` around walls. False when walls or shut doors cut it off.
function walk(w, foe, to, speed) {
  const aim = clearWalk(w.map.cells, foe, to) ? to : nextStep(w.map, foe, to);
  if (!aim) return false;
  const d = dist(foe, aim), step = Math.min(d, speed * w.dt);
  if (d > 0.5) { foe.face = Math.round(angle(foe, aim)); w.move(foe, foe.x + (aim.x - foe.x) / d * step, foe.y + (aim.y - foe.y) / d * step); }
  return true;
}
const near = (list, from) => [...list].sort((a, b) => dist(a, from) - dist(b, from))[0];
// A fighter holding the line draws everyone who can walk to them.
const taunt = (w, foe) => near(w.heroes.filter((h) => h.tank && (clearWalk(w.map.cells, foe, h) || nextStep(w.map, foe, h))), foe);
const inReach = (w, foe, h) => dist(foe, h) <= w.reach && sight(w.map.cells, foe, h);

// Each returns the id of a hero hit this tick, or null. w: { map, dt, heroes: [{id,x,y,tank,cloaked}], sounds, reach, move }
export function guard(w, id, foe, brain) {
  const seen = taunt(w, foe) || near(w.heroes.filter((h) => !h.cloaked && sees(w.map.cells, foe, h)), foe);
  foe.alert = !!(seen || brain.last);
  if (seen) {
    brain.last = { x: seen.x, y: seen.y }; brain.look = 0; foe.alert = true;
    if (inReach(w, foe, seen)) { foe.face = Math.round(angle(foe, seen)); return seen.id; }
    walk(w, foe, seen, 58); return null;
  }
  const spawn = w.map.spawns[id];
  if (brain.last) {   // go to where they were last seen, look around, then back to the beat
    if (dist(foe, brain.last) > 8 && walk(w, foe, brain.last, 58)) return null;
    brain.look ||= 0; if (!brain.look) brain.base = foe.face;
    brain.look += w.dt; foe.face = Math.round(brain.base + Math.sin(brain.look * 2.4) * 100);
    if (brain.look > 3) { brain.last = null; brain.look = 0; }
    return null;
  }
  const end = centerOf(brain.back ? spawn.a : spawn.b || spawn.a), there = dist(foe, end) < 3;
  brain.next ??= 3 + Math.random() * 3;
  if (!(brain.scan > 0)) {
    brain.next -= w.dt;
    if (there) brain.back = !brain.back;
    if (there || brain.next <= 0 || !walk(w, foe, end, 40)) { brain.scan = 2.8; brain.base = foe.face; brain.next = 3 + Math.random() * 3; }
    return null;
  }
  brain.scan -= w.dt; foe.face = Math.round(brain.base + Math.sin((2.8 - brain.scan) * 2.2) * 80);
  return null;
}

export function zombie(w, id, foe, brain) {
  const tank = taunt(w, foe), victim = near(w.heroes.filter((h) => !h.cloaked && inReach(w, foe, h)), foe);
  const noise = near(w.sounds.filter((s) => s.by !== id && dist(foe, s) <= s.range), foe);
  if (noise) brain.goal = { x: noise.x, y: noise.y };
  if (tank) brain.goal = { x: tank.x, y: tank.y };
  foe.alert = !!(victim || brain.goal);
  if (victim) return victim.id;
  if (brain.goal) {
    if (dist(foe, brain.goal) < 8) brain.goal = null;
    else if (!walk(w, foe, brain.goal, 36)) {   // shut out: claw straight at it
      const d = dist(foe, brain.goal); w.move(foe, foe.x + (brain.goal.x - foe.x) / d * 36 * w.dt, foe.y + (brain.goal.y - foe.y) / d * 36 * w.dt);
    }
    return null;
  }
  brain.wait = (brain.wait || 0) - w.dt;
  if (brain.wait <= 0) {
    const to = { x: foe.x + (Math.random() - 0.5) * CELL * 6, y: foe.y + (Math.random() - 0.5) * CELL * 6 };
    brain.stroll = to.x > 16 && to.y > 16 && to.x < w.map.cols * CELL - 16 && to.y < w.map.rows * CELL - 16 && !blocked(w.map.cells, to.x, to.y) ? to : null;
    brain.wait = 2 + Math.random() * 3;
  }
  if (brain.stroll) walk(w, foe, brain.stroll, 16);
  return null;
}

export function drawCone(ctx, cells, foe, at) {
  ctx.beginPath(); ctx.moveTo(at.x, at.y);
  for (let i = 0; i <= 24; i++) {
    const a = (foe.face - HALF + HALF * 2 * i / 24) * Math.PI / 180;
    let r = 0; while (r < RANGE && !solidAt(cells, at.x + Math.cos(a) * (r + 4), at.y + Math.sin(a) * (r + 4))) r += 4;
    ctx.lineTo(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r);
  }
  ctx.closePath(); ctx.fillStyle = foe.alert ? "#ff404055" : "#ffe27a3d"; ctx.fill();
}
