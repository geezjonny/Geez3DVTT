import { read, put, patch } from "../store.js";
import { S } from "./state.js";
import { floatWindow, toolbar, dropMenu, svg } from "./ui.js";
import { buildFile, restorePlan, imageIds } from "./scenefile.js";
import { exportGeezMap } from "./geezmap-export.js";

const STYLE_ID = "scene-style";
let saveWin = null, toastTimer = null;

function installStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style"); style.id = STYLE_ID;
  style.textContent = `
    #toast.show { display: block; }
    #win-scene-save .scene-form { display: grid; gap: .55rem; min-width: 15rem; }
    #win-scene-save input { box-sizing: border-box; width: 100%; }
    #win-scene-save .scene-actions { display: flex; justify-content: flex-end; gap: .45rem; }
  `;
  document.head.append(style);
}

function toast(message) {
  const el = document.querySelector("#toast"); if (!el) return;
  clearTimeout(toastTimer); el.textContent = message; el.classList.add("show");
  toastTimer = setTimeout(() => el.classList.remove("show"), 2500);
}

function sceneId(name) {
  const id = name.trim().toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return id || "scene";
}

const PARTS = ["map", "objects", "tokens", "groups", "initiative", "mapimg", "atmosphere"];   // map holds every floor
async function snapshot() {
  const values = await Promise.all(PARTS.map((p) => read(p)));
  return Object.fromEntries(PARTS.map((p, i) => [p, values[i]]));
}
const keepInLibrary = (name, data) => put(`scenes/${sceneId(name)}`, { name, ts: Date.now(), data });

// kind "map" -> <name>.geezmap, "scene" -> <name>.geezscene
async function download(kind, name, snap) {
  const images = {};
  for (const id of imageIds(snap.mapimg)) images[id] = await read(`mapimgs/${id}`);
  const outer = kind === "map" ? exportGeezMap({ name, map: snap.map || {}, objects: snap.objects || {}, atmosphere: snap.atmosphere || {} }) : {};
  const file = `${name.replace(/[\\/:*?"<>|]+/g, "_")}.geez${kind}`;
  const a = Object.assign(document.createElement("a"), { download: file, href: URL.createObjectURL(new Blob([JSON.stringify(buildFile(kind, name, snap, images, outer))], { type: "application/json" })) });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return file;
}

// A .geezmap or .geezscene picked in Import. False when it is some other kind of file.
export async function restoreFile(json) {
  const plan = restorePlan(json); if (!plan) return false;
  const before = await snapshot(), backup = `Before import ${new Date().toLocaleString()}`;
  await keepInLibrary(backup, before);
  for (const [id, chunks] of Object.entries(plan.images)) await put(`mapimgs/${id}`, chunks);
  await patch({ ...plan.changes, seeded: true, scene: { id: sceneId(plan.name), name: plan.name } });
  toast(`Loaded ${plan.name}. The previous table is saved under Load > Scene.`);
  return true;
}

function makeSaveWindow() {
  if (saveWin) return saveWin;
  saveWin = floatWindow({ id: "scene-save", title: "Save Scene", x: 300, y: 160 });
  saveWin.body.innerHTML = `<form class="scene-form"><label>Scene name<input name="name" type="text" maxlength="80" required autocomplete="off"></label><div class="scene-actions"><button type="button" data-cancel>Cancel</button><button type="submit">Save</button></div></form>`;
  const form = saveWin.body.querySelector("form"), input = form.elements.name;
  form.addEventListener("submit", async (e) => {
    e.preventDefault(); const name = input.value.trim(); if (!name) return input.focus();
    try {
      const data = await snapshot();
      await keepInLibrary(name, data);
      await put("scene", { id: sceneId(name), name });
      const file = await download("scene", name, data);
      saveWin.hide(); input.value = ""; toast(`Saved ${file}, also under Load > Scene`);
    } catch (err) { console.warn("Scene not saved", err); toast(`Not saved: ${err.message}`); }
  });
  form.querySelector("[data-cancel]").addEventListener("click", () => saveWin.hide());
  return saveWin;
}

function openSave() {
  const win = makeSaveWindow(); win.show(); win.body.querySelector("input").focus();
}

async function loadScene(id, scene) {
  const data = scene?.data || {};
  await Promise.all([
    put("map", data.map || {}), put("objects", data.objects || {}),
    put("tokens", data.tokens || {}), put("groups", data.groups || {}), put("initiative", data.initiative || null), put("mapimg", data.mapimg || null), put("seeded", true),
  ]);
  if (data.atmosphere) await patch({ atmosphere: data.atmosphere });
  await put("scene", { id, name: scene.name || id });
  toast(`Loaded scene: ${scene.name || id}`);
}

async function duplicateScene(id, scene) {
  const name = `${scene.name || id} (copy)`, copyId = sceneId(name);
  await put(`scenes/${copyId}`, { ...scene, name, ts: Date.now() });
  toast(`Duplicated scene: ${name}`);
}

function deleteMenu(anchor, id, scene) {
  const name = scene.name || id;
  dropMenu(anchor, [[`Really delete ${name}?`, async () => { await put(`scenes/${id}`, null); toast(`Deleted scene: ${name}`); }], ["Cancel", null]]);
}

async function openLoad(anchor) {
  const scenes = await read("scenes") || {};
  const entries = Object.entries(scenes).filter(([, scene]) => scene && scene.data).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
  const items = [["Load replaces the current map", null], ...entries.map(([id, scene]) => [`Load: ${scene.name || id}`, () => loadScene(id, scene)]), ["Delete…", null], ...entries.map(([id, scene]) => [`Delete: ${scene.name || id}`, () => deleteMenu(anchor, id, scene)])];
  if (entries.length) items.splice(2 + entries.length, 0, ["Duplicate...", null], ...entries.map(([id, scene]) => [`Copy: ${scene.name || id}`, () => duplicateScene(id, scene)]));
  if (!entries.length) items.push(["No saved scenes", null]);
  dropMenu(anchor, items);
}

// New Scene: the current one is kept as "Before new scene <time>" (so Load brings it back), then everything starts empty.
function openNew(anchor) {
  dropMenu(anchor, [["Start a new empty scene?", null], ["Yes, new scene (current one is saved first)", async () => {
    const data = await snapshot(), { map, objects, tokens } = data;
    if (Object.keys(map?.walls || {}).length || Object.keys(map?.floors || {}).length || Object.keys(objects || {}).length || Object.keys(tokens || {}).length) await keepInLibrary(`Before new scene ${new Date().toLocaleString()}`, data);
    await Promise.all(["map", "objects", "tokens", "groups", "initiative", "mapimg", "scene"].map((p) => put(p, null)));
    await put("seeded", true); toast("New scene");
  }], ["Cancel", null]]);
}

// GeezVTT's Scene Controls: New, Load, Import, Save Map, Save Scene.
export function initScenes() {
  if (!S.isGM) return;
  installStyle();
  const bar = toolbar("scene", "Scene Controls", 510).body, maps = () => import("./dd2vtt.js");
  const add = (title, icon, onClick) => {
    const b = Object.assign(document.createElement("button"), { type: "button", className: "barbtn", title, innerHTML: svg(icon) });
    b.setAttribute("aria-label", title); b.addEventListener("click", () => onClick(b)); bar.append(b);
  };
  add("New blank scene", '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 7v10M7 12h10"/>', openNew);
  add("Load", '<path d="M3 8V4h7l2 3h9v3M3 8h18l-3 12H3Z"/>', (b) => dropMenu(b, [["Battlemap", async () => (await maps()).loadLibraryMap(b)], ["Scene", () => openLoad(b)]]));
  add("Import", '<path d="M12 3v12m-5-5 5 5 5-5M3 15v6h18v-6"/>', (b) => dropMenu(b, [["Battlemap", async () => (await maps()).importMapFile()], ["Scene", async () => (await maps()).importSceneFile(b)]]));
  add("Save Map", '<path d="M3 3h15l3 3v15H3ZM7 3v6h10V3M7 21v-8h10v8M10 15h4"/>', async () => { try { const snap = await snapshot(); toast(`Saved ${await download("map", (await read("scene/name")) || "map", snap)}`); } catch (e) { console.warn("Map not saved", e); toast(`Not saved: ${e.message}`); } });
  add("Save Scene", '<path d="M3 3h15l3 3v15H3ZM7 3v6h10V3M7 21v-8h10v8M10 15l4 3m0-3-4 3"/>', openSave);
}
