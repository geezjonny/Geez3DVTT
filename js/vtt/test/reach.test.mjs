import test from "node:test";
import assert from "node:assert/strict";

// state.js reads the page when it loads; give it just enough of one.
globalThis.document = { documentElement: { dataset: {} }, querySelector: () => null };
const { S } = await import("../state.js");
const { canReach } = await import("../reach.js");

test("a player cannot use things through walls, closed doors or floors", () => {
  S.map.walls = { w: { x1: 80, y1: 0, x2: 80, y2: 40 }, secret: { x1: 80, y1: 80, x2: 80, y2: 120, hidden: true } };
  S.objects = { d: { kind: "door", x: 80, y: 60, dir: "v", state: "closed" } };
  const me = { x: 60, y: 20 }, lever = { kind: "switch", x: 100, y: 20 };
  assert.equal(canReach(me, lever), false);                                   // wall
  assert.equal(canReach({ x: 60, y: 60 }, { ...lever, y: 60 }), false);        // closed door
  assert.equal(canReach({ x: 60, y: 60 }, S.objects.d), true);                 // the door itself
  assert.equal(canReach({ x: 60, y: 100 }, { ...lever, y: 100 }), true);       // an opened secret wall
  assert.equal(canReach({ x: 100, y: 20, lv: 1 }, lever), false);              // another floor
  S.objects.d.state = "open";
  assert.equal(canReach({ x: 60, y: 60 }, { ...lever, y: 60 }), true);
});
