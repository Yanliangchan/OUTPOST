import * as THREE from 'three';
import { C, Kit, STOREY } from './kit';
import { CONCRETE, DARK_GLASS, perimeter } from './common';
import { DAY, HOUR, MIN, type BuildingDef, type LevelStats } from './types';

/*
 * Utilities: power and water for the outpost. Buildings near a powered,
 * watered Utilities run faster. Signature at every level: a generator or
 * electrical gear, water tanks, pipes and cables. Footprint 3×3; height cap ~3.5.
 */

const TITLES = [
  'Field Genset', 'Water Point', 'Pump Hut', 'Generator Hut', 'Water Tower', 'Substation', 'Pump & Power House',
  'Cooling Tower', 'Twin Tanks', 'Utilities Plant', 'Solar Array', 'Water Treatment', 'Fuel Cell Block', 'Pipe Gallery',
  'Mushroom Water Tower', 'Secure Substation', 'Battery Bank', 'Desalination Unit', 'Rain Harvest Tower', 'Energy Core',
];
const SUPPLIES = [250, 800, 1_800, 4_200, 9_000, 17_000, 30_000, 52_000, 85_000, 140_000, 215_000, 330_000, 465_000, 630_000, 840_000, 1_090_000, 1_390_000, 1_720_000, 2_080_000, 2_500_000];
const REPUTATION = [0, 0, 30, 100, 250, 450, 800, 1_200, 1_800, 2_500, 3_400, 4_500, 5_800, 7_300, 9_000, 10_800, 13_000, 15_500, 18_300, 21_300];
const TIME = [2 * MIN, 8 * MIN, 25 * MIN, 1 * HOUR, 2 * HOUR, 4 * HOUR, 6 * HOUR, 10 * HOUR, 16 * HOUR, 1 * DAY, 1.5 * DAY, 2 * DAY, 2.5 * DAY, 3 * DAY, 3.5 * DAY, 4 * DAY, 4.5 * DAY, 5 * DAY, 5.5 * DAY, 6 * DAY];

export const UTILITIES_LEVELS: LevelStats[] = TITLES.map((title, i) => {
  const level = i + 1;
  const power = Math.round((20 * Math.pow(1.3, i)) / 5) * 5;
  const water = Math.round((30 * Math.pow(1.3, i)) / 5) * 5;
  const radius = 6 + Math.floor(i / 2);
  return {
    level, title,
    supplies: SUPPLIES[i],
    reputation: REPUTATION[i],
    buildTime: TIME[i],
    hp: Math.round((260 * Math.pow(1.2, i)) / 10) * 10,
    stats: { power, water, radius },
    unlocks: [`${power} kW power`, `${water} kL/day water`, `Boosts buildings within ${radius} tiles`],
  };
});

// ------------------------------------------------------------------ signature props

const OLIVE = '#5d6b35';
const PIPE_BLUE = '#2f6fa8';
const PIPE_YEL = '#f2c230';
const PIPE_GRN = '#3f9b4a';
const STEEL = '#c9ced2';
const HAZ = '#ffc93c';

const M = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.7, ...o });

/** Diesel generator set: box with a spinning radiator fan and a smoking exhaust. */
function genset(k: Kit, x: number, z: number, y: number, s = 1, color = OLIVE) {
  k.box(0.7 * s, 0.4 * s, 0.4 * s, color, x, y, z);
  k.box(0.72 * s, 0.04, 0.42 * s, '#33383d', x, y + 0.4 * s, z);
  for (let i = 0; i < 3; i++) k.box(0.02, 0.22 * s, 0.3 * s, '#33383d', x - 0.18 * s + i * 0.08 * s, y + 0.1 * s, z + 0.005);
  const fan = new THREE.Group();
  fan.position.set(x + 0.36 * s, y + 0.2 * s, z);
  for (let b = 0; b < 4; b++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.28 * s, 0.05 * s), M('#4a4f54'));
    blade.rotation.x = (b / 4) * Math.PI;
    fan.add(blade);
  }
  k.add(fan);
  k.anims.push((t) => (fan.rotation.x = t * 14));
  k.cyl(0.035 * s, 0.35 * s, '#5c6166', x - 0.22 * s, y + 0.4 * s, z - 0.1 * s, 6);
  k.emitters.push({ pos: new THREE.Vector3(x - 0.22 * s, y + 0.8 * s, z - 0.1 * s), kind: 'smoke' });
}

/** Vertical tank with a band and a ladder. */
function tank(k: Kit, x: number, z: number, y: number, r: number, h: number, color = '#e8e6e0') {
  k.cyl(r, h, color, x, y, z, 12);
  k.cyl(r + 0.01, 0.04, C.trim, x, y + h * 0.5, z, 12);
  k.cyl(r * 1.02, 0.08, color, x, y + h, z, 12, r * 0.6);
  k.box(0.02, h, 0.12, C.metal, x + r + 0.02, y, z);
}

/** Horizontal pipe between two points at height y (axis-aligned runs). */
function pipe(k: Kit, x0: number, z0: number, x1: number, z1: number, y: number, r: number, color: string) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8).rotateZ(Math.PI / 2), M(color));
  m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  m.castShadow = true;
  k.add(m);
  // Flanges
  for (const t of [0.15, 0.85]) k.cyl(r * 1.4, 0.03, color, x0 + (x1 - x0) * t, y - 0.015, z0 + (z1 - z0) * t, 8).rotation.set(0, 0, Math.PI / 2);
}

/** Pipe riser from the ground up to height h. */
function riser(k: Kit, x: number, z: number, y: number, h: number, r: number, color: string) {
  k.cyl(r, h, color, x, y, z, 8);
}

/** Pad-mounted transformer with insulators and a humming status light. */
function transformer(k: Kit, x: number, z: number, y: number, s = 1) {
  k.box(0.5 * s, 0.45 * s, 0.4 * s, '#7f888c', x, y, z);
  for (let i = 0; i < 4; i++) k.box(0.02, 0.36 * s, 0.42 * s, '#6b7378', x - 0.18 * s + i * 0.12 * s, y + 0.04, z);
  for (const dx of [-0.15, 0, 0.15]) {
    k.cyl(0.03 * s, 0.14 * s, '#9a5a3a', x + dx * s, y + 0.45 * s, z, 6);
    k.cyl(0.045 * s, 0.02, '#9a5a3a', x + dx * s, y + 0.52 * s, z, 6);
  }
  k.box(0.14 * s, 0.14 * s, 0.01, HAZ, x, y + 0.2 * s, z + 0.205 * s);
  k.blinker(x + 0.2 * s, y + 0.45 * s, z + 0.15 * s, '#3fd16b', 0.025, 2.2);
}

/** Timber or steel pole carrying overhead cables. */
function pole(k: Kit, x: number, z: number, y: number, h = 1.4, color = '#7a5a3b') {
  k.cyl(0.035, h, color, x, y, z, 6);
  k.box(0.4, 0.04, 0.04, color, x, y + h - 0.1, z);
  for (const dx of [-0.16, 0, 0.16]) k.cyl(0.02, 0.05, '#e8e6e0', x + dx, y + h - 0.06, z, 5);
}

/** Sagging cable between two points. */
function cable(k: Kit, a: THREE.Vector3, b: THREE.Vector3) {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(new THREE.Vector3().lerpVectors(a, b, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * 0.12, 0)));
  }
  k.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#2a2b2d' })));
}

function hazardSign(k: Kit, x: number, z: number, y: number) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.02, 3).rotateX(Math.PI / 2), M(HAZ));
  m.position.set(x, y, z);
  k.add(m);
}

function fence(k: Kit, w: number, d: number, x: number, z: number, y: number) {
  const posts: [number, number][] = [];
  for (let i = 0; i <= 4; i++) {
    posts.push([x - w / 2 + (w / 4) * i, z - d / 2], [x - w / 2 + (w / 4) * i, z + d / 2]);
  }
  for (const [px, pz] of posts) k.box(0.03, 0.5, 0.03, C.metal, px, y, pz);
  for (const pz of [z - d / 2, z + d / 2]) {
    k.box(w, 0.02, 0.02, C.metal, x, y + 0.48, pz);
    const mesh = k.box(w, 0.42, 0.005, '#9aa3a6', x, y + 0.04, pz);
    mesh.material = M('#9aa3a6', { transparent: true, opacity: 0.4 });
  }
  for (const px of [x - w / 2, x + w / 2]) {
    k.box(0.02, 0.02, d, C.metal, px, y + 0.48, z);
    const mesh = k.box(0.005, 0.42, d, '#9aa3a6', px, y + 0.04, z);
    mesh.material = M('#9aa3a6', { transparent: true, opacity: 0.4 });
  }
}

// ------------------------------------------------------------------ levels

function field(k: Kit, level: number, y: number) {
  if (level === 1) {
    genset(k, -0.3, -0.5, y, 0.9);
    for (let i = 0; i < 4; i++) k.box(0.14, 0.24, 0.1, i % 2 ? OLIVE : '#e94f37', 0.6 + (i % 2) * 0.17, y, -0.7 + Math.floor(i / 2) * 0.14);
    // Water bladder (pillow tank)
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 6), M(PIPE_BLUE));
    b.scale.set(1.3, 0.35, 0.9);
    b.position.set(0, y + 0.12, 0.6);
    k.add(b);
    k.cyl(0.14, 0.12, '#e94f37', -0.9, y, 0.7, 10); // cable reel
    k.sandbags(0.8, 0.4, 0.8, Math.PI / 2, y);
    return;
  }
  if (level === 2) {
    // Raised water tank on a timber stand + genset
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.06, 0.8, 0.06, '#7a5a3b', 0.5 + sx * 0.25, y, -0.5 + sz * 0.25);
    k.box(0.62, 0.05, 0.62, '#7a5a3b', 0.5, y + 0.8, -0.5);
    tank(k, 0.5, -0.5, y + 0.85, 0.27, 0.45, PIPE_BLUE);
    pipe(k, 0.5, -0.2, 0.5, 0.6, y + 0.1, 0.03, PIPE_BLUE);
    k.cyl(0.06, 0.4, STEEL, 0.5, y, 0.7, 8); // tap stand
    genset(k, -0.55, 0.3, y);
    pole(k, -0.9, -0.8, y, 1.2);
    return;
  }
  // 3: timber pump hut with a hand pump, raised drum and cable pole
  const h = k.block(1.1, 0.9, 1, -0.5, y, -0.5, C.wood);
  k.gableRoof(1.1, 0.9, 0.35, -0.5, y + h, -0.5, C.zinc, 0.12, C.wood);
  k.door('front', -0.5, -0.5, 1.1, 0.9, 0, y, 0.3, 0.55, '#7a5a3b');
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.06, 1.0, 0.06, '#7a5a3b', 0.75 + sx * 0.22, y, -0.6 + sz * 0.22);
  tank(k, 0.75, -0.6, y + 1.0, 0.26, 0.45, '#e8e6e0');
  pipe(k, 0.75, -0.6, 0.75, 0.5, y + 0.15, 0.03, PIPE_BLUE);
  // Hand pump with a rocking handle
  k.box(0.12, 0.45, 0.12, '#33383d', 0.75, y, 0.6);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.03).translate(0.15, 0, 0), M('#33383d'));
  handle.position.set(0.75, y + 0.45, 0.6);
  k.add(handle);
  k.anims.push((t) => (handle.rotation.z = Math.sin(t * 2.4) * 0.35));
  genset(k, -0.5, 0.7, y, 0.8);
  pole(k, -1.05, 0.2, y, 1.5);
}

function camp(k: Kit, level: number, y: number) {
  if (level === 4) {
    // Generator hut: cream hut with louvred walls, exhaust, outdoor fuel tank
    const h = k.block(1.6, 1.2, 1, -0.3, y, -0.5);
    k.hipRoof(1.6, 1.2, 0.4, -0.3, y + h, -0.5);
    k.windowRow('front', -0.3, -0.5, 1.6, 1.2, 2, y + 0.4, { louvre: true });
    k.door('right', -0.3, -0.5, 1.6, 1.2, 0, y, 0.34, 0.6);
    k.cyl(0.05, 0.6, '#5c6166', -0.9, y + h, -0.8, 6);
    k.emitters.push({ pos: new THREE.Vector3(-0.9, y + h + 0.7, -0.8), kind: 'smoke' });
    const ft = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.9, 12).rotateZ(Math.PI / 2), M('#e94f37'));
    ft.position.set(0.1, y + 0.32, 0.65);
    k.add(ft);
    for (const dx of [-0.3, 0.5]) k.box(0.06, 0.14, 0.3, '#5c6166', dx, y, 0.65);
    transformer(k, 0.95, 0.65, y, 0.8);
    genset(k, -0.75, 0.75, y, 0.6);
    pole(k, 1.05, -0.9, y, 1.6);
    cable(k, new THREE.Vector3(1.05, y + 1.5, -0.9), new THREE.Vector3(0.5, y + h - 0.1, -0.5));
    return;
  }
  if (level === 5) {
    // Steel-legged water tower with a float gauge, plus a small pump room
    const ty = y + 1.15;
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = k.box(0.06, 1.15, 0.06, '#8a9196', 0.45 + sx * 0.32, y, -0.35 + sz * 0.32);
      leg.rotation.set(sz * 0.05, 0, -sx * 0.05);
    }
    for (const yy of [0.4, 0.8]) {
      k.box(0.7, 0.03, 0.03, '#8a9196', 0.45, y + yy, -0.03);
      k.box(0.7, 0.03, 0.03, '#8a9196', 0.45, y + yy, -0.67);
    }
    tank(k, 0.45, -0.35, ty, 0.45, 0.6, '#e8e6e0');
    k.cyl(0.48, 0.18, C.trim, 0.45, ty + 0.6, -0.35, 12, 0.08);
    // Float gauge: a needle that slowly rises and falls on the tank side
    k.box(0.04, 0.5, 0.02, '#33383d', 0.45, ty + 0.05, 0.11);
    const needle = k.box(0.12, 0.03, 0.03, '#e94f37', 0.45, ty + 0.05, 0.13);
    k.anims.push((t) => (needle.position.y = ty + 0.08 + (Math.sin(t * 0.3) * 0.5 + 0.5) * 0.42));
    riser(k, 0.45, -0.35, y, 1.15, 0.04, PIPE_BLUE);
    const h = k.block(0.9, 0.8, 1, -0.65, y, 0.5, C.wall);
    k.hipRoof(0.9, 0.8, 0.3, -0.65, y + h, 0.5);
    k.door('front', -0.65, 0.5, 0.9, 0.8, 0, y, 0.3, 0.55);
    pipe(k, -0.2, 0.5, 0.45, 0.5, y + 0.15, 0.04, PIPE_BLUE);
    genset(k, -0.7, -0.75, y, 0.75);
    return;
  }
  // 6: fenced substation yard + switch room
  fence(k, 1.5, 1.2, 0.45, -0.5, y);
  transformer(k, 0.2, -0.65, y, 1.1);
  transformer(k, 0.75, -0.35, y, 0.8);
  for (const x of [0.05, 0.85]) {
    k.box(0.06, 1.3, 0.06, '#8a9196', x, y, -0.9);
    k.box(0.5, 0.04, 0.04, '#8a9196', x, y + 1.25, -0.9);
  }
  cable(k, new THREE.Vector3(0.05, y + 1.27, -0.9), new THREE.Vector3(0.85, y + 1.27, -0.9));
  hazardSign(k, 0.45, 0.11, y + 0.3);
  const h = k.block(1.0, 0.9, 2, -0.7, y, 0.5, C.wallAlt);
  k.hipRoof(1.0, 0.9, 0.35, -0.7, y + h, 0.5);
  k.window('front', -0.7, 0.5, 1.0, 0.9, 0, y + STOREY + 0.42, 0.4, 0.3, true);
  k.door('front', -0.7, 0.5, 1.0, 0.9, 0, y, 0.32, 0.6);
  k.aircon(-0.15, y + 0.3, 0.6, Math.PI / 2);
  genset(k, 0.6, 0.75, y, 0.7);
}

function base(k: Kit, level: number, y: number) {
  if (level === 7) {
    // Two-room pump & power house with a ground tank and piping between them
    const h = k.block(2.2, 1.0, 2, 0, y, -0.75);
    k.box(2.2, 0.25, 1.0, C.wall, 0, y + 2 * STOREY, -0.75);
    k.windowRow('front', 0, -0.75, 2.2, 1.0, 4, y + STOREY + 0.42, { louvre: true });
    k.gableRoof(2.2, 1.0, 0.4, 0, y + h + 0.25, -0.75);
    k.windowRow('front', 0, -0.75, 2.2, 1.0, 4, y + 0.42, { louvre: true, skip: [1] });
    k.door('front', 0, -0.75, 2.2, 1.0, -0.3, y, 0.34, 0.6);
    for (const x of [-0.6, 0.5]) k.cyl(0.04, 0.5, '#5c6166', x, y + h + 0.25, -0.9, 6);
    k.emitters.push({ pos: new THREE.Vector3(0.5, y + h + 0.85, -0.9), kind: 'smoke' });
    tank(k, 0.75, 0.55, y, 0.42, 0.75, '#e8e6e0');
    pipe(k, -0.6, 0.0, 0.33, 0.0, y + 0.3, 0.05, PIPE_BLUE);
    pipe(k, -0.6, 0.15, 0.33, 0.15, y + 0.5, 0.04, PIPE_YEL);
    transformer(k, -0.7, 0.75, y, 0.7);
    genset(k, -0.25, 0.75, y, 0.55);
    return;
  }
  if (level === 8) {
    // Cooling tower (curved hyperboloid) beside a genset shed
    const prof: THREE.Vector2[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      prof.push(new THREE.Vector2(0.66 - Math.sin(t * Math.PI * 0.85) * 0.2 + t * 0.05, t * 2.5));
    }
    const ct = new THREE.Mesh(new THREE.LatheGeometry(prof, 14), M('#d6d0c2', { side: THREE.DoubleSide }));
    ct.position.set(0.4, y, -0.4);
    ct.castShadow = true;
    k.add(ct);
    k.cyl(0.66, 0.06, C.trim, 0.4, y + 0.2, -0.4, 14);
    for (let i = 0; i < 3; i++) k.emitters.push({ pos: new THREE.Vector3(0.4 + (i - 1) * 0.2, y + 2.6, -0.4), kind: 'steam' });
    const h = k.block(1.0, 0.8, 1, -0.7, y, 0.55);
    k.hipRoof(1.0, 0.8, 0.3, -0.7, y + h, 0.55);
    k.windowRow('front', -0.7, 0.55, 1.0, 0.8, 2, y + 0.42, { louvre: true });
    genset(k, 0.6, 0.85, y, 0.7);
    pipe(k, -0.2, 0.3, 0.1, 0.3, y + 0.35, 0.05, PIPE_GRN);
    tank(k, -0.85, -0.75, y, 0.3, 1.2, '#dfe6ea');
    k.box(0.9, 0.5, 0.5, CONCRETE, 0.55, y, 0.75); // cooling water basin
    return;
  }
  if (level === 9) {
    // Twin tanks linked by a pipe bridge with a catwalk, spiral stair hint
    tank(k, -0.55, -0.45, y, 0.48, 2.4, '#e8e6e0');
    tank(k, 0.6, -0.35, y, 0.42, 2.1, '#dfe6ea');
    k.box(1.1, 0.04, 0.2, '#8a9196', 0.02, y + 2.05, -0.4);
    for (const x of [-0.4, 0.45]) k.box(0.02, 0.2, 0.2, '#8a9196', x, y + 2.09, -0.4);
    pipe(k, -0.1, -0.2, 0.25, -0.2, y + 1.7, 0.04, PIPE_BLUE);
    const ph = k.block(0.9, 0.7, 1, 0.75, y, 0.45, C.wall);
    k.hipRoof(0.9, 0.7, 0.3, 0.75, y + ph, 0.45);
    // Concrete bund wall around the tank farm
    k.box(2.5, 0.34, 0.08, CONCRETE, 0, y, 0.05);
    k.box(0.08, 0.34, 1.2, CONCRETE, -1.2, y, -0.5);
    k.box(0.9, 0.34, 1.0, CONCRETE, -0.6, y, 0.6); // valve pit
    for (let i = 0; i < 9; i++) k.box(0.18, 0.03, 0.08, '#8a9196', -0.55 + Math.cos(i * 0.9) * 0.55, y + 0.2 + i * 0.25, -0.45 + Math.sin(i * 0.9) * 0.55);
    // Pump skid with a turning flywheel
    k.box(0.7, 0.2, 0.4, '#5c6166', -0.3, y, 0.75);
    const fly = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 10).rotateX(Math.PI / 2), M('#e94f37'));
    fly.position.set(-0.3, y + 0.32, 0.97);
    k.add(fly);
    k.anims.push((t) => (fly.rotation.z = t * 5));
    transformer(k, -0.95, 0.75, y, 0.6);
    return;
  }
  // 10: plant: power house + water tower + transformer yard + pipe rack
  const h = k.block(1.3, 1.1, 2, -0.6, y, -0.65);
  k.hipRoof(1.3, 1.1, 0.4, -0.6, y + h, -0.65);
  for (let f = 0; f < 2; f++) k.windowRow('front', -0.6, -0.65, 1.3, 1.1, 2, y + f * STOREY + 0.42, { louvre: true });
  k.cyl(0.05, 0.7, '#5c6166', -1.0, y + h, -0.9, 6);
  k.emitters.push({ pos: new THREE.Vector3(-1.0, y + h + 0.8, -0.9), kind: 'smoke' });
  const ty = y + 2.1;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.05, 2.1, 0.05, '#8a9196', 0.7 + sx * 0.22, y, -0.6 + sz * 0.22);
  tank(k, 0.7, -0.6, ty, 0.36, 0.5, PIPE_BLUE);
  // Pipe rack across the front
  for (const x of [-1.0, 0, 1.0]) k.box(0.05, 0.6, 0.05, '#8a9196', x, y, 0.3);
  k.box(2.1, 0.04, 0.24, '#8a9196', 0, y + 0.6, 0.3);
  pipe(k, -1.05, 0.24, 1.05, 0.24, y + 0.68, 0.04, PIPE_BLUE);
  pipe(k, -1.05, 0.36, 1.05, 0.36, y + 0.68, 0.035, PIPE_YEL);
  transformer(k, -0.6, 0.85, y, 0.7);
  genset(k, 0.55, 0.9, y, 0.6);
}

function command(k: Kit, level: number, y: number) {
  if (level === 11) {
    // Solar array canopy over a battery container
    const cb = k.block(0.9, 0.7, 3, -0.85, y, -0.85, C.wallAlt);
    k.flatRoof(0.9, 0.7, -0.85, y + cb, -0.85);
    k.box(1.0, 0.65, 0.7, '#f2f0ea', 0.5, y, -0.8);
    for (let i = 0; i < 3; i++) k.box(0.02, 0.6, 0.72, '#c9ced2', 0.15 + i * 0.35, y + 0.02, -0.8);
    k.blinker(0.8, y + 0.65, -0.5, '#3fd16b', 0.03);
    for (const [x, z] of [[-1.0, -0.3], [1.0, -0.3], [-1.0, 0.9], [1.0, 0.9]]) k.box(0.06, z < 0 ? 2.75 : 2.15, 0.06, C.metal, x, y, z);
    const arr = new THREE.Group();
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.42), M('#284a73', { roughness: 0.35 }));
      p.position.set(-0.78 + i * 0.52, 0, -0.45 + j * 0.44);
      arr.add(p);
    }
    arr.position.set(0, y + 2.45, 0.3);
    arr.rotation.x = 0.4;
    k.add(arr);
    transformer(k, 0.7, -0.15, y, 0.6);
    genset(k, 0.0, 0.6, y, 0.6, '#f2f0ea');
    return;
  }
  if (level === 12) {
    // Water treatment: round clarifier with a rotating sweep arm + filter block
    tank(k, 0.95, -1.0, y, 0.25, 2.6, '#dfe6ea');
    k.cyl(0.8, 0.4, CONCRETE, 0.35, y, -0.35, 18);
    k.cyl(0.72, 0.02, '#5fb7c9', 0.35, y + 0.38, -0.35, 18);
    const arm = new THREE.Group();
    arm.position.set(0.35, y + 0.42, -0.35);
    k.box(1.44, 0.05, 0.08, HAZ, 0, 0, 0, arm);
    k.box(0.12, 0.12, 0.12, '#5c6166', 0, 0, 0, arm);
    k.add(arm);
    k.anims.push((t) => (arm.rotation.y = t * 0.4));
    const h = k.block(0.9, 1.0, 3, -0.85, y, 0.55, C.wallAlt);
    k.flatRoof(0.9, 1.0, -0.85, y + h, 0.55);
    for (let f = 0; f < 3; f++) k.windowRow('front', -0.85, 0.55, 0.9, 1.0, 2, y + f * STOREY + 0.42, { louvre: true });
    pipe(k, -0.4, 0.3, 0.1, 0.3, y + 0.25, 0.05, PIPE_BLUE);
    genset(k, 0.75, 0.85, y, 0.6, '#f2f0ea');
    return;
  }
  if (level === 13) {
    // Fuel cell block: white modules, horizontal hydrogen tanks, green status lights
    for (let i = 0; i < 3; i++) {
      k.box(0.55, 2.0 + i * 0.4, 0.8, '#f2f0ea', -0.75 + i * 0.6, y, -0.6);
      for (let f = 1; f < 3 + i; f++) k.box(0.57, 0.03, 0.82, '#c9ced2', -0.75 + i * 0.6, y + f * 0.7, -0.6);
      k.box(0.3, 0.12, 0.02, DARK_GLASS, -0.75 + i * 0.6, y + 0.5, -0.19);
      k.blinker(-0.75 + i * 0.6, y + 2.0 + i * 0.4, -0.6, '#3fd16b', 0.03, 1.2 + i * 0.3);
    }
    for (const z of [0.45, 0.85]) {
      const tk = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 1.4, 4, 10).rotateZ(Math.PI / 2), M('#e8f1f4'));
      tk.position.set(0, y + 0.3, z);
      tk.castShadow = true;
      k.add(tk);
      for (const x of [-0.5, 0.5]) k.box(0.08, 0.15, 0.3, '#5c6166', x, y, z);
    }
    pipe(k, -0.75, 0.1, 0.75, 0.1, y + 0.45, 0.03, PIPE_GRN);
    genset(k, 0.95, 0.1, y, 0.5, '#f2f0ea');
    k.box(2.4, 0.32, 1.3, CONCRETE, 0, y - 0.0, 0.6); // tank cradle plinth
    return;
  }
  if (level === 14) {
    // Pipe gallery: tall two-tier pipe rack with colour-coded pipes looping to a pump hall
    const h = k.block(1.0, 1.0, 3, -0.8, y, -0.7, C.wall);
    k.flatRoof(1.0, 1.0, -0.8, y + h, -0.7);
    k.windowRow('front', -0.8, -0.7, 1.0, 1.0, 2, y + STOREY + 0.42, { louvre: true });
    for (const x of [-0.2, 0.5, 1.2]) for (const z of [-1.05, -0.35]) k.box(0.06, 2.7, 0.06, '#8a9196', x, y, z);
    for (const yy of [1.4, 2.65]) for (const z of [-1.05, -0.35]) k.box(1.5, 0.04, 0.05, '#8a9196', 0.5, y + yy, z);
    k.box(1.5, 0.03, 0.75, '#8a9196', 0.5, y + 2.65, -0.7);
    const cols = [PIPE_BLUE, PIPE_YEL, PIPE_GRN, '#e94f37'];
    cols.forEach((c, i) => pipe(k, -0.25, -1.0 + i * 0.2, 1.25, -1.0 + i * 0.2, y + (i % 2 ? 2.72 : 1.48), 0.05, c));
    for (let i = 0; i < 3; i++) riser(k, 1.2, -0.9 + i * 0.2, y, 1.5 + (i % 2) * 1.25, 0.045, cols[i]);
    k.box(2.5, 0.34, 1.0, CONCRETE, 0, y, 0.65); // pump plinth
    genset(k, 0.3, 0.6, y + 0.34, 0.8, '#f2f0ea');
    transformer(k, -0.75, 0.65, y + 0.34, 0.7);
    return;
  }
  // 15: mushroom water tower landmark with a gold ring and tapering stem
  k.cyl(0.32, 2.4, CONCRETE, 0, y, -0.3, 12, 0.24);
  for (let i = 1; i < 4; i++) k.cyl(0.33 - i * 0.02, 0.04, C.trim, 0, y + i * 0.6, -0.3, 12);
  k.cyl(0.95, 0.55, '#f2f0ea', 0, y + 2.4, -0.3, 16, 1.1);
  k.cyl(0.25, 0.4, '#f2f0ea', 0, y + 2.05, -0.3, 16, 0.95);
  k.cyl(1.12, 0.07, '#d9b24a', 0, y + 2.92, -0.3, 16);
  k.cyl(0.3, 0.2, '#f2f0ea', 0, y + 2.99, -0.3, 10, 0.1);
  k.blinker(0, y + 3.19, -0.3, '#ff3b30', 0.05, 1.6);
  k.door('front', 0, -0.3, 0.6, 0.6, 0, y, 0.24, 0.5);
  genset(k, -0.75, 0.75, y, 0.7, '#f2f0ea');
  transformer(k, 0.75, 0.75, y, 0.7);
  k.planter(0, 1.05, 0.6, y);
}

function secure(k: Kit, level: number, y: number) {
  perimeter(k, y, 1.22, 1.22, false);
  if (level === 16) {
    // Secure substation: concrete transformer bunkers with lightning rods
    for (const x of [-0.55, 0.55]) {
      k.box(0.85, 2.6, 1.2, CONCRETE, x, y, -0.45);
      for (let i = 1; i < 4; i++) k.box(0.87, 0.03, 1.22, '#c2bdb3', x, y + i * 0.65, -0.45);
      k.box(0.6, 0.5, 0.04, '#6b7075', x, y, 0.16);
      for (let i = 0; i < 5; i++) k.box(0.12, 0.06, 0.05, i % 2 ? C.kerbB : C.kerbY, x - 0.24 + i * 0.12, y + 0.52, 0.17);
      transformer(k, x, -0.45, y + 2.6, 0.8);
      k.cyl(0.015, 0.9, STEEL, x + 0.32, y + 2.6, -0.9, 4);
    }
    k.box(1.9, 0.6, 0.35, CONCRETE, 0, y, 0.7);
    hazardSign(k, 0, 0.88, y + 0.35);
    genset(k, -0.6, 0.95, y, 0.45, '#f2f0ea');
    return;
  }
  if (level === 17) {
    // Battery bank: stacked battery containers with running LED strips
    for (let r = 0; r < 5; r++) for (let i = 0; i < 2; i++) {
      const cy = y + r * 0.62;
      k.box(1.0, 0.6, 0.55, '#2bb3a3', -0.5 + i * 1.05, cy, -0.6);
      for (let j = 0; j < 5; j++) k.box(0.02, 0.56, 0.57, '#1f8a7d', -0.9 + i * 1.05 + j * 0.2, cy + 0.02, -0.6);
      for (let j = 0; j < 4; j++) k.blinker(-0.85 + i * 1.05 + j * 0.24, cy + 0.42, -0.33, j % 2 ? '#3fd16b' : '#7cff8a', 0.02, 1.0 + j * 0.15);
    }
    k.box(2.1, 0.06, 0.7, '#f2f0ea', 0, y + 3.1, -0.6);
    k.stairs(1.05, 0.0, 0.3, 0.6, 1.2);
    transformer(k, -0.55, 0.65, y, 0.9);
    genset(k, 0.6, 0.65, y, 0.7, '#f2f0ea');
    return;
  }
  if (level === 18) {
    // Desalination unit: racks of white membrane tubes, seawater tank, pumps
    for (let r = 0; r < 9; r++) {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.4, 10).rotateZ(Math.PI / 2), M('#f4f6f7'));
      tube.position.set(-0.25, y + 0.35 + r * 0.24, -0.55);
      k.add(tube);
      const tube2 = tube.clone();
      tube2.position.z = -0.85;
      k.add(tube2);
    }
    for (const x of [-0.95, 0.45]) k.box(0.05, 2.5, 0.45, '#8a9196', x, y, -0.7);
    k.box(1.45, 0.05, 0.5, '#8a9196', -0.25, y + 2.5, -0.7);
    tank(k, 0.85, -0.5, y, 0.35, 2.7, '#5fb7c9');
    pipe(k, 0.45, -0.3, 0.85, -0.3, y + 0.5, 0.04, PIPE_BLUE);
    genset(k, -0.5, 0.65, y, 0.75, '#f2f0ea');
    tank(k, 0.6, 0.65, y, 0.25, 0.6, PIPE_BLUE);
    return;
  }
  if (level === 19) {
    // Rain harvest tower: inverted funnel roof drains into a tank wrapped in a green wall
    k.cyl(0.6, 2.6, '#4fae3a', 0, y, -0.35, 12);
    for (let i = 0; i < 7; i++) k.cyl(0.57, 0.03, '#3f8a2e', 0, y + 0.3 + i * 0.35, -0.35, 12);
    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.25, 0.6, 14, 1, true), M('#f2f0ea', { side: THREE.DoubleSide }));
    funnel.position.set(0, y + 2.9, -0.35);
    funnel.castShadow = true;
    k.add(funnel);
    k.cyl(0.95, 0.02, '#5fb7c9', 0, y + 3.1, -0.35, 14);
    // Rain chain dripping into a basin
    k.box(0.02, 2.5, 0.02, C.metal, 0.75, y + 0.1, 0.3);
    k.cyl(0.18, 0.1, CONCRETE, 0.75, y, 0.3, 10);
    k.emitters.push({ pos: new THREE.Vector3(0.75, y + 0.25, 0.3), kind: 'spray' });
    genset(k, -0.6, 0.7, y, 0.65, '#f2f0ea');
    return;
  }
  // 20: Energy core: glowing core in a glass drum with rotating gold rings
  k.cyl(0.95, 0.4, CONCRETE, 0, y, -0.3, 16);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 2.6, 16), M('#86b7cc', { transparent: true, opacity: 0.45 }));
  glass.position.set(0, y + 1.7, -0.3);
  k.add(glass);
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 2.4, 12), new THREE.MeshStandardMaterial({ color: '#7ff0ff', emissive: '#2bb3d4', emissiveIntensity: 1.0, flatShading: true }));
  core.position.set(0, y + 1.7, -0.3);
  k.add(core);
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75 - i * 0.08, 0.035, 6, 24), M('#d9b24a'));
    ring.position.set(0, y + 0.9 + i * 0.75, -0.3);
    k.add(ring);
    rings.push(ring);
  }
  k.anims.push((t) => {
    rings.forEach((r, i) => {
      r.rotation.x = Math.PI / 2 + Math.sin(t * 0.6 + i) * 0.35;
      r.rotation.z = t * (0.5 + i * 0.3);
    });
    (core.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8 + Math.sin(t * 2) * 0.4;
  });
  k.cyl(0.7, 0.14, '#d9b24a', 0, y + 3.0, -0.3, 16);
  k.cyl(0.5, 0.2, '#f2f0ea', 0, y + 3.14, -0.3, 16, 0.2);
  transformer(k, -0.75, 0.75, y, 0.7);
  transformer(k, 0.75, 0.75, y, 0.7);
}

export function buildUtilities(level: number): Kit {
  const k = new Kit();
  const y = k.pad(3, 3);
  if (level <= 3) field(k, level, y);
  else if (level <= 6) camp(k, level, y);
  else if (level <= 10) base(k, level, y);
  else if (level <= 15) command(k, level, y);
  else secure(k, level, y);
  return k;
}

export const UTILITIES: BuildingDef = {
  id: 'utilities',
  name: 'Utilities',
  role: 'Power and water for the outpost. Nearby buildings run faster when supplied.',
  footprint: [3, 3],
  unlockHq: 2,
  levels: UTILITIES_LEVELS,
  designedLevels: 20,
  build: buildUtilities,
};
