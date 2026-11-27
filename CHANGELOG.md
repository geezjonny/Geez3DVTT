# Changelog

What changed in Geez3DVTT, newest first.

## 2026-11-26

### Table (`index.html`, GM link `gm.html`)
- **The viewer is now a shared table**, built on the GeezSheets table code, with Firebase as the source of truth. Run it with `serve.cmd`; it no longer opens by double-clicking the file.
- **Separate GM and player sides.** A player link can name the character (`?char=lark`).
- **Smooth free movement** for players with WASD or the arrow keys: walls, closed doors and windows stop you, and stairs, ladders and portals take you between floors.
- **3D only.** The flat map is gone; a locked top-down view replaces it, and build, drawing and aiming tools work there.
- **All floors are drawn together**; only the floor you are on gets lights and shadows.
- Fog of war with party sight, fading smoothly, with seen areas remembered per floor.
- `.dd2vtt` import (windows come in as windows, doors keep their exact place), editing by right-click, weather, time of day, 3D dice, ping, ruler and handouts.
- **Tokens are round:** a base on the ground with the picture floating above it, and the picture on the base in top-down. The view no longer follows your token.
- Players have no audio menu; they still hear what the GM plays.
- Still included from the old table and not yet trimmed: attacks, inventory, effects, initiative, journal and other extras.
- Not there yet: no hosted player link, and rolls made in `companion.html` do not show on this table.

### 3D map viewer
- **New:** open or drop a `.dd2vtt` map and it stands up in 3D, with the map art on the floor and its walls, doors, windows and lights.
- **Dark fantasy look:** broken mossy stone, spired pillars, iron-banded doors, torches and braziers with embers, moonlight against firelight, and fog.
- All models are built in code, so there are no model or texture files to download.
- **Runs on weak and strong machines:** Low, Medium, High and Auto quality. Auto steps down by itself when frames are slow, including on very slow machines.
