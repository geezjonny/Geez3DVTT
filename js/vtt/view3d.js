// 3D view: the dark fantasy renderer (code-built low-poly stone, the lights painted into one texture, fog of war as
// another) driven by the live table state. Every floor is drawn, stacked; only the floor you are on gets lights,
// shadows and detail, the others are cheap dim shells. Prop kit, roofs, picking, ruler, ping and first person come
// from the GeezSheets 3D view. 1 unit = 1 grid cell = 5 ft = 40 map px. Map (x, y) -> world (x/40, z/40).
import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { S, mapSize } from "./state.js";
import { isPcToken, wallPieces } from "./draw.js";
import { visibleToPlayer } from "./visibility.js";
import { isCurrentlyVisible } from "./explored-vtt.js";
import { getRefImage } from "./refimage.js";
import { doorSeg } from "./reach.js";
import { CONDITIONS, conditionsOf } from "./conditions.js";

const U = 40, THICK = 0.22, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const stored = (k, d) => { try { return localStorage.getItem("geez3d." + k) ?? d; } catch { return d; } };
const keep = (k, v) => { try { localStorage.setItem("geez3d." + k, v); } catch { /* private mode */ } };
let WALL_H = clamp(Number(stored("height", 1.1)) || 1.1, 0.25, 2.4);
const floorGap = () => WALL_H + 0.14; // how far apart stacked floors sit

/* ---------------- quality ---------------- */
const PRESETS = {
  low:    { scale: 0.75, maxPr: 1,    aa: false, shadow: 0,    tex: 2048, other: 1024, light: 1024, ppc: 12, blocks: false, glow: false, flicker: false },
  medium: { scale: 1,    maxPr: 1.25, aa: true,  shadow: 1024, tex: 4096, other: 1536, light: 2048, ppc: 20, blocks: true,  glow: true,  flicker: true },
  high:   { scale: 1,    maxPr: 2,    aa: true,  shadow: 2048, tex: 8192, other: 2048, light: 4096, ppc: 32, blocks: true,  glow: true,  flicker: true }
};
function guessQuality() {
  const gl = document.createElement("canvas").getContext("webgl2");
  const info = gl?.getExtension("WEBGL_debug_renderer_info"), gpu = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "";
  gl?.getExtension("WEBGL_lose_context")?.loseContext();
  if (/swiftshader|llvmpipe|software|basic render/i.test(gpu) || (navigator.deviceMemory || 8) <= 2 || (navigator.hardwareConcurrency || 8) <= 2) return "low";
  if (matchMedia("(pointer: coarse)").matches || (navigator.hardwareConcurrency || 8) <= 4 || /intel|mali|adreno|powervr/i.test(gpu)) return "medium";
  return "high";
}
let choice = new URLSearchParams(location.search).get("q") || stored("quality", "auto");
if (choice !== "auto" && !PRESETS[choice]) choice = "auto";
let level = choice === "auto" ? guessQuality() : choice, Q = PRESETS[level];

/* ---------------- shared shader pieces ---------------- */
const U3 = { uLM: { value: null }, uFog: { value: null }, uSize: { value: new THREE.Vector2(1, 1) }, uOrigin: { value: new THREE.Vector2(0, 0) }, uGain: { value: 1 }, uSat: { value: 1 }, uTime: { value: 0 }, uPx: { value: 1 }, uCarry: { value: Array.from({ length: 12 }, () => new THREE.Vector4()) } };
const WORLD_POS = `#include <fog_vertex>
  vec4 wp4 = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    wp4 = instanceMatrix * wp4;
  #endif
  vWp = (modelMatrix * wp4).xyz;`;
function lit(material) {
  material.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, { uLM: U3.uLM, uFog: U3.uFog, uSize: U3.uSize, uOrigin: U3.uOrigin, uGain: U3.uGain, uSat: U3.uSat, uCarry: U3.uCarry });
    s.vertexShader = "varying vec3 vWp;\n" + s.vertexShader.replace("#include <fog_vertex>", WORLD_POS);
    s.fragmentShader = "uniform sampler2D uLM, uFog; uniform vec2 uSize, uOrigin; uniform float uGain, uSat; uniform vec4 uCarry[12]; varying vec3 vWp;\n" + s.fragmentShader.replace("#include <opaque_fragment>", `
      vec3 fn = normalize(cross(dFdx(vWp), dFdy(vWp)));
      vec3 glow = texture2D(uLM, (vWp.xz + fn.xz * 0.25 - uOrigin) / uSize).rgb * uGain * mix(0.55, 1.0, abs(fn.y));
      outgoingLight = mix(vec3(dot(outgoingLight, vec3(0.3, 0.59, 0.11))), outgoingLight, uSat); // moonlight drains colour
      for (int i = 0; i < 12; i++) { // x, z, radius, strength
        if (uCarry[i].w <= 0.0) continue;
        float near = max(0.0, 1.0 - distance(vWp.xz, uCarry[i].xy) / uCarry[i].z);
        glow += vec3(1.0, 0.55, 0.22) * (near * near * uCarry[i].w);
      }
      outgoingLight += diffuseColor.rgb * glow / (1.0 + glow * 0.5);
      vec2 inMap = vWp.xz - uOrigin;
      float edge = min(min(inMap.x, uSize.x - inMap.x), min(inMap.y, uSize.y - inMap.y));
      outgoingLight *= (0.5 + 0.5 * smoothstep(0.0, 3.0, edge)) * texture2D(uFog, (vWp.xz + fn.xz * 0.35 - uOrigin) / uSize).r; // fog of war
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => "geez-lit";
  return material;
}
// Floors you are not on: no map lights, no shadows, just dim, and only where that floor has been seen.
function dimmed(material, mask) {
  material.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, { uMask: { value: mask }, uSize: U3.uSize, uOrigin: U3.uOrigin });
    s.vertexShader = "varying vec3 vWp;\n" + s.vertexShader.replace("#include <fog_vertex>", WORLD_POS);
    s.fragmentShader = "uniform sampler2D uMask; uniform vec2 uSize, uOrigin; varying vec3 vWp;\n" + s.fragmentShader.replace("#include <opaque_fragment>", `
      float seen = texture2D(uMask, (vWp.xz - uOrigin) / uSize).r;
      if (seen < 0.15) discard;
      outgoingLight *= 0.42 * seen;
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => "geez-dim";
  return material;
}
// Flames and glows are unlit, but must still vanish in the dark.
function fogged(material, flicker = false) {
  material.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, { uFog: U3.uFog, uSize: U3.uSize, uOrigin: U3.uOrigin, uTime: U3.uTime });
    let v = s.vertexShader.replace("#include <fog_vertex>", WORLD_POS);
    if (flicker) v = v.replace("#include <begin_vertex>", `#include <begin_vertex>
      transformed.xz *= 1.0 + 0.18 * sin(uTime * 11.0 + instanceMatrix[3][0] * 7.0);
      transformed.y *= 1.0 + 0.25 * sin(uTime * 7.0 + instanceMatrix[3][2] * 5.0);`);
    s.vertexShader = "uniform float uTime; varying vec3 vWp;\n" + v;
    s.fragmentShader = "uniform sampler2D uFog; uniform vec2 uSize, uOrigin; varying vec3 vWp;\n" + s.fragmentShader.replace("#include <opaque_fragment>", `
      if (texture2D(uFog, (vWp.xz - uOrigin) / uSize).r < 0.8) discard;
      #include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => "geez-fogged" + flicker;
  return material;
}
const emberMaterial = () => new THREE.ShaderMaterial({
  uniforms: { uTime: U3.uTime, uPx: U3.uPx, uFog: U3.uFog, uSize: U3.uSize, uOrigin: U3.uOrigin }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `attribute float seed; uniform float uTime, uPx; uniform sampler2D uFog; uniform vec2 uSize, uOrigin; varying float vLife;
    void main() {
      float t = fract(uTime * (0.35 + fract(seed * 7.3) * 0.3) + seed);
      vec3 p = position + vec3(sin(seed * 40.0 + uTime * 2.0) * 0.18 * t, t * 0.9, cos(seed * 23.0 + uTime * 1.7) * 0.18 * t);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv; gl_PointSize = clamp(uPx * 0.045 / -mv.z, 1.0, 5.0);
      vLife = (1.0 - t) * step(0.8, texture2D(uFog, (position.xz - uOrigin) / uSize).r);
    }`,
  fragmentShader: `varying float vLife; void main() { gl_FragColor = vec4(1.0, 0.25 + 0.45 * vLife, 0.05, vLife); }`
});

/* ---------------- scene, renderer, camera ---------------- */
const scene = new THREE.Scene(); scene.background = new THREE.Color(); scene.fog = new THREE.Fog(0x000000, 40, 120);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1500);
const hemi = new THREE.HemisphereLight(), sun = new THREE.DirectionalLight();
const world = new THREE.Group(), floorRoot = new THREE.Group(), others = new THREE.Group(), tokenRoot = new THREE.Group(), fxRoot = new THREE.Group();
scene.add(hemi, sun, sun.target, world, floorRoot, others, tokenRoot, fxRoot);
let renderer = null, controls, host, raf = 0, dirty = true, pending = true, framedFor = "";
let root = world; // where the prop kit adds its models

const TIMES = [ // moonlit night, blood dusk, overcast day
  { sky: 0x6a8cc0, ground: 0x2c2230, hemi: 1.65, sun: 0x86a6ee, sunI: 1.5, gain: 4.0, sat: 0.5, bg: 0x04060a },
  { sky: 0xa092ac, ground: 0x422a22, hemi: 1.75, sun: 0xdc7442, sunI: 2.0, gain: 3.0, sat: 0.68, bg: 0x0d080c },
  { sky: 0xc4d0dc, ground: 0x6a5f54, hemi: 1.9, sun: 0xeadcc4, sunI: 2.1, gain: 1.1, sat: 0.75, bg: 0x181d24 }
];
const HOURS = [[0, 0], [5, 0], [6.5, 0.5], [8.5, 1], [16.5, 1], [18.5, 0.5], [20.5, 0], [24, 0]];
let hourNow = null;
function applyTime() {
  const hour = ((Number(S.atmosphere?.time ?? 12) % 24) + 24) % 24;
  if (hour === hourNow) return;
  hourNow = hour;
  let day = 0;
  for (let i = 1; i < HOURS.length; i++) if (hour <= HOURS[i][0]) { const [h0, v0] = HOURS[i - 1], [h1, v1] = HOURS[i]; day = v0 + (v1 - v0) * (hour - h0) / (h1 - h0); break; }
  const t = day * 2, i = Math.min(1, Math.floor(t)), f = t - i, a = TIMES[i], b = TIMES[i + 1];
  const num = (k) => a[k] + (b[k] - a[k]) * f, col = (target, k) => target.setHex(a[k]).lerp(new THREE.Color(b[k]), f);
  col(hemi.color, "sky"); col(hemi.groundColor, "ground"); col(sun.color, "sun"); col(scene.background, "bg");
  hemi.intensity = num("hemi"); sun.intensity = num("sunI"); U3.uGain.value = num("gain"); U3.uSat.value = num("sat");
  scene.fog.color.copy(scene.background); dirty = true;
}

function makeRenderer() {
  const target = controls?.target.clone();
  if (renderer) { controls.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove(); sun.shadow.map?.dispose(); sun.shadow.map = null; }
  renderer = new THREE.WebGLRenderer({ antialias: Q.aa, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, Q.maxPr) * Q.scale);
  renderer.shadowMap.enabled = Q.shadow > 0; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
  host.prepend(renderer.domElement);
  controls = new MapControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.15; controls.maxPolarAngle = 1.35; controls.minDistance = 2.5; controls.maxDistance = 220;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.ROTATE };
  if (target) controls.target.copy(target);
  controls.addEventListener("change", () => { dirty = true; });
  lockView(); applyControls(); fpLook(renderer.domElement); resize();
}
function init() {
  host = document.createElement("div"); host.id = "view3d"; host.hidden = true; document.body.append(host);
  const vignette = document.createElement("div"); vignette.className = "v3-vignette"; host.append(vignette);
  const opts = document.createElement("div"); opts.className = "v3-opts";
  opts.innerHTML = `<label>Quality <select><option value="auto">Auto</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label>Walls <input type="range" min="0.25" max="2.4" step="0.05"></label>`;
  document.body.append(opts); // above the top-down input layer
  opts.addEventListener("pointerdown", (e) => e.stopPropagation());
  const q = opts.querySelector("select"), h = opts.querySelector("input"); q.value = choice; h.value = WALL_H;
  q.addEventListener("change", () => { choice = q.value; keep("quality", choice); setLevel(choice === "auto" ? guessQuality() : choice); q.blur(); });
  h.addEventListener("change", () => { WALL_H = Number(h.value); keep("height", WALL_H); staticSig = ""; pending = true; h.blur(); });
  makeRenderer();
  new ResizeObserver(resize).observe(host);
  flat = document.getElementById("map");
  if (flat) { document.body.append(flat); flat.setAttribute("preserveAspectRatio", "none"); }
}
function setLevel(next) {
  level = next; Q = PRESETS[level]; makeRenderer();
  U3.uLM.value?.dispose(); U3.uLM.value = null; staticSig = ""; pending = true;
}
function resize() {
  if (!host) return;
  if (!renderer) return; const w = host.clientWidth || 800, h = host.clientHeight || 560;
  renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); dirty = true;
}

/* ---------------- 2D geometry ---------------- */
function rayHit(x, z, dx, dz, s) {
  const ex = s[2] - s[0], ez = s[3] - s[1], den = dx * ez - dz * ex;
  if (Math.abs(den) < 1e-9) return Infinity;
  const px = s[0] - x, pz = s[1] - z, t = (px * ez - pz * ex) / den, u = (px * dz - pz * dx) / den;
  return t > 0 && u >= -1e-6 && u <= 1 + 1e-6 ? t : Infinity;
}
function visibility(x, z, r, segs, rays = 200) {
  const near = segs.filter((s) => Math.min(s[0], s[2]) <= x + r && Math.max(s[0], s[2]) >= x - r && Math.min(s[1], s[3]) <= z + r && Math.max(s[1], s[3]) >= z - r);
  return Array.from({ length: rays }, (_, i) => {
    const a = i / rays * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    let t = r;
    for (const s of near) { const hit = rayHit(x, z, dx, dz, s); if (hit > 0.08 && hit < t) t = hit; }
    return [x + dx * t, z + dz * t];
  });
}
function closest(x, z, s) {
  const ex = s[2] - s[0], ez = s[3] - s[1], u = clamp(((x - s[0]) * ex + (z - s[1]) * ez) / (ex * ex + ez * ez || 1), 0, 1);
  const cx = s[0] + ex * u, cz = s[1] + ez * u;
  return { x: cx, z: cz, d: Math.hypot(x - cx, z - cz), ex, ez };
}

/* ---------------- model helpers ---------------- */
const random = (seed) => () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const seeded = (str) => { let a = 7; for (const ch of String(str)) a = (a * 31 + ch.charCodeAt(0)) | 0; return random(a); };
const dummy = new THREE.Object3D();
const matrix = (x, y, z, ry, sx, sy, sz) => { dummy.position.set(x, y, z); dummy.rotation.set(0, ry, 0); dummy.scale.set(sx, sy, sz); dummy.updateMatrix(); return dummy.matrix.clone(); };
const along = (dx, dz) => Math.atan2(-dz, dx); // rotation about Y that points local +x along (dx, dz)
const onSeg = ([x1, z1, x2, z2], y, h, thick, shrink = 1) => matrix((x1 + x2) / 2, y, (z1 + z2) / 2, along(x2 - x1, z2 - z1), Math.hypot(x2 - x1, z2 - z1) * shrink, h, thick);
function instances(geo, material, list, { shadows = true, into = world } = {}) {
  if (!list.length) { geo.dispose(); material.dispose(); return null; }
  const mesh = new THREE.InstancedMesh(geo, material, list.length);
  list.forEach((it, i) => { mesh.setMatrixAt(i, it.m); if (it.c) mesh.setColorAt(i, it.c); });
  mesh.castShadow = mesh.receiveShadow = shadows; into.add(mesh);
  return mesh;
}
function chunk(jitter) {
  const g = new THREE.BoxGeometry(1, 1, 1).toNonIndexed(), p = g.attributes.position;
  const h = (x, y, z, k) => { const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + k * 19.3) * 43758.5453; return (n - Math.floor(n) - 0.5) * 2 * jitter; };
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); p.setXYZ(i, x + h(x, y, z, 1), y + h(x, y, z, 2), z + h(x, y, z, 3)); }
  g.computeVertexNormals(); return g;
}
function painted(geo, hex) {
  const c = new THREE.Color(hex), data = new Float32Array(geo.attributes.position.count * 3);
  for (let i = 0; i < data.length; i += 3) c.toArray(data, i);
  return geo.setAttribute("color", new THREE.BufferAttribute(data, 3));
}
const merged = (parts) => { const g = mergeGeometries(parts); parts.forEach((p) => p.dispose()); return g; };
const part3 = (geo, hex, x, y, z, rx = 0) => painted(geo.rotateX(rx).translate(x, y, z), hex);
const stoneMat = () => lit(new THREE.MeshLambertMaterial({ flatShading: true }));
function canvasTexture(w, h, draw) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function sprite(text, { color = "#e6ebf1", size = 0.34, bg = "#0c0a0acc" } = {}) {
  const probe = document.createElement("canvas").getContext("2d"); probe.font = "600 40px system-ui";
  const w = Math.ceil(probe.measureText(text).width) + 24;
  const tex = canvasTexture(w, 56, (g) => { g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, w, 56, 10); g.fill(); g.font = "600 40px system-ui"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = color; g.fillText(text, w / 2, 30); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
  s.scale.set(size * w / 56, size, 1); s.raycast = () => {}; return s;
}

/* ---------------- the GeezSheets prop kit ---------------- */
const INK = 0x2a1a33, PARCHMENT = 0xa8763a, SOLID = 0x8c8894, BRASS = 0xb08a30;
const mats = new Map();
const mat = (c) => { if (!mats.has(c)) { const col = new THREE.Color(c), hsl = col.getHSL({}); const m = lit(new THREE.MeshLambertMaterial({ color: col.setHSL(hsl.h, hsl.s * 0.7, hsl.l * 0.75), flatShading: true })); m.userData.shared = true; mats.set(c, m); } return mats.get(c); };
const toonRamp = () => null, ink = () => {};
function carve(geo, amt) { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), h = (k) => { const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + k * 19.3) * 43758.5453; return (n - Math.floor(n)) * 2 - 1; }; p.setXYZ(i, x + h(1) * amt, y + h(2) * amt, z + h(3) * amt); } p.needsUpdate = true; geo.computeVertexNormals(); return geo; }
const boxGeo = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const ROOF_COL = { thatch: 0x8a7238, slate: 0x48505c, tile: 0x7a3a28, flat: 0x55524d, wood: 0x5a3a1c, stone: 0x6d6a78 }, ROOF_DEF = 0x6a3828;
function roofMesh(a) {   // a gabled roof over a map rectangle: ridge along the long side, a little overhang, sitting on top of the walls
  const o = .25, w = a.w / U + 2 * o, d = a.h / U + 2 * o, hw = w / 2, hd = d / 2, alongX = w >= d, rh = Math.max(.6, Math.min(2.4, Math.min(w, d) * .4));
  const y0 = WALL_H, y1 = WALL_H + rh, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const A = V(-hw, y0, -hd), B = V(hw, y0, -hd), C = V(hw, y0, hd), D = V(-hw, y0, hd);
  const R1 = alongX ? V(-hw, y1, 0) : V(0, y1, -hd), R2 = alongX ? V(hw, y1, 0) : V(0, y1, hd);
  const tris = alongX ? [[A, B, R2], [A, R2, R1], [D, C, R2], [D, R2, R1], [A, D, R1], [B, C, R2]] : [[A, D, R2], [A, R2, R1], [B, C, R2], [B, R2, R1], [A, B, R1], [D, C, R2]];
  const center = V(0, y0 + rh / 3, 0), pos = [], uv = [];
  for (let [p, q, r] of tris) {
    const n = new THREE.Vector3().crossVectors(q.clone().sub(p), r.clone().sub(p)), mid = p.clone().add(q).add(r).multiplyScalar(1 / 3).sub(center);
    if (n.dot(mid) < 0) [q, r] = [r, q];   // wind every face outward
    for (const v of [p, q, r]) { pos.push(v.x, v.y, v.z); uv.push(2 * (alongX ? v.x : v.z), 2 * (v.y + (alongX ? Math.abs(v.z) : Math.abs(v.x)))); }   // two shingle tiles per cell
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.computeVertexNormals();
  const tex = a.mat === "stone" ? "stone" : a.mat === "wood" ? "wood" : "shingle";
  const m = new THREE.Mesh(geo, mat(ROOF_COL[a.mat] ?? ROOF_DEF, tex));
  m.position.set((a.x + a.w / 2) / U, 0, (a.y + a.h / 2) / U); m.userData.structural = true; m.raycast = () => {};   // clicks pass through to what's under it
  return m;
}


function prop(p, pid) {   // chunky, outlined Wind Waker-style prop kit
  const K = p.kind;
  const g = new THREE.Group(); g.position.set(p.x / U, p.elevation || 0, p.y / U); g.rotation.y = -(p.rot || 0) * Math.PI / 180; g.scale.set((p.flip ? -1 : 1) * (p.s || 1), p.s || 1, p.s || 1); g.userData.pick = { type: "prop", id: pid }; root.add(g);
  const R = seeded(p.id), pick = (a) => a[Math.floor(R() * a.length)];
  const part = (geo, c, x = 0, y = 0, z = 0, tex, noInk = false) => { const m = new THREE.Mesh(geo, c?.isMaterial ? c : mat(c, tex)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = !noInk; m.userData.noInk = noInk; g.add(m); return m; };
  const b = (w, h, d, c, x, y, z, tex, noInk = false) => part(boxGeo(w, h, d), c, x, y, z, tex, noInk);
  const cyl = (r, h, c, x, y, z, tex, n = 10) => part(new THREE.CylinderGeometry(r, r, h, n), c, x, y + h / 2, z, tex);
  const carved = (geo, amount) => carve(geo, amount);
  if (K === "crate") {
    b(.68, .68, .68, PARCHMENT, 0, .34, 0, "wood"); for (const [x, z] of [[-.3, -.3], [.3, -.3], [-.3, .3], [.3, .3]]) b(.09, .78, .09, 0x7b4b2a, x, .39, z, "wood");
    for (const z of [-.356, .356]) for (const a of [-1, 1]) { const m = b(.58, .065, .035, 0x8c5428, 0, .34, z, "wood"); m.rotation.z = a * .62; }
  } else if (K === "barrel") {
    const profile = [new THREE.Vector2(.22, 0), new THREE.Vector2(.29, .08), new THREE.Vector2(.34, .25), new THREE.Vector2(.35, .52), new THREE.Vector2(.30, .72), new THREE.Vector2(.23, .8)];
    part(carved(new THREE.LatheGeometry(profile, 12), .012), PARCHMENT, 0, .4, 0, "wood");
    for (const [y, color] of [[.18, BRASS], [.62, 0x5d7488]]) { const hoop = part(new THREE.TorusGeometry(.315, .025, 6, 12), color, 0, y, 0); hoop.rotation.x = Math.PI / 2; }
    cyl(.245, .045, 0x8a5a34, 0, .78, 0, "wood", 12);
  } else if (K === "table") {
    b(.86, .14, .58, PARCHMENT, 0, .72, 0, "wood"); for (const [x, z] of [[-.36, -.22], [.36, -.22], [-.36, .22], [.36, .22]]) b(.09, .7, .09, 0x87512a, x, .35, z, "wood");
    cyl(.1, .025, 0xe9d7a0, -.18, .805, .02, undefined, 12); cyl(.055, .08, BRASS, -.18, .82, .02, undefined, 10);
  } else if (K === "chest") {
    b(.76, .38, .5, PARCHMENT, 0, .2, 0, "wood");
    const lid = part(new THREE.CylinderGeometry(.27, .27, .76, 12, 1, false, 0, Math.PI), PARCHMENT, 0, .47, 0, "wood"); lid.rotation.z = Math.PI / 2;
    b(.055, .5, .54, BRASS, 0, .45, 0); b(.13, .16, .035, BRASS, 0, .24, -.275);
    b(.05, .1, .03, INK, 0, .25, -.295);
  } else if (K === "pillar") {
    cyl(.3, .18, SOLID, 0, 0, 0, "stone"); cyl(.22, 1.55, SOLID, 0, .18, 0, "stone"); cyl(.34, .18, SOLID, 0, 1.73, 0, "stone");
  } else if (K === "statue") {
    b(.62, .25, .62, SOLID, 0, .125, 0, "stone"); cyl(.35, .12, SOLID, 0, .25, 0, "stone");
    part(new THREE.CylinderGeometry(.18, .26, .62, 8), SOLID, 0, .68, 0, "stone"); part(new THREE.SphereGeometry(.19, 10, 7), SOLID, 0, 1.12, 0);
    const armL = cyl(.07, .48, SOLID, -.25, .63, 0, "stone", 10); armL.rotation.z = -.48;
    const armR = cyl(.07, .48, SOLID, .25, .63, 0, "stone", 10); armR.rotation.z = .48;
  } else if (K === "bed") {
    b(.72, .28, .92, PARCHMENT, 0, .14, 0, "wood"); b(.64, .14, .8, 0xf0dfc0, 0, .35, .02);
    b(.63, .16, .27, 0xe0445a, 0, .45, .25); b(.42, .1, .2, 0xf5e8ca, 0, .47, -.27);
    for (const [x, z] of [[-.33, -.42], [.33, -.42], [-.33, .42], [.33, .42]]) { cyl(.055, 1.02, 0x87512a, x, 0, z, "wood", 10); part(new THREE.SphereGeometry(.09, 10, 6), BRASS, x, 1.08, z); }
    b(.72, .62, .07, PARCHMENT, 0, .65, .44, "wood");
  } else if (K === "rug") {
    part(new THREE.CylinderGeometry(.64, .64, .035, 8), 0xe0445a, 0, .018, 0, undefined, true); part(new THREE.CylinderGeometry(.5, .5, .04, 8), BRASS, 0, .04, 0, undefined, true);
  } else if (K === "tree") {
    cyl(.11, .9, 0x8a5a2c, 0, 0, 0, "wood", 8); part(carved(new THREE.IcosahedronGeometry(.42, 0), .04), 0x3fbf3a, -.22, 1.0, 0, "leaves"); part(carved(new THREE.IcosahedronGeometry(.46, 0), .04), 0x5fd04a, .2, 1.12, .02, "leaves"); part(carved(new THREE.IcosahedronGeometry(.4, 0), .04), 0x3fbf3a, 0, 1.42, 0, "leaves");
  } else if (K === "pine") {
    cyl(.08, .45, 0x8a5a2c, 0, 0, 0, "wood", 7); for (const [r, h, y] of [[.55, .72, .55], [.43, .65, 1.0], [.3, .58, 1.42]]) part(carved(new THREE.ConeGeometry(r, h, 7), .025), 0x3fbf3a, 0, y, 0, "leaves");
  } else if (K === "bush") {
    for (let i = 0; i < 3; i++) part(carved(new THREE.IcosahedronGeometry(.25 + R() * .1, 0), .03), pick([0x3fbf3a, 0x55cf45, 0x299c38]), (R() - .5) * .45, .23, (R() - .5) * .4, "leaves");
  } else if (K === "obelisk") {   // glowing crystal obelisk on a stepped stone plinth, with orbiting shards
    const GLOW = 0x5fe8ff, glow = (geo, x, y, z) => { const m = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: GLOW, emissive: GLOW, emissiveIntensity: .75, gradientMap: toonRamp(), transparent: true, opacity: .92 })); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    cyl(.5, .1, SOLID, 0, 0, 0, "stone", 6); cyl(.4, .1, SOLID, 0, .1, 0, "stone", 6);
    glow(new THREE.CylinderGeometry(.2, .3, 1.7, 6), 0, 1.15, 0); glow(new THREE.ConeGeometry(.2, .45, 6), 0, 2.225, 0);
    for (const [a, r, y, s] of [[0, .55, 1.0, .1], [2.1, .5, 1.5, .08], [4.2, .58, .7, .09]]) { const sh = glow(new THREE.OctahedronGeometry(s, 0), Math.cos(a) * r, y, Math.sin(a) * r); sh.scale.y = 1.8; }
  } else if (K === "rock") {
    const m = part(carved(new THREE.DodecahedronGeometry(.36, 0), .06), pick([0x8b91a6, 0xa7a0b8, 0x747b91]), 0, .25, 0, "stone"); m.scale.y = .7;
  } else if (K === "stump") {
    cyl(.27, .32, 0x8a5a2c, 0, 0, 0, "wood", 8); part(new THREE.CylinderGeometry(.21, .21, .025, 8), 0xc9a878, 0, .33, 0);
  } else if (K === "well") {
    part(carved(new THREE.CylinderGeometry(.55, .6, .45, 9, 1, true), .025), SOLID, 0, .225, 0, "stone"); part(new THREE.CylinderGeometry(.42, .42, .04, 9), 0x386a91, 0, .3, 0); for (const x of [-.5, .5]) b(.08, 1.05, .08, PARCHMENT, x, .78, 0, "wood"); part(new THREE.ConeGeometry(.72, .42, 4), 0xe0445a, 0, 1.42, 0, "wood").rotation.y = Math.PI / 4;
  } else if (K === "lamp") {
    cyl(.06, 1.55, BRASS, 0, 0, 0, undefined, 7); b(.2, .24, .2, new THREE.MeshBasicMaterial({ color: 0xffd28a }), 0, 1.68, 0); part(new THREE.ConeGeometry(.18, .14, 4), BRASS, 0, 1.9, 0).rotation.y = Math.PI / 4;
  } else if (K === "fence") {
    for (const x of [-.45, 0, .45]) b(.08, .62, .08, PARCHMENT, x, .31, 0, "wood"); for (const y of [.22, .45]) b(1, .07, .05, PARCHMENT, 0, y, 0, "wood");
  }
  if (!g.children.length) b(.65, .35, .65, K.startsWith("decal_") ? 0x9b6b62 : 0xb79a63, 0, .175, 0, undefined, K.startsWith("decal_"));
  if (p.color) g.traverse((n) => { if (n.isMesh && !n.userData.noInk) { const tint = Array.isArray(n.material) ? n.material.map((m) => m.clone()) : n.material.clone(); (Array.isArray(tint) ? tint : [tint]).forEach((m) => { m.color?.set(p.color); if (m.emissive?.getHex()) m.emissive.set(p.color); }); n.material = tint; } else if (n.isLight) n.color.set(p.color); });
  const meshes = []; g.traverse((n) => { if (n.isMesh && !n.userData.noInk) meshes.push(n); }); meshes.forEach(ink);
}


// Pieces the old kit drew as a plain box: stairs, ladders and portals.
function stairsProp(p, pid) {
  const g = new THREE.Group(); g.position.set(p.x / U, p.elevation || 0, p.y / U); g.rotation.y = -(p.rot || 0) * Math.PI / 180; g.scale.setScalar(p.s || 1); g.userData.pick = { type: "prop", id: pid }; root.add(g);
  const add = (geo, c, x, y, z) => { const m = new THREE.Mesh(geo, c.isMaterial ? c : mat(c)); m.position.set(x, y, z); m.castShadow = m.receiveShadow = !c.isMaterial; g.add(m); return m; };
  const up = p.to == null || Number(p.to) > (p.lv ?? 0);
  if (p.kind === "stairs") for (let i = 0; i < 5; i++) { const h = up ? 0.09 * (i + 1) : 0.09 * (5 - i); add(boxGeo(0.84, h, 0.17), i % 2 ? SOLID : 0x76727e, 0, h / 2, 0.34 - i * 0.17); }
  else if (p.kind === "ladder") { for (const x of [-0.22, 0.22]) add(boxGeo(0.07, 1.4, 0.07), PARCHMENT, x, 0.7, 0); for (let i = 0; i < 6; i++) add(boxGeo(0.44, 0.05, 0.05), PARCHMENT, 0, 0.18 + i * 0.22, 0); }
  else {
    add(new THREE.TorusGeometry(0.46, 0.08, 5, 12), 0x4a4458, 0, 0.56, 0);
    add(new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({ color: p.color || 0x8a4dff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }), 0, 0.56, 0);
  }
}
const buildProp = (p, id) => (["stairs", "ladder", "portal"].includes(p.kind) ? stairsProp(p, id) : prop(p, id));

/* ---------------- map state -> world ---------------- */
let data = null; // the current floor, in cells
const lvOf = (r) => r.lv ?? 0;
const nowLv = () => S.level ?? S.map.level ?? 0;
const here = (r) => lvOf(r) === nowLv();
const seenByRules = (r) => visibleToPlayer(r, Object.values(S.map.fog || {}).filter(here), S.isGM, S.currentVisible, S.map.exploredEnabled !== false);
const canExist = (r) => S.isGM || !r.hidden;
const FLOOR_COL = { wood: "#6b4a2a", stone: "#6e6a72", slab: "#5e5b55", cobble: "#5d5566", marble: "#9a9a94", tile: "#7a4a3a", carpet: "#5a2a38", dirt: "#4a3a2a", cave: "#3a3438", iron: "#44525e", gravel: "#6a5f4c", sand: "#8a7648", grass: "#33502a", snow: "#aab4b8", water: "#1d4a62", shallow: "#3a6670", mud: "#4a321e", ice: "#6a98a8", lava: "#a02c14", swamp: "#33402a", bone: "#8a8270", void: "#0c0c14", moss: "#3a4a28" };
const WALL_COL = { stone: 0x6a6672, ashlar: 0x6e6a66, marble: 0x8c8c86, brick: 0x6a362c, fieldstone: 0x56524e, plaster: 0x857a66, timber: 0x4a3018, wood: 0x5a3a1c, palisade: 0x3e2a1a, cave: 0x3c383a, hedge: 0x2c4024, earth: 0x4a3624, cobble: 0x4a4254, iron: 0x35444f };

const imageCache = new Map();
function cachedImage(url) {
  let img = imageCache.get(url);
  if (!img) { img = new Image(); img.crossOrigin = "anonymous"; img.onload = () => { pending = true; }; img.src = url; imageCache.set(url, img); }
  return img.complete && img.naturalWidth ? img : null;
}
function levels() { // every floor that has anything on it, plus the one you are on
  const set = new Set([nowLv()]);
  for (const part of [S.map.floors, S.map.walls, S.map.props, S.objects]) for (const r of Object.values(part || {})) set.add(lvOf(r));
  for (const k of Object.keys(S.pictures || {})) set.add(Number(k));
  return [...set].sort((a, b) => a - b);
}
// What a floor's map picture is right now (the current floor honours the Reference show/hide button).
const pictureOf = (lv) => (lv === nowLv() ? getRefImage() && { url: getRefImage().dataUrl, cols: getRefImage().cols, rows: getRefImage().rows } : S.pictures?.[lv]) || null;
// One floor painted flat: ground, map picture, floor swatches drawn over it, placed images. The bottom floor is solid; higher floors
// are see-through where they have nothing, so the floors under them show.
function floorCanvas(lv, maxSize, solid) {
  const { cols, rows, x: x0, y: y0 } = mapSize(), pic = pictureOf(lv), img = pic && cachedImage(pic.url);
  const floors = Object.values(S.map.floors || {}).filter((a) => lvOf(a) === lv), images = Object.values(S.map.images || {}).filter((a) => a?.url && lvOf(a) === lv);
  const ppc = Math.min(64, maxSize / Math.max(cols, rows), img ? Math.max(24, img.naturalWidth / (pic.cols || cols)) : 48);
  const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(cols * ppc)); c.height = Math.max(1, Math.round(rows * ppc));
  const g = c.getContext("2d"); g.setTransform(c.width / cols, 0, 0, c.height / rows, -x0 * c.width / cols, -y0 * c.height / rows);
  if (solid) {
    g.fillStyle = "#26221f"; g.fillRect(x0, y0, cols, rows);
    const rnd = random(11);
    for (let i = 0; i < cols * rows * 3; i++) { g.fillStyle = rnd() > 0.5 ? "rgba(255,240,220,0.035)" : "rgba(0,0,0,0.16)"; g.beginPath(); g.arc(x0 + rnd() * cols, y0 + rnd() * rows, 0.03 + rnd() * 0.12, 0, 7); g.fill(); }
  }
  if (img) g.drawImage(img, 0, 0, pic.cols || cols, pic.rows || rows);
  for (const a of floors) {
    const x = a.x / U, z = a.y / U, w = a.w / U, h = a.h / U;
    g.fillStyle = FLOOR_COL[a.mat] || "#5c5346"; g.fillRect(x, z, w, h);
    const r = random(Math.round(x * 91 + z * 17) | 0);
    for (let cx = x; cx < x + w - 0.01; cx++) for (let cz = z; cz < z + h - 0.01; cz++) {
      g.fillStyle = r() > 0.5 ? `rgba(255,255,255,${r() * 0.07})` : `rgba(0,0,0,${r() * 0.16})`; g.fillRect(cx, cz, 1, 1);
      g.strokeStyle = "rgba(0,0,0,0.25)"; g.lineWidth = 0.025; g.strokeRect(cx, cz, 1, 1);
    }
  }
  for (const a of images) { const im = cachedImage(a.url); if (im) { g.globalAlpha = a.op ?? 1; g.drawImage(im, a.x / U, a.y / U, a.w / U, a.h / U); g.globalAlpha = 1; } }
  return c;
}
function floorTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return tex;
}
function ground(into, material, y = 0) {
  const { cols, rows, x, y: z } = mapSize(), floor = new THREE.Mesh(new THREE.PlaneGeometry(cols, rows).rotateX(-Math.PI / 2), material);
  floor.position.set(x + cols / 2, y, z + rows / 2); into.add(floor); return floor;
}
function slab(into) { // the block of earth the whole stack stands on
  const { cols, rows, x, y } = mapSize(), m = new THREE.Mesh(boxGeo(cols + 0.4, 0.9, rows + 0.4), new THREE.MeshLambertMaterial({ color: 0x17121a, flatShading: true }));
  m.position.set(x + cols / 2, -0.47, y + rows / 2); into.add(m);
}

let sampler = null; // small copy of the current floor picture, used to tint stone to match the art
function buildFloor(bottom) {
  disposeTree(floorRoot); floorRoot.clear();
  const canvas = floorCanvas(nowLv(), Math.min(Q.tex, renderer.capabilities.maxTextureSize), bottom);
  const { cols, rows } = mapSize(), small = document.createElement("canvas"); small.width = Math.min(512, cols * 12); small.height = Math.min(512, rows * 12);
  const sg = small.getContext("2d", { willReadFrequently: true }); sg.drawImage(canvas, 0, 0, small.width, small.height);
  try { sampler = sg.getImageData(0, 0, small.width, small.height); } catch { sampler = null; } // a picture from another site may not be readable
  ground(floorRoot, lit(new THREE.MeshLambertMaterial({ color: 0xe8e2d8, map: floorTexture(canvas), alphaTest: bottom ? 0 : 0.5 }))).receiveShadow = true;
  if (bottom) slab(floorRoot);
  for (const a of Object.values(S.map.floors || {}).filter((a) => here(a) && Number(a.elev))) {
    const e = a.elev / U, m = new THREE.Mesh(boxGeo(a.w / U, Math.max(0.04, Math.abs(e)), a.h / U), mat(parseInt((FLOOR_COL[a.mat] || "#5c5346").slice(1), 16)));
    m.position.set((a.x + a.w / 2) / U, e / 2, (a.y + a.h / 2) / U); m.receiveShadow = true; floorRoot.add(m);
  }
}
function stone(x, z, rnd, matName) {
  const base = new THREE.Color(WALL_COL[matName] ?? 0x5d6268), { cols, rows, x: x0, y: y0 } = mapSize();
  if (!WALL_COL[matName] && sampler) {
    const px = clamp(Math.round((x - x0) / cols * sampler.width), 1, sampler.width - 2), pz = clamp(Math.round((z - y0) / rows * sampler.height), 1, sampler.height - 2);
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = -1; i <= 1; i++) for (let k = -1; k <= 1; k++) { const o = ((pz + k) * sampler.width + px + i) * 4; if (sampler.data[o + 3] > 8) { r += sampler.data[o]; g += sampler.data[o + 1]; b += sampler.data[o + 2]; n++; } }
    if (n) base.lerp(new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace), 0.35);
  }
  const hsl = base.getHSL({});
  return base.setHSL(hsl.h, hsl.s * 0.6, clamp(hsl.l, 0.11, 0.34) * (0.75 + rnd() * 0.5));
}
function buildWalls(H) {
  const blocks = [], posts = [], spires = [], rnd = random(7), moss = new THREE.Color(0x1f2b16);
  for (const { seg: [x1, z1, x2, z2], mat: m } of data.walls) {
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz), ry = along(dx, dz);
    if (len < 0.01) continue;
    const put = (t, y, sx, sy, sz, c, wobble = 0) => blocks.push({ m: matrix(x1 + dx * t, y, z1 + dz * t, ry + wobble, sx, sy, sz), c });
    const n = Math.max(1, Math.round(len / 0.55)), tint = (t) => stone(x1 + dx * t, z1 + dz * t, rnd, m);
    if (Q.blocks) {
      put(0.5, H / 2, len, H, THICK * 0.7, tint(0.5).multiplyScalar(0.45)); // mortar core
      const rows = Math.max(1, Math.round(H / 0.36)), rh = H / rows;
      for (let r = 0; r < rows; r++) {
        const cuts = [0, ...Array.from({ length: n - 1 }, (_, i) => (i + (r % 2 ? 0.5 : 1)) / n), ...(r % 2 && n > 1 ? [(n - 0.5) / n] : []), 1];
        for (let i = 1; i < cuts.length; i++) {
          const t = (cuts[i] + cuts[i - 1]) / 2, w = (cuts[i] - cuts[i - 1]) * len, c = tint(t);
          if (r === 0 && rnd() < 0.45) c.lerp(moss, 0.4 + rnd() * 0.4);
          put(t, rh * (r + 0.5), Math.max(0.05, w - 0.03), rh - 0.03, THICK * (0.85 + rnd() * 0.4), c, (rnd() - 0.5) * 0.1);
        }
      }
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n, tall = 0.05 + rnd() * 0.13; if (rnd() > 0.14) put(t, H + tall / 2, len / n * (0.75 + rnd() * 0.25), tall, THICK + 0.03 + rnd() * 0.08, tint(t).multiplyScalar(1.15), (rnd() - 0.5) * 0.22); }
      for (let i = 0; i < len; i++) if (rnd() < 0.4) { // rubble at the foot of the wall
        const t = (i + rnd()) / Math.ceil(len), off = (rnd() < 0.5 ? -1 : 1) * (THICK * 0.7 + rnd() * 0.12), size = 0.07 + rnd() * 0.13;
        blocks.push({ m: matrix(x1 + dx * t - dz / len * off, size * 0.3, z1 + dz * t + dx / len * off, rnd() * 6, size * 1.3, size * 0.7, size), c: tint(t) });
      }
    } else { put(0.5, H / 2, len, H, THICK, tint(0.5)); put(0.5, H + 0.04, len, 0.09, THICK + 0.07, tint(0.5).multiplyScalar(1.3)); }
  }
  const joints = new Map(), key = (x, z) => `${Math.round(x * 20)},${Math.round(z * 20)}`;
  for (const { seg: [x1, z1, x2, z2] } of data.walls) for (const [x, z, ox, oz] of [[x1, z1, x2, z2], [x2, z2, x1, z1]]) {
    const k = key(x, z), len = Math.hypot(ox - x, oz - z) || 1;
    if (!joints.has(k)) joints.set(k, { x, z, dirs: [] });
    joints.get(k).dirs.push([(ox - x) / len, (oz - z) / len]);
  }
  const post = (x, z, r, h) => { const c = stone(x, z, rnd), spin = rnd() * 6; posts.push({ m: matrix(x, h / 2, z, spin, r, h, r), c }); spires.push({ m: matrix(x, h + 0.13 * r, z, spin, r, r, r), c: c.clone().multiplyScalar(0.75) }); };
  for (const { x, z, dirs } of joints.values()) if (dirs.length !== 2 || dirs[0][0] * dirs[1][0] + dirs[0][1] * dirs[1][1] > -0.9) post(x, z, 1, H + 0.16);
  for (const d of data.doors) if (d.kind !== "secret") { post(d.seg[0], d.seg[1], 0.85, H + 0.2); post(d.seg[2], d.seg[3], 0.85, H + 0.2); }
  for (const d of data.doors.filter((d) => d.window)) { // windows share the stone: sill and lintel
    const x = (d.seg[0] + d.seg[2]) / 2, z = (d.seg[1] + d.seg[3]) / 2;
    blocks.push({ m: onSeg(d.seg, H * 0.18, H * 0.36, THICK * 1.05), c: stone(x, z, rnd) });
    blocks.push({ m: onSeg(d.seg, H * 0.92, H * 0.16, THICK * 1.05), c: stone(x, z, rnd) });
  }
  instances(chunk(Q.blocks ? 0.045 : 0), stoneMat(), blocks);
  instances(new THREE.CylinderGeometry(0.14, 0.2, 1, 6), stoneMat(), posts);
  instances(new THREE.ConeGeometry(0.2, 0.28, 4), stoneMat(), spires);
}

let leaves = [];
const swings = new Map(); // door id -> current swing, kept across rebuilds so doors animate
const isOpenDoor = (o) => !!o && (o.state === "open" || (o.doorKind || o.kindName) === "arch");
const doorOpen = (id) => isOpenDoor(S.objects[id]);
const lifts = (d) => d.kind === "portcullis" || d.kind === "bars";
function doorMatrix(d, H) {
  const [x1, z1, x2, z2] = d.seg, dx = x2 - x1, dz = z2 - z1, s = swings.get(d.id) || 0, len = Math.hypot(dx, dz);
  return lifts(d) ? matrix(x1, s * H * 0.85, z1, along(dx, dz), len, H * 0.95, 0.07) : matrix(x1, 0, z1, along(dx, dz) + s * 1.75, len, H * 0.95, 0.12);
}
function buildDoors(H) {
  const real = data.doors.filter((d) => !d.window && !["arch", "secret"].includes(d.kind));
  for (const d of data.doors) if (!swings.has(d.id)) swings.set(d.id, doorOpen(d.id) ? 1 : 0);
  const plank = (iron) => {
    const planks = [0x3d2a1c, 0x32231a, 0x45301f, 0x37261a].map((c, i) => part3(new THREE.BoxGeometry(0.235, 0.98, 1), iron ? 0x2a2e36 : c, 0.125 + i * 0.25, 0.5, 0));
    const bands = [0.2, 0.76].map((y) => part3(new THREE.BoxGeometry(0.96, 0.08, 1.4), 0x1d1f25, 0.5, y, 0));
    const studs = [0.2, 0.76].flatMap((y) => [0.12, 0.37, 0.63, 0.88].map((x) => part3(new THREE.BoxGeometry(0.035, 0.035, 1.8), 0x6b6258, x, y, 0)));
    const rings = [-0.85, 0.85].map((z) => part3(new THREE.TorusGeometry(0.065, 0.016, 4, 8), 0x8a6a34, 0.8, 0.46, z));
    return merged([...planks, ...bands, ...studs, ...rings]);
  };
  const curtain = () => merged([0, 1, 2, 3, 4].map((i) => part3(new THREE.BoxGeometry(0.19, 0.96, 0.5), i % 2 ? 0x5c1f3a : 0x6e2746, 0.1 + i * 0.2, 0.5, i % 2 ? 0.3 : -0.3)));
  const grille = () => merged([...[0, 1, 2, 3, 4, 5].map((i) => part3(new THREE.BoxGeometry(0.05, 1, 1), 0x2b2f38, 0.04 + i * 0.184, 0.5, 0)), ...[0.15, 0.5, 0.85].map((y) => part3(new THREE.BoxGeometry(1, 0.05, 1.1), 0x2b2f38, 0.5, y, 0))]);
  leaves = [];
  const group = (list, geo) => {
    const mesh = instances(geo, lit(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true })), list.map((d) => ({ m: doorMatrix(d, H) })));
    if (mesh) { mesh.frustumCulled = false; list.forEach((d, i) => leaves.push({ d, mesh, i })); }
  };
  group(real.filter((d) => !lifts(d) && !["iron", "curtain"].includes(d.kind)), plank(false));
  group(real.filter((d) => d.kind === "iron"), plank(true));
  group(real.filter((d) => d.kind === "curtain"), curtain());
  group(real.filter(lifts), grille());
  const panes = [];
  for (const d of data.doors.filter((d) => d.window && !doorOpen(d.id))) panes.push({ m: onSeg(d.seg, H * 0.6, H * 0.48, 0.04, 0.96) }, { m: onSeg(d.seg, H * 0.6, H * 0.48, 0.1, 0.04) });
  instances(boxGeo(1, 1, 1), lit(new THREE.MeshLambertMaterial({ color: 0x2a3648, emissive: 0x40200a, transparent: true, opacity: 0.75, depthWrite: false })), panes, { shadows: false });
}

function fire(hex) { // warm and white lights burn like fire; blue and green ones are magic and keep their colour
  const c = new THREE.Color(hex);
  if (c.r >= c.b && c.r >= c.g * 0.92) c.lerp(c.clone().multiply(new THREE.Color(0xff9a4a)), 0.8);
  return c;
}
let glowTex = null;
function buildFixtures(H) {
  const sconces = [], braziers = [], flames = [], glowPos = [], glowCol = [];
  for (const l of data.lights) {
    let best = null;
    for (const w of data.walls) { const c = closest(l.x, l.z, w.seg); if (!best || c.d < best.d) best = c; }
    const color = fire(l.color);
    let fx = l.x, fy = 0.66, fz = l.z;
    if (best && best.d < 0.5) {
      const el = Math.hypot(best.ex, best.ez) || 1, nx = best.d > 0.02 ? (l.x - best.x) / best.d : -best.ez / el, nz = best.d > 0.02 ? (l.z - best.z) / best.d : best.ex / el;
      const y = Math.max(0.15, H * 0.62), x = best.x + nx * THICK / 2, z = best.z + nz * THICK / 2;
      sconces.push({ m: matrix(x, y, z, Math.atan2(nx, nz), 1, 1, 1) }); fx = x + nx * 0.2; fz = z + nz * 0.2; fy = y + 0.3;
    } else braziers.push({ m: matrix(l.x, 0, l.z, l.x * 3, 1, 1, 1) });
    flames.push({ m: matrix(fx, fy, fz, 0, 1, 1, 1), c: color.clone().lerp(new THREE.Color(0xffe0a0), 0.2) });
    glowPos.push(fx, fy, fz); glowCol.push(color.r, color.g, color.b);
  }
  const iron = 0x1c1d23, wood = 0x3a2616, painted3 = () => lit(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  instances(merged([part3(new THREE.BoxGeometry(0.16, 0.2, 0.04), iron, 0, 0, 0.02), part3(new THREE.BoxGeometry(0.05, 0.05, 0.18), iron, 0, 0, 0.11),
    part3(new THREE.CylinderGeometry(0.045, 0.025, 0.3, 5), wood, 0, 0.07, 0.19, 0.12), part3(new THREE.CylinderGeometry(0.075, 0.055, 0.07, 6), iron, 0, 0.21, 0.2)]), painted3(), sconces);
  instances(merged([part3(new THREE.CylinderGeometry(0.22, 0.12, 0.15, 7), iron, 0, 0.45, 0), part3(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 7), 0xc2521f, 0, 0.52, 0),
    ...[0, 1.26, 2.51, 3.77, 5.03].map((a) => part3(new THREE.ConeGeometry(0.025, 0.14, 4), iron, Math.cos(a) * 0.2, 0.57, Math.sin(a) * 0.2)),
    ...[0, 2.1, 4.2].map((a) => part3(new THREE.BoxGeometry(0.04, 0.46, 0.04).rotateZ(0.28).rotateY(a), iron, Math.cos(a) * 0.14, 0.21, -Math.sin(a) * 0.14))]), painted3(), braziers);
  instances(new THREE.OctahedronGeometry(0.09).scale(1, 1.8, 1), fogged(new THREE.MeshBasicMaterial(), Q.flicker), flames, { shadows: false });
  if (!glowPos.length) return;
  if (Q.glow) {
    glowTex ||= canvasTexture(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,0.9)"); r.addColorStop(0.3, "rgba(255,255,255,0.3)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(glowPos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(glowCol, 3));
    world.add(new THREE.Points(g, fogged(new THREE.PointsMaterial({ map: glowTex, size: 1.5, vertexColors: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }))));
  }
  if (Q.flicker) {
    const rnd = random(3), from = [], seed = [];
    for (let i = 0; i < glowPos.length; i += 3) for (let k = 0; k < 5; k++) { from.push(glowPos[i], glowPos[i + 1], glowPos[i + 2]); seed.push(rnd()); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(from, 3)); g.setAttribute("seed", new THREE.Float32BufferAttribute(seed, 1));
    const embers = new THREE.Points(g, emberMaterial()); embers.frustumCulled = false; world.add(embers);
  }
}

/* Traps and triggers: a rune on the floor for anything that is not a door or a light. */
const RUNES = { plate: ["▣", "#c9a45c"], tripwire: ["┄", "#d06a4a"], sight: ["◉", "#b06adf"], gauge: ["♥", "#d04a5a"], switch: ["⌇", "#6ac0a0"], dial: ["✥", "#6aa8d0"], floor: ["▦", "#a08a70"], spawn: ["☠", "#d04a4a"], stone: ["●", "#9a948a"], catapult: ["➶", "#d0904a"], initiative: ["⚔", "#e0c060"] };
function rune(id, o) {
  const [icon, color] = RUNES[o.kind] || ["?", "#c9a45c"], on = o.state !== (o.start ?? o.state), g = new THREE.Group();
  g.userData.pick = { type: "object", id };
  const cells = o.kind === "tripwire" ? o.len || 3 : 1;
  for (let i = 0; i < cells; i++) {
    const tex = canvasTexture(96, 96, (c) => { c.strokeStyle = color; c.lineWidth = 5; c.globalAlpha = o.hidden ? 0.5 : 1; if (o.hidden) c.setLineDash([10, 8]); c.fillStyle = on ? color + "66" : "#00000066"; c.beginPath(); c.roundRect(8, 8, 80, 80, 14); c.fill(); c.stroke(); c.setLineDash([]); c.fillStyle = color; c.font = "56px system-ui"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(icon, 48, 52); });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2), fogged(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })));
    m.position.set(o.x / U + (o.dir === "v" ? 0 : i), 0.03, o.y / U + (o.dir === "v" ? i : 0)); g.add(m);
  }
  if (o.kind === "switch") { const base = new THREE.Mesh(boxGeo(0.3, 0.14, 0.2), mat(SOLID)), arm = new THREE.Mesh(boxGeo(0.07, 0.42, 0.07), mat(PARCHMENT)); base.position.set(o.x / U, 0.07, o.y / U); arm.position.set(o.x / U, 0.3, o.y / U); arm.rotation.z = o.state === "on" ? -0.6 : 0.6; g.add(base, arm); }
  if (S.isGM) { const name = sprite(`${o.label || o.kind}: ${o.state}`, { size: 0.24 }); name.position.set(o.x / U, 0.75, o.y / U); g.add(name); }
  world.add(g);
}

function disposeTree(t) {
  t.traverse((o) => {
    o.geometry?.dispose?.();
    for (const m of [].concat(o.material || [])) if (!m.userData.shared) { if (m.map && m.map !== glowTex) m.map.dispose(); m.dispose(); }
    if (o.isInstancedMesh) o.dispose();
  });
}

// The doors, walls and secret doors of one floor, in cells.
function plan(lv) {
  const doors = Object.entries(S.objects).filter(([, o]) => o.kind === "door" && lvOf(o) === lv && Number.isFinite(o.x)).map(([id, o]) => ({
    id, o, kind: o.doorKind || o.kindName || (o.win ? "window" : "wood"), window: !!(o.win || o.doorKind === "window"), seg: doorSeg(o).map((v) => v / U)
  }));
  const cutters = doors.map((d) => d.o), walls = [];
  for (const [id, w] of Object.entries(S.map.walls || {})) if (lvOf(w) === lv) for (const p of wallPieces(w, cutters)) walls.push({ id, mat: w.mat, seg: p.map((v) => v / U) });
  for (const d of doors) if (d.kind === "secret" && !isOpenDoor(d.o)) walls.push({ id: null, door: d.id, mat: d.o.mat, seg: d.seg }); // a secret door looks like wall
  return { doors, walls };
}

/* ---------------- the other floors: cheap shells, no lights, no shadows ---------------- */
const masks = new Map(); // floor -> what has been seen there
function maskFor(lv) {
  const { cols, rows } = mapSize();
  let tex = masks.get(lv);
  if (!tex || tex.image.width !== cols || tex.image.height !== rows) {
    tex?.dispose(); tex = new THREE.DataTexture(new Uint8Array(cols * rows * 4).fill(255), cols, rows, THREE.RGBAFormat);
    tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true; masks.set(lv, tex);
  }
  return tex;
}
function buildOtherFloor(lv, bottom) {
  const above = lv > nowLv(), mask = maskFor(lv), shell = new THREE.Group(), H = WALL_H;
  shell.position.y = (lv - nowLv()) * floorGap(); others.add(shell);
  const faded = (m) => { if (above) Object.assign(m, { transparent: true, opacity: 0.2, depthWrite: false }); return dimmed(m, mask); }; // floors overhead are see-through
  if (!above) ground(shell, dimmed(new THREE.MeshLambertMaterial({ map: floorTexture(floorCanvas(lv, Math.min(Q.other, renderer.capabilities.maxTextureSize), bottom)), alphaTest: bottom ? 0 : 0.5 }), mask));
  if (bottom && !above) slab(shell);
  const p = plan(lv), blocks = [], rnd = random(lv * 13 + 5), flat = { shadows: false, into: shell };
  for (const w of p.walls) blocks.push({ m: onSeg(w.seg, H / 2, H, THICK), c: new THREE.Color(WALL_COL[w.mat] ?? 0x6d6a76).multiplyScalar(0.85 + rnd() * 0.3) });
  for (const d of p.doors) if (d.window) blocks.push({ m: onSeg(d.seg, H * 0.18, H * 0.36, THICK), c: new THREE.Color(0x6d6a76) });
    else if (!isOpenDoor(d.o) && d.kind !== "secret") blocks.push({ m: onSeg(d.seg, H * 0.47, H * 0.94, 0.12), c: new THREE.Color(0x5a3a22) });
  instances(boxGeo(1, 1, 1), faded(new THREE.MeshLambertMaterial({ flatShading: true })), blocks, flat);
  if (above) return;
  root = shell;
  for (const [id, prp] of Object.entries(S.map.props || {})) if (lvOf(prp) === lv && canExist(prp)) buildProp({ ...prp, id }, id);
  root = world;
  shell.traverse((o) => { if (o.isMesh && o.material.userData.shared) { o.material = dimmed(new THREE.MeshLambertMaterial({ color: o.material.color, flatShading: true }), mask); o.castShadow = o.receiveShadow = false; } });
}

let hitMesh = null, hitIds = [], staticSig = "", roofs = [], gridLines = null, gridOn = true;
function signature() {
  const { cols, rows, x, y } = mapSize(), lv = nowLv();
  const objects = Object.entries(S.objects).map(([id, o]) => { if (o.kind !== "door" || lvOf(o) !== lv) return [id, o]; const { state, locked, ...rest } = o; return [id, { ...rest, shut: o.doorKind === "secret" || o.win ? state : null }]; });
  const pictures = levels().map((l) => { const p = pictureOf(l); return p && [l, p.url.length, p.url.slice(-32), !!cachedImage(p.url)]; });
  const images = Object.values(S.map.images || {}).map((a) => [a, !!(a?.url && cachedImage(a.url))]);
  return JSON.stringify([cols, rows, x, y, lv, level, WALL_H, S.map.floors, S.map.walls, S.map.props, S.map.roofs, S.map.labels, images, pictures, objects]);
}
function buildStatic() {
  const { cols, rows, x: x0, y: y0 } = mapSize(), sig = signature();
  data = plan(nowLv());
  data.lights = Object.entries(S.objects).filter(([, o]) => o.kind === "light" && o.state === "on" && here(o) && canExist(o)).map(([id, o]) => ({ id, x: o.x / U, z: o.y / U, range: (o.radius || 120) / U, power: clamp(0.35 + (Number(o.intensity) || 1) * 0.55, 0.4, 1.2), color: o.color || "#ffb347" }));
  if (sig === staticSig) return false;
  staticSig = sig;
  disposeTree(world); world.clear(); disposeTree(others); others.clear(); root = world;
  const all = levels(), H = WALL_H;
  buildFloor(all[0] === nowLv());
  for (const lv of all) if (lv !== nowLv()) buildOtherFloor(lv, lv === all[0]);
  buildWalls(H); buildDoors(H); buildFixtures(H);
  const elevation = (x, y) => Object.values(S.map.floors || {}).find((a) => here(a) && x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h)?.elev / U || 0;
  for (const [id, p] of Object.entries(S.map.props || {})) if (here(p) && canExist(p)) buildProp({ ...p, id, elevation: elevation(p.x, p.y) }, id);
  for (const [id, p] of Object.entries(S.map.props || {})) if (!here(p) && canExist(p) && ["stairs", "ladder"].includes(p.kind) && Number(p.to) === nowLv() && p.to !== "") buildProp({ ...p, id, lv: nowLv(), to: lvOf(p) }, id);
  roofs = [];
  for (const a of Object.values(S.map.roofs || {})) {
    if (!here(a) || a.open) continue;
    const m = roofMesh(a);
    if (S.isGM) m.material = lit(new THREE.MeshLambertMaterial({ color: m.material.color, transparent: true, opacity: 0.3, depthWrite: false, flatShading: true }));
    else m.castShadow = true;
    roofs.push({ a, m }); world.add(m);
  }
  for (const [id, o] of Object.entries(S.objects)) if (here(o) && canExist(o) && o.kind !== "door" && o.kind !== "light") rune(id, o);
  for (const a of Object.values(S.map.labels || {})) if (here(a) && seenByRules(a)) { const s = sprite(a.text || "", { color: a.color && a.color !== "#3d2632" ? a.color : "#e6ebf1", size: 0.45 * (a.size || 1) }); s.position.set(a.x / U, H + 0.3, a.y / U); world.add(s); }
  // invisible boxes that make walls, doors and lights easy to click
  const hits = []; hitIds = [];
  const hit = (type, id, m) => { hits.push({ m }); hitIds.push({ type, id }); };
  for (const w of data.walls) hit(w.door ? "object" : "wall", w.door || w.id, onSeg(w.seg, H / 2, H, 0.3));
  for (const d of data.doors) if (canExist(d.o) && d.kind !== "secret") hit("object", d.id, onSeg(d.seg, H / 2 + 0.05, H + 0.1, 0.5, 0.98));
  if (S.isGM) for (const [id, o] of Object.entries(S.objects)) if (here(o) && o.kind === "light") {
    const on = o.state === "on";
    if (!on) { const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.14), new THREE.MeshBasicMaterial({ color: 0x55505c, wireframe: true })); m.position.set(o.x / U, 0.6, o.y / U); world.add(m); }
    hit("object", id, matrix(o.x / U, 0.55, o.y / U, 0, 0.55, 1, 0.55));
  }
  hitMesh = instances(boxGeo(1, 1, 1), new THREE.MeshBasicMaterial(), hits, { shadows: false });
  if (hitMesh) hitMesh.visible = false;
  const pts = []; for (let c = x0; c <= x0 + cols; c++) pts.push(c, 0, y0, c, 0, y0 + rows); for (let r = y0; r <= y0 + rows; r++) pts.push(x0, 0, r, x0 + cols, 0, r);
  gridLines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pts, 3)), new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28 }));
  gridLines.position.y = 0.014; gridLines.visible = gridOn; world.add(gridLines);
  const size = Math.hypot(cols, rows) / 2, cx = x0 + cols / 2, cz = y0 + rows / 2;
  sun.target.position.set(cx, 0, cz); sun.position.set(cx - size * 0.7, size * 1.1, cz + size * 0.5); sun.castShadow = Q.shadow > 0;
  if (sun.castShadow) { sun.shadow.mapSize.set(Q.shadow, Q.shadow); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; Object.assign(sun.shadow.camera, { left: -size - 2, right: size + 2, top: size + 2, bottom: -size - 2, near: 0.5, far: size * 4 }); sun.shadow.camera.updateProjectionMatrix(); }
  U3.uSize.value.set(cols, rows); U3.uOrigin.value.set(x0, y0); renderer.shadowMap.needsUpdate = true;
  return true;
}

/* ---------------- light and fog textures ---------------- */
const lightCanvas = document.createElement("canvas"), polys = new Map();
let lightSig = "", wallKeyNow = "";
function bakeLights() {
  const { cols, rows, x: x0, y: y0 } = mapSize();
  const closed = data.doors.filter((d) => !d.window && !doorOpen(d.id) && !lifts(d)).map((d) => d.seg);
  const walls = data.walls.filter((w) => !w.door).map((w) => w.seg).concat(closed);
  const lights = data.lights;
  const wallKey = JSON.stringify(walls), sig = wallKey + JSON.stringify(lights) + [cols, rows, x0, y0] + level;
  if (sig === lightSig && U3.uLM.value) return;
  lightSig = sig;
  if (wallKeyNow !== wallKey || polys.size > 600) { polys.clear(); wallKeyNow = wallKey; }
  const ppc = Math.min(Q.ppc, Math.min(Q.light, renderer.capabilities.maxTextureSize) / Math.max(cols, rows)), w = Math.max(1, Math.round(cols * ppc)), h = Math.max(1, Math.round(rows * ppc));
  if (lightCanvas.width !== w || lightCanvas.height !== h || !U3.uLM.value) {
    lightCanvas.width = w; lightCanvas.height = h; U3.uLM.value?.dispose(); U3.uLM.value = new THREE.CanvasTexture(lightCanvas);
    Object.assign(U3.uLM.value, { flipY: false, colorSpace: THREE.SRGBColorSpace, generateMipmaps: false, minFilter: THREE.LinearFilter });
  }
  const g = lightCanvas.getContext("2d");
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "source-over"; g.fillStyle = "#000"; g.fillRect(0, 0, w, h);
  g.setTransform(w / cols, 0, 0, h / rows, -x0 * w / cols, -y0 * h / rows); g.globalCompositeOperation = "lighter";
  for (const l of lights) {
    const r = l.range * 1.25, k = `${l.x.toFixed(2)},${l.z.toFixed(2)},${r}`;
    let poly = polys.get(k); if (!poly) polys.set(k, poly = visibility(l.x, l.z, r, walls));
    g.save(); g.beginPath(); poly.forEach(([x, z], i) => g[i ? "lineTo" : "moveTo"](x, z)); g.closePath(); g.clip();
    const hex = "#" + fire(l.color).getHexString(), grad = g.createRadialGradient(l.x, l.z, 0, l.x, l.z, r), a = (v) => hex + Math.round(clamp(v * l.power, 0, 1) * 255).toString(16).padStart(2, "0");
    grad.addColorStop(0, a(0.8)); grad.addColorStop(0.45, a(0.34)); grad.addColorStop(1, a(0));
    g.fillStyle = grad; g.fillRect(l.x - r, l.z - r, r * 2, r * 2); g.restore();
  }
  U3.uLM.value.needsUpdate = true; dirty = true;
}
function paintMask(tex, value) { // value(x, y) -> 0..255 for each cell
  const { cols, rows, x: x0, y: y0 } = mapSize(), px = tex.image.data;
  let changed = false;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const v = value(x0 + x, y0 + y), i = (y * cols + x) * 4;
    if (px[i] !== v) { px[i] = px[i + 1] = px[i + 2] = v; changed = true; }
  }
  if (changed || !tex.version) { tex.needsUpdate = true; dirty = true; }
}
const REMEMBERED = 165; // of 255: seen before, not in sight now
let fogTarget = null, fogLevel = null;
function easeFog(dt) { // move each cell toward its target; full fade takes under a second
  if (!fogTarget || !U3.uFog.value) return false;
  const px = U3.uFog.value.image.data, step = Math.max(1, Math.round(dt * 320));
  let changed = false;
  for (let i = 0; i < fogTarget.length; i++) {
    const at = px[i * 4], gap = fogTarget[i] - at;
    if (!gap) continue;
    px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = at + Math.sign(gap) * Math.min(step, Math.abs(gap)); changed = true;
  }
  if (changed) U3.uFog.value.needsUpdate = true;
  return changed;
}
// Fog of war, one texel per cell (smoothed by the GPU). Players: unseen is black, remembered is dim, in sight is clear.
function updateFog() {
  const { cols, rows, x: x0, y: y0 } = mapSize();
  if (!U3.uFog.value || U3.uFog.value.image.width !== cols || U3.uFog.value.image.height !== rows) {
    U3.uFog.value?.dispose(); U3.uFog.value = new THREE.DataTexture(new Uint8Array(cols * rows * 4).fill(255), cols, rows, THREE.RGBAFormat);
    U3.uFog.value.magFilter = U3.uFog.value.minFilter = THREE.LinearFilter;
  }
  const memory = !S.isGM && S.map.exploredEnabled !== false;
  const coveredOn = (lv) => { const shut = Object.values(S.map.fog || {}).filter((f) => lvOf(f) === lv && !f.open); return (x, y) => { const cx = x * U + U / 2, cy = y * U + U / 2; return shut.some((f) => cx >= f.x && cx <= f.x + f.w && cy >= f.y && cy <= f.y + f.h); }; };
  const covered = coveredOn(nowLv());
  const fresh = !fogTarget || fogTarget.length !== cols * rows || fogLevel !== nowLv(); // a new floor appears at once
  if (fresh) { fogTarget = new Uint8Array(cols * rows); fogLevel = nowLv(); }
  const value = (x, y) => {
    const cell = `${x},${y}`, hidden = covered(x, y);
    if (S.isGM) return hidden ? 140 : 255;
    if (S.currentVisible?.has(cell) || !(memory || hidden)) return 255;
    return memory && S.exploredCells?.has(cell) ? REMEMBERED : 0;
  };
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) fogTarget[y * cols + x] = value(x0 + x, y0 + y);
  if (fresh) paintMask(U3.uFog.value, value);
  for (const lv of levels()) if (lv !== nowLv()) {
    const shut = coveredOn(lv), seen = S.exploredByLevel?.[lv];
    paintMask(maskFor(lv), (x, y) => (S.isGM ? 255 : memory ? (seen?.has(`${x},${y}`) ? 255 : 0) : shut(x, y) ? 0 : 255));
  }
}

/* ---------------- tokens ---------------- */
const tokens = new Map(); // id -> { group, card, sig, drag, base }
const RINGS = ["#a94c3d", "#466c83", "#66774b", "#7a5a8a"];
function tokenArt(t, id, i, entry) {
  const ring = t.color || (t.hp != null && !t.pc ? "#7a2a22" : RINGS[i % RINGS.length]);
  const draw = (g, size, img) => {
    g.clearRect(0, 0, size, size); g.save(); g.beginPath(); g.arc(size / 2, size / 2, size / 2 - 4, 0, 7); g.fillStyle = "#17130f"; g.fill(); g.clip();
    if (img) { const k = Math.max(size / img.naturalWidth, size / img.naturalHeight), iw = img.naturalWidth * k, ih = img.naturalHeight * k; g.drawImage(img, (size - iw) / 2, (size - ih) / 2, iw, ih); }
    else { g.fillStyle = ring; g.fillRect(0, 0, size, size); g.fillStyle = "#f0e2c0"; g.font = `700 ${size * 0.42}px system-ui`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText((t.label || id).slice(0, 2), size / 2, size / 2); }
    g.restore(); g.lineWidth = 7; g.strokeStyle = ring; g.stroke(); g.lineWidth = 2; g.strokeStyle = "#e8cf8a"; g.stroke();
  };
  const art = canvasTexture(192, 192, (g, size) => draw(g, size));
  if (t.img) {
    const img = new Image(); img.crossOrigin = "anonymous";
    img.onload = () => { if (tokens.get(id) !== entry) return; draw(art.image.getContext("2d"), art.image.width, img); art.needsUpdate = true; dirty = true; };
    img.src = t.img;
  }
  return { ring, art };
}
function hpOf(id, t) { const s = S.pcLive?.[S.tokPc?.[id]]; return s?.hp_max ? { hp: s.hp_current ?? s.hp_max, max: s.hp_max } : t.hp != null && S.isGM ? { hp: t.hp, max: t.max || t.hp } : null; }
function buildToken(id, t, i) {
  const entry = { group: new THREE.Group(), picture: null, disc: null, tags: [], drag: null, base: 0 };
  tokens.set(id, entry);
  const g = entry.group, { ring, art } = tokenArt(t, id, i, entry), faint = t.hidden || !here(t), ghost = faint ? { transparent: true, opacity: 0.45 } : {};
  g.userData.pick = { type: "token", id };
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.09, 20), new THREE.MeshLambertMaterial({ color: ring, emissive: ring, emissiveIntensity: 0.25, flatShading: true, ...ghost })); base.position.y = 0.045; base.castShadow = !faint;
  entry.disc = new THREE.Mesh(new THREE.CircleGeometry(0.34, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: art, transparent: true, ...ghost })); entry.disc.position.y = 0.095;
  // Sprites face the camera. On this floor they draw over the scene, so a wall never slices a picture; on other floors they stay hidden behind floors.
  const flat = (map, w, h) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, opacity: faint ? 0.45 : 1, depthTest: !here(t), depthWrite: false, fog: false })); s.scale.set(w, h, 1); s.renderOrder = 11; g.add(s); return s; };
  entry.picture = flat(art, 0.82, 0.82);
  g.add(base, entry.disc);
  const tag = (s, lift) => { s.userData.lift = lift; s.raycast = () => {}; entry.tags.push(s); };
  const hp = hpOf(id, t);
  if (hp) {
    const part = clamp(hp.hp / (hp.max || 1), 0, 1);
    tag(flat(canvasTexture(128, 28, (c) => { c.fillStyle = "#000c"; c.fillRect(0, 0, 128, 28); c.fillStyle = part <= 0.25 ? "#c02a22" : part <= 0.5 ? "#c8780a" : "#2a9440"; c.fillRect(2, 2, 124 * part, 24); c.fillStyle = "#fff"; c.font = "700 20px system-ui"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(`${hp.hp}/${hp.max}`, 64, 15); }), 0.62, 0.136), 0.02);
  }
  const words = [t.label || "", ...conditionsOf(t).map((c) => CONDITIONS[c]?.[0]).filter(Boolean)].filter(Boolean).join(" · ");
  if (words) { const label = sprite(words, { size: 0.22 }); label.material.depthTest = !here(t); label.renderOrder = 12; g.add(label); tag(label, hp ? 0.18 : 0.02); }
  g.scale.setScalar(Number(t.size) || 1);
  g.position.set(t.x / U, 0, t.y / U);
  placeToken(entry);
  tokenRoot.add(g);
  return entry;
}
// Tilted: the picture floats where the character stands, above the base. Top-down: the picture is on the base.
function placeToken(e) {
  e.picture.visible = !topDown; e.disc.visible = topDown;
  e.picture.center.set(0.5, 0); e.picture.position.y = 0.28;
  const top = topDown ? 0.4 : e.picture.scale.y; // name and HP sit above whichever is showing
  for (const s of e.tags) { s.position.y = topDown ? 0.12 : 0.28; s.center.set(0.5, -(top + s.userData.lift) / s.scale.y); }
}
let walkingId = null;
function syncTokens() {
  const seen = new Set();
  Object.entries(S.tokens).forEach(([id, t], i) => {
    if (!Number.isFinite(t.x)) return;
    const own = id === walkingId;
    if (!here(t) && !S.isGM) return; // other floors: only the GM sees who is there
    if (!S.isGM && !own && (!seenByRules(t) || (S.map.exploredEnabled !== false && !isCurrentlyVisible(t.x, t.y)))) return;
    seen.add(id);
    const sig = JSON.stringify([t.img, t.label, t.color, t.hidden, t.size, here(t), conditionsOf(t), S.turn === id, hpOf(id, t), t.pc]);
    let e = tokens.get(id);
    if (!e || e.sig !== sig) { const old = e?.group.position.clone(); if (e) { tokenRoot.remove(e.group); disposeTree(e.group); } e = buildToken(id, t, i); e.sig = sig; if (old) e.group.position.copy(old); dirty = true; }
    const base = (lvOf(t) - nowLv()) * floorGap();
    if (e.base !== base) { e.base = base; e.group.position.set(t.x / U, base, t.y / U); dirty = true; }
    e.group.position.y = base;
  });
  for (const [id, e] of tokens) if (!seen.has(id)) { tokenRoot.remove(e.group); disposeTree(e.group); tokens.delete(id); dirty = true; }
  for (const { a, m } of roofs) { const inside = Object.values(S.tokens).some((t) => isPcToken(t) && !t.hidden && here(t) && t.x >= a.x && t.x <= a.x + a.w && t.y >= a.y && t.y <= a.y + a.h); if (m.visible === inside) { m.visible = !inside; dirty = true; renderer.shadowMap.needsUpdate = true; } }
}

/* ---------------- camera ---------------- */
// whose token this screen walks; the view centres on it once, then stays where you put it
export function setWalker(id) { if (walkingId !== id) { walkingId = id; framedFor = ""; pending = true; } }
function frameMap() {
  const { cols, rows, x: x0, y: y0 } = mapSize(), lead = !S.isGM && walkingId && S.tokens[walkingId];
  const aspect = Math.max(0.4, camera.aspect), dist = lead ? 14 : Math.max(rows, cols / aspect) * (topDown ? 1.32 : 1.15) + (topDown ? 1 : 3);
  const cx = lead ? lead.x / U : x0 + cols / 2, cz = lead ? lead.y / U : y0 + rows * (topDown ? 0.5 : 0.56), tilt = topDown ? 1e-4 : 0.75;
  controls.target.set(cx, 0, cz); camera.position.set(cx, Math.cos(tilt) * dist, cz + Math.sin(tilt) * dist); controls.update(); dirty = true;
}
export function heading() { // the way "forward" points on the map for the current camera
  if (fp) return facing();
  const v = new THREE.Vector3(); camera.getWorldDirection(v);
  if (Math.hypot(v.x, v.z) < 0.05) v.set(0, 1, 0).applyQuaternion(camera.quaternion);
  const len = Math.hypot(v.x, v.z) || 1; return { x: v.x / len, y: v.z / len };
}

/* ---------------- tools: zoom, fit, picking, ruler, ping ---------------- */
const anims = new Set(), ray = new THREE.Raycaster(), floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const aim = (clientX, clientY) => { const r = renderer.domElement.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera); };
export const isOpen = () => !!host && !host.hidden;
export function zoom(f) { const o = camera.position.clone().sub(controls.target).multiplyScalar(clamp(f, 0.3, 3)); camera.position.copy(controls.target).add(o); controls.update(); dirty = true; } // above 1 moves away
export function fit() { frameMap(); }
let toolBlock = false;
const applyControls = () => { if (controls) controls.enabled = !toolBlock && !fp; };
export const controlsBlocked = () => toolBlock;
export function setControls(on) { toolBlock = !on; applyControls(); }
export function setGrid(on) { gridOn = on; if (gridLines) gridLines.visible = on; dirty = true; }
function firstPick(targets) {
  for (const h of ray.intersectObjects(targets, true)) {
    if (h.object === hitMesh) return { pick: hitIds[h.instanceId], object: null, point: h.point };
    let o = h.object; while (o && !o.userData.pick) o = o.parent;
    if (o && o.visible) return { pick: o.userData.pick, object: o, point: h.point };
  }
  return null;
}
export function pickToken(clientX, clientY) { aim(clientX, clientY); return firstPick([tokenRoot])?.pick.id ?? null; }
export function dragToken(id, p) { const e = tokens.get(id); if (e) { e.drag = p; dirty = true; setTimeout(() => { if (e.drag === p) e.drag = null; }, 4000); } }
export function groundAt(clientX, clientY) { aim(clientX, clientY); const hit = ray.ray.intersectPlane(floorPlane, new THREE.Vector3()); return hit ? { x: hit.x * U, y: hit.z * U } : null; }
let selRing = null;
export function peekAt(clientX, clientY) { aim(clientX, clientY); return (firstPick([tokenRoot]) || firstPick([world]))?.pick ?? null; } // what is there, without ringing it
export function pickAt(clientX, clientY) {
  aim(clientX, clientY);
  const found = firstPick([tokenRoot]) || firstPick([world]);
  clearSelection();
  if (!found) return null;
  const c = !found.object ? found.point : found.pick.type === "token" ? found.object.position : new THREE.Box3().setFromObject(found.object.children[0] || found.object).getCenter(new THREE.Vector3());
  selRing = new THREE.Mesh(new THREE.RingGeometry(0.46, 0.55, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: BRASS, depthTest: false, side: THREE.DoubleSide }));
  selRing.position.set(c.x, 0.07, c.z); selRing.renderOrder = 10; fxRoot.add(selRing); dirty = true;
  return found.pick;
}
export function clearSelection() { if (selRing) { fxRoot.remove(selRing); selRing = null; dirty = true; } }
export function screenAt(mx, my) { const r = renderer.domElement.getBoundingClientRect(), v = new THREE.Vector3(mx / U, 0.1, my / U).project(camera); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; }
let ghost = null;
// What a build tool is about to draw, as outlines on the floor: segments [x1, y1, x2, y2] in map pixels.
export function preview(segs) {
  if (ghost) { fxRoot.remove(ghost); disposeTree(ghost); ghost = null; dirty = true; }
  if (!segs.length) return;
  const points = segs.flatMap(([x1, y1, x2, y2]) => [new THREE.Vector3(x1 / U, 0.08, y1 / U), new THREE.Vector3(x2 / U, 0.08, y2 / U)]);
  ghost = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xffd56a, depthTest: false }));
  ghost.renderOrder = 10; fxRoot.add(ghost); dirty = true;
}
let rulerObj = null;
export function ruler(a, b) {
  if (rulerObj) { fxRoot.remove(rulerObj); disposeTree(rulerObj); rulerObj = null; }
  if (a && b) {
    rulerObj = new THREE.Group();
    const A = new THREE.Vector3(a.x / U, 0.08, a.y / U), B = new THREE.Vector3(b.x / U, 0.08, b.y / U);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([A, B]), new THREE.LineBasicMaterial({ color: 0xffd56a, depthTest: false })); line.renderOrder = 10; rulerObj.add(line);
    for (const p of [A, B]) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd56a, depthTest: false })); d.position.copy(p); d.renderOrder = 10; rulerObj.add(d); }
    fxRoot.add(rulerObj);
  }
  dirty = true;
}
export function ping(p) {
  if (!isOpen()) return;
  const g = new THREE.Group(); g.position.set(p.x / U, 0.06, p.y / U);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd56a, transparent: true, depthTest: false, side: THREE.DoubleSide }), ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40).rotateX(-Math.PI / 2), ringMat); ring.renderOrder = 10;
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false })); beam.position.y = 1.1; beam.renderOrder = 10;
  g.add(ring, beam); fxRoot.add(g);
  const t0 = performance.now(), a = () => { const k = (performance.now() - t0) / 1500; if (k >= 1) { fxRoot.remove(g); disposeTree(g); anims.delete(a); dirty = true; return; } ring.scale.setScalar(0.15 + k * 1.1); ringMat.opacity = 0.95 * (1 - k); beam.material.opacity = k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35; };
  anims.add(a);
}

/* ---------------- top-down: the flat view ---------------- */
// Looking straight down, the table's own build, drawing and aiming tools work on an invisible layer laid exactly over
// the floor (the layer shows only previews, rulers and drawings; the picture underneath is always the 3D one).
let topDown = false, tilted = null, flat = null, busyWas = false;
export const isTopDown = () => topDown;
function lockView() { Object.assign(controls, topDown ? { maxPolarAngle: 0, minAzimuthAngle: 0, maxAzimuthAngle: 0 } : { maxPolarAngle: 1.35, minAzimuthAngle: -Infinity, maxAzimuthAngle: Infinity }); }
export function setTopDown(on) {
  if (!renderer || on === topDown) return;
  if (on && fp) setFirstPerson(null);
  const dist = camera.position.distanceTo(controls.target);
  if (on) tilted = camera.position.clone().sub(controls.target);
  topDown = on; clearSelection(); lockView();
  const offset = on ? new THREE.Vector3(0, dist, dist * 1e-4) : tilted ? tilted.setLength(dist) : new THREE.Vector3(0, Math.cos(0.75) * dist, Math.sin(0.75) * dist);
  camera.position.copy(controls.target).add(offset); controls.update(); dirty = true;
  document.body.classList.toggle("topdown", on);
  tokens.forEach(placeToken);
  document.dispatchEvent(new Event("topdownchange"));
}
export function pan(dx, dy) { // drag the top-down view by screen pixels
  const perPixel = 2 * camera.position.distanceTo(controls.target) * Math.tan(camera.fov * Math.PI / 360) / (renderer.domElement.clientHeight || 1);
  const move = new THREE.Vector3(-dx * perPixel, 0, -dy * perPixel);
  controls.target.add(move); camera.position.add(move); controls.update(); dirty = true;
}
function syncFlat() { // keep the input layer's coordinates matching the floor on screen
  const building = !!(S.isGM && (S.tool || S.placing));   // the left button draws instead of panning
  controls.mouseButtons.LEFT = building ? -1 : THREE.MOUSE.PAN; controls.touches.ONE = building ? -1 : THREE.TOUCH.PAN;
  const busy = !!flat?.matches(".aiming"); // attack aiming still needs the flat layer
  if (busy && !busyWas) setTopDown(true);
  busyWas = busy;
  if (!topDown || !flat) return;
  camera.updateMatrixWorld();
  const r = renderer.domElement.getBoundingClientRect(), a = groundAt(r.left, r.top), b = groundAt(r.right, r.bottom);
  if (!a || !b) return;
  const box = `${a.x.toFixed(2)} ${a.y.toFixed(2)} ${(b.x - a.x).toFixed(2)} ${(b.y - a.y).toFixed(2)}`;
  if (flat.getAttribute("viewBox") !== box) flat.setAttribute("viewBox", box);
  const place = { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" };
  for (const [k, v] of Object.entries(place)) if (flat.style[k] !== v) flat.style[k] = v;
}

/* ---------------- first person ---------------- */
let fp = null, fpSaved = null;
export const isFirstPerson = () => !!fp;
export const facing = () => fp ? { x: -Math.sin(fp.yaw), y: -Math.cos(fp.yaw) } : null;
export function turn(rad) { if (fp) { fp.yaw += rad; dirty = true; } }
export function setFirstPerson(id) {
  if (!renderer) return;
  if (id && S.tokens[id]) { setTopDown(false); if (!fp) fpSaved = { pos: camera.position.clone(), target: controls.target.clone() }; fp = { id, yaw: Math.PI, pitch: -0.05 }; camera.fov = 75; }
  else if (fp) { fp = null; camera.fov = 45; if (fpSaved) { camera.position.copy(fpSaved.pos); controls.target.copy(fpSaved.target); controls.update(); } }
  camera.updateProjectionMatrix(); applyControls(); dirty = true;
}
function fpLook(el) {
  let down = null;
  el.addEventListener("pointerdown", (e) => { if (fp && e.button === 0) { down = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); } });
  el.addEventListener("pointermove", (e) => { if (!fp || !down) return; fp.yaw -= (e.clientX - down.x) * 0.005; fp.pitch = clamp(fp.pitch - (e.clientY - down.y) * 0.004, -1.2, 1.2); down = { x: e.clientX, y: e.clientY }; dirty = true; });
  const up = () => { down = null; }; el.addEventListener("pointerup", up); el.addEventListener("pointercancel", up);
}

/* ---------------- loop: draw only when something moved ---------------- */
let last = 0, drawn = 0, slow = 0, builtAt = 0;
function refresh() {
  pending = false;
  if (buildStatic()) builtAt = performance.now();
  bakeLights(); updateFog(); syncTokens();
  const size = S.map.size, key = size ? `${size.cols}x${size.rows}` : "default";
  if (framedFor !== key) { const grew = size?.grown && framedFor && framedFor !== "default"; framedFor = key; if (!grew) frameMap(); }   // a new map re-frames; one grown by drawing does not
  dirty = true;
}
function loop(now) {
  raf = requestAnimationFrame(loop);
  const gap = now - last, dt = Math.min(0.05, gap / 1000); last = now;
  applyTime();
  if (pending) refresh();
  for (const a of anims) a();
  let moving = false;
  for (const { d, mesh, i } of leaves) {
    const to = doorOpen(d.id) ? 1 : 0, at = swings.get(d.id) || 0;
    if (at === to) continue;
    swings.set(d.id, Math.abs(to - at) < 0.01 ? to : at + (to - at) * Math.min(1, dt * 9));
    mesh.setMatrixAt(i, doorMatrix(d, WALL_H)); mesh.instanceMatrix.needsUpdate = true; moving = true;
  }
  if (moving) renderer.shadowMap.needsUpdate = true;
  if (easeFog(dt)) moving = true;
  let carried = 0;
  for (const [id, e] of tokens) {
    const t = S.tokens[id];
    if (!t?.torch || !here(t) || t.hidden || carried >= 12) continue;
    U3.uCarry.value[carried++].set(e.group.position.x, e.group.position.z, 5.5, 3);
  }
  for (; carried < 12; carried++) U3.uCarry.value[carried].w = 0;
  for (const [id, e] of tokens) {
    const t = S.tokens[id]; if (!t) continue;
    const p = e.drag || t, tx = p.x / U, tz = p.y / U, pos = e.group.position, far = Math.hypot(tx - pos.x, tz - pos.z);
    if (far > 0.002) {
      const k = id === walkingId || e.drag || far > 4 ? 1 : Math.min(1, dt * 12); // others glide between network updates
      pos.x += (tx - pos.x) * k; pos.z += (tz - pos.z) * k; pos.y = e.base + (far > 0.01 && k < 1 ? Math.abs(Math.sin(now / 70)) * 0.04 : 0); moving = true;
    } else if (pos.y !== e.base) { pos.y = e.base; moving = true; }
    e.group.visible = !(fp?.id === id);
  }
  if (fp) { const t = S.tokens[fp.id]; if (!t) setFirstPerson(null); else { camera.position.lerp(new THREE.Vector3(t.x / U, 0.85, t.y / U), 0.35); camera.rotation.set(fp.pitch, fp.yaw, 0, "YXZ"); moving = true; } }
  const changed = !fp && controls.update();
  syncFlat();
  const flame = Q.flicker && data?.lights.length && now - drawn >= 32;
  if (!(dirty || moving || changed || anims.size || flame)) return;
  if (choice === "auto" && level !== "low" && document.hasFocus() && now - builtAt > 2500 && gap < 1000) {
    slow = Math.max(0, slow + (gap > 100 ? 8 : gap > 36 ? 1 : -1));
    if (slow > 45) { slow = 0; setLevel(level === "high" ? "medium" : "low"); return; }
  }
  U3.uTime.value = now / 1000;
  const reach = fp ? 14 : camera.position.distanceTo(controls.target);
  scene.fog.near = reach; scene.fog.far = reach * 2.8; U3.uPx.value = renderer.domElement.height;
  renderer.render(scene, camera);
  dirty = false; drawn = now;
  host.dataset.stats = `${level} ${renderer.info.render.calls} draws ${Math.round(renderer.info.render.triangles / 1000)}k tris`;
}

export function open() {
  if (!renderer) init();
  host.hidden = false; resize(); pending = true; builtAt = performance.now();
  S.refresh3d = () => { pending = true; };
  if (!raf) raf = requestAnimationFrame(loop);
}
export function close() { if (!host) return; if (fp) setFirstPerson(null); clearSelection(); host.hidden = true; cancelAnimationFrame(raf); raf = 0; S.refresh3d = null; }
