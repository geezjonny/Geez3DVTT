import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LOOT_TIERS, generateLoot, addToBag, addCoins } from "../lootroll.js";

const read = (f) => JSON.parse(readFileSync(new URL(`../../../data/${f}`, import.meta.url), "utf8"));
const reference = [...read("equipment.json"), ...read("magic_items.json")];

test("every tier rolls coins in range, gear and one magic item of its rarity", () => {
  for (const random of [() => 0, () => 0.5, () => 0.999999]) LOOT_TIERS.forEach((rules, i) => {
    const { coins, items } = generateLoot(i + 1, reference, random);
    assert.deepEqual(Object.keys(coins), Object.keys(rules.coins));
    for (const [k, n] of Object.entries(coins)) assert.ok(n >= rules.coins[k][0] && n <= rules.coins[k][1]);
    assert.ok(items.length >= 3 && items.length <= 5);
    for (const item of items) assert.ok(item.name && item.qty >= 1 && item.qty <= 3);
    assert.ok(rules.rarity.includes(reference.find((r) => r.name === items.at(-1).name).rarity.name));
  });
  assert.throws(() => generateLoot(5, reference));
});

test("giving adds to what is carried and leaves the original alone", () => {
  const bag = { a: { name: "Rope", qty: 1 } };
  const out = addToBag(bag, [{ name: "rope", qty: 2 }, { name: "Torch", qty: 3 }], () => "b");
  assert.equal(out.a.qty, 3); assert.equal(out.b.name, "Torch"); assert.equal(out.b.qty, 3); assert.equal(bag.a.qty, 1);
  assert.deepEqual(addCoins({ gp: 5, sp: 1 }, { gp: 10, pp: 2 }), { gp: 15, sp: 1, pp: 2 });
  assert.deepEqual(addCoins(null, { cp: 4 }), { cp: 4 });
});
