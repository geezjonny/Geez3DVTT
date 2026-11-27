// Blockcreature monsters (blockcreature.html): the choices, presets, and the check every saved or pasted code goes through.
export const MONSTER_PARTS = { // the first choice is the default
  body: ["blob", "orb", "squid", "beast", "brute", "serpent", "bug"],
  head: ["auto", "beast", "dragon", "skull", "bird"],
  mouth: ["none", "smile", "fangs", "beak", "maw"],
  limbs: ["none", "legs", "spider", "tentacles"],
  arms: ["none", "claws", "pincers", "tentacles"],
  horns: ["none", "horns", "antlers", "spikes", "crown"],
  back: ["none", "spines", "fins", "batwings", "featherwings"],
  tail: ["none", "tail", "spiked", "stinger", "fish"],
  markings: ["none", "spots", "stripes", "runes"],
  float: ["no", "yes"],
  aura: ["no", "yes"],
};
// [lowest, highest, start, step]
export const MONSTER_SLIDERS = {
  size: [0.5, 2.5, 1, 0.05], bulk: [0.6, 1.6, 1, 0.05], headSize: [0.6, 1.7, 1, 0.05], eyes: [0, 8, 2, 1], eyeSize: [0.6, 1.8, 1, 0.05],
  count: [2, 10, 4, 1], limbLen: [0.5, 1.7, 1, 0.05],
};
export const MONSTER_COLORS = { skin: "#5a8a4a", accent: "#c9b46a", glow: "#ffd23f" };

export const PRESETS = {
  Squishy: { body: "squid", mouth: "beak", limbs: "tentacles", count: 8, eyes: 6, back: "fins", markings: "runes", float: "yes", aura: "yes", skin: "#6a35b0", accent: "#9a6ad0", glow: "#9dff4a" },
  Slime: { body: "blob", mouth: "smile", markings: "spots", aura: "yes", eyeSize: 1.2, skin: "#4ac98a", accent: "#a8f0c8", glow: "#e8fff0" },
  "Floating eye": { body: "orb", mouth: "maw", arms: "none", limbs: "tentacles", count: 6, limbLen: 0.7, eyes: 1, eyeSize: 1.4, horns: "spikes", float: "yes", skin: "#8a3a4a", accent: "#c97a6a", glow: "#ffe14a" },
  "Dire wolf": { body: "beast", head: "beast", mouth: "fangs", limbs: "legs", count: 4, back: "spines", tail: "tail", skin: "#4a4650", accent: "#8a8490", glow: "#ff5a3a" },
  "Giant spider": { body: "bug", mouth: "fangs", limbs: "spider", count: 8, eyes: 8, markings: "stripes", skin: "#2a2430", accent: "#b8343a", glow: "#ff3a3a" },
  Wyrmling: { body: "beast", head: "dragon", mouth: "fangs", limbs: "legs", count: 4, horns: "horns", back: "batwings", tail: "spiked", skin: "#a8342a", accent: "#e8b04a", glow: "#ffd23f" },
  Serpent: { body: "serpent", head: "dragon", mouth: "fangs", back: "spines", markings: "stripes", size: 1.2, skin: "#2e7d6f", accent: "#d9c86a", glow: "#e8ff5a" },
  Ogre: { body: "brute", mouth: "fangs", limbs: "legs", count: 2, arms: "claws", horns: "horns", size: 1.4, bulk: 1.2, skin: "#7a8a5a", accent: "#5a4630", glow: "#ffb347" },
};

const HEX = /^#[0-9a-f]{6}$/i;
// A monster code with every value checked. "octopus" is the first Squishy mini, saved before there was a creator.
export function cleanCreature(code) {
  const c = code?.creature === "octopus" ? { ...PRESETS.Squishy, creature: "monster", name: "Squishy" } : code;
  if (c?.creature !== "monster") throw new Error("That is not a monster code.");
  const out = { creature: "monster", name: String(c.name || "").slice(0, 40) };
  for (const [k, list] of Object.entries(MONSTER_PARTS)) out[k] = list.includes(c[k]) ? c[k] : list[0];
  for (const [k, [lo, hi, start, step]] of Object.entries(MONSTER_SLIDERS)) {
    const v = Number(c[k] ?? start);
    out[k] = Number.isFinite(v) ? Math.min(hi, Math.max(lo, step === 1 ? Math.round(v) : v)) : start;
  }
  for (const [k, d] of Object.entries(MONSTER_COLORS)) out[k] = HEX.test(c[k]) ? c[k] : d;
  return out;
}
