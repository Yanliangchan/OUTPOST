# OUTPOST — Phase 0: Audit & Design Specification

Status: **awaiting approval.** Items marked ❓ need your decision.

---

## 1. Repository audit

| Item | Finding |
|---|---|
| Existing code / assets | None. Empty repo, no commits. The brief arrived as a chat message and the reference image as an upload (saved to `docs/reference/visual-reference.png`). |
| Framework | None, so I chose one (see §2). |
| Save / deploy needs | Local saves for now. The save format will be versioned, serialisable JSON so a server can be added later for PvP. |

## 2. Framework decision: **Three.js + TypeScript + Vite** (web)

| | Three.js (web) ✅ | Godot 4 | Unity |
|---|---|---|---|
| Real-time 3D, shadows, instancing | Yes | Yes | Yes |
| I can run it and screenshot it in this environment | **Yes** (headless Chromium) | Hard | No |
| You can play it from a link on any device | **Yes** | Needs an export | Needs an export |
| Future PvP backend | Same language end to end (TS server) | Separate | Separate |
| Size / dependencies | Tiny (three, vite, typescript) | Large engine | Large engine |

Trade-off: we don't get an engine editor, so content is built procedurally or as `.glb` models. That fits a low-poly style well.

## 3. Architecture (modular, data-driven)

```
src/
  config/      palette.ts, world.ts (all tunables)        ← Phase 0 ✅
  core/        rng/noise, cameraRig, wind/time uniforms     ← Phase 0 ✅
  world/       terrain, water, vegetation, lighting         ← Phase 0 ✅
  ui/          HUD (DOM overlay, not canvas)                ← Phase 0 ✅
  buildings/   catalogue data, mesh builders, placement     ← Phase 2/4
  agents/      residents, vehicles, pathfinding (grid A*)   ← Phase 3/5
  sim/         needs, routines, events, economy            ← Phase 5/6
  combat/      defences, units, AI raids, battle sim        ← Phase 7/8
  save/        versioned JSON save/load                     ← Phase 4 onward
```
- **Fixed-tick deterministic simulation**, kept separate from rendering. This makes save/load reliable, and later it lets a server replay or validate PvP battles.
- Buildings, units and upgrades are **data entries** (stats, footprint, cost, mesh builder id), so adding a building needs no placement code.
- Repeated objects use `InstancedMesh`. Phase 0 draws about 300k triangles in 15 draw calls.

## 4. Genre references: what we borrow

| Game | Take | Avoid |
|---|---|---|
| **Clash of Clans** | Chunky, readable buildings; the satisfying build → timer → upgrade pop; the HQ gates the tech tree; clearable obstacles (trees and rocks give resources) | Long paywall timers and gem pressure |
| **Boom Beach** | Closest tonal match: a tropical island, cheerful military theme, PvE enemy bases, cartoon explosions | Its grimness at higher levels |
| **Rise of Kingdoms** | Large world beyond your base, districts, the sense of a growing city | 4X complexity, alliances |
| **Hay Day / Township** | Delivery vehicles, production chains kept very simple, cosy ambient life | Order-board grind |
| **The Sims / Two Point Hospital** | Residents with needs, little thought bubbles, facilities that visibly get used | Micromanaging individuals |
| **Townscaper / Islanders** | Tactile placement, soft diorama lighting, the joy of just placing things | — |
| **Your reference image** | Lime faceted grass, beige faceted cliffs, conifers, ponds, buildings on concrete pads ringed by sandbags, crates and drums as clutter, ~35° camera | Its blue-everything assets |

## 5. Visual style guide

**Look:** a stylised low-poly miniature diorama. Flat-shaded facets, bright saturated grass, pale angular cliffs, soft warm sun from the upper left (shadows fall down-right, as in the reference).

**Rules**
1. **Silhouette first.** Every building is identifiable from its shape at the furthest zoom.
2. **Colour = function.** Each building category gets one accent colour (roofs, doors, signage); the bulk is warm concrete or off-white.
3. **Restraint with green.** The terrain owns green. Buildings use concrete, khaki and wood with coloured accents, never camo. Olive appears only on vehicles and uniforms.
4. **Detail budget.** Small, chunky props (crates, drums, sandbags, noticeboards) cluster around buildings. No surface texturing; colour and geometry only.
5. **Concrete pads.** Every building sits on a light concrete pad, as in the reference. This frames footprints and hides the terrain's micro-facets.

### Palette (`src/config/palette.ts`)

| Role | Colours |
|---|---|
| Grass | `#9bdb4d` lime · `#86cf40` bright · `#5fae34` deep |
| Cliff / rock | `#e6dabd` · `#d6c7a6` · `#a99a7e` |
| Water | `#2fb5c8` sea · `#55d6d0` shallow · sand `#ecd9a0` |
| Trees | pines `#3fae3c` `#2f9a39` `#56c043`; broadleaf `#4fae3a` `#6cc244`; trunk `#8a5a3b` |
| Buildings | concrete `#cfcac0` · warm concrete `#d9d2c3` · off-white `#f2efe6` · khaki `#c2b280` · wood `#b07a4a` |
| Accents (by function) | teal `#3e9c94` (living/admin) · orange `#e98a3c` (food/rec) · yellow `#ffc93c` (logistics/hazard markings) · utility green `#5b7a3a` (vehicles) |
| UI | panel `rgba(255,255,252,.92)` · ink `#26332a` · accent green `#3f9b4a` · highlight `#ffc93c` · font **Nunito** (rounded, friendly) |

## 6. Camera specification

| Property | Value |
|---|---|
| Projection | Orthographic (crisp, no perspective distortion, best for grid building) |
| Pitch | 38° (reference ≈ 35°; slightly steeper for footprint readability) |
| Yaw | 45° diamond view; **Q/E rotates in 90° steps**, smoothed |
| Zoom | 0.55× (whole region) → 2.6× (individual residents); smooth, zooms toward the cursor |
| Pan | Drag (any mouse button), WASD/arrows; clamped to ±42 tiles around the base |
| Later | Touch pinch/drag (Phase 7), edge-scroll option, focus-on-building |

## 7. Scale specification (greybox: press **B** in the prototype)

- **1 tile = 1 world unit ≈ 2.5 m.** All placement snaps to tiles.
- Resident ≈ 0.6 tall (exaggerated about 1.4× for readability).
- HQ footprint 5×5; small buildings 2×2 or 3×3; large 4×4 or 4×6; vehicles about 2×1.
- Map: a 45×45 flat plateau. The **starter plot is 24×24** (yellow outline, press **G**), and the rest unlocks through expansions. Hills, lakes and coast around it become later "districts" or outfield areas.

## 8. Naming: subtle SAF ❓ *Please mark up this table*

Principle: plain-language names, with SAF flavour where the familiar term is also clear to a non-NS player.

| Generic (brief) | Proposed OUTPOST name | Note |
|---|---|---|
| Town Hall | **HQ** | Gates the tech tree, like the CoC Town Hall |
| Accommodation Block | **Bunk** (Bunk Block) | Houses residents |
| Dining Hall | **Cookhouse** | Food need; queue events |
| Supply Depot | **QM Store** *or* Supply Depot | Stores Supplies; deliveries arrive here |
| Workshop | **Workshop** | Produces Supplies / repairs |
| Utility Building | **Utilities** (power + water) | |
| Recreation Centre | **Rec Centre** | Morale |
| — (new) | **Mama Shop** | Small provision-shop kiosk; morale + tiny income. A detail NS boys will smile at |
| Medical Station | **Medical Centre** | Recovery; heals units after raids |
| Training Ground | **Parade Square** (fall-in events) + **Obstacle Course** | |
| Vehicle Garage | **Motor Pool** (or "MT Line") | Delivery and utility vehicles |
| Guard post | **Guardhouse** + boom gate | The camp entrance |
| — (new) | **Fitness Corner**, **Link-way** (covered walkway), **Water Point** | Cheap decor-plus-buff pieces |
| Residents | **Crew**? Recruits? Personnel? ❓ | |
| Enemy (combat) | **OPFOR** | Exercise term; cartoon enemies |

Resources stay as briefed: **Supplies**, **Reputation** (unlocks), **Morale** (efficiency). Combat may later add one resource, only if it's needed.

## 9. Initial asset list

**Phase 1 (world):** terrain (done) · lakes (done) · pine, rain tree, tall tree, palm, bush (done) · rocks, boulders, grass tufts, flowers (done) · *to add:* a waterfall, a dirt track up to the plateau, drifting cloud shadows, birds.

**Phase 2 (architecture):** the 10 core buildings (§8), each with 3 upgrade looks · concrete pads · sandbag walls · covered link-way · flagpole (plain, no real flag) · noticeboard · crates, drums, pallets · boom gate · street lamp.
Vehicles: utility truck (green), supply lorry, jeep-style runabout, forklift.

**Phase 7+ (combat, art planned now so the style stays consistent):** Sentry Tower, Sandbag Wall, Mortar Pit, Searchlight, Artillery Emplacement · troops (Rifleman, Scout, Heavy, Engineer, Medic) · Armoured Car · OPFOR camps reusing the same kit in a red-and-grey palette.

## 10. Revised phase plan

| # | Phase | Notes |
|---|---|---|
| 0 | Audit & spec + world prototype | **This delivery** |
| 1 | The World | Polish terrain, add waterfall, track, clouds, ambient sound |
| 2 | Architecture & assets | Buildings and vehicles showcase |
| 3 | Characters & activity | Residents, walk cycles, ambient routes |
| 4 | Construction gameplay | Catalogue, place, rotate, validate, upgrade, costs, **save** |
| 5 | Living simulation | Needs, routines, events |
| 6 | Progression | HQ levels, unlocks, objectives, plot expansion |
| **7** | **Defence** *(new)* | Defensive buildings; PvE OPFOR raids attack your outpost |
| **8** | **Raids** *(new)* | Train units; attack AI-generated OPFOR camps; loot |
| 9 | Polish | UI, SFX, VFX, touch controls |
| 10 | Reliability & release | Performance, saves, docs. A PvP-ready data layer (server later) |

## 11. Open questions ❓

1. **Naming table (§8).** Keep, change or remove which names? And what should residents be called?
2. **World shape.** Landmass with lakes, as in your reference (current), *or* a Boom Beach-style island fully ringed by sea?
3. **Trees.** A mix of conifers (reference) and tropical trees (current), *or* all tropical (rain trees and palms, more Singaporean)?
4. **Building accent colours.** Teal/orange/yellow by function (proposed), *or* a single camp colour?
5. **Timers.** CoC-style build timers (short ones, no premium currency), *or* instant building with an animation?
