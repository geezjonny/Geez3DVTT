import test from "node:test";
import assert from "node:assert/strict";
import { moveCircle, exitAt, leadsTo } from "../movement.js";

test("a wall stops a token and lets it slide", () => {
  const wall = [[100, 0, 100, 400]];
  const o = moveCircle({ x: 60, y: 100 }, 200, 80, 12, wall, 400, 400);
  assert.ok(Math.abs(o.x - 88) < 0.01, `stopped at ${o.x}`);
  assert.ok(o.y > 175, "kept moving along the wall");
});

test("a long step cannot tunnel through a wall, and the map edge holds", () => {
  assert.ok(moveCircle({ x: 90, y: 50 }, 5000, 0, 12, [[100, 0, 100, 100]], 400, 400).x < 100);
  assert.equal(moveCircle({ x: 20, y: 20 }, -500, -500, 12, [], 400, 400).x, 12);
});

test("stairs work from both ends, portals pair by name", () => {
  const props = {
    s: { kind: "stairs", x: 60, y: 60, lv: 0, to: 1 }, dead: { kind: "ladder", x: 140, y: 60, lv: 0, to: "" },
    a: { kind: "portal", x: 220, y: 60, lv: 0, link: "gate" }, b: { kind: "portal", x: 300, y: 300, lv: 2, link: "gate" }
  };
  assert.equal(exitAt(props, { x: 50, y: 70 }, 0), "s");
  assert.equal(exitAt(props, { x: 50, y: 70 }, 1), "s");
  assert.equal(exitAt(props, { x: 50, y: 70 }, 2), null);
  assert.deepEqual(leadsTo(props, "s", { x: 50, y: 70 }, 0), { x: 50, y: 70, lv: 1 });
  assert.deepEqual(leadsTo(props, "s", { x: 50, y: 70 }, 1), { x: 50, y: 70, lv: 0 });
  assert.equal(leadsTo(props, "dead", { x: 140, y: 60 }, 0), null);
  assert.deepEqual(leadsTo(props, "a", { x: 220, y: 60 }, 0), { x: 300, y: 300, lv: 2 });
});
