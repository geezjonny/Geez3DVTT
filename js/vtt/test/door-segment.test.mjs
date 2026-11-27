import assert from "node:assert/strict";
import { test } from "node:test";
import { cutWall, segmentDoors } from "../door-segment.js";

test("snaps diagonal input to its dominant axis and computes horizontal doors", () => {
  const s = segmentDoors({ x: 0, y: 0 }, { x: 125, y: 70 });
  assert.equal(s.dir, "h");
  assert.deepEqual([s.x2, s.y2], [125, 0]);
  assert.deepEqual(s.cells, [{ x: 20, y: 0, dir: "h" }, { x: 60, y: 0, dir: "h" }, { x: 100, y: 0, dir: "h" }]);
});

test("vertical segments have one door per cell edge", () => {
  const s = segmentDoors({ x: 80, y: 40 }, { x: 80, y: 160 });
  assert.equal(s.dir, "v");
  assert.deepEqual(s.cells, [{ x: 80, y: 60, dir: "v" }, { x: 80, y: 100, dir: "v" }, { x: 80, y: 140, dir: "v" }]);
});

test("zero length places no doors and reversing preserves the edge count", () => {
  assert.deepEqual(segmentDoors({ x: 40, y: 40 }, { x: 40, y: 40 }).cells, []);
  const s = segmentDoors({ x: 120, y: 0 }, { x: 0, y: 0 });
  assert.equal(s.dir, "h");
  assert.deepEqual(s.cells.map((c) => c.x), [100, 60, 20]);
});

test("a new wall or door covers what lies under it, even slightly off the grid", () => {
  const a = { x: 40, y: 80 }, b = { x: 80, y: 80 };
  assert.deepEqual(cutWall({ x1: 0, y1: 86, x2: 120, y2: 86, mat: "brick" }, a, b), [{ x1: 0, y1: 86, x2: 40, y2: 86, mat: "brick" }, { x1: 80, y1: 86, x2: 120, y2: 86, mat: "brick" }]);
  assert.deepEqual(cutWall({ x1: 44, y1: 77, x2: 84, y2: 77 }, a, b)?.length, 1);   // an imported door half a square along
  assert.equal(cutWall({ x1: 80, y1: 80, x2: 120, y2: 80 }, a, b), null);           // only touching ends
  assert.equal(cutWall({ x1: 60, y1: 60, x2: 60, y2: 100 }, a, b), null);           // crossing
  assert.equal(cutWall({ x1: 40, y1: 120, x2: 80, y2: 120 }, a, b), null);          // the next grid line
});
