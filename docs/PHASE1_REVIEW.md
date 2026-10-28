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

## Not in this phase
- The waterfall and the dirt track, moved to Phase 4 alongside roads.
- Ambient sound, planned for Phase 9.
