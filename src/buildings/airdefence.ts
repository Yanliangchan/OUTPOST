import * as THREE from 'three';
import { C, Kit, STOREY, mat } from './kit';
import { CONCRETE, DARK_GLASS, GOLD } from './common';
import { DAY, HOUR, type BuildingDef, type LevelStats } from './types';
import type { Turret } from './turret';

/*
 * Air Defence: shoots only flying raiders (drones, helicopters). Signature at
 * every level: guns or launchers pointing skyward, a rotating open-frame or
 * planar search radar, and a crew. The weapon grows band by band:
 * twin AA machine-gun on a sandbag ring → quad MG → single AA cannon → twin
 * cannons on a turntable → enclosed twin-cannon turret with fire-control radar →
 * gun/missile turret → missile pods → hardened launchers with armoured covers
 * and phased-array panels (gold at 20). Footprint 3×3; bulk ≤ ~3.5 storeys.
 */

const TITLES = [
  'Sandbag AA Nest', 'Canvas AA Pit', 'Quad-Gun Platform', 'AA Cannon Pit', 'Shielded Gun Bay', 'Twin-Gun Turntable',
  'Fire-Control Battery', 'Gun Turret Drum', 'Radar Gun Tower', 'Air Defence Bastion', 'Twin-35 Pavilion', 'Missile Pod Battery',
  'Reload Crane Battery', 'Launcher Tower', 'Sky Shield Centre', 'Hardened Launcher', 'Phased-Array Post', 'Clamshell Launcher',
  'Sensor Fortress', 'Sky Citadel',
];
const SUPPLIES = [300_000, 375_000, 470_000, 585_000, 730_000, 915_000, 1_150_000, 1_430_000, 1_790_000, 2_240_000, 2_800_000, 3_500_000, 4_370_000, 5_460_000, 6_830_000, 8_530_000, 10_700_000, 13_300_000, 16_700_000, 20_800_000];
const REPUTATION = [3_000, 3_450, 3_950, 4_550, 5_250, 6_050, 6_950, 8_000, 9_200, 10_600, 12_200, 14_000, 16_100, 18_500, 21_200, 24_400, 28_100, 32_300, 37_100, 42_700];
const TIME = [8 * HOUR, 10 * HOUR, 12 * HOUR, 14 * HOUR, 17 * HOUR, 20 * HOUR, 1 * DAY, 1.25 * DAY, 1.5 * DAY, 1.75 * DAY, 2 * DAY, 2.5 * DAY, 3 * DAY, 3.5 * DAY, 4 * DAY, 5 * DAY, 6 * DAY, 7 * DAY, 8 * DAY, 9 * DAY];
/** Barrels or launch tubes (muzzles) per level. */
const BARRELS = [2, 2, 4, 1, 1, 2, 2, 2, 2, 2, 2, 8, 12, 16, 24, 12, 18, 16, 20, 24];
/** Bursts (or salvoes) per second. */
const RATE = [1.0, 1.0, 1.1, 0.8, 0.85, 1.0, 1.0, 1.05, 1.1, 1.1, 1.2, 0.9, 0.95, 1.0, 1.05, 1.0, 1.05, 1.1, 1.15, 1.2];

export const AIR_DEFENCE_LEVELS: LevelStats[] = TITLES.map((title, i) => {
  const level = i + 1;
  const dps = Math.round(40 * Math.pow(1.18, i));
  const range = Math.round((9 + (i * 2.5) / 19) * 10) / 10;
  const missiles = level >= 12;
  return {
    level, title,
    supplies: SUPPLIES[i],
    reputation: REPUTATION[i],
    buildTime: TIME[i],
    hp: Math.round((1100 * Math.pow(1.2, i)) / 10) * 10,
    stats: { dps, range, rate: RATE[i], barrels: BARRELS[i] },
    unlocks: [
      `Hits flying raiders only, ${dps} damage/s`,
      `Range ${range} tiles`,
      `${BARRELS[i]} ${missiles ? 'launch tubes' : BARRELS[i] > 1 ? 'barrels' : 'barrel'}`,
    ],
  };
});

// ------------------------------------------------------------------ palette

const OLIVE = '#5b6b3a';
const OLIVE_D = '#46542c';
const BERET = '#2a3326';
const SKIN = ['#e0ac7e', '#c68b5f', '#a8714b', '#f0c39a'];
const GUN = '#3d4247';
const GUN_OD = '#55603a';
const AMMO = '#4f5d34';
const BRASS = '#d9a640';
const DIRT = '#b98a5a';
const HAZ = '#f2c230';
const CANVAS = '#b9a878';
const TEAL = '#2bb3a3';
const ARMOR = '#5c6870';
const ARMOR_D = '#4a555c';
const STEEL = '#9aa3a6';
const M = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8, ...o });
const glow = (c: string, i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, flatShading: true });
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const rnd = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const smooth = (u: number) => {
  const c = Math.min(1, Math.max(0, u));
  return c * c * (3 - 2 * c);
};

// ------------------------------------------------------------------ primitives

/** Cylinder along +x starting at x (rTop is the far end's radius). */
function rodX(k: Kit, parent: THREE.Object3D, r: number, len: number, color: string, x: number, y: number, z: number, sides = 8, rTop = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, len, sides).rotateZ(-Math.PI / 2).translate(len / 2, 0, 0), mat(color));
  m.position.set(x, y, z);
  return k.add(m, parent);
}

/** Upright cylinder with its base at y, under any parent. */
function cylP(k: Kit, parent: THREE.Object3D, r: number, h: number, color: string, x: number, y: number, z: number, sides = 8, rTop = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, sides), mat(color));
  m.position.set(x, y + h / 2, z);
  return k.add(m, parent);
}

/** Cylinder between two points (legs, braces, guy wires). */
function strut(k: Kit, a: THREE.Vector3, b: THREE.Vector3, r: number, color: string, parent: THREE.Object3D = k.group, sides = 5) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), sides), mat(color));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  return k.add(m, parent);
}

/** Ring of sandbags around (cx, cz) with an entrance gap facing gapA (+z is π/2). */
function bagRing(k: Kit, cx: number, cz: number, r: number, layers: number, y: number, gapW = 0.8, gapA = Math.PI / 2) {
  const geo = new THREE.BoxGeometry(0.26, 0.11, 0.17);
  const tones = ['#cdb98a', '#c2ad7e', '#d6c497', '#b9a374'];
  for (let l = 0; l < layers; l++) {
    const rr = r - l * 0.02;
    const n = Math.max(8, Math.round((2 * Math.PI * rr) / 0.25));
    for (let i = 0; i < n; i++) {
      const a = ((i + (l % 2) * 0.5) / n) * Math.PI * 2;
      if (Math.abs(wrap(a - gapA)) < gapW / 2) continue;
      const m = new THREE.Mesh(geo, mat(tones[Math.floor(rnd(i * 7 + l * 13 + r) * 4)]));
      m.position.set(cx + Math.cos(a) * rr, y + 0.055 + l * 0.1, cz + Math.sin(a) * rr);
      m.rotation.y = -a - Math.PI / 2 + (rnd(i + l * 31) - 0.5) * 0.18;
      m.scale.set(0.95 + rnd(i * 3 + l) * 0.12, 0.92 + rnd(i * 5 + l) * 0.14, 1);
      k.add(m);
    }
  }
}

/** Segmented round parapet wall; cap 'kerb' paints the coping yellow/black. */
function ringWall(k: Kit, cx: number, cz: number, r: number, h: number, y: number, color: string, cap: string | 'kerb', gapW = 0.7, gapA = Math.PI / 2, thick = 0.14) {
  const n = Math.max(12, Math.round((2 * Math.PI * r) / 0.2));
  const seg = ((2 * Math.PI * r) / n) * 1.04;
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2;
    if (Math.abs(wrap(a - gapA)) < gapW / 2) continue;
    const px = cx + Math.cos(a) * r, pz = cz + Math.sin(a) * r;
    k.box(seg, h, thick, color, px, y, pz).rotation.y = -a - Math.PI / 2;
    const cc = cap === 'kerb' ? (i % 2 ? C.kerbB : C.kerbY) : cap;
    k.box(seg, 0.04, thick + 0.03, cc, px, y + h, pz).rotation.y = -a - Math.PI / 2;
  }
}

function signMat(text: string, bg: string, fg: string, font = 40) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = fg;
  g.font = `900 ${font}px Nunito, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
}

/** Flat sign with lettering on its +z face. */
function board(k: Kit, text: string, w: number, h: number, x: number, y: number, z: number, bg: string, fg = '#ffffff', rotY = 0, font = 40) {
  const side = M(bg);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), [side, side, side, side, signMat(text, bg, fg, font), side]);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = rotY;
  return k.add(m);
}

/** Sign on a post. */
function postSign(k: Kit, text: string, x: number, z: number, y: number, bg = HAZ, fg = '#2a2a28', rotY = 0, h = 0.5, post: string = C.metal) {
  k.box(0.04, h, 0.04, post, x, y, z);
  board(k, text, 0.46, 0.15, x + Math.sin(rotY) * 0.03, y + h - 0.1, z + Math.cos(rotY) * 0.03, bg, fg, rotY, 36);
}

/** Emissive screen panel facing +z (or turned by rotY). */
function screen(k: Kit, w: number, h: number, x: number, y: number, z: number, color = '#3fd1ff', rotY = 0, parent: THREE.Object3D = k.group) {
  const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012), glow(color, 0.8));
  s.position.set(x, y + h / 2, z);
  s.rotation.y = rotY;
  return k.add(s, parent);
}

// ------------------------------------------------------------------ people

interface Figure { root: THREE.Group; legL: THREE.Object3D; legR: THREE.Object3D; armL: THREE.Object3D; armR: THREE.Object3D }
type Hat = 'beret' | 'helmet' | 'cap' | 'headset' | null;

/** ~0.6-tall low-poly crew member facing +x, with pivoting limbs. */
function figure(seed: number, hat: Hat = 'helmet', uniform = OLIVE, trousers = OLIVE_D): Figure {
  const root = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, c: string, x: number, yy: number, z: number, parent: THREE.Object3D = root) => {
    const m = new THREE.Mesh(geo, M(c));
    m.position.set(x, yy, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const limb = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, -h / 2, 0);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(0, 0.26, -0.045);
  legR.position.set(0, 0.26, 0.045);
  for (const l of [legL, legR]) {
    add(limb(0.065, 0.22, 0.065), trousers, 0, 0, 0, l);
    add(new THREE.BoxGeometry(0.09, 0.045, 0.07), '#2a2b2d', 0.012, -0.24, 0, l);
    root.add(l);
  }
  add(new THREE.BoxGeometry(0.12, 0.2, 0.17), uniform, 0, 0.36, 0);
  add(new THREE.BoxGeometry(0.125, 0.03, 0.175), '#2a2b2d', 0, 0.27, 0);
  const skin = SKIN[seed % SKIN.length];
  add(new THREE.IcosahedronGeometry(0.062, 0), skin, 0, 0.52, 0);
  if (hat === 'beret') add(new THREE.CylinderGeometry(0.068, 0.07, 0.03, 8), BERET, -0.005, 0.575, 0.01).rotation.x = 0.2;
  else if (hat === 'helmet') {
    add(new THREE.SphereGeometry(0.074, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), OLIVE_D, 0, 0.54, 0);
    add(new THREE.CylinderGeometry(0.082, 0.082, 0.012, 8), OLIVE_D, 0, 0.54, 0);
  } else if (hat === 'cap') {
    add(new THREE.CylinderGeometry(0.064, 0.066, 0.04, 8), OLIVE_D, 0, 0.575, 0);
    add(new THREE.BoxGeometry(0.06, 0.012, 0.08), OLIVE_D, 0.06, 0.56, 0);
  } else if (hat === 'headset') {
    add(new THREE.BoxGeometry(0.02, 0.02, 0.15), '#2a2b2d', 0, 0.59, 0);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.04, 0.05, 0.02), '#2a2b2d', 0, 0.53, s * 0.07);
    add(new THREE.BoxGeometry(0.05, 0.01, 0.01), '#2a2b2d', 0.04, 0.5, 0.065);
  }
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(0, 0.45, -0.105);
  armR.position.set(0, 0.45, 0.105);
  for (const a of [armL, armR]) {
    add(limb(0.05, 0.18, 0.05), uniform, 0, 0, 0, a);
    add(new THREE.BoxGeometry(0.045, 0.04, 0.045), skin, 0, -0.19, 0, a);
    root.add(a);
  }
  return { root, legL, legR, armL, armR };
}

function pose(f: Figure, walk: number, amp = 0.5) {
  const s = Math.sin(walk);
  f.legL.rotation.z = s * amp;
  f.legR.rotation.z = -s * amp;
  f.armL.rotation.z = -s * amp * 0.8;
  f.armR.rotation.z = s * amp * 0.8;
}

const face = (dx: number, dz: number) => Math.atan2(-dz, dx);

/** Seated crew member: hips at seatY in parent space, legs forward. */
function seated(k: Kit, parent: THREE.Object3D, x: number, seatY: number, z: number, rotY = 0, seed = 0, hat: Hat = 'helmet', uniform = OLIVE) {
  const f = figure(seed, hat, uniform);
  f.root.position.set(x, seatY - 0.25, z);
  f.root.rotation.y = rotY;
  f.legL.rotation.z = f.legR.rotation.z = 1.45;
  f.armL.rotation.z = f.armR.rotation.z = 1.2;
  k.add(f.root, parent);
  return f;
}

/** Gun-layer: hands on the controls, arms follow the barrel elevation and twitch while tracking. */
function gunner(k: Kit, f: Figure, pitch: THREE.Object3D, base = 1.25, seed = 0) {
  k.anims.push((t) => {
    const e = pitch.rotation.z;
    f.armL.rotation.z = base - e * 0.35 + Math.sin(t * 2.3 + seed) * 0.06;
    f.armR.rotation.z = base - e * 0.35 + Math.sin(t * 2.1 + seed + 1) * 0.06;
  });
}

/** Spotter with binoculars to the sky, slowly scanning. */
function spotter(k: Kit, x: number, z: number, y: number, rotY: number, seed = 1, hat: Hat = 'beret', parent: THREE.Object3D = k.group) {
  const f = figure(seed, hat);
  f.root.position.set(x, y, z);
  k.add(f.root, parent);
  f.armL.rotation.z = f.armR.rotation.z = 2.3;
  f.armL.rotation.x = -0.25;
  f.armR.rotation.x = 0.25;
  const bino = new THREE.Group();
  bino.position.set(0.08, 0.57, 0);
  bino.rotation.z = 0.5;
  for (const s of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.07, 6).rotateZ(Math.PI / 2), M('#2a2b2d'));
    b.position.set(0, 0, s * 0.025);
    bino.add(b);
  }
  f.root.add(bino);
  k.anims.push((t) => {
    f.root.rotation.y = rotY + Math.sin(t * 0.37 + seed) * 0.9;
    bino.rotation.z = 0.5 + Math.sin(t * 0.6 + seed) * 0.2;
  });
  return f;
}

/** Crew member walking to and fro carrying something (ammo box, clip, canister). */
function carrier(k: Kit, y: number, x0: number, z0: number, x1: number, z1: number, period: number, seed: number, load: 'box' | 'clip' | 'shell' | 'tablet' = 'box', hat: Hat = 'helmet', uniform = OLIVE) {
  const f = figure(seed, hat, uniform);
  k.add(f.root);
  const item = new THREE.Group();
  item.position.set(0.13, 0.3, 0);
  if (load === 'box') {
    item.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.16), M(AMMO)));
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.102, 0.015, 0.162), M(HAZ));
    s.position.y = 0.02;
    item.add(s);
  } else if (load === 'clip') {
    for (let i = 0; i < 4; i++) {
      const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 6), M(BRASS));
      sh.position.set(0, 0.05, -0.06 + i * 0.04);
      item.add(sh);
    }
  } else if (load === 'shell') {
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.28, 8).rotateX(Math.PI / 2), M('#e8e6e0'));
    item.add(sh);
  } else {
    item.position.set(0.1, 0.36, 0);
    item.add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.09, 0.12), M('#2a2b2d')));
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.07, 0.1), glow('#3fd1ff', 0.8));
    item.add(s);
  }
  f.root.add(item);
  k.anims.push((t) => {
    const p = ((((t + seed * 2.3) % period) + period) % period) / period;
    const fwd = p < 0.5;
    const u = smooth(fwd ? p * 2 : 2 - p * 2);
    f.root.position.set(x0 + (x1 - x0) * u, y, z0 + (z1 - z0) * u);
    const turning = Math.min(p, Math.abs(p - 0.5), 1 - p) < 0.05;
    pose(f, turning ? 0 : t * 8, 0.45);
    f.armL.rotation.z = f.armR.rotation.z = load === 'tablet' ? 1.1 : 1.2;
    f.root.rotation.y = fwd ? face(x1 - x0, z1 - z0) : face(x0 - x1, z0 - z1);
    item.visible = load === 'tablet' || fwd;
  });
  return f;
}

/** Operator at a console: types, glances up. */
function operator(k: Kit, x: number, seatY: number, z: number, rotY: number, seed = 2, hat: Hat = 'headset', uniform = OLIVE, parent: THREE.Object3D = k.group) {
  const f = seated(k, parent, x, seatY, z, rotY, seed, hat, uniform);
  k.anims.push((t) => {
    f.armL.rotation.z = 1.1 + Math.sin(t * 7 + seed) * 0.12;
    f.armR.rotation.z = 1.1 + Math.sin(t * 6.3 + seed + 2) * 0.12;
    f.root.rotation.y = rotY + Math.sin(t * 0.45 + seed) * 0.25;
  });
  return f;
}

// ------------------------------------------------------------------ radars

type RadarStyle = 'yagi' | 'bedspring' | 'truss' | 'planar' | 'aesa';

/**
 * Rotating search radar on its own turning head at (x, y, z). Open-frame
 * arrays early (Yagi, "bedspring" dipole grid, orange-peel truss), solid
 * planar panels and dark phased-array (AESA) faces later.
 */
function radar(k: Kit, x: number, y: number, z: number, style: RadarStyle, s = 1, speed = 1.1, parent: THREE.Object3D = k.group, opts: { gold?: boolean; iff?: boolean; dark?: boolean } = {}) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  k.add(g, parent);
  const metal = STEEL;
  if (style === 'yagi') {
    k.box(0.07, 0.08, 0.07, C.wood, 0, 0, 0, g);
    rodX(k, g, 0.012, 0.72 * s, metal, -0.3 * s, 0.11, 0, 5);
    for (let i = 0; i < 5; i++) k.box(0.012, 0.012, (0.4 - i * 0.05) * s, i === 0 ? '#d8342c' : C.white, (-0.26 + i * 0.16) * s, 0.104, 0, g);
    // Second, vertical stack for a chunkier read
    k.box(0.012, 0.22 * s, 0.012, metal, -0.26 * s, 0.11, 0, g);
    for (let i = 0; i < 4; i++) k.box(0.012, 0.012, (0.3 - i * 0.04) * s, C.white, (-0.2 + i * 0.16) * s, 0.28 * s, 0, g);
    rodX(k, g, 0.01, 0.62 * s, metal, -0.26 * s, 0.29 * s, 0, 4);
  } else if (style === 'bedspring') {
    const w = 0.72 * s, h = 0.46 * s;
    k.box(0.08, 0.12, 0.08, metal, 0, 0, 0, g);
    k.box(0.06, 0.04, w * 0.6, metal, 0, 0.12, 0, g);
    const f = new THREE.Group();
    f.position.set(0.04, 0.14, 0);
    f.rotation.z = 0.14;
    g.add(f);
    const c = '#b8c0c4';
    k.box(0.03, 0.03, w, c, 0, 0, 0, f);
    k.box(0.03, 0.03, w, c, 0, h, 0, f);
    for (const sz of [-1, 1]) k.box(0.03, h, 0.03, c, 0, 0, (sz * w) / 2, f);
    for (let i = 1; i < 5; i++) k.box(0.014, h, 0.014, c, 0, 0, -w / 2 + (w * i) / 5, f);
    for (let j = 1; j < 3; j++) k.box(0.014, 0.014, w, c, 0, (h * j) / 3, 0, f);
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
      const zz = -w / 2 + (w * (i + 0.5)) / 5, yy = (h * (j + 0.5)) / 3;
      k.box(0.06, 0.01, 0.01, C.white, 0.03, yy, zz, f);
      k.box(0.01, 0.01, 0.1 * s, C.white, 0.06, yy, zz, f);
    }
    // Reflector screen of rods behind, on stand-offs
    for (let j = 0; j < 4; j++) k.box(0.012, 0.012, w, '#7f878b', -0.08, (h * j) / 3, 0, f);
    for (const sz of [-1, 0, 1]) k.box(0.08, 0.012, 0.012, '#7f878b', -0.04, h / 2, (sz * w) / 2.2, f);
  } else if (style === 'truss') {
    const w = 1.0 * s, h = 0.34 * s;
    cylP(k, g, 0.09, 0.12, metal, 0, 0, 0, 10);
    k.box(0.1, 0.12, 0.3 * s, metal, 0, 0.12, 0, g);
    const f = new THREE.Group();
    f.position.set(0.02, 0.2, 0);
    f.rotation.z = 0.22;
    g.add(f);
    const N = 6;
    const pt = (i: number, yy: number) => {
      const zz = -w / 2 + (w * i) / N;
      const u = (2 * zz) / w;
      return V(-0.14 * s * (1 - u * u), yy, zz);
    };
    for (let i = 0; i < N; i++) {
      for (const yy of [0, h]) strut(k, pt(i, yy), pt(i + 1, yy), 0.016, C.white, f, 4);
      strut(k, pt(i, 0), pt(i + 1, h), 0.01, '#b8c0c4', f, 4);
      for (let j = 1; j < 4; j++) strut(k, pt(i, (h * j) / 4), pt(i + 1, (h * j) / 4), 0.006, '#b8c0c4', f, 3);
    }
    for (let i = 0; i <= N; i++) strut(k, pt(i, 0), pt(i, h), 0.014, C.white, f, 4);
    // Feed horn on a boom
    strut(k, V(-0.06, 0, 0), V(0.32 * s, h * 0.35, 0), 0.016, metal, f, 4);
    k.box(0.08, 0.07, 0.12, '#33383d', 0.32 * s, h * 0.35 - 0.03, 0, f);
    if (opts.iff ?? true) {
      k.box(0.03, 0.03, w * 0.7, '#d8342c', -0.1, h + 0.08, 0, f);
      for (const sz of [-1, 1]) k.box(0.02, 0.08, 0.02, metal, -0.1, h, sz * w * 0.25, f);
    }
  } else if (style === 'planar') {
    const w = 0.8 * s, h = 0.5 * s;
    cylP(k, g, 0.12 * s, 0.14, C.white, 0, 0, 0, 12);
    cylP(k, g, 0.125 * s, 0.03, TEAL, 0, 0.1, 0, 12);
    const f = new THREE.Group();
    f.position.set(0, 0.16, 0);
    f.rotation.z = 0.12;
    g.add(f);
    k.box(0.08, h, w, opts.dark ? '#4a555c' : C.white, 0, 0, 0, f);
    for (const sx of [-1, 1]) {
      k.box(0.01, h - 0.06, w - 0.06, opts.dark ? '#2a3238' : '#5f7a8a', sx * 0.042, 0.03, 0, f);
      k.box(0.012, 0.03, w - 0.04, TEAL, sx * 0.044, 0.035, 0, f);
      for (let i = 1; i < 4; i++) k.box(0.012, h - 0.08, 0.012, '#8aa0ad', sx * 0.046, 0.04, -w / 2 + (w * i) / 4, f);
    }
    if (opts.iff ?? true) {
      k.box(0.05, 0.05, w * 0.8, C.white, 0, h + 0.04, 0, f);
      for (const sz of [-1, 1]) k.box(0.03, 0.05, 0.03, C.white, 0, h, sz * w * 0.3, f);
    }
  } else {
    const w = 0.8 * s, h = 0.6 * s;
    const rim = opts.gold ? GOLD : ARMOR_D;
    cylP(k, g, 0.16 * s, 0.16, ARMOR, 0, 0, 0, 8);
    if (opts.gold) cylP(k, g, 0.165 * s, 0.03, GOLD, 0, 0.12, 0, 8);
    const f = new THREE.Group();
    f.position.set(0, 0.18, 0);
    f.rotation.z = 0.18;
    g.add(f);
    // A-frame of two back-to-back faces
    for (const sx of [-1, 1]) {
      const p = new THREE.Group();
      p.position.set(sx * 0.07, 0, 0);
      p.rotation.z = -sx * 0.22;
      f.add(p);
      k.box(0.06, h, w, rim, 0, 0, 0, p);
      k.box(0.012, h - 0.06, w - 0.06, '#2a3238', sx * 0.032, 0.03, 0, p);
      const nx = 6, ny = 4;
      const cells = new THREE.InstancedMesh(new THREE.BoxGeometry(0.01, (h - 0.1) / ny - 0.02, (w - 0.1) / nx - 0.02), glow('#7fd8ff', 0.5), nx * ny);
      const m4 = new THREE.Matrix4();
      let n = 0;
      for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
        m4.makeTranslation(sx * 0.04, 0.05 + ((h - 0.1) * (b + 0.5)) / ny, -(w - 0.1) / 2 + ((w - 0.1) * (a + 0.5)) / nx);
        cells.setMatrixAt(n++, m4);
      }
      p.add(cells);
    }
    k.box(0.22, 0.06, w * 0.5, rim, 0, h * 0.95, 0, f);
  }
  const ph = x * 3 + z;
  k.anims.push((t) => (g.rotation.y = t * speed + ph));
  return g;
}

/** Fire-control tracking radar (small flat dish) that elevates with the guns. */
function trackingDish(k: Kit, parent: THREE.Object3D, pitch: THREE.Object3D, x: number, y: number, z: number, r = 0.14, color: string = C.white) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  k.add(g, parent);
  k.box(0.06, 0.06, 0.06, GUN, -0.03, -0.03, 0, g);
  const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, 0.05, 14).rotateZ(-Math.PI / 2), mat(color));
  d.position.set(0.05, 0, 0);
  k.add(d, g);
  rodX(k, g, 0.012, 0.12, GUN, 0.08, 0, 0, 4);
  k.box(0.03, 0.03, 0.03, '#d8342c', 0.2, -0.015, 0, g);
  k.anims.push((t) => (g.rotation.z = pitch.rotation.z * 0.9 + Math.sin(t * 5) * 0.03));
  return g;
}

// ------------------------------------------------------------------ weapons

interface Missile { obj: THREE.Object3D; muzzle: THREE.Object3D; rest: number }
interface Rig { yaw: THREE.Group; pitch: THREE.Group; muzzles: THREE.Object3D[]; recoil: THREE.Object3D[]; missiles: Missile[] }

/** Yaw pivot at (x, y, z) with a pitch pivot ph above it. The weapon is built along +x. */
function rig(k: Kit, x: number, y: number, z: number, ph: number, px = 0): Rig {
  const yaw = new THREE.Group();
  yaw.position.set(x, y, z);
  const pitch = new THREE.Group();
  pitch.position.set(px, ph, 0);
  yaw.add(pitch);
  k.add(yaw);
  return { yaw, pitch, muzzles: [], recoil: [], missiles: [] };
}

/** Belt-fed machine gun on the pitch cradle at lateral offset z. */
function mg(k: Kit, r: Rig, z: number, len = 0.5, yy = 0, can = 0) {
  const p = r.pitch;
  k.box(0.28, 0.08, 0.075, GUN, 0.0, yy - 0.04, z, p);
  k.box(0.07, 0.06, 0.06, '#2a2b2d', -0.17, yy - 0.03, z, p);
  for (const s of [-1, 1]) k.box(0.08, 0.016, 0.016, '#2a2b2d', -0.24, yy - 0.01, z + s * 0.026, p);
  k.box(0.1, 0.012, 0.03, BRASS, 0.02, yy - 0.06, z, p).rotation.z = -0.5; // cartridge chute
  const g = new THREE.Group();
  g.position.set(0, yy, z);
  p.add(g);
  rodX(k, g, 0.017, len, GUN, 0.14, 0, 0, 6);
  rodX(k, g, 0.029, len * 0.5, '#2a2f33', 0.14, 0, 0, 8);
  for (let i = 0; i < 4; i++) rodX(k, g, 0.032, 0.014, '#5d6368', 0.16 + i * len * 0.12, 0, 0, 8);
  rodX(k, g, 0.026, 0.07, '#2a2b2d', 0.14 + len, 0, 0, 6, 0.034);
  const m = new THREE.Object3D();
  m.position.set(0.14 + len + 0.09, 0, 0);
  g.add(m);
  r.muzzles.push(m);
  r.recoil.push(g);
  if (can) {
    // Ammo can hung on the cradle, belt of brass links up into the feed
    const cz = z + can * 0.1;
    k.box(0.15, 0.12, 0.08, AMMO, -0.02, yy - 0.2, cz, p);
    k.box(0.152, 0.02, 0.082, HAZ, -0.02, yy - 0.14, cz, p);
    for (let i = 0; i < 5; i++) {
      const u = i / 4;
      k.box(0.03, 0.02, 0.03, BRASS, -0.02 + u * 0.02, yy - 0.08 + u * 0.05, cz - can * u * 0.065, p).rotation.x = can * 0.6;
    }
  }
}

/** Autocannon on the pitch cradle at lateral offset z; clip = ready rounds on the feed. */
function cannon(k: Kit, r: Rig, z: number, len = 0.9, o: { brake?: boolean; clip?: number; body?: string; rb?: number; jacket?: boolean } = {}) {
  const p = r.pitch, body = o.body ?? GUN_OD, rb = o.rb ?? 0.034;
  k.box(0.42, 0.15, 0.14, body, -0.06, -0.09, z, p);
  k.box(0.1, 0.08, 0.1, GUN, -0.31, -0.07, z, p);
  rodX(k, p, 0.03, 0.34, GUN, 0.14, -0.065, z, 8);
  k.box(0.12, 0.016, 0.04, BRASS, -0.08, -0.12, z, p).rotation.z = -0.6; // spent-case chute
  const g = new THREE.Group();
  g.position.set(0, 0, z);
  p.add(g);
  rodX(k, g, rb * 1.5, 0.12, GUN, 0.12, 0, 0, 8);
  rodX(k, g, rb, len, GUN, 0.2, 0, 0, 8);
  if (o.jacket) rodX(k, g, rb * 1.35, len * 0.4, '#2a2f33', 0.24, 0, 0, 8);
  rodX(k, g, rb * 1.15, 0.05, '#5d6368', 0.2 + len * 0.6, 0, 0, 8);
  if (o.brake ?? true) {
    rodX(k, g, rb * 1.7, 0.12, '#2a2b2d', 0.2 + len, 0, 0, 8);
    for (const s of [-1, 1]) k.box(0.05, 0.01, 0.01, '#5d6368', 0.26 + len, s * rb * 1.2, 0, g);
  } else rodX(k, g, rb * 1.1, 0.15, '#2a2b2d', 0.2 + len, 0, 0, 8, rb * 2);
  const m = new THREE.Object3D();
  m.position.set(0.2 + len + 0.16, 0, 0);
  g.add(m);
  r.muzzles.push(m);
  r.recoil.push(g);
  if (o.clip) {
    k.box(0.18, 0.05, 0.1, GUN, -0.06, 0.06, z, p);
    for (let i = 0; i < o.clip; i++) {
      cylP(k, p, 0.02, 0.15, BRASS, -0.12 + i * 0.04, 0.1, z, 6);
      cylP(k, p, 0.02, 0.04, '#d8342c', -0.12 + i * 0.04, 0.25, z, 6, 0.008);
    }
  }
}

/**
 * Missile pod on the pitch cradle at lateral offset z: rows × cols tubes, each
 * a muzzle with a missile whose nose shows; the pod kicks back on launch and
 * the fired missile is reloaded, sliding back up the tube.
 */
function pod(k: Kit, r: Rig, z: number, rows: number, cols: number, o: { cell?: number; len?: number; body?: string; frame?: string; nose?: string; yy?: number; lid?: boolean } = {}) {
  const cell = o.cell ?? 0.12, len = o.len ?? 0.6, body = o.body ?? C.white, nose = o.nose ?? '#d8342c';
  const H = rows * cell + 0.05, W = cols * cell + 0.05;
  const b = new THREE.Group();
  b.position.set(0, o.yy ?? 0, z);
  r.pitch.add(b);
  const x0 = -0.22, xf = len - 0.22;
  k.box(len, H, W, body, x0 + len / 2, -H / 2, 0, b);
  k.box(0.04, H + 0.03, W + 0.03, o.frame ?? GUN, xf - 0.02, -H / 2 - 0.015, 0, b);
  k.box(0.05, H + 0.03, W + 0.03, o.frame ?? GUN, x0 + 0.05, -H / 2 - 0.015, 0, b);
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const cy = -H / 2 + 0.025 + cell * (i + 0.5), cz = -W / 2 + 0.025 + cell * (j + 0.5);
    rodX(k, b, cell * 0.43, 0.025, '#1e2226', xf + 0.005, cy, cz, 10);
    const ms = new THREE.Group();
    const rest = xf - 0.3;
    ms.position.set(rest, cy, cz);
    rodX(k, ms, cell * 0.28, 0.3, '#f4f4f0', 0, 0, 0, 8);
    rodX(k, ms, cell * 0.28, 0.1, nose, 0.3, 0, 0, 8, 0.004);
    b.add(ms);
    const mz = new THREE.Object3D();
    mz.position.set(xf + 0.1, cy, cz);
    b.add(mz);
    r.muzzles.push(mz);
    r.missiles.push({ obj: ms, muzzle: mz, rest });
  }
  r.recoil.push(b);
  return { body: b, H, W, xf };
}

/** Armoured flip-up lid over a pod's tube face, hinged at the top. */
function podLid(k: Kit, b: THREE.Object3D, H: number, W: number, xf: number, color = ARMOR) {
  const lid = new THREE.Group();
  lid.position.set(xf + 0.03, H / 2, 0);
  b.add(lid);
  k.box(0.03, H + 0.02, W + 0.02, color, 0, -H - 0.01, 0, lid);
  k.box(0.032, 0.03, W + 0.02, HAZ, 0, -H * 0.5, 0, lid);
  return lid;
}

/** Register the weapon with the combat rig and give it a sky-scanning idle. */
function arm(k: Kit, r: Rig, lv: number, o: { kick?: number; turn?: number; home?: number; pitch?: number; stow?: boolean } = {}) {
  const home = o.home ?? -0.75;
  const base = o.pitch ?? 1.0;
  const idle = (t: number) => {
    r.yaw.rotation.y = home + Math.sin(t * 0.23 + lv) * 1.25 + Math.sin(t * 0.09 + lv * 2) * 0.6;
    let e = base + Math.sin(t * 0.5 + lv) * 0.14;
    if (o.stow) {
      // Periodically stows level under its armour, then raises again
      const c = (((t % 22) + 22) % 22) / 22;
      const down = c < 0.12 ? 0 : c < 0.2 ? (c - 0.12) / 0.08 : c < 0.34 ? 1 : c < 0.42 ? 1 - (c - 0.34) / 0.08 : 0;
      e *= 1 - smooth(down);
    }
    r.pitch.rotation.z = e;
  };
  const tur = k.turret({ yaw: r.yaw, pitch: r.pitch, muzzles: r.muzzles, recoil: r.recoil, weapon: 'flak', targets: 'air', rate: RATE[lv - 1], turnRate: o.turn ?? 2.2, kick: o.kick ?? 0.08, idle });
  idle(0);
  if (r.missiles.length) reload(k, tur, r.missiles);
  return tur;
}

/** Fired missiles vanish from their tube and are reloaded, sliding back up into place. */
function reload(k: Kit, tur: Turret, missiles: Missile[]) {
  let now = 0;
  const fired = missiles.map(() => -99);
  const w = new THREE.Vector3();
  tur.onFire.push((shot) => {
    let best = 0, bd = Infinity;
    missiles.forEach((m, i) => {
      const d = m.muzzle.getWorldPosition(w).distanceToSquared(shot.from);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    fired[best] = now;
  });
  k.anims.push((t) => {
    now = t;
    missiles.forEach((m, i) => {
      const dt = t - fired[i];
      m.obj.visible = !(dt >= 0 && dt < 0.3);
      m.obj.position.x = dt >= 0.3 && dt < 2.4 ? m.rest - 0.35 * (1 - smooth((dt - 0.3) / 2.1)) : m.rest;
    });
  });
}

/** Lids that open while the weapon is raised or engaging and close when it stows. */
function lidsFollow(k: Kit, lids: THREE.Object3D[], pitch: THREE.Object3D, tur: Turret, maxOpen = 1.9) {
  let o = 0, last = 0;
  k.anims.push((t) => {
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    const want = tur.target || pitch.rotation.z > 0.35 ? 1 : 0;
    o += THREE.MathUtils.clamp(want - o, -dt * 2.5, dt * 2.5);
    if (dt === 0) o = want;
    for (const l of lids) l.rotation.z = smooth(o) * maxOpen;
  });
}

// ------------------------------------------------------------------ props

function ammoBoxes(k: Kit, x: number, z: number, y: number, n = 3, rotY = 0) {
  for (let i = 0; i < n; i++) {
    const lx = (i % 2) * 0.18 - 0.09, ly = Math.floor(i / 2) * 0.1, lz = (rnd(i + x) - 0.5) * 0.04;
    const px = x + Math.cos(rotY) * lx + Math.sin(rotY) * lz, pz = z - Math.sin(rotY) * lx + Math.cos(rotY) * lz;
    k.box(0.16, 0.1, 0.1, AMMO, px, y + ly, pz).rotation.y = rotY + (rnd(i * 3 + z) - 0.5) * 0.2;
    k.box(0.162, 0.018, 0.102, HAZ, px, y + ly + 0.06, pz).rotation.y = rotY;
  }
}

function brass(k: Kit, x: number, z: number, y: number, n = 6, spread = 0.2) {
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 5).rotateZ(Math.PI / 2), mat(BRASS));
    c.position.set(x + (rnd(i * 7 + x) - 0.5) * spread, y + 0.012, z + (rnd(i * 11 + z) - 0.5) * spread);
    c.rotation.y = rnd(i * 13) * 3;
    k.add(c);
  }
}

/** Rack of ready rounds (brass cases, red tips). */
function shellRack(k: Kit, x: number, z: number, y: number, n = 6, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  k.add(g);
  k.box(0.08 * n + 0.08, 0.04, 0.16, C.wood, 0, 0, 0, g);
  k.box(0.08 * n + 0.08, 0.03, 0.04, C.wood, 0, 0.16, -0.05, g);
  for (const s of [-1, 1]) k.box(0.03, 0.22, 0.14, C.wood, (s * (0.08 * n + 0.04)) / 2, 0, 0, g);
  for (let i = 0; i < n; i++) {
    cylP(k, g, 0.025, 0.2, BRASS, -0.04 * (n - 1) + i * 0.08, 0.04, 0.01, 6);
    cylP(k, g, 0.025, 0.05, '#d8342c', -0.04 * (n - 1) + i * 0.08, 0.24, 0.01, 6, 0.006);
  }
}

/** Ground cable run between two points. */
function cable(k: Kit, x0: number, z0: number, x1: number, z1: number, y: number) {
  strut(k, V(x0, y + 0.012, z0), V(x1, y + 0.012, z1), 0.012, '#2a2b2d', k.group, 4);
}

/** Generator set with a spinning radiator fan and an exhaust that smokes. */
function generator(k: Kit, x: number, z: number, y: number, color = OLIVE, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  k.add(g);
  k.box(0.44, 0.04, 0.3, '#33383d', 0, 0, 0, g);
  k.box(0.4, 0.26, 0.26, color, 0, 0.04, 0, g);
  k.box(0.02, 0.2, 0.2, '#2a2b2d', 0.21, 0.07, 0, g);
  const fan = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.17, 0.03), mat('#9aa3a6'));
  fan.position.set(0.225, 0.17, 0);
  const fan2 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.17), mat('#9aa3a6'));
  fan.add(fan2);
  k.add(fan, g);
  k.anims.push((t) => (fan.rotation.x = t * 11));
  k.box(0.03, 0.18, 0.03, '#2a2b2d', -0.14, 0.3, -0.08, g);
  const p = new THREE.Vector3(-0.14, 0.5, -0.08).applyAxisAngle(V(0, 1, 0), rotY).add(V(x, y, z));
  k.emitters.push({ pos: p, kind: 'smoke' });
  k.box(0.1, 0.08, 0.02, HAZ, 0.05, 0.16, 0.135, g);
}

/** Cooling fan unit (horizontal fan in a frame) on top of a cabin. */
function roofFan(k: Kit, x: number, y: number, z: number, r = 0.14, color = '#e8e6e0') {
  k.box(r * 2.4, 0.12, r * 2.4, color, x, y, z);
  k.cyl(r, 0.02, '#2a2b2d', x, y + 0.12, z, 12);
  const b = new THREE.Group();
  b.position.set(x, y + 0.14, z);
  k.add(b);
  for (let i = 0; i < 3; i++) k.box(r * 1.9, 0.012, 0.04, '#7a8085', 0, 0, 0, b).rotation.y = (i * Math.PI) / 3;
  k.anims.push((t) => (b.rotation.y = t * 7 + x));
}

/** Steel lattice tower (four legs, X-braced) with a deck on top; returns the deck height. */
function lattice(k: Kit, x: number, z: number, y: number, h: number, base = 0.5, top = 0.3, color = STEEL) {
  const segs = Math.max(2, Math.round(h / 0.4));
  const at = (sx: number, sz: number, u: number) => {
    const w = (base + (top - base) * u) / 2;
    return V(x + sx * w, y + h * u, z + sz * w);
  };
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [sx, sz] of corners) strut(k, at(sx, sz, 0), at(sx, sz, 1), 0.025, color, k.group, 5);
  for (let i = 0; i < segs; i++) {
    const u0 = i / segs, u1 = (i + 1) / segs;
    for (let c = 0; c < 4; c++) {
      const [ax, az] = corners[c], [bx, bz] = corners[(c + 1) % 4];
      strut(k, at(ax, az, u1), at(bx, bz, u1), 0.012, color, k.group, 4);
      strut(k, at(ax, az, u0), at(bx, bz, u1), 0.008, color, k.group, 3);
    }
  }
  k.box(top + 0.14, 0.05, top + 0.14, color, x, y + h, z);
  return y + h + 0.05;
}

/** Ladder up the side of something. */
function ladder(k: Kit, x: number, z: number, y: number, h: number, alongX = false, color = STEEL) {
  for (const s of [-1, 1]) k.box(alongX ? 0.02 : 0.02, h, 0.02, color, x + (alongX ? s * 0.07 : 0), y, z + (alongX ? 0 : s * 0.07));
  for (let i = 1; i < h / 0.1; i++) k.box(alongX ? 0.15 : 0.015, 0.015, alongX ? 0.015 : 0.15, color, x, y + i * 0.1, z);
}

/** Small timber or steel hut with a lean-to roof. */
function leanTo(k: Kit, x: number, z: number, y: number, w: number, d: number, h: number, roof: string = C.zinc, post: string = C.wood) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.05, h + (sz < 0 ? 0.12 : 0), 0.05, post, x + (sx * (w / 2 - 0.03)), y, z + (sz * (d / 2 - 0.03)));
  const r = k.box(w + 0.14, 0.035, d + 0.18, roof, x, y + h + 0.04, z);
  r.rotation.x = 0.16;
}

/** Concrete T-wall blast barrier. */
function tWall(k: Kit, x: number, z: number, y: number, rotY = 0, h = 0.85, color = CONCRETE) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  k.add(g);
  k.box(0.32, h, 0.09, color, 0, 0, 0, g);
  k.box(0.32, 0.12, 0.34, color, 0, 0, 0.04, g);
  k.box(0.33, 0.04, 0.1, HAZ, 0, h - 0.18, 0, g);
}

/** Phased-array face (dark cell grid) in the x/y plane facing +z, with a glowing scan bar sweeping across. */
function arrayFace(k: Kit, w: number, h: number, x: number, y: number, z: number, rotY = 0, frame = ARMOR_D, seed = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  k.add(g);
  k.box(w, h, 0.05, frame, 0, 0, 0, g);
  k.box(w - 0.06, h - 0.06, 0.02, '#232b31', 0, 0.03, 0.025, g);
  const nx = Math.max(3, Math.round(w / 0.1)), ny = Math.max(3, Math.round(h / 0.1));
  const cells = new THREE.InstancedMesh(new THREE.BoxGeometry((w - 0.1) / nx - 0.018, (h - 0.1) / ny - 0.018, 0.012), glow('#5fb8e0', 0.35), nx * ny);
  const m4 = new THREE.Matrix4();
  let n = 0;
  for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
    m4.makeTranslation(-(w - 0.1) / 2 + ((w - 0.1) * (a + 0.5)) / nx, 0.05 + ((h - 0.1) * (b + 0.5)) / ny, 0.04);
    cells.setMatrixAt(n++, m4);
  }
  g.add(cells);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.03, h - 0.1, 0.016), glow('#9ff0ff', 1.6));
  g.add(bar);
  k.anims.push((t) => bar.position.set(Math.sin(t * 1.3 + seed) * (w / 2 - 0.07), h / 2, 0.05));
  return g;
}

// ================================================================== Field 1–3

function lv1(k: Kit, y: number) {
  // Sandbag AA nest: twin MG on a timber tripod, Yagi spotting antenna on a bamboo pole, spotter with binoculars
  const cx = -0.2, cz = -0.1;
  k.cyl(0.66, 0.015, DIRT, cx, y, cz, 14);
  bagRing(k, cx, cz, 0.72, 2, y, 0.9);
  const top = y + 0.5;
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI * 2) / 3 + 0.5;
    strut(k, V(cx + Math.cos(a) * 0.36, y, cz + Math.sin(a) * 0.36), V(cx, top - 0.02, cz), 0.026, C.wood);
  }
  k.cyl(0.05, 0.05, GUN, cx, top - 0.04, cz, 8);
  const r = rig(k, cx, top, cz, 0.07);
  cylP(k, r.yaw, 0.024, 0.06, GUN, 0, 0, 0);
  for (const s of [-1, 1]) k.box(0.05, 0.1, 0.02, GUN, 0, 0.0, s * 0.12, r.yaw);
  k.box(0.16, 0.04, 0.22, GUN, 0, -0.03, 0, r.pitch);
  mg(k, r, 0.07, 0.48, 0, 1);
  mg(k, r, -0.07, 0.48, 0, -1);
  k.box(0.014, 0.1, 0.014, GUN, 0.16, 0.0, 0, r.pitch);
  const sight = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 4, 12).rotateY(Math.PI / 2), mat(GUN));
  sight.position.set(0.16, 0.14, 0);
  k.add(sight, r.pitch);
  const g = figure(0, 'helmet');
  g.root.position.set(-0.42, y + 0.015 - top, 0);
  k.add(g.root, r.yaw);
  gunner(k, g, r.pitch, 1.35);
  arm(k, r, 1, { kick: 0.05 });
  brass(k, cx + 0.1, cz + 0.15, y, 8, 0.3);
  ammoBoxes(k, cx - 0.45, cz - 0.3, y, 3, 0.5);
  // Spotter outside the nest
  spotter(k, 0.8, 0.62, y, -0.8, 1, 'beret');
  k.crates(-1.05, 0.95, y, 2);
  // Yagi spotting antenna on a guyed bamboo pole, field radio on a crate
  const mx = 0.98, mz = -0.95, mh = 1.3;
  bagRing(k, mx, mz, 0.16, 1, y, 0);
  k.cyl(0.03, mh, '#a9c95c', mx, y, mz, 6);
  for (const a of [0.4, 2.5, 4.4]) strut(k, V(mx, y + mh * 0.85, mz), V(mx + Math.cos(a) * 0.4, y, mz + Math.sin(a) * 0.4), 0.004, '#e8e2cc', k.group, 3);
  radar(k, mx, y + mh, mz, 'yagi', 1, 0.9);
  k.box(0.3, 0.22, 0.24, C.wood, 0.5, y, -1.05);
  k.box(0.2, 0.12, 0.14, '#4b5a3a', 0.47, y + 0.22, -1.05);
  k.box(0.05, 0.04, 0.02, '#3fd16b', 0.47, y + 0.28, -0.975);
  cable(k, 0.6, -1.05, mx, mz, y);
  postSign(k, 'AIR WATCH', 1.15, 1.18, y, C.wood, '#ffffff', 0, 0.55, C.wood);
  k.windsock(-1.2, y, -1.15);
}

function lv2(k: Kit, y: number) {
  // Canvas AA pit: deeper three-layer bag ring, twin MG on a steel pedestal with a seated gunner,
  // a "bedspring" dipole radar on a timber mast, plotter under a canvas shade
  const cx = -0.25, cz = -0.05;
  k.cyl(0.8, 0.015, DIRT, cx, y, cz, 16);
  bagRing(k, cx, cz, 0.86, 3, y, 0.75);
  for (let i = 0; i < 3; i++) k.box(0.3, 0.06, 0.16, '#c2ad7e', cx, y, cz + 0.98 + i * 0.12); // sandbag step
  k.cyl(0.14, 0.05, GUN, cx, y, cz, 8);
  k.cyl(0.06, 0.42, GUN, cx, y + 0.05, cz, 8);
  const r = rig(k, cx, y + 0.47, cz, 0.12);
  cylP(k, r.yaw, 0.09, 0.05, GUN, 0, 0, 0, 10);
  for (const s of [-1, 1]) k.box(0.06, 0.16, 0.025, GUN, 0, 0.0, s * 0.15, r.yaw);
  k.box(0.04, 0.24, 0.04, GUN, -0.22, -0.2, 0, r.yaw);
  k.box(0.14, 0.03, 0.14, '#2a2b2d', -0.28, 0.02, 0, r.yaw);
  k.box(0.2, 0.05, 0.26, GUN, -0.02, -0.04, 0, r.pitch);
  mg(k, r, 0.09, 0.56, 0, 1);
  mg(k, r, -0.09, 0.56, 0, -1);
  k.box(0.014, 0.12, 0.014, GUN, 0.2, 0.0, 0, r.pitch);
  const sight = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.008, 4, 14).rotateY(Math.PI / 2), mat(GUN));
  sight.position.set(0.2, 0.17, 0);
  k.add(sight, r.pitch);
  for (let i = 0; i < 3; i++) k.box(0.1, 0.008, 0.008, GUN, 0.2, 0.17, 0, r.pitch).rotation.x = (i * Math.PI) / 3;
  const g = seated(k, r.yaw, -0.32, 0.05, 0, 0, 0, 'helmet');
  gunner(k, g, r.pitch, 1.3);
  arm(k, r, 2, { kick: 0.05 });
  ammoBoxes(k, cx - 0.5, cz - 0.4, y, 4, 0.8);
  brass(k, cx + 0.15, cz + 0.25, y, 10, 0.4);
  // Canvas shade over the plotting table, flap swinging
  const sx = 1.0, sz = 0.6;
  for (const [dx, dz, h] of [[-0.3, -0.3, 0.95], [0.3, -0.3, 0.95], [-0.3, 0.3, 0.75], [0.3, 0.3, 0.75]]) k.box(0.04, h, 0.04, C.wood, sx + dx, y, sz + dz);
  const can = k.box(0.75, 0.03, 0.78, CANVAS, sx, y + 0.84, sz);
  can.rotation.x = 0.26;
  const flap = k.box(0.75, 0.14, 0.01, '#a8996a', sx, y + 0.6, sz + 0.39);
  k.swing(flap, 0, 0.25, 2);
  k.box(0.5, 0.03, 0.34, C.wood, sx, y + 0.3, sz - 0.05);
  for (const dx of [-0.2, 0.2]) k.box(0.03, 0.3, 0.3, C.metal, sx + dx, y, sz - 0.05);
  k.box(0.36, 0.005, 0.26, '#f4f1e8', sx, y + 0.33, sz - 0.05);
  k.box(0.15, 0.1, 0.12, '#4b5a3a', sx + 0.12, y + 0.33, sz - 0.12);
  operator(k, sx, 0.3 + y, sz + 0.22, -Math.PI / 2, 3, 'headset');
  // Bedspring radar on a timber mast with a sandbag foot
  const mx = 1.0, mz = -0.85, mh = 1.4;
  bagRing(k, mx, mz, 0.2, 2, y, 0);
  k.box(0.08, mh, 0.08, C.wood, mx, y, mz);
  for (const a of [0.8, 2.6, 4.6]) strut(k, V(mx, y + mh * 0.8, mz), V(mx + Math.cos(a) * 0.45, y, mz + Math.sin(a) * 0.45), 0.004, '#e8e2cc', k.group, 3);
  radar(k, mx, y + mh, mz, 'bedspring', 0.85, 1.0);
  cable(k, mx, mz, sx, sz - 0.2, y);
  // Field telephone and cable drum
  k.box(0.04, 0.5, 0.04, C.wood, -1.25, y, -1.2);
  k.box(0.1, 0.14, 0.07, '#4b5a3a', -1.25, y + 0.3, -1.15);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 10).rotateX(Math.PI / 2), mat('#7a5a3b'));
  drum.position.set(-1.2, y + 0.12, 1.15);
  k.add(drum);
  k.drum(-0.85, 1.2, '#4b5a3a', y);
}

function lv3(k: Kit, y: number) {
  // Quad-gun platform: raised timber deck, four MGs on an armoured mount, trailer-mounted radar with generator
  const cx = -0.3, cz = -0.2, dh = 0.3, yd = y + dh;
  k.box(1.6, dh, 1.6, '#9a7350', cx, y, cz);
  for (let i = 0; i < 7; i++) k.box(0.015, 0.004, 1.6, '#7a5a3b', cx - 0.69 + i * 0.23, yd, cz);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.08, dh + 0.02, 0.08, '#6b4f36', cx + sx * 0.78, y, cz + sz * 0.78);
  k.sandbags(cx, cz - 0.72, 1.5, 0, yd, 3);
  k.sandbags(cx - 0.72, cz, 1.3, Math.PI / 2, yd, 3);
  k.sandbags(cx + 0.72, cz, 1.3, Math.PI / 2, yd, 3);
  k.sandbags(cx - 0.5, cz + 0.72, 0.5, 0, yd, 2);
  k.sandbags(cx + 0.5, cz + 0.72, 0.5, 0, yd, 2);
  k.stairs(cx, cz + 1.0, 0.4, 0.4, dh + 0.08);
  // Quad mount: gunner in an armoured tub between two pairs of guns
  const r = rig(k, cx, yd + 0.4, cz, 0.0);
  cylP(k, r.yaw, 0.3, 0.08, GUN_OD, 0, -0.4, 0, 14);
  k.box(0.34, 0.26, 0.28, GUN_OD, -0.08, -0.32, 0, r.yaw);
  const shield = k.box(0.03, 0.2, 0.28, GUN_OD, 0.1, -0.1, 0, r.yaw);
  shield.rotation.z = -0.25;
  k.box(0.035, 0.05, 0.12, DARK_GLASS, 0.115, 0.05, 0, r.yaw).rotation.z = -0.25;
  const g = seated(k, r.yaw, -0.12, -0.14, 0, 0, 0, 'helmet');
  gunner(k, g, r.pitch, 1.15);
  for (const s of [-1, 1]) {
    k.box(0.3, 0.24, 0.04, GUN_OD, -0.04, -0.12, s * 0.17, r.pitch);
    mg(k, r, s * 0.24, 0.55, 0.06);
    mg(k, r, s * 0.24, 0.55, -0.06);
    k.box(0.22, 0.22, 0.08, AMMO, -0.06, -0.12, s * 0.33, r.pitch);
    k.box(0.222, 0.03, 0.082, HAZ, -0.06, 0.04, s * 0.33, r.pitch);
    for (let i = 0; i < 4; i++) k.box(0.03, 0.02, 0.03, BRASS, -0.02, 0.1 - i * 0.03, s * (0.3 - i * 0.012), r.pitch);
  }
  arm(k, r, 3, { kick: 0.05 });
  ammoBoxes(k, cx - 0.4, cz - 0.4, yd, 4, 0.3);
  brass(k, cx + 0.3, cz + 0.3, yd, 10, 0.4);
  // Trailer radar: chassis, wheels, cabinet, mast and a bigger bedspring array
  const tx = 1.0, tz = -0.6;
  k.box(0.5, 0.06, 0.8, '#3f4a2a', tx, y + 0.14, tz);
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 10).rotateZ(Math.PI / 2), mat('#2a2b2d'));
    w.position.set(tx + sx * 0.3, y + 0.13, tz - 0.05);
    k.add(w);
  }
  strut(k, V(tx, y + 0.17, tz + 0.4), V(tx, y + 0.07, tz + 0.72), 0.02, '#3f4a2a');
  k.box(0.06, 0.08, 0.06, GUN, tx, y, tz + 0.72);
  k.box(0.42, 0.36, 0.5, OLIVE, tx, y + 0.2, tz - 0.08);
  k.box(0.02, 0.12, 0.2, '#2a2b2d', tx + 0.22, y + 0.34, tz - 0.08);
  k.cyl(0.035, 0.5, GUN, tx, y + 0.56, tz - 0.08, 6);
  radar(k, tx, y + 1.06, tz - 0.08, 'bedspring', 1.0, 1.1);
  k.blinker(tx - 0.15, y + 0.56, tz - 0.25, '#ff3b30', 0.025);
  generator(k, 1.05, 0.25, y, OLIVE, Math.PI);
  cable(k, 1.05, 0.12, tx, tz + 0.15, y);
  // Zinc ammo lean-to and a loader humping boxes up to the deck
  leanTo(k, 1.02, 1.02, y, 0.55, 0.5, 0.5);
  ammoBoxes(k, 1.02, 1.0, y, 4, 0.1);
  carrier(k, y, 0.68, 1.12, -0.05, 1.22, 7, 2, 'box');
  k.fieldFlag(-1.2, 1.15, y);
}

// ================================================================== Camp 4–6

function lv4(k: Kit, y: number) {
  // AA cannon pit: cream round parapet, single cannon on a concrete pedestal, ready-room hut with a red roof
  const cx = -0.3, cz = 0.05;
  k.cyl(0.84, 0.03, CONCRETE, cx, y, cz, 18);
  ringWall(k, cx, cz, 0.9, 0.34, y, C.wall, C.trim, 0.75);
  for (const s of [-1, 1]) {
    const a = Math.PI / 2 + s * 0.45;
    for (let i = 0; i < 3; i++) k.box(0.17, 0.13, 0.17, i % 2 ? C.kerbB : C.kerbY, cx + Math.cos(a) * 0.9, y + i * 0.13, cz + Math.sin(a) * 0.9);
  }
  k.cyl(0.24, 0.3, CONCRETE, cx, y, cz, 10, 0.17);
  const r = rig(k, cx, y + 0.3, cz, 0.3);
  cylP(k, r.yaw, 0.3, 0.05, C.trim, 0, 0, 0, 14);
  for (const s of [-1, 1]) k.box(0.22, 0.3, 0.04, GUN_OD, 0, 0.05, s * 0.11, r.yaw);
  cannon(k, r, 0, 0.95, { clip: 4 });
  k.box(0.04, 0.2, 0.04, GUN, -0.14, 0.05, 0.3, r.yaw);
  k.box(0.13, 0.03, 0.13, '#2a2b2d', -0.16, 0.25, 0.3, r.yaw);
  const g = seated(k, r.yaw, -0.16, 0.29, 0.3, 0, 0, 'helmet');
  gunner(k, g, r.pitch, 1.15);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 4, 10).rotateY(Math.PI / 2), mat('#2a2b2d'));
  wheel.position.set(0.04, 0.38, 0.3);
  wheel.add(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.1, 0.012), mat('#2a2b2d')));
  k.add(wheel, r.yaw);
  k.box(0.18, 0.03, 0.03, GUN, -0.05, 0.36, 0.3, r.yaw);
  k.anims.push((t) => (wheel.rotation.x = t * 2.5));
  arm(k, r, 4, { kick: 0.1 });
  // Ready-room hut and its bedspring radar mast
  const hx = 0.85, hz = -0.9;
  k.block(0.95, 0.75, 1, hx, y, hz);
  k.hipRoof(0.95, 0.75, 0.35, hx, y + STOREY, hz);
  k.door('front', hx, hz, 0.95, 0.75, -0.18, y);
  k.window('front', hx, hz, 0.95, 0.75, 0.22, y + 0.42);
  k.window('right', hx, hz, 0.95, 0.75, 0, y + 0.42);
  k.aircon(hx + 0.56, y + 0.25, hz - 0.1, Math.PI / 2);
  const mx = 1.15, mz = -0.22;
  k.box(0.26, 0.12, 0.26, CONCRETE, mx, y, mz);
  k.cyl(0.035, 1.5, C.trim, mx, y + 0.12, mz, 6);
  radar(k, mx, y + 1.62, mz, 'bedspring', 0.95, 1.0);
  k.blinker(mx, y + 1.62, mz + 0.06, '#ff3b30', 0.025);
  cable(k, mx, mz, hx, hz + 0.38, y);
  // Ready rounds and a loader carrying clips to the gun
  shellRack(k, 0.95, 0.55, y, 6, -0.3);
  carrier(k, y, 0.78, 0.88, -0.2, 1.15, 6.5, 1, 'clip');
  postSign(k, 'KEEP CLEAR', 1.2, 1.18, y);
  k.bin(-1.25, 1.2, y);
}

function lv5(k: Kit, y: number) {
  // Shielded gun bay: raised octagonal emplacement, cannon with gun shield and a loader feeding clips;
  // lattice radar tower and a gable-roofed radar cabin
  const cx = -0.3, cz = -0.05, ph = 0.34, yd = y + ph;
  k.cyl(0.95, ph, C.wall, cx, y, cz, 8).rotation.y = Math.PI / 8;
  k.cyl(0.97, 0.08, C.trim, cx, y, cz, 8).rotation.y = Math.PI / 8;
  k.cyl(0.97, 0.04, C.white, cx, yd - 0.04, cz, 8).rotation.y = Math.PI / 8;
  ringWall(k, cx, cz, 0.8, 0.24, yd, C.wall, C.trim, 0.7);
  k.stairs(cx, cz + 1.02, 0.42, 0.32, ph + 0.08);
  k.cyl(0.2, 0.18, CONCRETE, cx, yd, cz, 10, 0.15);
  const r = rig(k, cx, yd + 0.18, cz, 0.3);
  cylP(k, r.yaw, 0.32, 0.05, C.trim, 0, 0, 0, 14);
  for (const s of [-1, 1]) k.box(0.22, 0.3, 0.04, GUN_OD, 0, 0.05, s * 0.11, r.yaw);
  const sh = k.box(0.04, 0.36, 0.62, GUN_OD, 0.2, 0.08, 0, r.yaw);
  sh.rotation.z = -0.18;
  for (const s of [-1, 1]) k.box(0.26, 0.26, 0.03, GUN_OD, 0.07, 0.08, s * 0.31, r.yaw);
  k.box(0.045, 0.06, 0.2, DARK_GLASS, 0.215, 0.3, 0.18, r.yaw).rotation.z = -0.18;
  cannon(k, r, 0, 1.05, { clip: 2 });
  const g = seated(k, r.yaw, -0.16, 0.29, 0.21, 0, 0, 'helmet');
  gunner(k, g, r.pitch, 1.15);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.012, 4, 10).rotateY(Math.PI / 2), mat('#2a2b2d'));
  wheel.position.set(0.04, 0.38, 0.21);
  wheel.add(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.1, 0.012), mat('#2a2b2d')));
  k.add(wheel, r.yaw);
  k.anims.push((t) => (wheel.rotation.x = t * 2.5));
  // Loader on the mount lifts a clip up into the feed, again and again
  const ld = figure(2, 'helmet');
  ld.root.position.set(-0.2, 0.05, -0.2);
  k.add(ld.root, r.yaw);
  const clip = new THREE.Group();
  clip.position.set(0, -0.22, 0.1);
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.15, 6), M(BRASS));
    c.position.set(0, 0, -0.1 + i * 0.035);
    clip.add(c);
  }
  ld.armR.add(clip);
  k.anims.push((t) => {
    const u = smooth(0.5 + Math.sin(t * 1.7) * 0.7);
    ld.armR.rotation.z = ld.armL.rotation.z = 0.9 + u * 1.5;
    clip.visible = Math.sin(t * 1.7 + 0.5) < 0.85;
  });
  arm(k, r, 5, { kick: 0.1 });
  ammoBoxes(k, cx + 0.45, cz - 0.4, yd, 3, -0.5);
  // Radar tower with a ladder, cable tray to the emplacement
  const tx = 1.0, tz = 0.22;
  const top = lattice(k, tx, tz, y, 1.35, 0.5, 0.28);
  ladder(k, tx, tz + 0.27, y, 1.35, true);
  radar(k, tx, top, tz, 'bedspring', 1.1, 1.0);
  k.blinker(tx + 0.18, top, tz + 0.18, '#ff3b30', 0.025);
  // Radar cabin with a red gable roof
  const bx = 0.92, bz = -0.92;
  k.block(0.85, 0.7, 1, bx, y, bz);
  k.gableRoof(0.85, 0.7, 0.32, bx, y + STOREY, bz);
  k.door('front', bx, bz, 0.85, 0.7, -0.15, y);
  k.window('right', bx, bz, 0.85, 0.7, 0, y + 0.42);
  k.window('front', bx, bz, 0.85, 0.7, 0.22, y + 0.42);
  cable(k, tx, tz, bx, bz + 0.36, y);
  // Ammo bunker
  k.box(0.55, 0.42, 0.45, C.wall, 1.0, y, 0.98);
  k.hipRoof(0.55, 0.45, 0.2, 1.0, y + 0.42, 0.98, C.roof, 0.08);
  k.box(0.22, 0.32, 0.03, C.trim, 0.9, y, 1.21);
  board(k, 'AMMO', 0.22, 0.08, 1.14, y + 0.25, 1.215, '#d8342c');
  k.flagpole(-1.25, -1.2, 1.8, y);
}

function lv6(k: Kit, y: number) {
  // Twin-gun turntable: two cannons on a rotating turntable with a seated layer between them,
  // two-storey radar hut, red-roofed ammo store, loader shuttling shells
  const cx = -0.3, cz = 0.0, ph = 0.3, yd = y + ph;
  k.cyl(0.82, ph, C.wall, cx, y, cz, 18);
  k.cyl(0.84, 0.08, C.trim, cx, y, cz, 18);
  ringWall(k, cx, cz, 0.78, 0.05, yd, C.wall, 'kerb', 0.5, Math.PI / 2, 0.1);
  k.stairs(cx, cz + 0.98, 0.42, 0.3, ph + 0.08);
  const r = rig(k, cx, yd, cz, 0.34);
  cylP(k, r.yaw, 0.6, 0.08, C.trim, 0, 0, 0, 18);
  cylP(k, r.yaw, 0.61, 0.02, HAZ, 0, 0.06, 0, 18);
  for (const s of [-1, 0, 1]) if (s) for (const o of [-0.09, 0.09]) k.box(0.22, 0.32, 0.03, GUN_OD, 0, 0.08, s * 0.24 + o, r.yaw);
  cannon(k, r, 0.24, 1.05, { clip: 4 });
  cannon(k, r, -0.24, 1.05, { clip: 4 });
  k.box(0.3, 0.22, 0.26, GUN_OD, -0.12, 0.08, 0, r.yaw);
  const ws = k.box(0.03, 0.14, 0.24, DARK_GLASS, 0.04, 0.3, 0, r.yaw);
  ws.rotation.z = -0.3;
  const g = seated(k, r.yaw, -0.16, 0.32, 0, 0, 0, 'helmet');
  gunner(k, g, r.pitch, 1.15);
  for (const s of [-1, 1]) k.box(0.06, 0.06, 0.06, '#2a2b2d', 0.05, 0.3, s * 0.11, r.yaw);
  arm(k, r, 6, { kick: 0.1 });
  // Radar hut, two storeys with a flat roof and the radar on top
  const bx = 0.9, bz = -0.88, bw = 0.85, bd = 0.8;
  const h = k.block(bw, bd, 2, bx, y, bz);
  k.flatRoof(bw, bd, bx, y + h, bz);
  k.door('front', bx, bz, bw, bd, -0.18, y);
  k.window('front', bx, bz, bw, bd, 0.2, y + 0.42);
  k.windowRow('front', bx, bz, bw, bd, 2, y + STOREY + 0.42);
  k.windowRow('right', bx, bz, bw, bd, 2, y + STOREY + 0.42);
  k.aircon(bx + bw / 2 + 0.08, y + 0.3, bz, Math.PI / 2);
  radar(k, bx, y + h + 0.06, bz, 'bedspring', 1.2, 0.95);
  k.blinker(bx + 0.35, y + h + 0.2, bz + 0.33, '#ff3b30', 0.03);
  k.windsock(bx - 0.33, y + h + 0.06, bz - 0.3);
  cable(k, bx - 0.3, bz + 0.4, cx + 0.5, cz - 0.4, y);
  // Ammo store and shell rack
  const ax = 1.0, az = 0.72;
  k.block(0.66, 0.56, 0.7, ax, y, az);
  k.hipRoof(0.66, 0.56, 0.24, ax, y + 0.7 * STOREY, az, C.roof, 0.1);
  k.door('front', ax, az, 0.66, 0.56, 0, y, 0.3, 0.5);
  board(k, 'AMMO', 0.24, 0.08, ax, y + 0.53, az + 0.295, '#d8342c');
  shellRack(k, -1.1, 0.95, y, 5, 0.9);
  carrier(k, y, 0.62, 1.18, -0.2, 1.2, 6, 3, 'shell');
  postSign(k, 'AIR DEFENCE', -0.75, 1.28, y, C.trim, '#ffffff');
}

// ------------------------------------------------------------------ assembly

const LEVEL_FNS: ((k: Kit, y: number) => void)[] = [lv1, lv2, lv3, lv4, lv5, lv6];

export function buildAirDefence(level: number): Kit {
  const k = new Kit();
  const y = k.pad(3, 3);
  LEVEL_FNS[Math.min(level, LEVEL_FNS.length) - 1](k, y);
  return k;
}

export const AIR_DEFENCE: BuildingDef = {
  id: 'airdefence',
  name: 'Air Defence',
  role: 'Shoots down flying raiders (drones and helicopters). Cannot hit ground troops.',
  footprint: [3, 3],
  unlockHq: 13,
  levels: AIR_DEFENCE_LEVELS,
  designedLevels: 20,
  build: buildAirDefence,
};
