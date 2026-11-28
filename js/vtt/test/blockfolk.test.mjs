import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanHero, RACES, CLASSES, SLIDERS } from "../blockfolk-data.js";
import { PRESETS, MONSTER_COLORS } from "../blockcreature-data.js";
import { RACE_PARTS, RACE_FACE } from "../raceparts-data.js";

test("a hero code keeps good values and replaces bad ones with defaults", () => {
  const h = cleanHero({ race: "Elf", cls: "Wizard", hat: "crown", top: "#112233", skin: "red", main: "<img>", junk: 1 });
  assert.deepEqual([h.hat, h.top, h.skin, h.main], ["crown", "#112233", RACES.Elf.skins[0], CLASSES.Wizard.main]);
  assert.ok(!("junk" in h) && Object.values(h).every((v) => typeof v === "string" || Number.isFinite(v)));
});

test("body parts and sliders take known values, clamped, with plain defaults for old codes", () => {
  const old = cleanHero({ race: "Human", cls: "Bard" });
  assert.deepEqual([old.head, old.ears, old.shoulders, old.height, old.legLen], ["normal", "race", "auto", 1, 1]);
  const h = cleanHero({ race: "Human", cls: "Bard", head: "skull", arms: "tentacle", height: 9, build: "0.1", thick: "big" });
  assert.deepEqual([h.head, h.arms, h.height, h.build, h.thick], ["skull", "normal", SLIDERS.height[1], SLIDERS.build[0], 1]);
});

test("the female body and heroic head are kept, and every race has both heroic heads", () => {
  const h = cleanHero({ race: "Elf", cls: "Wizard", sex: "female", head: "heroic" });
  assert.deepEqual([h.sex, h.head, cleanHero({ race: "Elf", cls: "Wizard" }).sex], ["female", "heroic", "male"]);
  for (const race of Object.keys(RACES)) {
    for (const name of ["head." + race, "head." + race + ".f"]) {
      assert.equal(RACE_FACE[name.slice(5)]?.filter(Number.isFinite).length, 4, name);
      const { v, f } = RACE_PARTS[name];
      assert.ok(Object.values(f).every((ids) => ids.length % 3 === 0 && ids.every((i) => Number.isInteger(v[i * 3 + 2]))), name);
    }
  }
});

test("the heroic torso is kept", () => {
  assert.equal(cleanHero({ race: "Goliath", cls: "Monk", torso: "heroic" }).torso, "heroic");
});

test("an extended race starts with its own legs, head and wings, and a chosen value still wins", () => {
  const c = cleanHero({ race: "Centaur", cls: "Fighter" }), f = cleanHero({ race: "Fairy", cls: "Wizard" });
  assert.deepEqual([c.legs, c.head, c.tail, f.cape], ["centaur", "heroic", "race", "fairywings"]);
  assert.equal(cleanHero({ race: "Centaur", cls: "Fighter", legs: "normal" }).legs, "normal");
});

test("a monster code is checked as a monster, and the first Squishy mini still loads", () => {
  const squishy = cleanHero({ creature: "octopus" });
  assert.deepEqual([squishy.creature, squishy.body, squishy.eyes, squishy.count], ["monster", "squid", 6, 8]);
  const m = cleanHero({ creature: "monster", body: "cube", eyes: 99, count: 3.6, size: "x", skin: "red", junk: 1 });
  assert.deepEqual([m.body, m.eyes, m.count, m.size, m.skin, "junk" in m], ["blob", 8, 4, 1, MONSTER_COLORS.skin, false]);
  assert.throws(() => cleanHero({ creature: "dragon" }), /not a monster code/);
});

test("every preset is already clean", () => {
  for (const [name, preset] of Object.entries(PRESETS)) {
    const clean = cleanHero({ ...preset, creature: "monster", name });
    for (const [key, value] of Object.entries(preset)) assert.equal(clean[key], value, `${name} ${key}`);
  }
});

test("a code without a known race and class is refused", () => {
  for (const bad of [null, {}, { race: "__proto__", cls: "Wizard" }, { race: "Elf", cls: "toString" }]) assert.throws(() => cleanHero(bad), /valid race or class/);
});
