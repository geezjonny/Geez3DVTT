// Blockcreature's monsters, built from the same faceted kit as the Blockfolk heroes (blockfolk.js passes it in, and
// merges the result into a mini). Units match the heroes: a human is about 18 tall. +z is the front.
import * as THREE from "three";

const BONE = "#e8dfc8", DARK = "#160d14";

// Eyes on the face, as fractions of its radius: [x, y, size]
function eyeSpots(n) {
  const pair = (x, y, r) => [[-x, y, r], [x, y, r]];
  if (n === 1) return [[0, 0.15, 1.9]];
  if (n <= 3) return [...pair(0.38, 0.12, 1.1), ...(n === 3 ? [[0, 0.55, 0.9]] : [])];
  if (n <= 5) return [...pair(0.34, 0.02, 1), ...pair(0.58, 0.42, 0.8), ...(n === 5 ? [[0, 0.55, 0.8]] : [])];
  return [...pair(0.35, -0.12, 1.12), ...pair(0.73, 0.32, 0.82), ...pair(0.26, 0.5, 0.75), ...(n === 7 ? [[0, 0.8, 0.6]] : n === 8 ? pair(0.66, -0.25, 0.6) : [])];
}

export function buildCreature(c, kit) {
  const { grp, sph, cyl, cone, box, add, T, glow, shade, random, MM, GOLD } = kit;
  const rnd = random(29), model = new THREE.Group(), limbs = [];
  const { skin, accent, bulk: k, limbLen: ll } = c, dark = shade(skin, -0.3), pale = shade(skin, 0.28);
  const joint = (parent, kind, x, y, z, side = 1, phase = 0) => { const g = grp(parent, x, y, z); g.rotation.order = "YXZ"; limbs.push({ node: g, kind, side, phase }); return g; };
  // a tapering rod from a to b
  const rod = (p, a, b, r0, r1, hex) => {
    const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), d = to.clone().sub(from), m = cyl(p, r1, r0, d.length(), hex, 0, 0, 0, 6);
    m.position.copy(from).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return m;
  };

  const floating = c.float === "yes", legged = c.limbs === "legs" || c.limbs === "spider";
  const stand = c.limbs === "legs" ? 4.6 * ll : c.limbs === "spider" ? 3 * ll : c.limbs === "tentacles" ? 2.2 * ll : 0;
  const lift = stand + (floating ? (c.limbs === "tentacles" ? 1.2 : 3) : 0);
  const body = grp(model, 0, lift, 0);

  // ---- body: sets the shape, where things attach, and where the face goes when there is no separate head
  let B; // { rx, rz, top, mid, front: {y, z, rx, ry, rz}, headAt, rear: [y, z], back: [[y, z]] }
  const shell = (rings, n = 9, cols = [dark, skin, skin, skin, skin, pale]) => T(body, rings.map(([y, x, z, ox = 0, oz = 0]) => [y, x * k, z * k, ox, oz * k]), { n, cols });
  if (c.body === "squid") {
    shell([[0.1, 1.7, 1.7], [1.2, 3.4, 3.2], [3.0, 3.8, 3.5], [4.8, 3.3, 3.0, 0, -0.4], [6.6, 2.2, 2.0, 0, -1.3], [8.2, 1.0, 0.9, 0, -2.2], [9.1, 0.15, 0.15, 0, -2.9]]);
    B = { rx: 3.8 * k, rz: 3.5 * k, top: 8, mid: 3, front: { y: 3.1, z: 0, rx: 3.9 * k, ry: 3.9, rz: 3.55 * k }, headAt: [0, 8.6, -1], rear: [2.2, -3.2 * k], back: [[7.6, -3 * k], [6, -3.2 * k], [4.2, -3.6 * k], [2.4, -3.5 * k]] };
  } else if (c.body === "orb") {
    sph(body, 4.4, skin, 0, 4.4, 0, k, 1, k, 8);
    B = { rx: 4.4 * k, rz: 4.4 * k, top: 8.8, mid: 4, front: { y: 4.4, z: 0, rx: 4.4 * k, ry: 4.4, rz: 4.4 * k }, headAt: [0, 10, 0], rear: [3.6, -4 * k], back: [[8.4, -1.4], [7, -3.3 * k], [5, -4.3 * k], [3, -3.9 * k]] };
  } else if (c.body === "blob") {
    shell([[0, 4.6, 4.6], [0.8, 5.4, 5.2], [2.6, 4.7, 4.5], [4.6, 3.4, 3.2], [6.0, 1.7, 1.6], [6.5, 0.15, 0.15]], 10, [dark, skin, skin, pale, pale]);
    B = { rx: 5.2 * k, rz: 5 * k, top: 6.4, mid: 2.4, front: { y: 2.7, z: 0, rx: 5 * k, ry: 4.2, rz: 4.8 * k }, headAt: [0, 7.4, 0], rear: [1.4, -4.8 * k], back: [[6, -1], [4.6, -3.2 * k], [3, -4.4 * k], [1.6, -5 * k]] };
  } else if (c.body === "beast") {
    T(body, [[-5.2, 1.0, 1.1, 0, 2.6], [-4, 2.3, 2.4, 0, 2.7], [-1, 2.1, 2.0, 0, 2.6], [2, 2.8, 2.9, 0, 3.0], [4.2, 1.6, 1.8, 0, 3.4]].map(([z, x, y, ox, oy]) => [z, x * k, y * k, ox, oy]), { n: 8, axis: "z", cols: [skin, skin, skin, pale] });
    B = { rx: 2.6 * k, rz: 5 * k, top: 3 + 2.8 * k, mid: 2.8, headAt: [0, 5.6, 5.4], rear: [3.1, -5], back: [[2.9 + 2 * k, -3.6], [2.6 + 2 * k, -1.4], [3 + 2.5 * k, 0.8], [3 + 2.7 * k, 2.6]] };
  } else if (c.body === "brute") {
    shell([[0, 2.0, 1.7], [1.6, 2.6, 2.3, 0, 0.3], [4.2, 3.9, 2.8, 0, 0.1], [6.2, 4.1, 2.6, 0, -0.2], [7.6, 1.6, 1.4]], 8, [accent, skin, skin, skin]);
    B = { rx: 3.9 * k, rz: 2.6 * k, top: 7.6, mid: 3.6, headAt: [0, 8.6, 1.4], rear: [1, -2.2 * k], back: [[7.2, -2 * k], [5.8, -2.8 * k], [4, -2.8 * k], [2.2, -2.4 * k]] };
  } else if (c.body === "serpent") {
    const path = Array.from({ length: 30 }, (_, i) => { const t = i / 29; if (t < 0.7) { const a = t / 0.7 * Math.PI * 3 - Math.PI * 2.4, r = 4.6 - t * 3; return [Math.cos(a) * r, 0.5 + t * 2.6, Math.sin(a) * r, 0.5 + t * 1.8]; } const u = (t - 0.7) / 0.3; return [Math.cos(Math.PI * 0.6) * 2.5 * (1 - u), 2.3 + u * 6.2, Math.sin(Math.PI * 0.6) * 2.5 * (1 - u) + u * 1.2, 1.8 - u * 0.4]; });
    path.forEach(([x, y, z, r], i) => sph(body, r * k, i % 3 ? skin : c.markings === "stripes" ? accent : dark, x, y, z, 1, 1, 1, 8));
    B = { rx: 4.8 * k, rz: 4.8 * k, top: 8.5, mid: 3, headAt: [0, 9.6, 1.8], rear: [0.6, -4], back: [[8, -0.4], [6.2, -0.2], [4.4, -0.4], [3, -1.6]] };
  } else { // bug
    sph(body, 3.5, skin, 0, 3.4, -3.2, k, 0.85, 1.15, 8); sph(body, 2.1, dark, 0, 2.7, 1.2, k, 0.9, 1, 8);
    B = { rx: 3.2 * k, rz: 5.5, top: 6.4, mid: 2.8, headAt: [0, 3.2, 4.1], rear: [3, -6.8], back: [[5.6, -5.6], [6.4, -3.6], [5.8, -1.4], [4.4, 1]] };
  }

  // ---- head and face
  const ownHead = !!B.front && c.head === "auto"; // squid, orb and blob wear their face on the body
  const dragon = c.head === "dragon";
  if (dragon && c.body !== "serpent") { // a dragon carries its head out on a neck
    const [hx, hy, hz] = B.headAt, bend = [0, hy + 1.2, hz - 0.8];
    rod(body, [0, hy - 2.3, hz - 2.5], bend, 1.9 * k, 1.4 * k, skin); sph(body, 1.4 * k, skin, ...bend, 1, 1, 1, 8);
    rod(body, bend, [0, hy + 4, hz + 0.9], 1.4 * k, 1.1 * c.headSize, skin);
    B.headAt = [hx, hy + 4.2, hz + 1.4];
  }
  let head, F, headTop;
  if (ownHead) { head = body; F = B.front; headTop = [0, B.top - 0.6, B.front.z]; }
  else {
    const r = 2.1 * c.headSize, [hx, hy, hz] = B.headAt;
    head = joint(model, "head", hx, lift + hy, hz);
    const kind = c.head;
    if (kind === "skull") { sph(head, r, BONE, 0, 0, 0, 1, 1, 1, 8); box(head, r * 1.1, r * 0.55, r * 0.8, shade(BONE, -0.08), 0, -r * 0.85, r * 0.35); }
    else if (!dragon) sph(head, r, skin, 0, 0, 0, 1, 0.92, 1, 8);
    if (kind === "beast") {
      T(head, [[r * 0.4, r * 0.72, r * 0.5, 0, -r * 0.3], [r * 1.2, r * 0.52, r * 0.38, 0, -r * 0.38], [r * 1.65, r * 0.3, r * 0.24, 0, -r * 0.4]], { n: 6, axis: "z", cols: [skin, pale] });
      sph(head, r * 0.17, DARK, 0, -r * 0.24, r * 1.68);
      for (const s of [-1, 1]) cone(head, r * 0.3, r * 0.9, dark, s * r * 0.72, r * 0.85, -r * 0.15, 3).rotation.z = -s * 0.45;
    }
    if (dragon) { // a wedge skull, an open lower jaw, heavy brows and a swept-back frill
      const loft = (rings, cols) => T(head, rings.map(([z, x, y, oy]) => [z * r, x * r, y * r, 0, oy * r]), { n: 6, axis: "z", cols });
      loft([[-0.9, 0.45, 0.45, 0.05], [-0.2, 0.9, 0.7, 0.05], [0.6, 0.74, 0.5, 0.06], [1.3, 0.44, 0.3, -0.06], [2.3, 0.36, 0.25, -0.1], [2.75, 0.14, 0.12, -0.16]], [dark, skin, skin, skin, skin]);
      loft([[-0.3, 0.6, 0.26, -0.55], [0.9, 0.4, 0.18, -0.84], [2.3, 0.2, 0.11, -1.08]], [dark, pale]);
      for (const s of [-1, 1]) {
        sph(head, r * 0.09, DARK, s * r * 0.18, r * 0.1, r * 2.42);
        if (c.mouth !== "none") for (let i = 0; i < 5; i++) {
          const z = 0.85 + i * 0.4, x = s * r * (0.5 - i * 0.065);
          cone(head, r * 0.08, r * (i === 3 ? 0.6 : 0.32), BONE, x, -r * 0.45, r * z, 3).rotation.x = Math.PI;
          if (i < 4) cone(head, r * 0.07, r * 0.28, BONE, x * 0.85, -r * (0.56 + i * 0.075), r * (z + 0.15), 3);
        }
        rod(head, [s * r * 0.85, r * 0.55, -r * 0.35], [s * r * 0.42, r * 0.32, r * 1.2], r * 0.19, r * 0.05, dark);
        for (const [y, len] of [[0.3, 1.7], [-0.05, 1.35], [-0.38, 1]]) rod(head, [s * r * 0.68, r * y, -r * 0.3], [s * r * 1.2, r * (y + 0.2), -r * (0.3 + len)], r * 0.17, 0.02, accent);
      }
      for (let i = 0; i < c.eyes; i++) { // narrow slit eyes along the sides; an odd one sits on the forehead
        const middle = i === c.eyes - 1 && c.eyes % 2, s = middle ? 0 : i % 2 ? 1 : -1, row = Math.floor(i / 2), size = r * 0.27 * c.eyeSize * (row ? 0.7 : 1);
        const eye = grp(head, s * r * (0.68 + row * 0.05), r * (middle ? 0.62 : 0.15 + row * 0.14), r * (middle ? 0.62 : 0.68 - row * 0.4)); eye.rotation.y = s * 0.4;
        sph(eye, size, glow(c.glow), 0, 0, 0, 0.55, 0.55, 1.15, 8); sph(eye, size * 0.5, glow(DARK), middle ? 0 : s * size * 0.45, 0, size * 0.4, 0.4, 1.1, 0.4, 8);
      }
    }
    if (kind === "bird") cone(head, r * 0.5, r * 1.4, "#e8a83a", 0, -r * 0.3, r * 1.35, 4).rotation.x = Math.PI / 2 + 0.2;
    F = { y: 0, z: 0, rx: r, ry: r, rz: r }; headTop = [0, r * 0.75, 0];
  }
  const faceZ = (x, y) => F.z + F.rz * Math.sqrt(Math.max(0.05, 1 - (x / F.rx) ** 2 - ((y - F.y) / F.ry) ** 2));
  if (c.eyes && !dragon) for (const [fx, fy, size] of eyeSpots(c.eyes)) {
    const muzzle = !ownHead && c.head !== "auto" && c.head !== "skull";
    const r = F.rx * 0.24 * size * c.eyeSize * (c.eyes > 5 ? 1.18 : 1) * (ownHead ? 1 : 1.05), x = fx * F.rx * 0.88, y = F.y + (fy + (muzzle ? 0.22 : 0)) * F.ry * 0.82;
    const eye = grp(head, x, y, faceZ(x, y) - r * 0.28); eye.rotation.set(-Math.max(0, fy) * 0.35, Math.asin(Math.max(-1, Math.min(1, x / F.rx))), 0);
    sph(eye, r, dark, 0, 0, 0, 1, 1, 0.6, 8); sph(eye, r * 0.82, glow(c.glow), 0, 0, r * 0.28, 1, 1, 0.55, 8);
    sph(eye, r * 0.48, glow(DARK), 0, 0, r * 0.6, 1, 1, 0.45, 8); sph(eye, r * 0.16, glow("#ffffff"), -r * 0.2, r * 0.22, r * 0.84, 1, 1, 0.6, 8);
  }
  if (c.mouth === "tentacles") { // a mind flayer's face: a beard of writhing feelers
    const w = F.rx, y = dragon ? -w * 0.3 : F.y - F.ry * 0.4, z = dragon ? w * 2.1 : c.head === "beast" ? w * 1.4 : faceZ(0, y);
    for (let i = 0; i < 8; i++) {
      const u = (i - 3.5) / 3.5, len = w * (2.6 + (i * 5 % 3) * 0.65), at = [u * w * (dragon ? 0.45 : 0.6), y, z - Math.abs(u) * w * (dragon ? 1 : 0.4)];
      const g = ownHead ? joint(model, "feeler", at[0], at[1] + lift, at[2], 1, i * 1.3) : joint(head, "feeler", ...at, 1, i * 1.3);
      let from = [0, 0, 0];
      for (let j = 1; j <= 5; j++) {
        const t = j / 5, to = [u * w * 1.1 * t + Math.sin(t * 5 + i) * w * 0.2, -len * (t < 0.75 ? t : 1.5 - t), w * 0.8 * Math.sin(t * Math.PI * 0.9)];
        rod(g, from, to, w * 0.21 * (1 - (j - 1) / 5.5), w * 0.21 * (1 - j / 5.5), j > 3 ? shade(accent, 0.3) : accent); from = to;
      }
    }
  } else if (c.mouth !== "none" && !dragon) {
    const snouted = !ownHead && c.head === "beast";
    const y = F.y - F.ry * (snouted ? 0.55 : 0.5), z = snouted ? F.rz * 1.2 : faceZ(0, y), w = F.rx * (snouted ? 0.35 : 0.45);
    if (c.mouth === "smile") add(head, new THREE.TorusGeometry(w * 0.6, w * 0.09, 4, 8, Math.PI), DARK, 0, y + w * 0.2, z + 0.05).rotation.z = Math.PI;
    if (c.mouth === "beak") cone(head, w * 0.5, w, "#f0c46a", 0, y, z + w * 0.15, 4).rotation.x = Math.PI * 0.72;
    if (c.mouth === "fangs") { box(head, w * 1.3, w * 0.12, w * 0.2, DARK, 0, y, z); for (const s of [-1, 1]) cone(head, w * 0.17, w * 0.75, "#f8f2e2", s * w * 0.45, y - w * 0.38, z + 0.05, 3).rotation.x = Math.PI; }
    if (c.mouth === "maw") { sph(head, w, glow(DARK), 0, y, z - w * 0.35, 1.15, 0.75, 0.55, 8); for (let i = 0; i < 6; i++) for (const s of [-1, 1]) cone(head, w * 0.13, w * 0.45, "#f8f2e2", (i - 2.5) * w * 0.34, y + s * w * 0.48, z + w * 0.12, 3).rotation.x = s > 0 ? Math.PI : 0; }
  }
  if (c.horns !== "none") {
    const [, ty, tz] = headTop, r = F.rx * (ownHead ? 0.7 : 0.75), s0 = F.rx / 2.4;
    if (c.horns === "horns") for (const s of [-1, 1]) { const g = grp(head, s * r * 0.8, ty, tz); g.rotation.set(dragon ? -0.9 : 0, 0, -s * 0.6); cone(g, 0.55 * s0, 2.2 * s0, BONE, 0, s0, 0, 5); const tip = grp(g, 0, 1.9 * s0, 0); tip.rotation.x = -0.7; cone(tip, 0.3 * s0, 1.4 * s0, shade(BONE, -0.12), 0, 0.6 * s0, 0, 5); }
    if (c.horns === "antlers") for (const s of [-1, 1]) { const g = grp(head, s * r * 0.7, ty, tz); g.rotation.z = -s * 0.5; rod(g, [0, 0, 0], [0, 3.6 * s0, 0], 0.28 * s0, 0.14 * s0, BONE); for (const [h, side] of [[1.4, 1], [2.4, -1], [3.2, 1]]) rod(g, [0, h * s0, 0], [side * s * 1.2 * s0, (h + 1.1) * s0, 0], 0.18 * s0, 0.05, shade(BONE, -0.08)); }
    if (c.horns === "spikes") for (let i = -2; i <= 2; i++) cone(head, 0.4 * s0, (2 - Math.abs(i) * 0.35) * s0, accent, i * r * 0.42, ty + 0.5 * s0 - Math.abs(i) * 0.25 * s0, tz, 4).rotation.z = -i * 0.3;
    if (c.horns === "crown") { const cr = r * 0.75, y = ty + 0.25 * s0; add(head, new THREE.CylinderGeometry(cr, cr * 1.05, 0.7 * s0, 8, 1, true), { metal: GOLD, dbl: 1 }, 0, y, tz); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; cone(head, 0.22 * s0, 0.8 * s0, MM(GOLD), Math.cos(a) * cr, y + 0.7 * s0, tz + Math.sin(a) * cr, 3); } sph(head, 0.22 * s0, glow(c.glow), 0, y, tz + cr); }
  }

  // ---- back
  if (c.back === "spines") B.back.forEach(([y, z], i) => cone(body, 0.55, 2.2 - i * 0.2, accent, 0, y + 0.55, z + 0.2, 4).rotation.x = z < 0 && c.body !== "beast" && c.body !== "bug" ? -1 : -0.25);
  if (c.back === "fins") for (const s of [-1, 1]) { const f = cone(body, 1.5, 3.4, pale, s * B.rx * 0.72, B.top * 0.78, c.body === "squid" ? -1.7 : -0.8, 3); f.scale.set(1, 1, 0.22); f.rotation.z = -s * 0.75; }
  if (c.back === "batwings" || c.back === "featherwings") for (const s of [-1, 1]) {
    const [y, z] = B.back[2], wing = joint(model, "wing", s * B.rx * 0.45, lift + y, c.body === "beast" ? 0.6 : c.body === "bug" ? -0.5 : z + 0.4, s);
    const span = Math.max(0.8, B.rx / 3);
    if (c.back === "batwings") { // one scalloped membrane stretched over the finger bones
      const p = (x, y, z) => [s * x * span, y * span, z];
      const root = p(0, 0, 0), elbow = p(3.2, 3.6, -0.7), wrist = p(6, 5.4, -1.2), tips = [p(11, 2.6, -2.6), p(8.2, -1.2, -2.2), p(4.6, -2.4, -1.5)];
      const edge = [wrist, tips[0], p(8, 1.5, -2), tips[1], p(5.6, 0.1, -1.6), tips[2], p(2.2, -0.9, -0.9), p(0.3, -2.2, -0.3), root];
      const skinOf = new THREE.BufferGeometry();
      skinOf.setAttribute("position", new THREE.Float32BufferAttribute(edge.slice(1).flatMap((q, i) => [...elbow, ...edge[i], ...q]), 3));
      add(wing, skinOf, accent);
      rod(wing, root, elbow, 0.55, 0.4, dark); rod(wing, elbow, wrist, 0.4, 0.28, dark); rod(wing, wrist, p(6.5, 7, -1), 0.22, 0.02, BONE);
      for (const tip of tips) rod(wing, wrist, tip, 0.24, 0.05, dark);
    } else {
      rod(wing, [0, 0, 0], [s * 6.4 * span, 3 * span, -1.2], 0.45, 0.2, pale);
      [1, 0.9, 0.76, 0.6, 0.44].forEach((l, i) => { const h = 6.5 * l * span, a = 0.3 + 0.09 * i, x = (1.2 + i * 1.2) * span, f = cone(wing, 0.9 * span, h, i % 2 ? pale : shade(skin, 0.5), s * (x + Math.sin(a) * h / 2), x * 0.47 - Math.cos(a) * h / 2, -0.25 - x * 0.18, 4); f.rotation.z = Math.PI + s * a; f.scale.z = 0.16; });
    }
  }

  // ---- tail
  if (c.tail !== "none") {
    const [y, z] = B.rear, root = joint(model, "tail", 0, lift + y, z);
    const sting = c.tail === "stinger", n = 7, pts = Array.from({ length: n + 1 }, (_, i) => { const t = i / n; return sting ? [0, Math.sin(t * Math.PI * 0.85) * 7 * ll, -Math.sin(t * Math.PI * 1.15) * 5 * ll] : [0, -Math.min(y + lift - 0.5, 3) * Math.sin(t * Math.PI * 0.7), -t * 9 * ll]; });
    for (let i = 0; i < n; i++) rod(root, pts[i], pts[i + 1], 1.25 * k * (1 - i / (n + 1)), 1.25 * k * (1 - (i + 1) / (n + 1)), i % 2 && c.markings === "stripes" ? accent : skin);
    const [ex, ey, ez] = pts[n];
    if (c.tail === "spiked") { sph(root, 0.75, dark, ex, ey, ez); for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -0.4, -1], [0.7, 0.7, -0.4], [-0.7, 0.7, -0.4]]) rod(root, [ex, ey, ez], [ex + dx * 1.8, ey + dy * 1.8, ez + dz * 1.8], 0.35, 0.02, BONE); }
    if (sting) { sph(root, 0.7, accent, ex, ey, ez); rod(root, [ex, ey, ez], [ex, ey - 1.8, ez + 1.4], 0.4, 0.02, BONE); }
    if (c.tail === "fish") for (const s of [-1, 1]) { const f = cone(root, 1.4, 3.2, accent, ex + s * 1.1, ey, ez - 0.8, 3); f.rotation.set(-Math.PI / 2, 0, -s * 0.7); f.scale.z = 0.2; }
  }

  // ---- legs, tentacles, arms
  const sucker = (g, x, y, z, r) => sph(g, r, c.markings === "none" ? shade(accent, 0.2) : glow(c.glow), x, y, z);
  if (c.limbs === "tentacles") {
    const n = c.count, thick = Math.min(1.25, Math.sqrt(8 / n)) * k;
    for (let i = 0; i < n; i++) {
      const a = (i + 0.5) / n * Math.PI * 2, rr = Math.max(1.5, B.rx * 0.4), g = joint(model, "tentacle", Math.sin(a) * rr, lift + 0.7, Math.cos(a) * rr, 1, i * 1.7);
      g.rotation.y = a;
      T(g, [[0, 1.15, 0.95, 0, 0], [1.8, 0.95, 0.8, 0, -1.2], [3.5, 0.72, 0.62, 0, -2.1], [5.0, 0.5, 0.45, 0, -2.2], [6.2, 0.32, 0.3, 0, -1.5], [6.7, 0.12, 0.12, 0, -0.6]].map(([z, x, y, ox, oy]) => [z * ll, x * thick, y * thick, ox, oy * ll]), { n: 6, axis: "z", cols: [skin, skin, skin, pale, pale] });
      for (const [j, [z, y]] of [[1.3, -1.5], [2.6, -2.35], [3.9, -2.7], [5.1, -2.6], [6.1, -1.75]].entries()) for (const s of [-1, 1]) sucker(g, s * (0.72 - j * 0.11) * thick, y * ll + 0.35, z * ll, 0.24 - j * 0.03);
    }
  }
  if (legged) {
    const pairs = Math.ceil(c.count / 2), long = c.body === "beast" || c.body === "bug" ? 7 : 3;
    for (let i = 0; i < pairs; i++) for (const s of [-1, 1]) {
      const spread = pairs === 1 ? 0 : i / (pairs - 1) - 0.5, z = spread * long, hipY = lift + 1.2;
      const g = joint(model, "leg", s * B.rx * (c.limbs === "spider" ? 0.6 : 0.62), hipY, pairs === 1 && c.body === "beast" ? -2 : z, s, (i + (s > 0 ? 0 : 1)) % 2 * Math.PI);
      const ground = -(hipY - (floating ? lift - stand : 0));
      if (c.limbs === "spider") {
        const knee = [s * 3.4 * ll, 2.6 * ll, spread * 3.6], foot = [s * 6.2 * ll, ground, spread * 7.5];
        rod(g, [0, 0, 0], knee, 0.55 * k, 0.35 * k, skin); sph(g, 0.45 * k, accent, ...knee); rod(g, knee, foot, 0.35 * k, 0.08, dark);
      } else {
        const t = k * Math.min(1.3, Math.sqrt(4 / c.count)), knee = [s * 0.35, ground * 0.5, 0.5], foot = [s * 0.4, ground + 0.4, 0.1];
        rod(g, [0, 0.3, 0], knee, 1.25 * t, 0.8 * t, skin); rod(g, knee, foot, 0.8 * t, 0.55 * t, skin);
        box(g, 1.5 * t, 0.8, 2.2 * t, dark, s * 0.4, ground + 0.4, 0.55);
        for (const x of [-0.45, 0, 0.45]) cone(g, 0.18 * t, 0.7, BONE, s * 0.4 + x * t, ground + 0.25, 0.55 + 1.3 * t, 3).rotation.x = Math.PI / 2;
      }
    }
  }
  if (c.arms !== "none") for (const s of [-1, 1]) {
    const y = c.body === "brute" ? 5.8 : Math.min(B.mid + 0.6, 4), z = c.body === "beast" || c.body === "bug" ? 2.8 : 0.4;
    const g = joint(model, "arm", s * B.rx * 0.92, lift + y, z, s), reach = (c.body === "brute" ? 1 : 0.8) * ll;
    const elbow = [s * 1.8 * reach, -2.4 * reach, 0.6], hand = [s * 2.0 * reach, -4.6 * reach, 2.6 * reach];
    if (c.arms === "tentacles") { const mid = [s * 3 * reach, -1.4 * reach, 2.4 * reach], end = [s * 2.4 * reach, 0.4, 5.6 * reach]; rod(g, [0, 0, 0], elbow, k, 0.75 * k, skin); rod(g, elbow, mid, 0.75 * k, 0.45 * k, skin); rod(g, mid, end, 0.45 * k, 0.1, pale); for (const p of [elbow, mid]) sucker(g, p[0], p[1] - 0.5, p[2] + 0.4, 0.28); continue; }
    rod(g, [0, 0, 0], elbow, 1.1 * k, 0.85 * k, skin); sph(g, 0.9 * k, skin, ...elbow); rod(g, elbow, hand, 0.85 * k, 0.65 * k, skin); sph(g, 0.95 * k, c.arms === "pincers" ? accent : skin, ...hand);
    if (c.arms === "claws") for (const x of [-0.6, 0, 0.6]) rod(g, [hand[0] + x * k, hand[1], hand[2] + 0.5], [hand[0] + x * 1.5 * k, hand[1] - 0.6, hand[2] + 2.2], 0.28, 0.02, BONE);
    else for (const x of [-1, 1]) { const mid = [hand[0] + x * 1.2 * k, hand[1] + 0.1, hand[2] + 1.6 * k]; rod(g, hand, mid, 0.7 * k, 0.45 * k, accent); rod(g, mid, [hand[0] + x * 0.25 * k, hand[1], hand[2] + 3.3 * k], 0.45 * k, 0.03, accent); }
  }

  // ---- markings
  const onSkin = ["squid", "orb", "blob"].includes(c.body);
  if (c.markings === "spots" || c.markings === "runes") for (let i = 0; i < 24; i++) {
    const a = (rnd() < 0.5 ? -1 : 1) * (0.8 + rnd() * 2.2);
    if (onSkin) { const y = 1.4 + rnd() * (B.top - 2.8), f = B.front, w = Math.sqrt(Math.max(0.12, 1 - ((y - f.y) / (c.body === "squid" ? 6.2 : f.ry)) ** 2)), off = c.body === "squid" ? -Math.max(0, y - 3) * 0.42 : 0; sph(body, 0.1 + rnd() * 0.14, glow(c.glow), Math.sin(a) * B.rx * w * 0.98, y, Math.cos(a) * B.rz * w * 0.96 + off); }
    else { const [y, z] = B.back[i % B.back.length]; sph(body, 0.2 + rnd() * 0.2, c.markings === "runes" ? glow(c.glow) : accent, (rnd() - 0.5) * B.rx * 1.4, y - 0.1 - rnd() * 0.5, z + (rnd() - 0.5) * 1.6); }
  }
  if (c.markings === "runes" && onSkin) {
    const y = c.body === "squid" ? 6.15 : B.top * 0.78, z = c.body === "squid" ? 1.05 * k : faceZ(0, y) + 0.05;
    add(body, new THREE.TorusGeometry(0.55, 0.15, 4, 9, Math.PI * 1.3), glow(c.glow), 0, y, z).rotation.set(-0.5, 0, 0.9);
    if (c.body === "squid") for (const [py, pz, r] of [[7.35, 0, 0.32], [5.25, 2.25, 0.28]]) add(body, new THREE.OctahedronGeometry(r), glow(c.glow), 0, py, pz * k);
  }
  if (c.markings === "stripes" && c.body !== "serpent") {
    if (onSkin) for (const t of [0.22, 0.42, 0.7]) { const y = B.top * t + 0.3, f = B.front, w = Math.sqrt(Math.max(0.15, 1 - ((y - f.y) / (c.body === "squid" ? 6.2 : f.ry)) ** 2)); const ring = add(body, new THREE.TorusGeometry(1, 0.07, 3, 14, Math.PI * 1.1), accent, 0, y, c.body === "squid" ? -Math.max(0, y - 3) * 0.42 : 0); ring.rotation.set(-Math.PI / 2, 0, Math.PI * 0.95); ring.scale.set(B.rx * w, B.rz * w, 3); }
    else B.back.forEach(([y, z]) => box(body, B.rx * 1.3, 0.35, 0.7, accent, 0, y - 0.25, z));
  }

  const height = lift + (ownHead ? B.top : Math.max(B.top, B.headAt[1] + 2.2 * c.headSize)) + (c.horns === "none" ? 0 : 2) + (c.tail === "stinger" ? 1.5 : 0);
  return { model, limbs, sc: c.size, height: height * c.size, floating, aura: c.aura === "yes" ? c.glow : null };
}

// Moves a monster t seconds into an animation: each joint offsets from how it was built, and the body does its own part.
export function moveCreature(limbs, name, t) {
  const walk = name === "walk", still = name === "sleep" || name === "sit", strike = Math.sin(Math.PI * Math.min(1, t / 0.77));
  const up = ["cheer", "flex", "shrug"].includes(name);
  for (const { node, kind, side, phase, rest } of limbs) {
    let x = 0, y = 0, z = 0;
    if (kind === "tentacle") x = Math.sin(t * (walk || name === "attack" ? 11 : still ? 1.4 : 6) + phase) * (walk ? 0.38 : still ? 0.06 : 0.22) - (up || name === "attack" ? 0.55 : 0);
    if (kind === "leg") x = walk ? Math.sin(t * 11 + phase) * 0.45 : name === "dance" ? Math.sin(t * 8 + phase) * 0.35 : 0;
    if (kind === "arm") x = name === "attack" ? -1.2 * strike : up ? -1.3 : name === "wave" && side < 0 ? -1.3 + Math.sin(t * 9) * 0.35 : name === "point" && side < 0 ? -1.2 : walk ? Math.sin(t * 9 + side) * 0.35 : Math.sin(t * 6 + side) * 0.12;
    if (kind === "feeler") x = Math.sin(t * (still ? 1.4 : 4) + phase) * (still ? 0.05 : 0.15) - (name === "attack" ? 0.5 : 0);
    if (kind === "wing") z = still ? -side * 0.35 : side * Math.sin(t * (walk ? 11 : 8)) * 0.45;
    if (kind === "tail") y = Math.sin(t * (walk ? 9 : still ? 1.4 : 5)) * (still ? 0.08 : 0.35);
    if (kind === "head") { x = name === "attack" ? 0.45 * strike : name === "yes" ? Math.sin(t * 13) * 0.35 : name === "hurt" ? -0.35 : still ? 0.35 : up ? -0.35 : 0; y = name === "no" ? Math.sin(t * 13) * 0.6 : 0; }
    node.rotation.set(rest.x + x, rest.y + y, rest.z + z);
  }
  let y = 0, z = 0, tilt = 0, sway = 0, spin = 0;
  if (name === "walk") { tilt = 0.06; y = Math.abs(Math.sin(t * 9)) * 0.35; }
  else if (name === "attack") { z = strike * 3; tilt = strike * 0.25; }
  else if (name === "hurt") { const h = Math.sin(Math.PI * (t % 0.5) / 0.5); tilt = -0.4 * h; z = -1.5 * h; }
  else if (["cheer", "jump", "laugh", "fart"].includes(name)) y = Math.abs(Math.sin(t * 7)) * 2.2;
  else if (name === "dance") { spin = t * 4; y = Math.abs(Math.sin(t * 6)) * 1.2; sway = Math.sin(t * 5) * 0.2; }
  else if (["bow", "facepalm", "cry"].includes(name)) tilt = 0.35 * Math.min(1, t * 4);
  else if (name === "yes") tilt = Math.sin(t * 13) * 0.12;
  else if (name === "no") spin = Math.sin(t * 13) * 0.3;
  else if (still) { y = -1; if (name === "sleep") { sway = 0.14; tilt = -0.08; } }
  return { y, z, tilt, sway, spin };
}
