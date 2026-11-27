import assert from "node:assert/strict";
import { test } from "node:test";
import { cleanHero, RACES, CLASSES, SLIDERS } from "../blockfolk-data.js";

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

test("the octopus needs no race or class", () => {
  assert.deepEqual(cleanHero({ creature: "octopus", race: "x" }), { creature: "octopus", name: "Glowing octopus" });
  assert.throws(() => cleanHero({ creature: "dragon" }), /valid race or class/);
});

test("a code without a known race and class is refused", () => {
  for (const bad of [null, {}, { race: "__proto__", cls: "Wizard" }, { race: "Elf", cls: "toString" }]) assert.throws(() => cleanHero(bad), /valid race or class/);
});
