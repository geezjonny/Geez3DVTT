// Low-poly props as plain data: a few flat-shaded shapes each, which view3d.js merges into one mesh per kind.
// 1 unit = one grid cell, y = 0 is the floor, +z is the front. Boxes and cylinders sit ON y; balls, rocks and rings are centred.
const box = (c, w, h, d, x = 0, y = 0, z = 0, rot) => ({ g: "box", c, a: [w, h, d], at: [x, y + h / 2, z], rot });
const cyl = (c, r, h, x = 0, y = 0, z = 0, top = r, n = 7, rot) => ({ g: "cyl", c, a: [top, r, h, n], at: [x, y + h / 2, z], rot });
const cone = (c, r, h, x = 0, y = 0, z = 0, n = 6) => cyl(c, r, h, x, y, z, 0, n);
const ball = (c, r, x = 0, y = 0, z = 0, sy = 1) => ({ g: "ball", c, a: [r], at: [x, y, z], sy });
const rock = (c, r, x = 0, y = 0, z = 0, sy = 0.7) => ({ g: "rock", c, a: [r], at: [x, y, z], sy });
const ring = (c, r, t, x = 0, y = 0, z = 0, rot) => ({ g: "ring", c, a: [r, t], at: [x, y, z], rot });
const glow = (...parts) => parts.map((p) => ({ ...p, glow: true }));

const QUARTER = Math.PI / 2, FLAT = [QUARTER, 0, 0], ALONG_X = [0, 0, QUARTER], ALONG_Z = [QUARTER, 0, 0];
const WOOD = 0xa8763a, DARK = 0x6e4524, STONE = 0x8c8894, SLATE = 0x66636f, IRON = 0x4a525e, BRASS = 0xb08a30, RED = 0xb03a48, LINEN = 0xe6d6b0,
  LEAF = 0x3f9a3a, LIME = 0x5fb04a, BONE = 0xd8cca8, STRAW = 0xc9a850, WATER = 0x3a78a8, BLACK = 0x25222a, PURPLE = 0x6a4a90, FIRE = 0xff8a2a, FLAME = 0xffd060, CRYSTAL = 0x5fe8ff, GREEN = 0x7ad84a;

// shared pieces
const each = (list, fn) => list.map(fn);
const legs = (c, x, z, h, t = 0.08, y = 0) => [[-x, -z], [x, -z], [-x, z], [x, z]].map(([a, b]) => box(c, t, h, t, a, y, b));
const top = (c, w, d, h, th = 0.09) => [box(c, w, th, d, 0, h - th), ...legs(DARK, w / 2 - 0.07, d / 2 - 0.07, h - th)];
const fire = (x, y, z, s = 1) => glow(cone(FIRE, 0.12 * s, 0.3 * s, x, y, z, 5), cone(FLAME, 0.07 * s, 0.2 * s, x, y + 0.02, z + 0.03 * s, 4)).map((p) => ({ ...p, flame: true }));   // gone when the light is off
const candle = (x, y, z) => [cyl(LINEN, 0.025, 0.14, x, y, z, 0.025, 5), ...fire(x, y + 0.14, z, 0.3)];
const mug = (x, y, z) => [cyl(WOOD, 0.045, 0.1, x, y, z, 0.05, 6), box(IRON, 0.02, 0.06, 0.02, x + 0.065, y + 0.02, z)];
const bottle = (c, x, y, z) => [ball(c, 0.07, x, y + 0.07, z), cyl(c, 0.022, 0.09, x, y + 0.11, z, 0.022, 5)];
const books = (y, z, from = -0.32, n = 6) => Array.from({ length: n }, (_, i) => box([RED, 0x3a5a8a, 0x4a7a3a, BRASS, PURPLE][i % 5], 0.085, 0.2 + (i % 3) * 0.03, 0.16, from + i * 0.12, y, z));
const shelves = (levels, w = 0.9, d = 0.28, h = 1.2, z = -0.3) => [box(DARK, 0.06, h, d, -w / 2, 0, z), box(DARK, 0.06, h, d, w / 2, 0, z), box(DARK, w, h, 0.04, 0, 0, z - d / 2), ...levels.map((y) => box(WOOD, w, 0.05, d, 0, y, z))];
const keg = (x, y, z, r = 0.19, len = 0.4) => [cyl(WOOD, r, len, x, y - len / 2, z, r, 8, ALONG_Z), ring(IRON, r, 0.018, x, y, z - len * 0.3), ring(IRON, r, 0.018, x, y, z + len * 0.3)];
const wheel = (x, y, z, r = 0.22) => [ring(DARK, r, 0.035, x, y, z, [0, QUARTER, 0]), box(DARK, 0.04, r * 2, 0.04, x, y - r, z), box(DARK, 0.04, 0.04, r * 2, x, y - 0.02, z)];
const skull = (x, y, z, s = 1) => [ball(BONE, 0.12 * s, x, y, z), box(BONE, 0.11 * s, 0.07 * s, 0.1 * s, x, y - 0.14 * s, z + 0.02 * s), box(BLACK, 0.04 * s, 0.04 * s, 0.02, x - 0.045 * s, y - 0.02, z + 0.1 * s), box(BLACK, 0.04 * s, 0.04 * s, 0.02, x + 0.045 * s, y - 0.02, z + 0.1 * s)];
const trunk = (r, h) => cyl(DARK, r * 1.3, h, 0, 0, 0, r * 0.7, 6);
const bed = (y = 0) => [box(DARK, 0.76, 0.2, 0.96, 0, y + 0.08), box(LINEN, 0.68, 0.1, 0.86, 0, y + 0.28), box(RED, 0.7, 0.04, 0.54, 0, y + 0.37, 0.17), box(0xf4ead0, 0.44, 0.08, 0.2, 0, y + 0.38, -0.29), box(WOOD, 0.76, 0.4, 0.07, 0, y + 0.08, -0.47)];
const cabinet = (w, h, d, rows, cols) => [box(DARK, w, h, d, 0, 0, -0.5 + d / 2 + 0.02), ...Array.from({ length: rows * cols }, (_, i) => {
  const cw = w / cols, ch = h / rows, x = -w / 2 + cw * (i % cols + 0.5), y = ch * Math.floor(i / cols) + 0.03;
  return [box(WOOD, cw - 0.05, ch - 0.06, 0.03, x, y, -0.5 + d + 0.035), box(BRASS, 0.04, 0.04, 0.03, cols > 1 ? x + (i % cols ? -1 : 1) * (cw / 2 - 0.08) : x, y + ch / 2 - 0.05, -0.5 + d + 0.06)];
})];
const counter = (c) => [box(DARK, 0.9, 0.7, 0.54), box(c, 0.98, 0.08, 0.62, 0, 0.7)];
const brazier = (h, r) => [...each([0, 2.1, 4.2], (a) => box(IRON, 0.06, h, 0.06, Math.cos(a) * r * 0.6, 0, Math.sin(a) * r * 0.6)), cyl(IRON, r * 0.6, 0.18, 0, h - 0.04, 0, r, 7), ...fire(0, h + 0.12, 0, r * 4)];
const crystals = (list) => glow(...list.map(([x, z, r, h, tilt]) => cyl(CRYSTAL, r, h, x, 0.05, z, 0.01, 5, [0, 0, tilt])));
const tufts = (c, h, n, spread) => Array.from({ length: n }, (_, i) => { const a = i * 2.4, r = spread * Math.sqrt((i + 0.5) / n); return cyl(c, 0.035, h * (0.7 + (i % 3) * 0.2), Math.cos(a) * r, 0, Math.sin(a) * r, 0, 4, [Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2]); });

const lever = (a, knob) => [box(SLATE, 0.42, 0.14, 0.32), box(BLACK, 0.3, 0.02, 0.07, 0, 0.14), cyl(WOOD, 0.035, 0.5, -0.25 * Math.sin(a), 0.25 * Math.cos(a) - 0.11, 0, 0.035, 5, [0, 0, a]), ball(knob, 0.08, -0.5 * Math.sin(a), 0.14 + 0.5 * Math.cos(a), 0)];
const plate = (h) => [box(SLATE, 0.86, 0.03, 0.86), box(STONE, 0.66, h, 0.66, 0, 0.03)];
const tripwire = (n, y) => [box(DARK, 0.07, 0.3, 0.07, -0.45), box(DARK, 0.07, 0.3, 0.07, n - 0.55), box(STRAW, n - 0.1, 0.02, 0.02, (n - 1) / 2, y)];

// Traps and triggers, one model per kind: n is 0 at the start state, 1 once used (a dial or gauge: which state it shows).
const catapult = (fired) => {
  const a = fired ? 0.45 : -1.15, y = 0.45 + (fired ? 0.1 : 0), z = fired ? 0.12 : -0.14, tip = [y + 0.375 * Math.cos(a), z + 0.375 * Math.sin(a)];
  return [each([-0.26, 0.26], (x) => box(DARK, 0.09, 0.09, 0.84, x, 0.1)), each([-0.3, 0.3], (v) => box(WOOD, 0.6, 0.07, 0.08, 0, 0.12, v)),
    each([-0.35, 0.35], (x) => each([-0.28, 0.28], (v) => cyl(BLACK, 0.13, 0.07, x, 0.095, v, 0.13, 8, ALONG_X))), each([-0.22, 0.22], (x) => box(WOOD, 0.07, 0.42, 0.07, x, 0.18, 0.05)),
    box(IRON, 0.52, 0.07, 0.07, 0, 0.52, 0.05), box(WOOD, 0.08, 0.75, 0.08, 0, y - 0.375, z, [a, 0, 0]), box(IRON, 0.2, 0.06, 0.2, 0, tip[0] - 0.03, tip[1]), fired ? [] : rock(SLATE, 0.11, 0, tip[0] + 0.1, tip[1], 0.9)];
};
const swords = (a) => [box(0xc8ccd4, 0.07, 0.75, 0.025, 0, 0.2, a > 0 ? 0.02 : -0.02, [0, 0, a]), box(BRASS, 0.22, 0.05, 0.05, 0.37 * Math.sin(a), 0.575 - 0.37 * Math.cos(a), a > 0 ? 0.02 : -0.02, [0, 0, a])];
const TRAPS = {
  trap_catapult: (n) => catapult(n),
  trap_stone: (n) => [box(DARK, 0.82, 0.06, 0.76, 0, 0.09, -0.04, [0.18, 0, 0]), box(WOOD, 0.82, 0.14, 0.08, 0, 0, -0.4), rock(SLATE, 0.32, 0, n ? 0.34 : 0.45, n ? 0.34 : -0.1, 0.95), each([-0.28, 0.28], (x) => box(WOOD, 0.12, n ? 0.04 : 0.15, 0.12, x, 0, 0.4))],
  trap_spawn: (n) => [ring(IRON, 0.4, 0.035, 0, 0.035, 0, FLAT), glow(cyl(n ? RED : PURPLE, 0.24, 0.02, 0, 0.005, 0, 0.24, 8)), each([0, 1.571, 3.142, 4.712], (a) => cone(BONE, 0.06, 0.34, Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4, 4)),
    n ? glow(...each([0, 2.1, 4.2], (a) => cone(RED, 0.08, 0.55, Math.cos(a) * 0.14, 0, Math.sin(a) * 0.14, 4))) : skull(0, 0.19, 0, 0.9)],
  trap_dial: (n = 0) => { const a = n * QUARTER; return [cyl(STONE, 0.24, 0.45, 0, 0, 0, 0.18, 7), cyl(BRASS, 0.3, 0.06, 0, 0.45, 0, 0.3, 10), each([0, 1, 2, 3], (i) => box(IRON, 0.06, 0.03, 0.06, Math.sin(i * QUARTER) * 0.23, 0.51, Math.cos(i * QUARTER) * 0.23)),
    box(RED, 0.05, 0.035, 0.22, Math.sin(a) * 0.1, 0.51, Math.cos(a) * 0.1, [0, a, 0]), ball(BLACK, 0.045, 0, 0.54, 0)]; },
  trap_sight: (n) => [cyl(SLATE, 0.24, 0.1, 0, 0, 0, 0.24, 6), cyl(STONE, 0.12, 0.65, 0, 0.1, 0, 0.1, 6), ball(LINEN, 0.17, 0, 0.9, 0), ring(BRASS, 0.2, 0.022, 0, 0.9, 0), glow(ball(n ? RED : PURPLE, 0.09, 0, 0.9, 0.13))],
  trap_gauge: (n = 0) => [cyl(DARK, 0.22, 0.07), box(DARK, 0.08, 0.7, 0.08, 0, 0.07), box(BRASS, 0.72, 0.05, 0.05, 0, 0.72, 0, [0, 0, n * -0.14]), each([-1, 1], (s) => { const y = 0.46 - s * n * 0.05; return [box(IRON, 0.015, 0.28, 0.015, s * 0.33, y), cyl(BRASS, 0.14, 0.035, s * 0.33, y, 0, 0.16, 8)]; }),
    glow(ball([GREEN, FIRE, RED][n] ?? RED, 0.1, 0, 0.9, 0))],
  trap_floor: (n) => [box(DARK, 0.94, 0.025, 0.94), n ? [box(BLACK, 0.78, 0.035, 0.78), each([-1, 1], (s) => box(WOOD, 0.38, 0.04, 0.78, s * 0.5, 0.13, 0, [0, 0, s * 1.05]))]
    : [each([-0.2, 0.2], (x) => box(WOOD, 0.38, 0.04, 0.8, x, 0.01)), ring(IRON, 0.09, 0.018, 0.1, 0.065, 0, FLAT), each([-0.28, 0.28], (v) => box(IRON, 0.82, 0.015, 0.05, 0, 0.05, v))]],
  trap_initiative: (n) => [cyl(SLATE, 0.32, 0.12, 0, 0, 0, 0.26, 7), swords(0.6), swords(-0.6), glow(ball(n ? RED : FLAME, 0.07, 0, 0.98, 0))],
};

const MODELS = {
  ...TRAPS,
  // connectable things: view3d picks the one for the object's state (a tripwire's number is its length in cells)
  lever: () => lever(0.6, RED), lever_on: () => lever(-0.6, GREEN),
  button: () => [cyl(SLATE, 0.16, 0.5, 0, 0, 0, 0.12, 6), cyl(BRASS, 0.19, 0.06, 0, 0.5, 0, 0.19, 8), cyl(RED, 0.12, 0.08, 0, 0.56, 0, 0.11, 8)],
  plate: () => plate(0.08), plate_down: () => plate(0.015),
  tripwire: (n = 3) => tripwire(n, 0.2), tripwire_down: (n = 3) => tripwire(n, 0.01),

  // furniture
  table: () => [top(WOOD, 0.9, 0.62, 0.74), cyl(LINEN, 0.1, 0.02, -0.18, 0.74, 0.02), mug(0.18, 0.74, -0.05)],
  round_table: () => [cyl(WOOD, 0.46, 0.08, 0, 0.66, 0, 0.46, 9), cyl(DARK, 0.09, 0.66), cyl(DARK, 0.26, 0.06)],
  chair: () => [top(WOOD, 0.42, 0.42, 0.44, 0.06), box(WOOD, 0.42, 0.46, 0.06, 0, 0.44, -0.18)],
  stool: () => [cyl(WOOD, 0.2, 0.07, 0, 0.38), legs(DARK, 0.11, 0.11, 0.38, 0.06)],
  bench: () => [box(WOOD, 0.92, 0.08, 0.3, 0, 0.32), box(DARK, 0.08, 0.32, 0.28, -0.34), box(DARK, 0.08, 0.32, 0.28, 0.34)],
  pew: () => [box(WOOD, 0.94, 0.08, 0.32, 0, 0.32), box(WOOD, 0.94, 0.46, 0.06, 0, 0.36, -0.17), box(DARK, 0.07, 0.62, 0.42, -0.44, 0, -0.02), box(DARK, 0.07, 0.62, 0.42, 0.44, 0, -0.02)],
  armchair: () => [box(RED, 0.62, 0.3, 0.55, 0, 0.1), box(RED, 0.62, 0.5, 0.15, 0, 0.4, -0.21), box(DARK, 0.13, 0.22, 0.55, -0.32, 0.38), box(DARK, 0.13, 0.22, 0.55, 0.32, 0.38), legs(DARK, 0.28, 0.24, 0.1)],
  bed: () => bed(),
  bunk_bed: () => [bed(), bed(0.72), legs(DARK, 0.38, 0.45, 1.35, 0.07)],
  bookshelf: () => [shelves([0.04, 0.42, 0.8, 1.16]), books(0.09, -0.28), books(0.47, -0.28), books(0.85, -0.28)],
  wardrobe: () => [cabinet(0.82, 1.35, 0.4, 1, 2), box(WOOD, 0.9, 0.08, 0.48, 0, 1.35, -0.28)],
  dresser: () => [cabinet(0.82, 0.62, 0.4, 3, 1), box(WOOD, 0.88, 0.05, 0.46, 0, 0.62, -0.28)],
  nightstand: () => [cabinet(0.46, 0.46, 0.38, 2, 1), candle(0, 0.46, -0.28)],
  desk: () => [top(WOOD, 0.9, 0.55, 0.72), box(DARK, 0.28, 0.4, 0.48, 0.27, 0.23), box(LINEN, 0.24, 0.015, 0.3, -0.14, 0.72), candle(-0.36, 0.72, -0.16)],
  lectern: () => [cyl(DARK, 0.22, 0.07), box(DARK, 0.1, 0.75, 0.1), box(WOOD, 0.46, 0.07, 0.34, 0, 0.74, 0, [0.45, 0, 0]), box(LINEN, 0.34, 0.03, 0.24, 0, 0.8, 0, [0.45, 0, 0])],

  // storage
  barrel: () => [cyl(WOOD, 0.26, 0.4, 0, 0, 0, 0.33, 9), cyl(WOOD, 0.33, 0.4, 0, 0.4, 0, 0.26, 9), ring(IRON, 0.29, 0.022, 0, 0.18, 0, FLAT), ring(IRON, 0.29, 0.022, 0, 0.62, 0, FLAT), cyl(DARK, 0.22, 0.02, 0, 0.8, 0, 0.22, 9)],
  crate: () => [box(WOOD, 0.66, 0.66, 0.66), legs(DARK, 0.31, 0.31, 0.7, 0.09), each([-0.345, 0.345], (z) => box(DARK, 0.8, 0.07, 0.03, 0, 0.3, z, [0, 0, 0.75])), each([0.02, 0.62], (y) => box(DARK, 0.68, 0.06, 0.68, 0, y))],
  chest: () => [box(WOOD, 0.74, 0.36, 0.48), cyl(DARK, 0.25, 0.74, 0, -0.01, 0, 0.25, 8, ALONG_X), box(BRASS, 0.07, 0.52, 0.52, -0.25), box(BRASS, 0.07, 0.52, 0.52, 0.25), box(BRASS, 0.12, 0.14, 0.05, 0, 0.26, 0.25)],
  strongbox: () => [box(IRON, 0.6, 0.46, 0.5), each([-0.22, 0.22], (x) => box(BRASS, 0.06, 0.48, 0.52, x)), cyl(BRASS, 0.07, 0.04, 0, 0.22, 0.25, 0.07, 6, ALONG_Z)],
  sacks: () => [rock(STRAW, 0.22, -0.18, 0.18, -0.08, 0.95), rock(LINEN, 0.2, 0.2, 0.16, -0.05, 0.9), rock(STRAW, 0.19, 0.03, 0.14, 0.24, 0.85), cone(STRAW, 0.07, 0.12, -0.18, 0.35, -0.08)],
  pantry_shelf: () => [shelves([0.04, 0.42, 0.8, 1.16]), each([0.09, 0.47, 0.85], (y) => each([-0.28, 0, 0.28], (x) => cyl(x ? STRAW : LINEN, 0.09, 0.2, x, y, -0.28)))],
  potion_shelf: () => [shelves([0.45, 0.85, 1.16]), each([0.5, 0.9], (y) => [bottle(GREEN, -0.27, y, -0.28), bottle(RED, 0, y, -0.28), bottle(CRYSTAL, 0.27, y, -0.28)])],
  display_shelf: () => [shelves([0.3, 0.7, 1.05]), ball(BRASS, 0.1, -0.22, 0.45, -0.28), box(RED, 0.18, 0.14, 0.14, 0.2, 0.35, -0.28), bottle(CRYSTAL, -0.15, 0.75, -0.28), cone(BRASS, 0.09, 0.2, 0.22, 0.75, -0.28)],
  scroll_rack: () => [shelves([0.04, 0.35, 0.66, 0.97], 0.8, 0.3, 1.1), each([0.14, 0.45, 0.76], (y) => each([-0.24, 0, 0.24], (x) => cyl(LINEN, 0.06, 0.3, x, y - 0.15, -0.28, 0.06, 5, ALONG_Z)))],

  // lighting and fire
  light: () => MODELS.lamp(),
  lamp: () => [cyl(IRON, 0.16, 0.06), cyl(BRASS, 0.04, 1.4, 0, 0, 0, 0.04, 5), ...glow(box(FLAME, 0.17, 0.22, 0.17, 0, 1.4)), cone(IRON, 0.18, 0.15, 0, 1.62, 0, 4)],
  lamp_post: () => [cyl(IRON, 0.18, 0.14), cyl(IRON, 0.06, 1.85, 0, 0, 0, 0.045, 6), ...glow(box(FLAME, 0.2, 0.28, 0.2, 0, 1.85)), cone(IRON, 0.22, 0.18, 0, 2.13, 0, 4)],
  torch_sconce: () => [box(IRON, 0.14, 0.2, 0.04, 0, 0.62, -0.47), box(IRON, 0.04, 0.04, 0.16, 0, 0.7, -0.4), cyl(DARK, 0.035, 0.34, 0, 0.68, -0.32, 0.05, 5), fire(0, 1.02, -0.32, 0.8)],
  standing_torch: () => [cyl(IRON, 0.14, 0.07), cyl(DARK, 0.05, 1.15, 0, 0, 0, 0.04, 5), cyl(IRON, 0.07, 0.16, 0, 1.12, 0, 0.1, 6), fire(0, 1.28, 0)],
  brazier: () => brazier(0.5, 0.26),
  tall_brazier: () => brazier(1.0, 0.3),
  campfire: () => [each([0, 1.05, 2.1], (a) => cyl(DARK, 0.06, 0.6, 0, -0.22, 0, 0.06, 5, [QUARTER, a, 0])).map((p) => ({ ...p, at: [0, 0.08, 0] })), each([0, 1, 2, 3, 4, 5, 6], (i) => rock(SLATE, 0.09, Math.cos(i * 0.9) * 0.34, 0.05, Math.sin(i * 0.9) * 0.34)), fire(0, 0.08, 0, 1.5)],
  candelabra: () => [cyl(BRASS, 0.16, 0.05), cyl(BRASS, 0.03, 0.8, 0, 0, 0, 0.03, 5), box(BRASS, 0.52, 0.04, 0.04, 0, 0.76), candle(-0.24, 0.8, 0), candle(0, 0.82, 0), candle(0.24, 0.8, 0)],
  fireplace: () => [box(STONE, 0.22, 0.75, 0.38, -0.34, 0, -0.27), box(STONE, 0.22, 0.75, 0.38, 0.34, 0, -0.27), box(SLATE, 0.98, 0.14, 0.46, 0, 0.75, -0.25), box(STONE, 0.6, 0.55, 0.28, 0, 0.89, -0.32), box(BLACK, 0.46, 0.7, 0.05, 0, 0, -0.44), cyl(DARK, 0.05, 0.4, 0, -0.14, -0.22, 0.05, 5, ALONG_X), fire(0, 0.1, -0.22, 1.4)],
  hearth_oven: () => [box(STONE, 0.9, 0.55, 0.7, 0, 0, -0.1), cyl(SLATE, 0.45, 0.35, 0, 0.55, -0.1, 0.2, 8), box(STONE, 0.18, 0.55, 0.18, 0, 0.85, -0.3), box(BLACK, 0.36, 0.28, 0.04, 0, 0.12, 0.25), glow(box(FIRE, 0.24, 0.1, 0.02, 0, 0.14, 0.27))],
  forge: () => [box(SLATE, 0.8, 0.5, 0.6, 0, 0, -0.05), box(STONE, 0.9, 0.1, 0.7, 0, 0.5, -0.05), glow(box(FIRE, 0.42, 0.04, 0.32, 0, 0.6, -0.05)), fire(0.05, 0.62, -0.08, 0.9), box(STONE, 0.5, 0.35, 0.2, 0, 0.9, -0.32), box(STONE, 0.22, 0.5, 0.18, 0, 1.2, -0.32)],

  // kitchen and tavern
  kitchen_counter: () => [counter(WOOD), cyl(IRON, 0.12, 0.14, -0.22, 0.78, 0), ball(LIME, 0.07, 0.15, 0.85, 0.08), ball(RED, 0.07, 0.28, 0.85, -0.06)],
  butcher_block: () => [box(WOOD, 0.62, 0.28, 0.5, 0, 0.42), legs(DARK, 0.24, 0.18, 0.42, 0.1), box(RED, 0.22, 0.07, 0.16, -0.1, 0.7), box(IRON, 0.2, 0.02, 0.14, 0.16, 0.7), box(DARK, 0.04, 0.04, 0.16, 0.22, 0.7, 0.14)],
  pot_rack: () => [box(DARK, 0.07, 1.25, 0.07, -0.42), box(DARK, 0.07, 1.25, 0.07, 0.42), box(DARK, 0.92, 0.07, 0.07, 0, 1.2), each([-0.24, 0.02, 0.27], (x, i) => [box(IRON, 0.02, 0.24, 0.02, x, 0.96), cyl(i === 1 ? BRASS : IRON, 0.1 - i * 0.012, 0.12, x, 0.84, 0, 0.12 - i * 0.012)])],
  bar_counter: () => [counter(WOOD), each([-0.3, 0, 0.3], (x) => box(WOOD, 0.1, 0.62, 0.03, x, 0.04, 0.28)), mug(-0.25, 0.78, 0.05), mug(0.1, 0.78, -0.1), bottle(GREEN, 0.3, 0.78, 0)],
  shop_counter: () => [counter(DARK), box(RED, 0.34, 0.02, 0.62, -0.2, 0.78), ball(BRASS, 0.08, 0.25, 0.86, 0), box(LINEN, 0.16, 0.08, 0.12, -0.2, 0.8, 0.1)],
  keg_rack: () => [box(DARK, 0.9, 0.1, 0.45), keg(-0.23, 0.31, 0), keg(0.23, 0.31, 0), box(DARK, 0.9, 0.06, 0.1, 0, 0.5), keg(0, 0.75, 0)],
  mug_clutter: () => [mug(-0.2, 0, -0.1), mug(0.15, 0, 0.18), mug(0.05, 0, -0.22), bottle(GREEN, -0.1, 0, 0.18), cyl(LINEN, 0.11, 0.025, 0.24, 0, -0.04)],
  cauldron: () => [cyl(BLACK, 0.2, 0.2, 0, 0.1, 0, 0.34, 8), cyl(BLACK, 0.34, 0.18, 0, 0.3, 0, 0.27, 8), ring(IRON, 0.28, 0.03, 0, 0.48, 0, FLAT), glow(cyl(GREEN, 0.25, 0.02, 0, 0.47, 0, 0.25, 8), ball(GREEN, 0.05, 0.08, 0.52, 0.05)), legs(IRON, 0.17, 0.17, 0.12, 0.07)],

  // study, alchemy and magic
  globe: () => [cyl(DARK, 0.2, 0.05), cyl(DARK, 0.04, 0.5), ball(WATER, 0.24, 0, 0.72, 0), rock(LEAF, 0.1, 0.1, 0.82, 0.14, 1), rock(LEAF, 0.08, -0.16, 0.68, 0.12, 1), ring(BRASS, 0.28, 0.018, 0, 0.72, 0, [0, 0, 0.4])],
  book_pile: () => [box(RED, 0.34, 0.08, 0.26, 0, 0, 0, [0, 0.2, 0]), box(0x3a5a8a, 0.3, 0.07, 0.22, 0.02, 0.08, 0, [0, -0.3, 0]), box(LEAF, 0.26, 0.07, 0.2, -0.01, 0.15, 0, [0, 0.5, 0]), box(BRASS, 0.2, 0.06, 0.26, 0.28, 0, 0.18, [0, -0.5, 0])],
  alchemy_table: () => [top(DARK, 0.9, 0.58, 0.72), bottle(GREEN, -0.28, 0.72, -0.08), bottle(RED, -0.08, 0.72, 0.1), bottle(PURPLE, 0.3, 0.72, -0.12), glow(ball(CRYSTAL, 0.08, 0.14, 0.86, 0)), ring(BRASS, 0.07, 0.014, 0.14, 0.76, 0, FLAT)],
  crystal_pedestal: () => [cyl(STONE, 0.28, 0.1, 0, 0, 0, 0.28, 6), cyl(STONE, 0.14, 0.55, 0, 0.1, 0, 0.14, 6), cyl(STONE, 0.22, 0.1, 0, 0.65, 0, 0.22, 6), glow(cone(CRYSTAL, 0.14, 0.26, 0, 0.98, 0, 5), cyl(CRYSTAL, 0.01, 0.18, 0, 0.8, 0, 0.14, 5))],
  summoning_circle_stones: () => [ring(PURPLE, 0.34, 0.014, 0, 0.02, 0, FLAT), each([0, 1, 2, 3, 4, 5], (i) => rock(SLATE, 0.11, Math.cos(i * 1.047) * 0.4, 0.11, Math.sin(i * 1.047) * 0.4, 1.3)), glow(cyl(PURPLE, 0.09, 0.015, 0, 0, 0, 0.09, 6))],
  obelisk: () => [cyl(STONE, 0.45, 0.1, 0, 0, 0, 0.45, 6), cyl(STONE, 0.36, 0.1, 0, 0.1, 0, 0.36, 6), glow(cyl(CRYSTAL, 0.26, 1.4, 0, 0.2, 0, 0.17, 6), cone(CRYSTAL, 0.17, 0.4, 0, 1.6, 0), ball(CRYSTAL, 0.08, 0.46, 1.1, 0, 1.8), ball(CRYSTAL, 0.07, -0.4, 0.7, 0.2, 1.8))],
  portal: () => [], stairs: () => [], ladder: () => [],   // view3d draws these: they depend on where they lead

  // temple and crypt
  altar: () => [box(SLATE, 0.96, 0.14, 0.6), box(STONE, 0.78, 0.48, 0.44, 0, 0.14), box(SLATE, 0.92, 0.1, 0.56, 0, 0.62), box(RED, 0.3, 0.015, 0.58, 0, 0.72), candle(-0.34, 0.72, 0), candle(0.34, 0.72, 0)],
  holy_font: () => [cyl(STONE, 0.24, 0.1), cyl(STONE, 0.09, 0.55, 0, 0.1), cyl(STONE, 0.14, 0.18, 0, 0.65, 0, 0.32, 8), glow(cyl(CRYSTAL, 0.27, 0.01, 0, 0.83, 0, 0.27, 8))],
  banner: () => [cyl(DARK, 0.18, 0.06), cyl(BRASS, 0.025, 1.55, 0, 0, -0.04, 0.025, 5), box(BRASS, 0.56, 0.04, 0.04, 0, 1.48), box(RED, 0.48, 0.9, 0.03, 0, 0.58, 0.02), box(BRASS, 0.16, 0.16, 0.02, 0, 1.0, 0.045, [0, 0, 0.785])],
  guild_crest: () => [box(DARK, 0.5, 0.56, 0.05, 0, 0.55, -0.45), box(BRASS, 0.34, 0.34, 0.04, 0, 0.66, -0.41, [0, 0, 0.785]), box(IRON, 0.06, 0.78, 0.03, 0, 0.44, -0.4, [0, 0, 0.7]), box(IRON, 0.06, 0.78, 0.03, 0, 0.44, -0.39, [0, 0, -0.7])],
  coffin: () => [box(DARK, 0.5, 0.26, 0.6, 0, 0, -0.1), box(DARK, 0.38, 0.26, 0.36, 0, 0, 0.3), box(WOOD, 0.54, 0.07, 0.62, 0, 0.26, -0.1), box(WOOD, 0.42, 0.07, 0.38, 0, 0.26, 0.31), box(IRON, 0.07, 0.025, 0.4, 0, 0.33, -0.02), box(IRON, 0.24, 0.025, 0.07, 0, 0.33, -0.12)],
  gravestone: () => [box(SLATE, 0.54, 0.1, 0.28), box(STONE, 0.42, 0.5, 0.14, 0, 0.1), cyl(STONE, 0.21, 0.14, 0, 0.53, 0, 0.21, 8, ALONG_Z), box(SLATE, 0.05, 0.28, 0.02, 0, 0.3, 0.08), box(SLATE, 0.2, 0.05, 0.02, 0, 0.45, 0.08)],
  statue: () => [box(SLATE, 0.6, 0.24, 0.6), cyl(STONE, 0.26, 0.62, 0, 0.24, 0, 0.14, 7), ball(STONE, 0.15, 0, 1.0, 0), box(STONE, 0.08, 0.44, 0.08, -0.24, 0.48, 0, [0, 0, -0.45]), box(STONE, 0.08, 0.44, 0.08, 0.24, 0.48, 0, [0, 0, 0.45])],
  bone_pile: () => [skull(0.05, 0.26, 0.05), skull(-0.2, 0.14, 0.18, 0.9), each([0, 0.7, 1.5, 2.3, 3.1], (a, i) => cyl(BONE, 0.03, 0.5, Math.cos(a) * 0.1, -0.2 + (i % 2) * 0.05, Math.sin(a) * 0.1, 0.03, 4, [QUARTER, a, 0]))],
  skull_pillar: () => [cyl(SLATE, 0.28, 0.14, 0, 0, 0, 0.28, 6), cyl(STONE, 0.17, 1.0, 0, 0.14, 0, 0.17, 6), cyl(SLATE, 0.24, 0.1, 0, 1.14, 0, 0.24, 6), skull(0, 1.4, 0), skull(0, 0.55, 0.17, 0.75), skull(0, 0.9, 0.17, 0.75)],
  pillar: () => [cyl(STONE, 0.3, 0.18, 0, 0, 0, 0.3, 8), cyl(STONE, 0.22, 1.55, 0, 0.18, 0, 0.2, 8), cyl(STONE, 0.34, 0.18, 0, 1.73, 0, 0.34, 8)],
  column: () => MODELS.pillar(),

  // dungeon and prison
  iron_cage: () => [box(IRON, 0.76, 0.07, 0.76), box(IRON, 0.76, 0.07, 0.76, 0, 1.05), each([-0.34, -0.11, 0.11, 0.34], (v) => [box(IRON, 0.035, 1.0, 0.035, v, 0.06, -0.34), box(IRON, 0.035, 1.0, 0.035, v, 0.06, 0.34), box(IRON, 0.035, 1.0, 0.035, -0.34, 0.06, v), box(IRON, 0.035, 1.0, 0.035, 0.34, 0.06, v)])],
  spike_trap: () => [box(SLATE, 0.86, 0.04, 0.86), each([-0.26, 0, 0.26], (x) => each([-0.26, 0, 0.26], (z) => cone(IRON, 0.06, 0.28, x, 0.04, z, 4)))],
  chains: () => [box(IRON, 0.5, 0.08, 0.05, 0, 1.05, -0.46), each([-0.18, 0.18], (x) => [0.98, 0.84, 0.7, 0.56, 0.42].map((y, i) => ring(IRON, 0.06, 0.016, x, y, -0.42, [0, i % 2 * QUARTER, 0])))],
  manacles_wall: () => [box(SLATE, 0.7, 0.9, 0.05, 0, 0.2, -0.47), each([-0.2, 0.2], (x) => [ring(IRON, 0.05, 0.014, x, 0.86, -0.43), ring(IRON, 0.05, 0.014, x, 0.74, -0.43, [0, QUARTER, 0]), ring(IRON, 0.08, 0.022, x, 0.58, -0.4)])],
  torture_rack: () => [box(WOOD, 0.6, 0.08, 0.9, 0, 0.42), legs(DARK, 0.27, 0.4, 0.42, 0.1), each([-0.43, 0.43], (z) => cyl(DARK, 0.07, 0.72, 0, 0.14, z, 0.07, 6, ALONG_X)),each([-0.16, 0.16], (x) => box(STRAW, 0.025, 0.02, 0.8, x, 0.5))],
  stocks: () => [box(DARK, 0.1, 0.8, 0.12, -0.42), box(DARK, 0.1, 0.8, 0.12, 0.42), box(WOOD, 0.86, 0.34, 0.09, 0, 0.42), box(IRON, 0.86, 0.025, 0.1, 0, 0.59), each([[-0.26, 0.06], [0, 0.11], [0.26, 0.06]], ([x, r]) => cyl(BLACK, r, 0.1, x, 0.59 - 0.05, 0, r, 8, ALONG_Z))],
  weapon_rack: () => [box(DARK, 0.9, 0.07, 0.24, 0, 0.1), box(DARK, 0.9, 0.07, 0.1, 0, 0.7), box(DARK, 0.07, 0.85, 0.24, -0.42), box(DARK, 0.07, 0.85, 0.24, 0.42), each([-0.25, 0, 0.25], (x, i) => [cyl(WOOD, 0.022, 1.0, x, 0.15, 0.02, 0.022, 5), i === 1 ? box(IRON, 0.22, 0.14, 0.04, x, 1.0, 0.02) : cone(IRON, 0.05, 0.22, x, 1.15, 0.02, 4)])],

  // smithy, shops and bedroom extras
  anvil: () => [cyl(DARK, 0.22, 0.35), box(IRON, 0.26, 0.1, 0.2, 0, 0.35), box(IRON, 0.5, 0.14, 0.24, -0.04, 0.45), cyl(IRON, 0.1, 0.24, 0.33, 0.4, 0, 0, 6, [0, 0, -QUARTER])],
  grindstone: () => [legs(DARK, 0.2, 0.16, 0.4, 0.07), cyl(STONE, 0.28, 0.12, 0, 0.34, 0, 0.28, 10, ALONG_X), cyl(IRON, 0.03, 0.46, 0, 0.17, 0, 0.03, 5, ALONG_X), box(IRON, 0.03, 0.2, 0.03, 0.24, 0.22)],
  workbench: () => [top(WOOD, 0.94, 0.55, 0.68, 0.12), box(DARK, 0.8, 0.05, 0.4, 0, 0.2), box(IRON, 0.14, 0.12, 0.14, -0.34, 0.68, 0.18), box(DARK, 0.04, 0.04, 0.3, 0.1, 0.68, 0, [0, 0.5, 0]), box(IRON, 0.16, 0.07, 0.08, 0.17, 0.68, 0.13, [0, 0.5, 0])],
  jeweler_bench: () => [top(DARK, 0.84, 0.52, 0.7), box(RED, 0.4, 0.02, 0.3, -0.1, 0.7), glow(ball(CRYSTAL, 0.045, -0.16, 0.76, 0), ball(GREEN, 0.04, 0, 0.75, 0.07)), ring(BRASS, 0.09, 0.016, 0.28, 0.98, -0.05), box(BRASS, 0.025, 0.2, 0.025, 0.28, 0.7, -0.05)],
  market_stall: () => [counter(WOOD), legs(DARK, 0.45, 0.32, 1.35, 0.06), each([-0.375, -0.125, 0.125, 0.375], (x, i) => box(i % 2 ? LINEN : RED, 0.25, 0.05, 0.85, x, 1.34, 0, [0.14, 0, 0])), ball(RED, 0.09, -0.22, 0.86, 0), ball(LIME, 0.09, 0.02, 0.86, 0.08), ball(STRAW, 0.09, 0.24, 0.86, -0.04)],
  hat_stand: () => [cyl(DARK, 0.24, 0.05), cyl(DARK, 0.035, 1.2, 0, 0, 0, 0.035, 5), each([[-0.18, 0.95, RED], [0.18, 1.0, LEAF], [0, 1.22, PURPLE]], ([x, y, c]) => [box(DARK, 0.2, 0.03, 0.03, x / 2, y - 0.02), cyl(c, 0.15, 0.025, x, y, 0, 0.15, 8), cyl(c, 0.09, 0.14, x, y, 0, 0.05, 7)])],
  hat_display: () => [shelves([0.45, 0.9]), each([0.5, 0.95], (y) => each([[-0.24, RED], [0.24, PURPLE]], ([x, c]) => [cyl(c, 0.15, 0.025, x, y, -0.28, 0.15, 8), cyl(c, 0.09, 0.13, x, y, -0.28, 0.05, 7)]))],
  mirror: () => [box(DARK, 0.5, 0.06, 0.3, 0, 0, -0.3), box(BRASS, 0.52, 1.15, 0.06, 0, 0.18, -0.32), glow(box(0x8ab0c0, 0.4, 1.02, 0.02, 0, 0.25, -0.28))],
  display_case: () => [box(DARK, 0.8, 0.55, 0.5), box(RED, 0.74, 0.03, 0.44, 0, 0.55), legs(BRASS, 0.38, 0.23, 0.3, 0.03, 0.55), box(BRASS, 0.8, 0.03, 0.5, 0, 0.85), glow(ball(CRYSTAL, 0.06, -0.18, 0.65, 0), ball(FLAME, 0.05, 0.16, 0.64, 0.04))],

  // mine, cave and nature
  rock: () => [rock(STONE, 0.36, 0, 0.24, 0)],
  rocks: () => [rock(STONE, 0.24, -0.16, 0.15, -0.08), rock(SLATE, 0.18, 0.22, 0.12, 0.05), rock(STONE, 0.13, -0.02, 0.08, 0.27)],
  boulder: () => [rock(SLATE, 0.48, 0, 0.4, 0, 0.9), rock(STONE, 0.16, 0.38, 0.1, 0.25)],
  cliff_rock: () => [rock(SLATE, 0.52, 0, 0.45, 0, 1.1), rock(STONE, 0.4, 0.2, 0.9, -0.12, 1.1), rock(SLATE, 0.28, -0.22, 1.05, 0.08, 1.2)],
  stalagmite: () => [cone(SLATE, 0.2, 0.95, -0.05, 0, -0.05, 6), cone(STONE, 0.14, 0.55, 0.22, 0, 0.12, 5), cone(STONE, 0.11, 0.35, -0.2, 0, 0.22, 5)],
  ore_pile: () => [rock(SLATE, 0.24, -0.1, 0.13, 0), rock(STONE, 0.18, 0.2, 0.11, 0.08), rock(SLATE, 0.16, 0.02, 0.3, -0.04), rock(BRASS, 0.07, -0.16, 0.28, 0.14, 1), rock(BRASS, 0.06, 0.24, 0.24, 0.1, 1), rock(BRASS, 0.05, 0.06, 0.44, 0, 1)],
  mine_cart: () => [box(IRON, 0.5, 0.32, 0.64, 0, 0.2), box(DARK, 0.56, 0.06, 0.7, 0, 0.48), rock(SLATE, 0.22, 0, 0.56, 0, 0.6), rock(BRASS, 0.07, 0.1, 0.68, 0.1, 1), each([-0.28, 0.28], (x) => each([-0.2, 0.2], (z) => cyl(BLACK, 0.14, 0.07, x, 0.105, z, 0.14, 8, ALONG_X)))],
  crystal_cluster: () => [rock(SLATE, 0.28, 0, 0.06, 0, 0.35), crystals([[0, 0, 0.13, 0.7, 0], [-0.2, 0.08, 0.09, 0.45, 0.45], [0.2, -0.04, 0.09, 0.5, -0.4], [0.06, 0.2, 0.07, 0.3, -0.2]])],
  tree: () => [trunk(0.1, 0.95), ball(LEAF, 0.42, -0.22, 1.1, 0), ball(LIME, 0.45, 0.2, 1.22, 0.04), ball(LEAF, 0.4, 0, 1.55, -0.03)],
  pine_tree: () => [trunk(0.08, 0.5), cone(LEAF, 0.55, 0.75, 0, 0.3, 0, 7), cone(LIME, 0.43, 0.68, 0, 0.75, 0, 7), cone(LEAF, 0.3, 0.6, 0, 1.2, 0, 7)],
  pine: () => MODELS.pine_tree(),
  dead_tree: () => [trunk(0.12, 1.1), cyl(DARK, 0.05, 0.65, -0.18, 0.7, 0, 0.015, 5, [0, 0, 0.8]), cyl(DARK, 0.05, 0.6, 0.18, 0.88, 0, 0.015, 5, [0, 0, -0.75]), cyl(DARK, 0.04, 0.5, 0, 1.02, -0.1, 0.01, 5, [-0.5, 0, 0.1])],
  bush: () => [ball(LEAF, 0.28, -0.14, 0.2, -0.08), ball(LIME, 0.3, 0.14, 0.24, 0.04), ball(LEAF, 0.22, -0.02, 0.17, 0.22)],
  stump: () => [cyl(DARK, 0.32, 0.3, 0, 0, 0, 0.26, 8), cyl(STRAW, 0.22, 0.02, 0, 0.3, 0, 0.22, 8), box(DARK, 0.7, 0.07, 0.12), box(DARK, 0.12, 0.07, 0.6)],
  fallen_log: () => [cyl(DARK, 0.2, 0.95, 0, -0.27, 0, 0.17, 8, ALONG_X), cyl(STRAW, 0.155, 0.02, -0.485, 0.195, 0, 0.155, 8, ALONG_X), cyl(DARK, 0.05, 0.28, 0.15, 0.3, 0.05, 0.03, 5, [0.5, 0, 0])],
  mushrooms: () => [[-0.15, -0.05, 0.26, 0.16], [0.17, 0.08, 0.18, 0.12], [0.0, 0.25, 0.1, 0.08]].map(([x, z, h, r]) => [cyl(LINEN, r * 0.3, h, x, 0, z, r * 0.25, 5), cyl(RED, r, r * 0.6, x, h, z, r * 0.2, 7)]),
  reeds: () => [tufts(STRAW, 0.75, 9, 0.35), each([[-0.1, 0.05], [0.18, -0.14], [0.05, 0.22]], ([x, z]) => cyl(DARK, 0.035, 0.18, x, 0.62, z, 0.035, 5))],
  flowers: () => [tufts(LEAF, 0.22, 8, 0.36), [[-0.2, 0.05, RED], [0.12, -0.18, FLAME], [0.22, 0.16, PURPLE], [-0.05, -0.05, LINEN], [-0.12, 0.25, FLAME]].map(([x, z, c]) => [box(LEAF, 0.015, 0.2, 0.015, x, 0, z), ball(c, 0.055, x, 0.23, z, 0.6)])],
  tall_grass_clump: () => [tufts(LIME, 0.45, 12, 0.36), tufts(LEAF, 0.3, 6, 0.42)],

  // town, outdoors and docks
  well: () => [cyl(STONE, 0.5, 0.42, 0, 0, 0, 0.46, 9), cyl(WATER, 0.36, 0.02, 0, 0.42, 0, 0.36, 9), each([-0.44, 0.44], (x) => box(WOOD, 0.08, 0.75, 0.08, x, 0.4)), box(DARK, 0.9, 0.05, 0.05, 0, 1.02), cone(RED, 0.66, 0.38, 0, 1.15, 0, 4)],
  fountain: () => [cyl(STONE, 0.48, 0.26, 0, 0, 0, 0.48, 9), cyl(WATER, 0.4, 0.02, 0, 0.26, 0, 0.4, 9), cyl(STONE, 0.1, 0.65, 0, 0.2), cyl(STONE, 0.1, 0.12, 0, 0.75, 0, 0.28, 8), cyl(WATER, 0.23, 0.02, 0, 0.87, 0, 0.23, 8), cone(WATER, 0.07, 0.28, 0, 0.88, 0, 5)],
  water_trough: () => [box(DARK, 0.9, 0.08, 0.4, 0, 0.1), box(WOOD, 0.9, 0.24, 0.07, 0, 0.16, -0.18), box(WOOD, 0.9, 0.24, 0.07, 0, 0.16, 0.18), box(WOOD, 0.07, 0.24, 0.36, -0.42, 0.16), box(WOOD, 0.07, 0.24, 0.36, 0.42, 0.16), box(WATER, 0.78, 0.12, 0.3, 0, 0.2), box(DARK, 0.1, 0.1, 0.44, -0.3), box(DARK, 0.1, 0.1, 0.44, 0.3)],
  hitching_post: () => [box(DARK, 0.09, 0.62, 0.09, -0.4), box(DARK, 0.09, 0.62, 0.09, 0.4), cyl(WOOD, 0.045, 0.96, 0, 0.47, 0, 0.045, 6, ALONG_X)],
  notice_board: () => [box(DARK, 0.08, 1.2, 0.08, -0.4), box(DARK, 0.08, 1.2, 0.08, 0.4), box(WOOD, 0.82, 0.6, 0.06, 0, 0.5), box(DARK, 0.94, 0.07, 0.16, 0, 1.18), box(LINEN, 0.22, 0.28, 0.02, -0.2, 0.68, 0.04), box(LINEN, 0.18, 0.2, 0.02, 0.12, 0.8, 0.04), box(STRAW, 0.2, 0.18, 0.02, 0.18, 0.56, 0.04)],
  signpost: () => [box(DARK, 0.08, 1.15, 0.08), box(WOOD, 0.52, 0.16, 0.05, 0.18, 0.9, 0.05), box(WOOD, 0.46, 0.15, 0.05, -0.15, 0.68, -0.05)],
  hay_bale: () => [box(STRAW, 0.82, 0.44, 0.58), box(DARK, 0.05, 0.46, 0.6, -0.22), box(DARK, 0.05, 0.46, 0.6, 0.22)],
  fence: () => [each([-0.45, 0, 0.45], (x) => box(DARK, 0.09, 0.62, 0.09, x)), each([0.22, 0.45], (y) => box(WOOD, 1.0, 0.07, 0.05, 0, y))],
  woodpile: () => [[-0.26, 0.13], [0, 0.13], [0.26, 0.13], [-0.13, 0.35], [0.13, 0.35], [0, 0.57]].map(([x, y]) => [cyl(DARK, 0.13, 0.7, x, y - 0.35, 0, 0.13, 7, ALONG_Z), cyl(STRAW, 0.1, 0.02, x, y - 0.01, 0.355, 0.1, 7, ALONG_Z)]),
  cart: () => [box(WOOD, 0.58, 0.07, 0.72, 0, 0.3), box(DARK, 0.05, 0.22, 0.72, -0.28, 0.37), box(DARK, 0.05, 0.22, 0.72, 0.28, 0.37), box(DARK, 0.58, 0.22, 0.05, 0, 0.37, -0.34), wheel(-0.38, 0.25, -0.05), wheel(0.38, 0.25, -0.05), box(DARK, 0.04, 0.05, 0.4, -0.2, 0.3, 0.5), box(DARK, 0.04, 0.05, 0.4, 0.2, 0.3, 0.5)],
  tent: () => [cone(LINEN, 1.3, 1.5, 0, 0, 0, 4), cone(BLACK, 0.4, 0.8, 0, 0, 0.74, 3), cyl(DARK, 0.03, 0.35, 0, 1.45, 0, 0.03, 4), box(RED, 0.26, 0.15, 0.02, 0.13, 1.62)],
  bridge: () => [box(WOOD, 3.0, 0.08, 0.86, 0, 0.04), each([-1.2, -0.72, -0.24, 0.24, 0.72, 1.2], (x) => box(DARK, 0.04, 0.02, 0.86, x, 0.12)), each([-0.43, 0.43], (z) => [box(DARK, 3.0, 0.06, 0.06, 0, 0.48, z), each([-1.45, -0.5, 0.5, 1.45], (x) => box(DARK, 0.09, 0.46, 0.09, x, 0.08, z))])],
  rope_coil: () => [ring(STRAW, 0.3, 0.06, 0, 0.06, 0, FLAT), ring(STRAW, 0.2, 0.055, 0, 0.1, 0, FLAT), ring(STRAW, 0.1, 0.05, 0, 0.12, 0, FLAT)],
  anchor: () => [box(IRON, 0.09, 0.75, 0.09, 0, 0.08), box(IRON, 0.4, 0.07, 0.07, 0, 0.66), ring(IRON, 0.1, 0.03, 0, 0.92, 0), box(IRON, 0.34, 0.09, 0.09, -0.15, 0.1, 0, [0, 0, -0.5]), box(IRON, 0.34, 0.09, 0.09, 0.15, 0.1, 0, [0, 0, 0.5])],
  dock_post: () => [cyl(DARK, 0.17, 0.75, 0, 0, 0, 0.14, 8), cyl(WOOD, 0.16, 0.07, 0, 0.75, 0, 0.12, 8), ring(STRAW, 0.17, 0.03, 0, 0.55, 0, FLAT), ring(STRAW, 0.17, 0.03, 0, 0.48, 0, FLAT)],
  cannon: () => [box(DARK, 0.42, 0.18, 0.55, 0, 0.14), wheel(-0.28, 0.2, -0.08, 0.17), wheel(0.28, 0.2, -0.08, 0.17), cyl(BLACK, 0.17, 0.9, 0, -0.05, 0.08, 0.11, 8, [1.45, 0, 0]), ring(IRON, 0.12, 0.025, 0, 0.45, 0.52, [-0.12, 0, 0])],
  blackship: () => [box(BLACK, 2.4, 0.7, 4.2, 0, 0), box(BLACK, 1.7, 0.7, 1.7, 0, 0, -2.1, [0, 0.785, 0]), box(DARK, 2.2, 0.08, 4.1, 0, 0.7), box(BLACK, 2.2, 0.6, 1.2, 0, 0.7, 1.7), box(DARK, 2.4, 0.08, 1.35, 0, 1.3, 1.7), each([-1.4, 0.3], (z) => [cyl(DARK, 0.09, 3.2, 0, 0.7, z, 0.05, 6), box(LINEN, 2.1, 1.1, 0.05, 0, 2.2, z + 0.08), box(DARK, 2.3, 0.08, 0.08, 0, 3.3, z + 0.08)]), box(RED, 0.5, 0.3, 0.02, 0.25, 3.9, 0.3), each([-1.22, 1.22], (x) => each([-1.0, 0, 1.0], (z) => box(IRON, 0.08, 0.22, 0.28, x, 0.28, z)))],
  rug: () => [box(RED, 0.92, 0.025, 0.92), box(BRASS, 0.7, 0.03, 0.7), box(RED, 0.52, 0.035, 0.52), box(BRASS, 0.2, 0.04, 0.2, 0, 0, 0, [0, 0.785, 0])],
};

// Decals are a few flat patches on the floor.
const patch = (c, r, x = 0, z = 0, y = 0, n = 7) => cyl(c, r, 0.008, x, 0.008 + y, z, r, n);
const patches = (c, list) => list.map(([x, z, r], i) => patch(c, r, x, z, i * 0.001));
const DECALS = {
  moss: () => patches(0x5a7a3a, [[-0.1, -0.05, 0.28], [0.18, 0.12, 0.2], [0.05, -0.28, 0.12]]),
  cracks: () => [[0, 0, 0.7, 0.3], [0.12, 0.14, 0.4, -0.8], [-0.2, -0.12, 0.35, 1.3]].map(([x, z, len, a]) => box(BLACK, len, 0.008, 0.025, x, 0.008, z, [0, a, 0])),
  blood_splatter: () => patches(0x9a1f1f, [[0, 0, 0.16], [0.28, 0.1, 0.07], [-0.24, -0.18, 0.08], [-0.1, 0.3, 0.05], [0.14, -0.28, 0.04]]),
  blood_pool: () => patches(0x801818, [[0, 0, 0.36], [0.22, 0.14, 0.2]]),
  scorch: () => [patch(0x3a3028, 0.42, 0, 0, 0, 9), patch(BLACK, 0.26, 0.03, -0.02, 0.002)],
  puddle: () => patches(0x4a90b8, [[-0.05, 0, 0.32], [0.2, 0.15, 0.18]]),
  rubble: () => [[-0.2, -0.1, 0.1], [0.15, 0.05, 0.13], [0, 0.25, 0.07], [0.25, -0.25, 0.06]].map(([x, z, r]) => rock(STONE, r, x, r * 0.5, z, 0.6)),
  leaves: () => [[-0.2, -0.1], [0.15, 0.05], [0, 0.25], [0.25, -0.25], [-0.28, 0.2], [0.02, -0.2]].map(([x, z], i) => patch(i % 2 ? 0xb07a2a : 0x8a5a2a, 0.09, x, z, i * 0.001, 4)),
  stains: () => patches(0x6a5638, [[-0.12, 0.05, 0.22], [0.2, -0.12, 0.14], [0.14, 0.24, 0.09]]),
  rune_circle: () => glow(ring(0x8a70ff, 0.4, 0.015, 0, 0.02, 0, FLAT), ring(0x8a70ff, 0.26, 0.01, 0, 0.02, 0, FLAT), ...[0, 1.047, 2.094].map((a) => box(0x8a70ff, 0.72, 0.008, 0.015, 0, 0.008, 0, [0, a, 0]))),
  footprints: () => [[-0.12, 0.3], [0.1, 0.08], [-0.12, -0.14], [0.1, -0.34]].map(([x, z]) => box(0x4a3a2a, 0.1, 0.008, 0.17, x, 0.008, z)),
  ash: () => patches(0xa09c9c, [[0, 0, 0.3], [0.2, -0.16, 0.14], [-0.22, 0.18, 0.1]]),
};

// The shapes of one prop kind, or null for a kind nobody has modelled.
export function propParts(kind) {
  const [name, n] = kind.split(":");
  const make = name.startsWith("decal_") ? DECALS[name.slice(6)] : Object.hasOwn(MODELS, name) ? MODELS[name] : null;
  return make ? [make(Number(n) || undefined)].flat(Infinity) : null;
}
