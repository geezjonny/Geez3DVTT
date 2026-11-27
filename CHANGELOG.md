# Changelog

What changed in Geez3DVTT, newest first.

## 2026-11-27

### Token minis (optional)
- **Minis move:** they walk the way they are going, swing when an attack lands and flinch when HP drops.
- **Attack effects** for every token: a slash for weapons, a flash for spells and cantrips, and a small camera shake
  (off if the system asks for reduced motion). Player rolls reach the table while the GM page is open.
- **Emote** (right-click your token): speech bubbles on any token; for minis, wave, cheer, dance, bow, point, yes, no,
  laugh, shrug, facepalm, jump, flex, cry, fart, and sit or sleep until you move.
- **Blockfolk heroes can stand on tokens:** right-click a token, **3D mini…**, and pick a saved hero or paste its code.
  Pictures stay the default, top-down still shows them, and **Remove mini** switches back.
- **The Blockfolk character creator** is included as `blockfolk.html`.

### Doors
- **A drag makes one door** as long as the drag, instead of a row of one-square doors. Windows work the same way.
- **Iron doors draw as iron**, including ones already placed with the iron material.
- **Every door type has its own 3D model:** riveted iron, two-leaf double doors, a portcullis that lifts, a swinging barred
  gate (it no longer lifts), a stepped arch, a curtain that draws aside, and slabs for stone, brick and other materials.

### Stealth (optional)
- **Stealth mode** is a GM switch (crossed-out eye in VTT Controls); nothing changes while it is off.
- Right-click an NPC token and **Tag as guard**. Guards patrol points you set, sweep, open unlocked doors, see in a
  cone that walls block (shorter in the dark), and walk over to footsteps they hear.
- A seen character and the guard both stop; you rule **Not seen**, **Investigate** or **Keep stopped**.
- Players **sneak** (C: slower, quieter, rolls Stealth) and **listen** (Q: rolls Perception, rings show guards heard).

### Loot, traps and effects
- **Loot** (chest icon on `gm.html`): roll coins and items by tier, then give them to a character's sheet.
- **Every trap and trigger has its own low-poly model** that shows its state, instead of a symbol on the floor. The GM
  sees hidden ones faded.
- **Prop effects:** right-click a prop to add or remove glow, fire or fairy particles.

### Scenes and testing
- The Alarus grounds scene is saved in `scene/`, ready to Import.
- Tried at the table and working: companion rolls, roll call and first person.

### Player view
- **"Who are you?"** Players pick their character when they open the page (a `?char=` link skips it). Nothing moves
  until they choose, and the list retries by itself if the characters are slow to load.
- **One wall height for the table:** the GM's Walls slider sets it for everyone; players no longer have their own.
- **Voice and video are gone from the table;** use Discord.
- **First person:** the eye button on the player page. Drag to look around, walk with WASD, turn with the arrows.
  Floors above are ceilings; where there is none you see higher floors and a sky that follows the time of day.
- **The view stays centred on your token** as it moves, keeping your zoom and angle.
- **View sheet is back** on a character's right-click menu, opening the companion in a floating window.
- Players can no longer use levers, buttons, dials or doors through walls, closed doors or floors.

### Building
- **Cut picture** (Floors window) removes squares from a floor's map picture so the floor below shows through; Restore
  puts them back.
- **A new wall replaces doors and windows under it, and a new door or window cuts the wall,** including on imported maps.
- **Duplicate** on the right-click menu of tokens, doors, lights, traps and props.
- **Drag props, levers and traps** to new squares.
- **The GM can switch a light on or off** by clicking it or from its right-click menu.

### Battlemaps
- Alaris Castle (full) is saved in the new `.geezmap` format, in `battlemap/`.

### Saving
- **Save Map** writes a `.geezmap` with everything except tokens and initiative; **Save Scene** writes a `.geezscene`
  with them too. Import loads either one exactly, keeping a copy of the table it replaces.

## 2026-11-26

### Rolls and players
- **Rolls made in `companion.html` now show on the table,** on the GM and player pages.
- **Roll call has a button** (the megaphone in VTT Controls). It reaches the called characters' companions, brings their
  results back and adds initiative results to the order.
- **Disable movement:** the GM can right-click a token to stop its player walking it.
- A player's right-click on a character no longer offers Inventory, Equipment or View sheet; those are in the companion.

### Props
- **Every prop now has its own low-poly model** instead of a plain box, decals included. They are built in code, so there
  is still nothing extra to download.
- Glowing props (obelisks, torches, braziers, rune circles and the like) can be switched off and on.

### Levers, traps and connections
- **Lever, button, plate and tripwire** have their own row in the Props window and show their state in 3D.
- **Connect them by right-clicking:** Connect, click a door, light, wall, prop or trap, then pick what it does: toggle
  open, lock, light, activate or visibility. Disconnect and Connections change it later.
- **Hidden walls** stop blocking movement and sight, for secret passages. The GM sees a faint outline and can show them again.
- **Stepping on a hidden plate or tripwire reveals it.** Plates and tripwires now only react to tokens on their own floor.
- **Players use levers, buttons, dials and doors with right-click > Interact**; their left-click no longer does.

### Initiative
- **Tokens snap to the grid** when they join initiative, and again when combat starts.

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
