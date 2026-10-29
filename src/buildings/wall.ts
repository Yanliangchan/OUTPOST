import * as THREE from 'three';
import { C, Kit } from './kit';
import { CONCRETE, GOLD } from './common';
import { MIN, type BuildingDef, type LevelStats } from './types';

/*
 * Perimeter Wall: placed tile by tile (Clash of Clans style). Each 1×1 piece is
 * a post plus a half-length segment toward every neighbouring wall tile, so two
 * neighbours meet exactly on their shared edge and runs, corners and T-junctions
 * all join up. Walls stay low (≤ ~0.9) so they never hide the base, and are kept
 * static and low-poly because a base holds hundreds of pieces.
 */

const TITLES = [
  'Sandbag Line', 'Sandbag Wall', 'Timber Palisade', 'Gabion Wall', 'Chain-Link Fence', 'Brick Wall', 'Block Wall · Wire',
  'Precast Panel Wall', 'HESCO Bastion', 'Rampart Wall', 'Steel Palisade', 'Jersey Screen Wall', 'T-Wall Line', 'Anti-Climb Mesh',
  'Landmark Wall', 'Armour Plate Wall', 'Turf Berm', 'Smart Fence', 'Laser Fence', 'Citadel Rampart',
];

export const WALL_LEVELS: LevelStats[] = TITLES.map((title, i) => ({
  level: i + 1,
  title,
  supplies: Math.round((60 * Math.pow(1.5, i)) / 10) * 10,
  reputation: Math.round((20 * Math.pow(1.3, i)) / 10) * 10,
  buildTime: i < 10 ? 0 : 1 * MIN,
  hp: Math.round((300 * Math.pow(1.3, i)) / 10) * 10,
  stats: { heightCm: Math.round(35 + i * 2.6) * 10 },
  unlocks: ['Joins up with neighbouring wall tiles', i >= 9 ? 'Upgrades a whole run at once' : 'Slows raiders at the line'],
}));

export interface WallLinks { n?: boolean; e?: boolean; s?: boolean; w?: boolean }

const M = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.85, ...o });
const glow = (c: string) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 1.2, flatShading: true });
const HAZ = '#f2c230';
const SAND = '#cdb98a';

/**
 * Each level: `seg` builds one half-segment in a group running along +x from
 * the tile centre (x = 0) to the tile edge (x = 0.5); `post` builds the tile's
 * centre post. Both stand on y = 0.
 */
interface Style { seg(g: Kit): void; post(g: Kit): void }

function bags(g: Kit, layers: number, x0 = 0, len = 0.5, depth = 0.17) {
  const n = Math.round(len / 0.25);
  for (let l = 0; l < layers; l++) for (let i = 0; i < n; i++) {
    const b = g.box(0.24, 0.1, depth, i % 3 === 1 ? '#c2ad7e' : SAND, x0 + 0.125 + i * 0.25 + (l % 2) * 0.06 - 0.03, l * 0.095, 0);
    b.rotation.y = (i + l) % 2 ? 0.05 : -0.05;
  }
}

function coil(g: Kit, x0: number, x1: number, y: number, z = 0) {
  const geo = new THREE.TorusGeometry(0.06, 0.007, 3, 9);
  for (let x = x0 + 0.04; x < x1; x += 0.09) {
    const c = new THREE.Mesh(geo, M('#b9c0c4'));
    c.position.set(x, y + 0.06, z);
    c.rotation.y = Math.PI / 2 + 0.35;
    g.group.add(c);
  }
}

const STYLES: Style[] = [
  // 1 Sandbag line: two courses of bags
  { seg: (g) => bags(g, 2), post: (g) => bags(g, 2, -0.12, 0.25, 0.22) },
  // 2 Sandbag wall: three courses held by timber stakes
  {
    seg: (g) => {
      bags(g, 3);
      g.box(0.04, 0.38, 0.04, '#7a5a3b', 0.48, 0, 0.1);
    },
    post: (g) => {
      bags(g, 3, -0.12, 0.25, 0.22);
      for (const z of [-0.1, 0.1]) g.box(0.045, 0.42, 0.045, '#7a5a3b', 0, 0, z);
    },
  },
  // 3 Timber palisade: sharpened logs on a rail
  {
    seg: (g) => {
      for (let x = 0.06; x < 0.5; x += 0.1) {
        g.cyl(0.045, 0.52, '#8a6040', x, 0, 0, 6);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 6), M('#a67c52'));
        tip.position.set(x, 0.58, 0);
        g.group.add(tip);
      }
      g.box(0.5, 0.05, 0.03, '#6b4a30', 0.25, 0.3, 0.05);
    },
    post: (g) => {
      g.cyl(0.07, 0.62, '#6b4a30', 0, 0, 0, 7);
      g.cyl(0.075, 0.04, '#c9a36a', 0, 0.42, 0, 7);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 7), M('#8a6040'));
      tip.position.set(0, 0.69, 0);
      g.group.add(tip);
    },
  },
  // 4 Gabion wall: wire baskets of stone
  {
    seg: (g) => {
      g.box(0.5, 0.42, 0.3, '#9c9488', 0.25, 0, 0);
      for (const y of [0.14, 0.28]) g.box(0.51, 0.012, 0.31, '#d8dcde', 0.25, y, 0);
      for (const x of [0.12, 0.25, 0.38]) g.box(0.012, 0.42, 0.31, '#d8dcde', x, 0, 0);
    },
    post: (g) => {
      g.box(0.34, 0.5, 0.34, '#8f877b', 0, 0, 0);
      g.box(0.35, 0.012, 0.35, '#d8dcde', 0, 0.25, 0);
    },
  },
  // 5 Chain-link fence on a kerb with barbed-wire strands
  {
    seg: (g) => {
      g.box(0.5, 0.1, 0.12, CONCRETE, 0.25, 0, 0);
      g.box(0.5, 0.5, 0.012, '#aab3b8', 0.25, 0.1, 0).material = M('#aab3b8', { transparent: true, opacity: 0.45 });
      for (const y of [0.1, 0.6]) g.box(0.5, 0.02, 0.02, C.metal, 0.25, y, 0);
      for (const y of [0.66, 0.72]) g.box(0.5, 0.008, 0.008, '#5c6166', 0.25, y, 0.04);
    },
    post: (g) => {
      g.box(0.16, 0.12, 0.16, CONCRETE, 0, 0, 0);
      g.cyl(0.03, 0.66, C.metal, 0, 0.1, 0, 6);
      const arm = g.box(0.025, 0.16, 0.025, C.metal, 0, 0.72, 0.03);
      arm.rotation.x = 0.6;
    },
  },
  // 6 Cream brick wall with a green dado and white coping
  {
    seg: (g) => {
      g.box(0.5, 0.52, 0.16, C.wall, 0.25, 0, 0);
      g.box(0.5, 0.1, 0.17, C.trim, 0.25, 0, 0);
      for (let i = 1; i < 5; i++) g.box(0.5, 0.008, 0.165, '#e2d6bd', 0.25, 0.1 + i * 0.085, 0);
      g.box(0.5, 0.04, 0.2, C.white, 0.25, 0.52, 0);
    },
    post: (g) => {
      g.box(0.24, 0.62, 0.24, C.wall, 0, 0, 0);
      g.box(0.25, 0.1, 0.25, C.trim, 0, 0, 0);
      g.box(0.28, 0.05, 0.28, C.white, 0, 0.62, 0);
    },
  },
  // 7 Concrete block wall topped with concertina wire
  {
    seg: (g) => {
      g.box(0.5, 0.52, 0.18, '#c8c3b8', 0.25, 0, 0);
      for (let r = 0; r < 4; r++) {
        g.box(0.5, 0.008, 0.185, '#a9a49a', 0.25, (r + 1) * 0.13, 0);
        g.box(0.008, 0.13, 0.185, '#a9a49a', r % 2 ? 0.12 : 0.37, r * 0.13, 0);
      }
      coil(g, 0, 0.5, 0.52);
    },
    post: (g) => {
      g.box(0.26, 0.6, 0.26, '#b9b4aa', 0, 0, 0);
      g.box(0.28, 0.04, 0.28, '#a9a49a', 0, 0.6, 0);
    },
  },
  // 8 Precast panel wall with a hazard-stripe band
  {
    seg: (g) => {
      g.box(0.5, 0.6, 0.14, '#d8d4ca', 0.25, 0, 0);
      for (let i = 0; i < 5; i++) g.box(0.1, 0.07, 0.145, i % 2 ? C.kerbB : HAZ, 0.05 + i * 0.1, 0.42, 0);
    },
    post: (g) => {
      g.box(0.18, 0.66, 0.06, '#5c6166', 0, 0, 0.07);
      g.box(0.18, 0.66, 0.06, '#5c6166', 0, 0, -0.07);
      g.box(0.06, 0.66, 0.18, '#5c6166', 0, 0, 0);
    },
  },
  // 9 HESCO bastion: tan geotextile cubes in a wire frame
  {
    seg: (g) => {
      g.box(0.48, 0.58, 0.44, '#c9b48f', 0.26, 0, 0);
      for (const y of [0.0, 0.29, 0.58]) g.box(0.49, 0.012, 0.45, '#8a9196', 0.26, y, 0);
      g.box(0.48, 0.03, 0.4, '#a89470', 0.26, 0.58, 0);
    },
    post: (g) => {
      g.box(0.46, 0.6, 0.46, '#c2ad86', 0, 0, 0);
      for (const y of [0.0, 0.3, 0.6]) g.box(0.47, 0.012, 0.47, '#8a9196', 0, y, 0);
    },
  },
  // 10 Rampart wall: buttressed concrete with merlons; the post carries a lamp
  {
    seg: (g) => {
      g.box(0.5, 0.58, 0.22, '#d8d4ca', 0.25, 0, 0);
      g.box(0.5, 0.08, 0.24, C.trim, 0.25, 0, 0);
      g.box(0.16, 0.14, 0.22, '#d8d4ca', 0.3, 0.58, 0);
      g.box(0.5, 0.03, 0.24, C.white, 0.25, 0.56, 0);
    },
    post: (g) => {
      g.box(0.3, 0.72, 0.3, '#cfcac0', 0, 0, 0);
      g.box(0.32, 0.08, 0.32, C.trim, 0, 0, 0);
      g.box(0.34, 0.05, 0.34, C.white, 0, 0.72, 0);
      const lampM = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), glow('#fff2c0'));
      lampM.position.set(0, 0.82, 0);
      g.group.add(lampM);
    },
  },
  // 11 Steel palisade: green W-pales with triple points on a concrete plinth
  {
    seg: (g) => {
      g.box(0.5, 0.12, 0.14, CONCRETE, 0.25, 0, 0);
      for (const y of [0.25, 0.55]) g.box(0.5, 0.03, 0.03, '#2f5a3a', 0.25, y, 0.03);
      for (let x = 0.04; x < 0.5; x += 0.075) {
        g.box(0.05, 0.6, 0.015, '#3a6b47', x, 0.1, 0);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 3), M('#3a6b47'));
        tip.position.set(x, 0.74, 0);
        g.group.add(tip);
      }
    },
    post: (g) => {
      g.box(0.2, 0.14, 0.2, CONCRETE, 0, 0, 0);
      g.box(0.09, 0.76, 0.09, '#2f5a3a', 0, 0.1, 0);
      g.box(0.11, 0.03, 0.11, '#2f5a3a', 0, 0.86, 0);
    },
  },
  // 12 Jersey barriers with a mesh screen above
  {
    seg: (g) => {
      g.box(0.5, 0.12, 0.24, '#d8d4ca', 0.25, 0, 0);
      g.box(0.5, 0.22, 0.13, '#d8d4ca', 0.25, 0.12, 0);
      g.box(0.5, 0.36, 0.012, '#7d878c', 0.25, 0.34, 0).material = M('#7d878c', { transparent: true, opacity: 0.5 });
      g.box(0.5, 0.025, 0.025, '#5c6166', 0.25, 0.7, 0);
      for (let i = 0; i < 2; i++) g.box(0.12, 0.06, 0.135, '#d8342c', 0.12 + i * 0.25, 0.26, 0);
    },
    post: (g) => {
      g.box(0.24, 0.34, 0.26, '#cfcac0', 0, 0, 0);
      g.cyl(0.035, 0.42, '#5c6166', 0, 0.34, 0, 6);
    },
  },
  // 13 T-wall line: tall blast panels with yellow tops on wide footings
  {
    seg: (g) => {
      g.box(0.5, 0.14, 0.34, '#bfbab0', 0.25, 0, 0);
      g.box(0.49, 0.8, 0.1, '#d0cbc1', 0.25, 0, 0);
      g.box(0.49, 0.07, 0.105, HAZ, 0.25, 0.72, 0);
    },
    post: (g) => {
      g.box(0.3, 0.14, 0.36, '#bfbab0', 0, 0, 0);
      g.box(0.08, 0.84, 0.12, '#b9b4aa', 0, 0, 0);
      g.box(0.04, 0.06, 0.04, '#5c6166', 0, 0.84, 0);
    },
  },
  // 14 Anti-climb mesh: dense dark-green mesh with a glowing LED strip
  {
    seg: (g) => {
      g.box(0.5, 0.08, 0.12, CONCRETE, 0.25, 0, 0);
      g.box(0.5, 0.72, 0.02, '#1f3a2a', 0.25, 0.08, 0).material = M('#1f3a2a', { transparent: true, opacity: 0.75 });
      for (let i = 1; i < 6; i++) g.box(0.5, 0.006, 0.025, '#2f5a3a', 0.25, 0.08 + i * 0.12, 0);
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.03), glow('#3fd1ff'));
      led.position.set(0.25, 0.81, 0);
      g.group.add(led);
    },
    post: (g) => {
      g.box(0.1, 0.84, 0.1, '#1f3a2a', 0, 0, 0);
      g.box(0.13, 0.04, 0.13, '#2bb3a3', 0, 0.84, 0);
    },
  },
  // 15 Landmark wall: smooth white wall, green coping, gold studs, base light strip
  {
    seg: (g) => {
      g.box(0.5, 0.66, 0.18, '#f4f2ec', 0.25, 0, 0);
      g.box(0.5, 0.05, 0.22, C.roofGreen, 0.25, 0.66, 0);
      for (const x of [0.12, 0.37]) g.box(0.04, 0.04, 0.19, GOLD, x, 0.42, 0);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.19), glow('#fff2c0'));
      strip.position.set(0.25, 0.06, 0);
      g.group.add(strip);
    },
    post: (g) => {
      g.box(0.28, 0.76, 0.28, '#f4f2ec', 0, 0, 0);
      g.box(0.3, 0.06, 0.3, GOLD, 0, 0.76, 0);
      g.box(0.2, 0.04, 0.2, C.roofGreen, 0, 0.82, 0);
    },
  },
  // 16 Armour plate wall: riveted olive steel with a raked top
  {
    seg: (g) => {
      g.box(0.5, 0.7, 0.16, '#5b6448', 0.25, 0, 0);
      const top = g.box(0.5, 0.06, 0.2, '#4a5238', 0.25, 0.68, 0.02);
      top.rotation.x = -0.35;
      for (const y of [0.18, 0.5]) for (const x of [0.08, 0.25, 0.42]) g.box(0.03, 0.03, 0.17, '#8a9196', x, y, 0);
    },
    post: (g) => {
      g.box(0.24, 0.8, 0.24, '#4a5238', 0, 0, 0);
      for (let i = 0; i < 4; i++) g.box(0.06, 0.06, 0.245, i % 2 ? C.kerbB : HAZ, -0.09 + i * 0.06, 0.74, 0);
    },
  },
  // 17 Turf berm: concrete-faced earth berm with a grassy top
  {
    seg: (g) => {
      g.box(0.5, 0.46, 0.5, '#8a7a5a', 0.25, 0, 0);
      for (const s of [-1, 1]) {
        const f = g.box(0.5, 0.5, 0.06, '#c9c4b9', 0.25, 0, s * 0.24);
        f.rotation.x = s * 0.28;
      }
      g.box(0.5, 0.08, 0.32, '#55a832', 0.25, 0.46, 0);
    },
    post: (g) => {
      g.box(0.5, 0.48, 0.5, '#8a7a5a', 0, 0, 0);
      g.box(0.4, 0.08, 0.4, '#4fae3a', 0, 0.48, 0);
      g.box(0.08, 0.3, 0.08, '#e8e6e0', 0, 0.56, 0);
    },
  },
  // 18 Smart fence: white rails and mesh, posts with glowing sensor heads
  {
    seg: (g) => {
      g.box(0.5, 0.1, 0.12, '#e8e6e0', 0.25, 0, 0);
      g.box(0.5, 0.58, 0.012, '#bfe6f2', 0.25, 0.1, 0).material = M('#bfe6f2', { transparent: true, opacity: 0.45 });
      for (const y of [0.1, 0.4, 0.7]) g.box(0.5, 0.025, 0.03, '#f4f4f0', 0.25, y, 0);
    },
    post: (g) => {
      g.box(0.08, 0.8, 0.08, '#f4f4f0', 0, 0, 0);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), glow('#3fd1ff'));
      head.position.set(0, 0.86, 0);
      g.group.add(head);
      g.box(0.14, 0.03, 0.14, '#2bb3a3', 0, 0.8, 0);
    },
  },
  // 19 Laser fence: black posts, glowing red beams over a concrete kerb
  {
    seg: (g) => {
      g.box(0.5, 0.1, 0.14, '#3f4448', 0.25, 0, 0);
      for (const y of [0.25, 0.45, 0.65]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.014, 0.014), new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0.85 }));
        b.position.set(0.25, y, 0);
        g.group.add(b);
      }
    },
    post: (g) => {
      g.box(0.12, 0.82, 0.12, '#1f2326', 0, 0, 0);
      for (const y of [0.25, 0.45, 0.65]) {
        const e = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.03, 0.13), glow('#ff3b30'));
        e.position.set(0, y, 0);
        g.group.add(e);
      }
    },
  },
  // 20 Citadel rampart: thick concrete with a gold band, merlons and gold-capped glass posts
  {
    seg: (g) => {
      g.box(0.5, 0.72, 0.28, '#d0cbc1', 0.25, 0, 0);
      g.box(0.5, 0.05, 0.29, GOLD, 0.25, 0.5, 0);
      g.box(0.5, 0.08, 0.3, '#4a4f54', 0.25, 0, 0);
      g.box(0.18, 0.14, 0.28, '#d0cbc1', 0.3, 0.72, 0);
    },
    post: (g) => {
      g.box(0.34, 0.86, 0.34, '#c4bfb5', 0, 0, 0);
      g.box(0.24, 0.16, 0.24, '#86b7cc', 0, 0.86, 0);
      g.box(0.36, 0.05, 0.36, GOLD, 0, 0.86, 0);
      g.box(0.28, 0.04, 0.28, GOLD, 0, 1.02, 0);
    },
  },
];

const DIRS: [keyof WallLinks, number][] = [['e', 0], ['n', Math.PI / 2], ['w', Math.PI], ['s', -Math.PI / 2]];

/** One wall tile with half-segments toward each linked neighbour. */
export function buildWallPiece(level: number, links: WallLinks = {}): Kit {
  const k = new Kit();
  const st = STYLES[Math.min(STYLES.length, Math.max(1, level)) - 1];
  for (const [d, rot] of DIRS) {
    if (!links[d]) continue;
    const g = new Kit();
    st.seg(g);
    g.group.rotation.y = rot;
    k.add(g.group);
  }
  const p = new Kit();
  st.post(p);
  k.add(p.group);
  return k;
}

export const WALL: BuildingDef = {
  id: 'wall',
  name: 'Perimeter Wall',
  role: 'Placed tile by tile; pieces join up with their neighbours to hold raiders at the line.',
  footprint: [1, 1],
  unlockHq: 6,
  levels: WALL_LEVELS,
  designedLevels: 20,
  build: (level) => buildWallPiece(level, { e: true, w: true }),
  connect: buildWallPiece,
};
