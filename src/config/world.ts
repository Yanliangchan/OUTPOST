// Tunable world-generation and camera values.
export const WORLD = {
  seed: 1337,
  /** Terrain mesh resolution: cells per side (1 cell = 1 world unit = 1 build tile). */
  gridCells: 168,
  /** Half-size of the flat, buildable plateau (tiles). */
  buildHalf: 22,
  /** Half-size of the starter plot unlocked at the beginning. */
  starterHalf: 12,
  /** Island radius (superellipse) to the start of the beach. */
  landRadius: 54,
  /** Superellipse exponent: 2 = circle, higher = squarer. */
  islandShapePower: 2.6,
  /** Normalised distance at which the beach gives way to the sea. */
  beachEnd: 1.08,
  /** Lakes carved into the surrounding terrain (outside the build plateau). */
  lakes: [
    { x: 10, z: 33, r: 7, depth: 6 },
    { x: -34, z: 14, r: 6, depth: 6 },
  ],
  /** Height for each terrace level. Index = level + 1 (level -1 = seabed). */
  levelHeights: [-0.9, 0.5, 1.7, 3.3, 4.9, 6.5, 8.1],
  plateauLevel: 1,
  waterLevel: 0.25,
  vertexJitter: 0.36,
};

export const CAMERA = {
  /** Elevation angle in degrees (true isometric is ~35.26). */
  pitchDeg: 38,
  /** Starting yaw; 45 gives the classic diamond view. */
  yawDeg: 45,
  /** Ortho half-height of the view in world units at zoom = 1. */
  viewHalfHeight: 22,
  zoomMin: 0.55,
  zoomMax: 2.6,
  zoomStart: 1.35,
  zoomSmoothing: 10,
  panSmoothing: 12,
  rotateSmoothing: 8,
  keyPanSpeed: 28,
  boundsHalf: 42,
};
