import assert from "node:assert/strict";
import { test } from "node:test";
import { cutWall, segmentDoors, doorKind, doorHalf, doorSeg } from "../door-segment.js";

test("snaps diagonal input to its dominant axis", () => {
  const s = segmentDoors({ x: 0, y: 0 }, { x: 125, y: 70 });
  assert.equal(s.dir, "h");
  assert.deepEqual([s.x2, s.y2], [125, 0]);
  assert.deepEqual(s.door, { x: 60, y: 0, dir: "h", len: 3 });
});

test("a dragged vertical line is one door as long as the drag", () => {
  const s = segmentDoors({ x: 80, y: 40 }, { x: 80, y: 160 });
  assert.equal(s.dir, "v");
  assert.deepEqual(s.door, { x: 80, y: 100, dir: "v", len: 3 });
  assert.deepEqual(doorSeg(s.door), [80, 40, 80, 160]);
});

test("zero length places no door and reversing preserves the length", () => {
  assert.equal(segmentDoors({ x: 40, y: 40 }, { x: 40, y: 40 }).door, null);
  assert.deepEqual(segmentDoors({ x: 120, y: 0 }, { x: 0, y: 0 }).door, { x: 60, y: 0, dir: "h", len: 3 });
});

test("iron material makes an iron door, and doubles are at least two wide", () => {
  assert.equal(doorKind({ doorKind: "wood", mat: "iron" }), "iron");
  assert.equal(doorKind({ doorKind: "bars", mat: "iron" }), "bars");
  assert.equal(doorHalf({ doorKind: "double" }), 40);
  assert.equal(doorHalf({ doorKind: "double", len: 5 }), 100);
  assert.equal(doorHalf({}), 20);
});

test("a new wall or door covers what lies under it, even slightly off the grid", () => {
  const a = { x: 40, y: 80 }, b = { x: 80, y: 80 };
  assert.deepEqual(cutWall({ x1: 0, y1: 86, x2: 120, y2: 86, mat: "brick" }, a, b), [{ x1: 0, y1: 86, x2: 40, y2: 86, mat: "brick" }, { x1: 80, y1: 86, x2: 120, y2: 86, mat: "brick" }]);
  assert.deepEqual(cutWall({ x1: 44, y1: 77, x2: 84, y2: 77 }, a, b)?.length, 1);   // an imported door half a square along
  assert.equal(cutWall({ x1: 80, y1: 80, x2: 120, y2: 80 }, a, b), null);           // only touching ends
  assert.equal(cutWall({ x1: 60, y1: 60, x2: 60, y2: 100 }, a, b), null);           // crossing
  assert.equal(cutWall({ x1: 40, y1: 120, x2: 80, y2: 120 }, a, b), null);          // the next grid line
});
