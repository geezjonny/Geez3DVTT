import test from "node:test";
import assert from "node:assert/strict";
import { canSee, cone, canHear, litAt, hearingRange, findPath, advance, SIGHT, DARK } from "../stealth-rules.js";

const guard = { x: 100, y: 100, face: 0 };   // looking right
const area = { x: 0, y: 0, cols: 10, rows: 6 };

test("a guard sees ahead, not behind, beyond range or across floors", () => {
  assert.ok(canSee(guard, { x: 220, y: 110 }, []));
  assert.ok(!canSee(guard, { x: 20, y: 100 }, []));
  assert.ok(!canSee(guard, { x: 100, y: 220 }, []));
  assert.ok(!canSee(guard, { x: 100 + SIGHT + 5, y: 100 }, []));
  assert.ok(!canSee(guard, { x: 220, y: 100, lv: 1 }, []));
  assert.ok(canSee(guard, { x: 70, y: 100 }, []), "close behind is noticed");
  assert.ok(!canSee(guard, { x: 100 + SIGHT * DARK + 5, y: 100 }, [], SIGHT * DARK), "darkness shortens sight");
});

test("walls block sight and light, muffle sound and cut the cone short", () => {
  const wall = [[160, 0, 160, 200]];
  assert.ok(!canSee(guard, { x: 220, y: 100 }, wall));
  assert.ok(canSee(guard, { x: 150, y: 100 }, wall));
  assert.ok(canHear(guard, { x: 220, y: 100 }, 160, []));
  assert.ok(!canHear(guard, { x: 220, y: 100 }, 160, wall));
  assert.ok(litAt({ x: 100, y: 100 }, [{ x: 140, y: 100, radius: 120 }], wall));
  assert.ok(!litAt({ x: 100, y: 100 }, [{ x: 200, y: 100, radius: 120 }], wall));
  assert.equal(hearingRange(12), 160); assert.equal(hearingRange(5), 0);
  const outline = cone(guard, wall);
  assert.deepEqual(outline[0], [100, 100]);
  assert.ok(outline.every(([x]) => x <= 160.01));
});

test("a path goes round a wall, and there is none through a sealed one", () => {
  const gap = [[200, 0, 200, 160]];   // open below y = 160
  const path = findPath({ x: 60, y: 60 }, { x: 340, y: 60 }, gap, area);
  assert.deepEqual(path.at(-1), [340, 60]);
  assert.ok(path.some(([, y]) => y > 160));
  assert.equal(findPath({ x: 60, y: 60 }, { x: 340, y: 60 }, [[200, 0, 200, 240]], area), null);
});

const run = (g, brain, seconds, world, seen = []) => { for (let i = 0; i < seconds * 10; i++) { const next = advance(g, brain, 0.1, world); if (next.open) { world.doors = []; seen.push(next.open); } Object.assign(g, next); } return g; };

test("a patrolling guard walks its points and opens a door on the way", () => {
  const g = { x: 60, y: 60, face: 0, patrol: [[60, 60], [300, 60]] }, opened = [];
  const world = { walls: [[200, 0, 200, 40], [200, 80, 200, 240]], doors: [{ id: "d1", seg: [200, 40, 200, 80] }], area };
  const brain = {};
  run(g, brain, 4, world, opened);
  assert.deepEqual(opened, ["d1"]);
  run(g, brain, 1.5, world);
  assert.ok(g.x > 220);
});

test("a guard investigates, looks round and goes back to its post", () => {
  const g = { x: 60, y: 60, face: 90 }, brain = {}, world = { walls: [], doors: [], area };
  run(g, brain, 0.1, world);
  Object.assign(brain, { mode: "invest", target: { x: 260, y: 60 }, path: null });
  run(g, brain, 2.5, world);
  assert.equal(brain.mode, "look"); assert.ok(Math.abs(g.x - 260) < 1);
  run(g, brain, 8, world);
  assert.equal(brain.mode, "home"); assert.ok(Math.hypot(g.x - 60, g.y - 60) < 5); assert.equal(g.face, 90);
});
