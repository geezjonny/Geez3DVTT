import assert from "node:assert/strict";
import { test } from "node:test";
import { companionAct, restOf } from "../acts.js";

const sheet = { attacks: [{ name: "Longsword" }], spellcasting: { spells: [{ name: "Fire Bolt" }, { name: "Fireball" }] } };

test("weapons slash on the to-hit roll and swing on damage", () => {
  const tried = new Set();
  assert.deepEqual(companionAct("Longsword Attack", sheet, tried), { fx: "slash" });
  assert.deepEqual(companionAct("Longsword Damage", sheet, tried), { act: "attack" });
});

test("spells flash; damage swings only after a to-hit roll", () => {
  const tried = new Set();
  assert.deepEqual(companionAct("Fireball Damage", sheet, tried), { fx: "magic" });
  assert.deepEqual(companionAct("Fire Bolt Spell attack", sheet, tried), { fx: "magic" });
  assert.deepEqual(companionAct("Fire Bolt Damage", sheet, tried), { act: "attack" });
});

test("other rolls do nothing", () => {
  for (const label of ["d20", "Stealth (DEX) Check", "Initiative Initiative", "Rope Damage", undefined]) assert.equal(companionAct(label, sheet, new Set()), null);
});

test("resting lasts only on the square it started on", () => {
  assert.equal(restOf({ act: "sit", x: 20, y: 60 }, { x: 20, y: 60 }), "sit");
  assert.equal(restOf({ act: "sleep", x: 20, y: 60 }, { x: 60, y: 60 }), null);
  assert.equal(restOf({ act: "wave" }, { x: 20, y: 60 }), null);
});
