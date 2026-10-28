# Placement and overlap: design

Built in Phase 4 (construction gameplay). Based on Clash of Clans, Boom Beach, Hay Day, Rise of Kingdoms and The Sims.

## 1. Ground overlap: one occupancy grid
- **Tile map:** the plateau is one tile grid (1 tile = 1 unit). Each tile holds one owner: `free`, `building:<id>`, `road`, `decor`, `obstacle` (trees and rocks to clear), `jungle` (uncleared zone) or `blocked` (cliff or water).
- **Footprints:** every building has a fixed footprint (HQ 6×6, Bunk 6×4, Cookhouse 5×4…) that is **the same at every level**, so upgrades never cause overlap. Rotation is in 90° steps and swaps width and depth.
- **Valid placement:** every footprint tile must be cleared, flat and free.
- **Touching allowed:** buildings may touch, as in Clash of Clans.
- **Entrance tile:** each building has one tile in front of its door. It must be free or road, and reachable on foot from the HQ (checked with a flood fill), so Recruits can always get in.
- **Ghost preview:** footprint tiles show green when valid and red when blocked, the entrance tile is marked with an arrow, and a short reason is shown when blocked: *"Overlaps Bunk"*, *"Jungle not cleared"*, *"Entrance blocked"*.
- **Move mode:** picking a building up frees its tiles; dropping it re-checks them. If the drop isn't valid, the building snaps back. A full layout editor (rearrange everything, save layouts) comes later.
- **Obstacles:** trees and rocks occupy tiles until cleared.

## 2. Visual overlap: nothing pokes over a neighbour
- **Pad = footprint:** every model stays inside its kerbed concrete pad (only small roof overhangs pass the kerb), so adjacent buildings never clip into each other.
- **Height budget:** a building's bulk stays within about 4 storeys; only thin elements (masts, flags, spires) go higher.
- **Select by tile:** clicking a tile picks the building that owns it, never the mesh, so partly hidden buildings are always selectable.
- **Fading what's in front:** buildings standing in front of the hovered, selected or placed building fade to semi-transparent.
- **Camera rotation:** Q/E rotates the view in 90° steps to see behind things.

## 3. Roads
Roads are **optional**. They speed up walking (and vehicles in later phases) and keep layouts tidy, but no building requires a road connection.
