// OUTPOST master palette (draft — pending reference image review).
// Every material in the game should pull from here so the world stays cohesive.
export const PALETTE = {
  // Terrain
  grassLime: '#9bdb4d',
  grassBright: '#86cf40',
  grassDeep: '#5fae34',
  grassForest: '#3f8a2e',
  olive: '#7a8a3a',
  sand: '#ecd9a0',
  sandWet: '#d8c084',
  cliffLight: '#e6dabd',
  cliffMid: '#d6c7a6',
  cliffDark: '#a99a7e',
  rock: '#d6c9ad',
  rockDark: '#bfb091',

  // Water
  waterShallow: '#55d6d0',
  water: '#2fb5c8',
  waterDeep: '#1d7f9e',
  seabedShallow: '#e6d7a2',
  seabedDeep: '#2a8a9a',

  // Vegetation
  trunk: '#8a5a3b',
  trunkPalm: '#a77a4f',
  leafA: '#4fae3a',
  pineA: '#3fae3c',
  pineB: '#2f9a39',
  pineC: '#56c043',
  leafB: '#3a9636',
  leafC: '#6cc244',
  leafPalm: '#5cbf3e',
  bush: '#46a83a',
  flowerOrange: '#ff9a3c',
  flowerYellow: '#ffd23f',
  flowerPink: '#ff6f91',

  // Architecture (for Phase 2 — listed now so the spec is complete)
  concrete: '#cfcac0',
  concreteWarm: '#d9d2c3',
  offWhite: '#f2efe6',
  roofTeal: '#3e9c94',
  roofOrange: '#e98a3c',
  khaki: '#c2b280',
  wood: '#b07a4a',
  utilityGreen: '#5b7a3a',
  accentYellow: '#ffc93c',
  accentTeal: '#2bb3a3',
  accentOrange: '#ff8a3d',

  // Sky / light
  skyTop: '#8fd3f4',
  skyHorizon: '#dff4f6',
  sun: '#fff1d6',
  hemiSky: '#d4f0ff',
  hemiGround: '#7a9a45',
} as const;
