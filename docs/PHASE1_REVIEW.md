# Phase 1: The World (review)

## Implemented
- **Island:** a rounded superellipse with noise-driven coves and headlands. Terraces step down to a beach ring and the sea. The base plateau is in the centre (45×45, starter plot 24×24).
- **Water:** the shader reads a height texture baked from the terrain, giving turquoise shallows, a mid-blue shelf, deep blue offshore, a white foam lip, and foam bands that roll in toward the beach.
- **Tropical flora:** rain trees, Tembusu-style tall trees, palms (coast-biased), banana plants, ferns, bougainvillea, flowers and grass tufts. Conifers grow only on high terraces. All plants are instanced and sway in the wind.
- **Cloud shadows:** soft, shader-based, drifting across land and sea (no geometry, so they never block the view).
- **Seagulls:** three small flocks circling, with flapping wings.
- **Palette:** updated to the approved SAF camp colours. The greybox HQ now uses cream walls, a red-brown roof and green trim.

## Refinement pass (review feedback)
- **Decorations in the wild areas:** lalang grass patches, bamboo stands, fallen logs and stumps, driftwood on the beaches, rocks in the shallows, rocks and shrubs on cliff faces, reeds on the lake banks, and lily pads on the lakes.
- **Deep jungle:** noise-driven patches of closed canopy (one to two trees per tile, with fern and bush undergrowth).
- **Hidden late-game sites** (`WORLD.hiddenSites`): three flat terraces (`ridge`, `lakeside`, `cove`), each buried under the same deep-jungle mix used elsewhere, so nothing gives them away. Each site's plants are in their own group (`vegetation.sites[id]`) and can be cleared later. The only way to preview one is the dev console call `__outpost.clearSite('ridge')`; there is no UI for it.
  - Suggested late-game uses (to confirm in Phase 6): **ridge** → Signal Station / radar (wider early warning against raids), **cove** → Boat Jetty (supply boats, later sea raids), **lakeside** → Adventure Training Centre (morale and unit training).
  - Suggested reveal: a mid/late "Jungle Clearance" objective that is announced only when unlocked, with a felling and dust animation.

## Jungle clearance (review feedback)
- **Opening state:** the player starts with a **22×22 clearing** (`start`). The rest of the 44×44 plateau is deep jungle, split into **12 clearance zones of 11×11** (rows A–D, columns 1–4).
  - **Tier 1** (8 zones, edge-adjacent to the start) can be cleared early.
  - **Tier 2** (4 corners) needs a neighbouring zone cleared first.
- **Hidden sites:** 3 × 9×9, tier 3 (late game, never shown before unlock).
- **Totals:** 484 start + 1452 jungle + 243 special = **2179 buildable tiles**.
- **Data model:** zones are defined as data in `src/world/zones.ts`. Each zone's jungle is its own vegetation group (`vegetation.clearables[id]`), ready for the Phase 4/6 clearance gameplay (cost, recruits working, felling animation).
- **Plan view:** the **Plan (P)** overlay shows every zone with labels and a legend. It's a design tool for now; it becomes the in-game Expand view later, without the hidden sites.

## Land clearance with contractor crews (review feedback)
Full design: [`CLEARANCE_DESIGN.md`](CLEARANCE_DESIGN.md).
- Click a yellow jungle zone and choose **Start clearing**. A contractor crew sets up a site and works through the zone tile by tile over the timer: felling, then hauling, then grading, then regrowth.
- Machines: excavator, bulldozer and log truck. Crew: 2 chainsaw operators, a flagman, a supervisor and a labourer. The site has barriers, cones, a sign, a portacabin, a toilet, a generator, a floodlight and a growing log pile.
- Escalating pacing: 2 h for the first zone, up to 3.5 days for the last jungle zone, then 4–6 days for the hidden sites. One crew means one job at a time.
- **Preview speed** control (1×–3600×) for reviewing long timers.

## Not in this phase
- The waterfall and the dirt track, moved to Phase 4 alongside roads.
- Ambient sound, planned for Phase 9.
