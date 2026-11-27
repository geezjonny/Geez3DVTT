# Changelog

What changed in Geez3DVTT, newest first.

## 2026-11-26

### Table (`index.html`, GM link `gm.html`)
- **The viewer is now a shared table**, built on the GeezSheets table code, with Firebase as the source of truth. Run it with `serve.cmd`; it no longer opens by double-clicking the file.
- **Separate GM and player pages:** `gm.html` for the GM, `index.html` for players. A player link can name the character (`?char=lark`).
- **Smooth free movement** for players with WASD or the arrow keys: walls, closed doors and windows stop you, and stairs, ladders and portals take you between floors.
- **3D only.** The flat map is gone; a top-down view replaces it when you ask for it.
- **All floors are drawn together**; only the floor you are on gets lights and shadows.
- Fog of war with party sight, fading smoothly, with seen areas remembered per floor.
- `.dd2vtt` import (windows come in as windows, doors keep their exact place), editing by right-click, weather, time of day, 3D dice, ping and ruler.
- **Tokens are round:** a base on the ground with the picture floating above it, and the picture on the base in top-down. The view no longer follows your token.
- Not there yet: no hosted player link, and rolls made in `companion.html` do not show on this table.

### Controls
- **GeezVTT-style floating toolbars** (VTT, Build, Initiative, Scene Controls) replace the top bar and menus, in one visual style. Windows can be resized and their contents scale.
- **Initiative is one row:** Start/End, the next four turns, and Next.
- **Scene Controls:** new scene, load and import a battlemap or scene, save the map as a file, save the scene.
- **Removed:** journal, audio, the View menu, the Build Tools window, explore and reset-explored, reference, orbit and marks buttons.
- **Right-click** opens a token menu or object menu (never the browser's menu, and it no longer draws walls). Menus close when you click elsewhere.

### Building
- **Build in the angled view:** drawing no longer switches you to top-down.
- **Walls now land on the floor you are viewing.**
- **Draw past the map's edge:** floors, walls and doors can go outside an imported map, and the map grows to fit.
- **Drawn floors show over the map picture.**
- **Select, Ruler and Ping** put the build tool away.
- **Token pictures** can be picked from `/Token` again, and a token named like a picture gets it automatically.
- **Traps and triggers** are back, as a button in Build Controls.

### 3D map viewer
- **New:** open or drop a `.dd2vtt` map and it stands up in 3D, with the map art on the floor and its walls, doors, windows and lights.
- **Dark fantasy look:** broken mossy stone, spired pillars, iron-banded doors, torches and braziers with embers, moonlight against firelight, and fog.
- All models are built in code, so there are no model or texture files to download.
- **Runs on weak and strong machines:** Low, Medium, High and Auto quality. Auto steps down by itself when frames are slow, including on very slow machines.
