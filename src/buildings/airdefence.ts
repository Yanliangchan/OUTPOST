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
const ARMOR = '#7a878d';
const ARMOR_D = '#5a666d';
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

/** Annular sector (ring with an optional gap) as one extruded mesh, base at y. */
function ringMesh(k: Kit, cx: number, cz: number, rOut: number, rIn: number, h: number, y: number, color: string, gapW = 0, gapA = Math.PI / 2) {
  const sh = new THREE.Shape();
  // Shape is drawn in x/y and the extrusion is turned so shape y becomes -z.
  const g0 = -gapA + gapW / 2, g1 = -gapA - gapW / 2 + Math.PI * 2;
  if (gapW > 0) {
    sh.absarc(0, 0, rOut, g0, g1, false);
    sh.absarc(0, 0, rIn, g1, g0, true);
  } else {
    sh.absarc(0, 0, rOut, 0, Math.PI * 2, false);
    const hole = new THREE.Path();
    hole.absarc(0, 0, rIn, 0, Math.PI * 2, true);
    sh.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 28 }).rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(cx, y, cz);
  return k.add(m);
}

/** Round parapet wall with a coping; cap 'kerb' paints the coping in yellow/black blocks. */
function ringWall(k: Kit, cx: number, cz: number, r: number, h: number, y: number, color: string, cap: string | 'kerb', gapW = 0.7, gapA = Math.PI / 2, thick = 0.14) {
  ringMesh(k, cx, cz, r + thick / 2, r - thick / 2, h, y, color, gapW, gapA);
  if (cap !== 'kerb') {
    ringMesh(k, cx, cz, r + thick / 2 + 0.02, r - thick / 2 - 0.02, 0.04, y + h, cap, gapW, gapA);
    return;
  }
  const n = Math.max(12, Math.round((2 * Math.PI * r) / 0.2));
  const seg = ((2 * Math.PI * r) / n) * 1.04;
  for (let i = 0; i < n; i++) {
    const a = ((i + 0.5) / n) * Math.PI * 2;
    if (Math.abs(wrap(a - gapA)) < gapW / 2) continue;
    k.box(seg, 0.04, thick + 0.03, i % 2 ? C.kerbB : C.kerbY, cx + Math.cos(a) * r, y + h, cz + Math.sin(a) * r).rotation.y = -a - Math.PI / 2;
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
  r.yaw.rotation.y = home;
  r.pitch.rotation.z = base;
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

/** Drives armour (lids, doors, hatches) open while the weapon is raised or engaging, shut when it stows. */
function armourFollow(k: Kit, pitch: THREE.Object3D, tur: Turret, set: (o: number) => void, thresh = 0.1) {
  let o = 1, last = -1;
  k.anims.push((t) => {
    const dt = last < 0 ? 1 : Math.min(0.1, Math.max(0, t - last));
    last = t;
    const want = tur.target || pitch.rotation.z > thresh ? 1 : 0;
    o += THREE.MathUtils.clamp(want - o, -dt * 3, dt * 3);
    set(smooth(o));
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
  const cx = -0.3, cz = -0.05, ph = 0.62, yd = y + ph;
  k.cyl(0.95, ph, C.wall, cx, y, cz, 8).rotation.y = Math.PI / 8;
  k.cyl(0.97, 0.08, C.trim, cx, y, cz, 8).rotation.y = Math.PI / 8;
  k.cyl(0.97, 0.04, C.white, cx, yd - 0.04, cz, 8).rotation.y = Math.PI / 8;
  ringWall(k, cx, cz, 0.8, 0.24, yd, C.wall, C.trim, 0.7);
  k.stairs(cx, cz + 1.1, 0.42, 0.5, ph + 0.08);
  k.windowRow('front', cx, cz, 1.3, 1.62, 2, y + 0.25, { span: 1.0 });
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
  cylP(k, r.yaw, 0.61, 0.06, HAZ, 0, 0, 0, 18);
  cylP(k, r.yaw, 0.56, 0.08, C.trim, 0, 0, 0, 18);
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

// ================================================================== Base 7–10

/** Enclosed twin-cannon turret body on the yaw (Gepard-style cheeks), returns the hatch-top height. */
function gunTurret(k: Kit, r: Rig, body: string, o: { w?: number; len?: number; h?: number; stripe?: string } = {}) {
  const w = o.w ?? 0.62, len = o.len ?? 0.8, h = o.h ?? 0.4;
  cylP(k, r.yaw, 0.46, 0.06, GUN, 0, 0, 0, 16);
  k.box(len, h, w, body, -0.06, 0.06, 0, r.yaw);
  const gl = k.box(0.3, 0.05, w - 0.02, body, len / 2 + 0.0, 0.06 + h - 0.12, 0, r.yaw);
  gl.rotation.z = -0.5;
  k.box(0.18, h * 0.6, w + 0.02, body, -0.06 - len / 2 + 0.05, 0.12, 0, r.yaw);
  if (o.stripe) k.box(len + 0.01, 0.04, w + 0.01, o.stripe, -0.06, 0.06 + h * 0.55, 0, r.yaw);
  for (const s of [-1, 1]) k.box(0.2, 0.12, 0.05, AMMO, -0.18, 0.12, s * (w / 2 + 0.03), r.yaw);
  return 0.06 + h;
}

/** Commander standing in the turret hatch with binoculars. */
function hatchCommander(k: Kit, r: Rig, x: number, top: number, seed = 4) {
  cylP(k, r.yaw, 0.11, 0.05, GUN, x, top, 0, 10);
  const lid = k.box(0.02, 0.18, 0.2, GUN, x - 0.13, top + 0.02, 0, r.yaw);
  lid.rotation.z = 0.4;
  const f = spotter(k, x, 0, 0, Math.PI * 0.1, seed, 'beret', r.yaw);
  f.root.position.y = top - 0.3;
  return f;
}

function lv7(k: Kit, y: number) {
  // Fire-control battery: sloped concrete emplacement, twin cannons on a turntable with a
  // tracking radar riding on the mount, concrete command post with an orange-peel truss radar, ammo hoist
  const cx = -0.3, cz = 0.1, ph = 0.36, yd = y + ph;
  k.cyl(1.02, ph, CONCRETE, cx, y, cz, 6, 0.88).rotation.y = Math.PI / 6;
  ringWall(k, cx, cz, 0.84, 0.03, yd, CONCRETE, 'kerb', 0.5, Math.PI / 2, 0.1);
  k.stairs(cx, cz + 1.05, 0.42, 0.34, ph + 0.08);
  const r = rig(k, cx, yd, cz, 0.36);
  cylP(k, r.yaw, 0.62, 0.05, '#4a4f54', 0, 0, 0, 18);
  cylP(k, r.yaw, 0.58, 0.1, '#7d8478', 0, 0, 0, 18);
  for (const s of [-1, 1]) for (const o of [-0.09, 0.09]) k.box(0.24, 0.34, 0.03, GUN_OD, 0, 0.1, s * 0.25 + o, r.yaw);
  cannon(k, r, 0.25, 1.15, { clip: 4, jacket: true });
  cannon(k, r, -0.25, 1.15, { clip: 4, jacket: true });
  k.box(0.36, 0.3, 0.3, OLIVE, -0.14, 0.1, 0, r.yaw);
  k.box(0.03, 0.12, 0.28, DARK_GLASS, 0.05, 0.3, 0, r.yaw).rotation.z = -0.3;
  const g = seated(k, r.yaw, -0.2, 0.34, 0, 0, 0, 'helmet');
  gunner(k, g, r.pitch, 1.15);
  k.box(0.05, 0.3, 0.05, GUN, -0.38, 0.1, 0, r.yaw);
  trackingDish(k, r.yaw, r.pitch, -0.38, 0.5, 0, 0.13);
  arm(k, r, 7, { kick: 0.1 });
  // Command post with slit windows and the search radar on its roof
  const bx = 0.86, bz = -0.86, bw = 1.0, bd = 0.85, bh = 1.35;
  k.box(bw, bh, bd, CONCRETE, bx, y, bz);
  k.box(bw + 0.03, 0.12, bd + 0.03, C.trim, bx, y, bz);
  for (const yy of [0.5, 1.0]) {
    k.box(bw - 0.3, 0.1, 0.02, DARK_GLASS, bx, y + yy, bz + bd / 2 + 0.005);
    k.box(0.02, 0.1, bd - 0.3, DARK_GLASS, bx + bw / 2 + 0.005, y + yy, bz);
  }
  k.box(0.3, 0.5, 0.03, '#4a4f54', bx - 0.25, y, bz + bd / 2 + 0.01);
  k.box(0.32, 0.04, 0.035, HAZ, bx - 0.25, y + 0.5, bz + bd / 2 + 0.01);
  k.flatRoof(bw, bd, bx, y + bh, bz);
  k.box(0.3, 0.2, 0.3, CONCRETE, bx, y + bh, bz);
  radar(k, bx, y + bh + 0.2, bz, 'truss', 0.95, 1.0);
  // Camouflage net draped over the command post on poles, breathing in the breeze
  const net = new THREE.Group();
  net.position.set(bx, y + bh + 0.16, bz);
  k.add(net);
  const NET = ['#5b6b3a', '#6f7d45', '#4a5a32'];
  for (const [sx, rz] of [[-1, 0.5], [1, -0.5]] as const) {
    const side = k.box(0.62, 0.025, bd + 0.35, NET[0], sx * 0.33, -0.18, 0, net);
    side.rotation.z = rz;
    for (let i = 0; i < 4; i++) k.box(0.18, 0.03, 0.2, NET[1 + (i % 2)], sx * (0.25 + (i % 2) * 0.12), -0.13 - (i % 2) * 0.08, -0.35 + i * 0.25, net).rotation.z = rz;
  }
  for (const sz of [-1, 1]) k.box(0.04, 0.5, 0.04, C.wood, bx + 0.62, y + bh - 0.4, bz + sz * 0.5);
  k.anims.push((t) => (net.scale.y = 1 + Math.sin(t * 1.3) * 0.08));
  k.aircon(bx + bw / 2 + 0.08, y + 0.3, bz + 0.15, Math.PI / 2);
  k.blinker(bx + 0.4, y + bh + 0.08, bz + 0.33, '#ff3b30', 0.03);
  // Ammo hoist: gantry with a crate that rises and lowers
  const hx = 1.0, hz = 0.7;
  for (const dz of [-0.25, 0.25]) k.box(0.06, 1.0, 0.06, HAZ, hx, y, hz + dz);
  k.box(0.08, 0.06, 0.6, HAZ, hx, y + 1.0, hz);
  k.box(0.1, 0.08, 0.1, GUN, hx, y + 0.94, hz);
  const hook = new THREE.Group();
  k.add(hook);
  const rope = k.box(0.01, 1, 0.01, '#2a2b2d', 0, 0, 0, hook);
  const crate = k.box(0.2, 0.16, 0.2, AMMO, 0, -0.16, 0, hook);
  k.box(0.202, 0.03, 0.202, HAZ, 0, -0.08, 0, hook);
  k.anims.push((t) => {
    const u = smooth(0.5 + Math.sin(t * 0.8) * 0.8);
    const hy = y + 0.2 + u * 0.55;
    hook.position.set(hx, hy, hz);
    rope.scale.y = y + 0.94 - hy;
    rope.position.y = 0;
    crate.visible = Math.cos(t * 0.8) > -0.2;
  });
  ammoBoxes(k, 0.75, 1.1, y, 4, 0.2);
  carrier(k, y, 0.7, 0.5, 0.25, 0.9, 5.5, 2, 'box');
  postSign(k, 'DANGER', -1.2, 1.2, y, '#d8342c', '#ffffff');
}

function lv8(k: Kit, y: number) {
  // Gun turret drum: enclosed twin-cannon turret on a tall concrete drum, commander in the hatch,
  // tracking dish on the turret, lattice search-radar tower, magazine feeding shells up a conveyor
  const cx = -0.3, cz = 0.0, dh = 0.85, yd = y + dh;
  ringWall(k, cx, cz, 1.0, 0.26, y, CONCRETE, 'kerb', 0.6);
  k.cyl(0.74, dh, CONCRETE, cx, y, cz, 16);
  k.cyl(0.76, 0.1, C.trim, cx, y, cz, 16);
  k.cyl(0.76, 0.06, HAZ, cx, yd - 0.1, cz, 16);
  k.box(0.28, 0.5, 0.05, '#4a4f54', cx, y, cz + 0.72);
  k.box(0.3, 0.04, 0.06, HAZ, cx, y + 0.5, cz + 0.72);
  const r = rig(k, cx, yd, cz, 0.28, 0.12);
  const top = gunTurret(k, r, GUN_OD);
  for (const s of [-1, 1]) cannon(k, r, s * 0.42, 1.15, { jacket: true, body: GUN_OD });
  trackingDish(k, r.yaw, r.pitch, 0.32, 0.5, 0, 0.12);
  hatchCommander(k, r, -0.2, top);
  arm(k, r, 8, { kick: 0.1 });
  // Lattice search-radar tower
  const tx = 1.0, tz = -1.0;
  const tt = lattice(k, tx, tz, y, 1.9, 0.55, 0.3);
  ladder(k, tx, tz + 0.3, y, 1.9, true);
  radar(k, tx, tt, tz, 'truss', 0.95, 1.05);
  k.blinker(tx + 0.18, tt, tz + 0.18, '#ff3b30', 0.03);
  // Magazine with a conveyor feeding shells into the drum
  const mx = 1.0, mz = 0.75;
  k.box(0.7, 0.62, 0.9, CONCRETE, mx, y, mz);
  k.box(0.72, 0.1, 0.92, C.trim, mx, y, mz);
  k.flatRoof(0.7, 0.9, mx, y + 0.62, mz);
  k.box(0.32, 0.44, 0.03, '#4a4f54', mx - 0.1, y, mz + 0.46);
  for (let i = 0; i < 4; i++) k.box(0.05, 0.44, 0.035, i % 2 ? C.kerbB : HAZ, mx - 0.26 + i * 0.105 + (i > 1 ? 0.25 : 0), y, mz + 0.46);
  board(k, 'MAGAZINE', 0.4, 0.1, mx - 0.1, y + 0.48, mz + 0.47, '#d8342c');
  const c0 = V(mx - 0.35, y + 0.45, 0.45), c1 = V(cx + 0.68, yd - 0.15, 0.3);
  strut(k, c0, c1, 0.05, '#4a4f54', k.group, 4);
  for (const p of [c0, c1]) k.box(0.05, p.y - y, 0.05, GUN, p.x, y, p.z);
  const shells: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const sh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 6), mat(BRASS));
    k.add(sh);
    shells.push(sh);
  }
  k.anims.push((t) => shells.forEach((sh, i) => {
    const u = (t * 0.25 + i / 4) % 1;
    sh.position.copy(c0).lerp(c1, u).add(V(0, 0.09, 0));
    sh.visible = u > 0.04 && u < 0.96;
  }));
  generator(k, 1.05, -0.15, y, '#6b7a45', Math.PI / 2);
  carrier(k, y, -1.2, 1.2, 0.2, 1.22, 7, 3, 'tablet', 'cap');
}

function lv9(k: Kit, y: number) {
  // Radar gun tower: square concrete gun tower with stairs, bigger turret carrying its own
  // rotating search radar on the back and a tracking dish on the front; cooling plant with a big fan
  const cx = -0.38, cz = -0.15, th = 1.05, yt = y + th;
  k.box(1.4, th, 1.4, CONCRETE, cx, y, cz);
  k.box(1.43, 0.12, 1.43, C.trim, cx, y, cz);
  k.box(1.46, 0.08, 1.46, C.white, cx, yt - 0.08, cz);
  for (let i = 0; i < 8; i++) k.box(1.47 / 8, 0.04, 0.02, i % 2 ? C.kerbB : HAZ, cx - 0.64 + i * 0.183, yt - 0.14, cz + 0.735);
  for (const s of [-1, 1]) {
    k.box(1.4, 0.03, 0.03, STEEL, cx, yt + 0.22, cz + s * 0.68);
    k.box(0.03, 0.03, 1.4, STEEL, cx + s * 0.68, yt + 0.22, cz);
  }
  for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) {
    k.box(0.03, 0.22, 0.03, STEEL, cx + sx * 0.68, yt, cz + sz * 0.68);
    k.box(0.03, 0.22, 0.03, STEEL, cx + sz * 0.68, yt, cz + sx * 0.68);
  }
  k.box(0.35, 0.55, 0.04, '#4a4f54', cx - 0.3, y, cz + 0.71);
  k.box(0.6, 0.12, 0.02, DARK_GLASS, cx + 0.25, y + 0.6, cz + 0.71);
  k.stairs(0.5, -0.15, 0.32, 1.25, th + 0.08);
  const r = rig(k, cx, yt, cz, 0.3, 0.12);
  const top = gunTurret(k, r, '#6b7a45', { len: 0.9, w: 0.66, h: 0.42, stripe: OLIVE_D });
  for (const s of [-1, 1]) cannon(k, r, s * 0.44, 1.25, { jacket: true, body: '#6b7a45' });
  trackingDish(k, r.yaw, r.pitch, 0.36, 0.52, 0, 0.13);
  k.box(0.08, 0.36, 0.08, GUN, -0.42, top, 0, r.yaw);
  radar(k, -0.42, top + 0.36, 0, 'truss', 0.7, 1.6, r.yaw, { iff: false });
  hatchCommander(k, r, -0.12, top, 5);
  arm(k, r, 9, { kick: 0.11 });
  // Cooling plant with a big fan, generator
  const bx = 1.05, bz = -0.75;
  k.box(0.6, 0.85, 0.9, CONCRETE, bx, y, bz);
  k.box(0.62, 0.1, 0.92, C.trim, bx, y, bz);
  for (let i = 0; i < 5; i++) k.box(0.02, 0.4, 0.06, '#8f969b', bx + 0.31, y + 0.25, bz - 0.3 + i * 0.15);
  roofFan(k, bx, y + 0.85, bz, 0.2);
  generator(k, 1.05, 0.55, y, '#6b7a45', Math.PI / 2);
  cable(k, 1.05, 0.35, 0.65, 0.1, y);
  ammoBoxes(k, 0.8, 1.15, y, 4, 0.1);
  carrier(k, y, -1.1, 1.05, 0.15, 1.05, 7, 4, 'tablet', 'cap');
  blastRun(k, -1.38, 1.33, 0.3, 1.33, y, 0.38);
  blastRun(k, -1.33, -1.0, -1.33, 1.2, y, 0.38);
}

function lv10(k: Kit, y: number) {
  // Air defence bastion (release cap): two-tier octagonal concrete bastion, big twin-cannon turret,
  // elevated radar mast with a platform and IFF, magazine with blast door, flags
  const cx = -0.3, cz = -0.2, t1 = 0.48, t2 = 0.55;
  k.cyl(1.15, t1, CONCRETE, cx, y, cz, 8).rotation.y = Math.PI / 8;
  k.cyl(1.17, 0.1, C.trim, cx, y, cz, 8).rotation.y = Math.PI / 8;
  k.cyl(1.17, 0.05, HAZ, cx, y + t1 - 0.05, cz, 8).rotation.y = Math.PI / 8;
  k.cyl(0.82, t2, CONCRETE, cx, y + t1, cz, 8).rotation.y = Math.PI / 8;
  k.cyl(0.84, 0.06, C.white, cx, y + t1 + t2 - 0.06, cz, 8).rotation.y = Math.PI / 8;
  ringWall(k, cx, cz, 0.98, 0.14, y + t1, CONCRETE, C.trim, 0.5);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    k.box(0.3, 0.06, 0.02, DARK_GLASS, cx + Math.cos(a) * 0.82, y + t1 + 0.25, cz + Math.sin(a) * 0.82).rotation.y = -a - Math.PI / 2;
  }
  k.stairs(cx, cz + 1.2, 0.42, 0.3, t1 + 0.08);
  k.stairs(cx + 0.55, cz + 0.6, 0.26, 0.3, t2 + 0.06, true);
  const yt = y + t1 + t2;
  const r = rig(k, cx, yt, cz, 0.32, 0.12);
  const top = gunTurret(k, r, '#6b7a45', { len: 0.95, w: 0.7, h: 0.46, stripe: HAZ });
  for (const s of [-1, 1]) cannon(k, r, s * 0.46, 1.3, { jacket: true, body: '#6b7a45', rb: 0.038 });
  trackingDish(k, r.yaw, r.pitch, 0.38, 0.56, 0, 0.15);
  k.box(0.1, 0.12, 0.1, '#e8e6e0', -0.35, top, 0.18, r.yaw);
  const eo = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), mat('#e8e6e0'));
  eo.position.set(-0.35, top + 0.19, 0.18);
  k.add(eo, r.yaw);
  k.box(0.05, 0.04, 0.02, DARK_GLASS, 0.06, 0, 0.0, eo);
  k.anims.push((t) => (eo.rotation.y = Math.sin(t * 0.7) * 1.2));
  hatchCommander(k, r, -0.12, top, 6);
  arm(k, r, 10, { kick: 0.12 });
  spotter(k, cx + 0.62, cz + 0.68, y + t1, -0.7, 2, 'beret');
  // Elevated radar mast with platform, guy wires and IFF
  const mx = 1.05, mz = -1.05, mh = 2.5;
  k.box(0.4, 0.15, 0.4, CONCRETE, mx, y, mz);
  k.cyl(0.08, mh, STEEL, mx, y + 0.15, mz, 8, 0.06);
  ladder(k, mx, mz + 0.12, y + 0.15, mh - 0.4, true);
  k.box(0.5, 0.05, 0.5, STEEL, mx, y + mh - 0.3, mz);
  for (const s of [-1, 1]) {
    k.box(0.5, 0.02, 0.02, HAZ, mx, y + mh - 0.1, mz + s * 0.24);
    k.box(0.02, 0.02, 0.5, HAZ, mx + s * 0.24, y + mh - 0.1, mz);
  }
  for (const a of [0.9, 2.6, 4.5]) strut(k, V(mx, y + mh * 0.75, mz), V(mx + Math.cos(a) * 0.5, y, mz + Math.sin(a) * 0.5), 0.005, '#c9ced2', k.group, 3);
  radar(k, mx, y + mh + 0.15, mz, 'truss', 1.15, 0.95);
  k.blinker(mx + 0.2, y + mh - 0.25, mz + 0.2, '#ff3b30', 0.035);
  // Magazine with a blast door
  const gx = 1.05, gz = 0.85;
  k.box(0.6, 0.6, 0.65, CONCRETE, gx, y, gz);
  k.box(0.62, 0.1, 0.67, C.trim, gx, y, gz);
  k.flatRoof(0.6, 0.65, gx, y + 0.6, gz);
  k.box(0.3, 0.42, 0.04, '#4a4f54', gx - 0.05, y, gz + 0.33);
  for (let i = 0; i < 5; i++) k.box(0.06, 0.02, 0.045, i % 2 ? C.kerbB : HAZ, gx - 0.17 + i * 0.06, y + 0.43, gz + 0.33);
  roofFan(k, gx, y + 0.66, gz - 0.1, 0.1);
  k.flagpole(-1.25, 1.2, 2.0, y);
  k.flagpole(0.55, 1.25, 2.0, y);
  carrier(k, y, 0.8, 0.45, 0.8, -0.35, 6, 3, 'box');
}

// ================================================================== Command 11–15

/** Low white boundary wall with teal coping between two points. */
function lowWall(k: Kit, x0: number, z0: number, x1: number, z1: number, y: number, h = 0.32) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const g = new THREE.Group();
  g.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  g.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  k.add(g);
  k.box(len, h, 0.12, C.white, 0, 0, 0, g);
  k.box(len + 0.02, 0.04, 0.15, TEAL, 0, h, 0, g);
  k.box(len, 0.05, 0.125, '#d6d0c2', 0, 0, 0, g);
}

/** Raised planter bed (white walls, shrubs and a palm-ish tuft). */
function plantBed(k: Kit, x: number, z: number, y: number, w: number, d: number) {
  k.box(w, 0.32, d, C.white, x, y, z);
  k.box(w + 0.03, 0.04, d + 0.03, TEAL, x, y + 0.32, z);
  k.hedge(x, z, w - 0.1, d - 0.1, y + 0.2);
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), mat(i % 2 ? '#e8418f' : '#55a832'));
    b.position.set(x - w / 2 + 0.15 + (i * (w - 0.3)) / 2, y + 0.5, z + (i % 2 ? 0.08 : -0.06));
    k.add(b);
  }
}

/** Landscaped hedge strip along the left (x = -1.36) and/or back (z = -1.36) pad edges, with white kerbs. */
function edgeHedges(k: Kit, y: number, left: [number, number] | null, back: [number, number] | null) {
  if (left) {
    k.box(0.2, 0.1, left[1] - left[0], C.white, -1.33, y, (left[0] + left[1]) / 2);
    k.hedge(-1.33, (left[0] + left[1]) / 2, 0.16, left[1] - left[0] - 0.04, y + 0.06);
  }
  if (back) {
    k.box(back[1] - back[0], 0.1, 0.2, C.white, (back[0] + back[1]) / 2, y, -1.33);
    k.hedge((back[0] + back[1]) / 2, -1.33, back[1] - back[0] - 0.04, 0.16, y + 0.06);
  }
}

const GLASS = new THREE.MeshStandardMaterial({ color: '#9fd0e0', transparent: true, opacity: 0.4, roughness: 0.1, flatShading: true });

/** Glass control cab with white posts and a green roof; an operator works the consoles inside. */
function glassCab(k: Kit, x: number, z: number, y: number, w: number, d: number, h: number, seed = 2, roof: string = C.roofGreen) {
  k.box(w, 0.08, d, C.white, x, y, z);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.05, h, 0.05, C.white, x + sx * (w / 2 - 0.025), y + 0.08, z + sz * (d / 2 - 0.025));
  for (const [pw, pd, px, pz] of [[w - 0.05, 0.02, 0, d / 2 - 0.02], [w - 0.05, 0.02, 0, -d / 2 + 0.02], [0.02, d - 0.05, w / 2 - 0.02, 0], [0.02, d - 0.05, -w / 2 + 0.02, 0]]) {
    const g = new THREE.Mesh(new THREE.BoxGeometry(pw, h, pd), GLASS);
    g.position.set(x + px, y + 0.08 + h / 2, z + pz);
    k.group.add(g);
  }
  k.box(w + 0.12, 0.07, d + 0.12, roof, x, y + 0.08 + h, z);
  k.box(w + 0.14, 0.03, d + 0.14, C.white, x, y + 0.06 + h, z);
  k.box(w * 0.6, 0.22, 0.12, '#4a4f54', x, y + 0.08, z - d / 2 + 0.12);
  screen(k, w * 0.25, 0.12, x - w * 0.15, y + 0.34, z - d / 2 + 0.17, '#3fd1ff', 0.3);
  screen(k, w * 0.25, 0.12, x + w * 0.15, y + 0.34, z - d / 2 + 0.17, '#3fd16b', -0.3);
  k.box(0.1, 0.18, 0.1, '#2a2b2d', x, y + 0.08, z + 0.05);
  operator(k, x, y + 0.27, z + 0.08, Math.PI / 2, seed, 'headset', '#4a6b8a');
  return y + 0.15 + h;
}

/** White podium drum with a dark-glass ribbon, teal band and fins; returns its top. */
function podium(k: Kit, x: number, z: number, y: number, r: number, h: number, sides = 16, fins = 12, glassH = 0.22) {
  const rot = sides === 8 ? Math.PI / 8 : 0;
  k.cyl(r, h, C.white, x, y, z, sides).rotation.y = rot;
  k.cyl(r + 0.01, 0.1, '#d6d0c2', x, y, z, sides).rotation.y = rot;
  k.cyl(r + 0.015, glassH, DARK_GLASS, x, y + Math.min(h * 0.35, h - glassH - 0.18), z, sides).rotation.y = rot;
  k.cyl(r + 0.02, 0.05, TEAL, x, y + h - 0.12, z, sides).rotation.y = rot;
  k.cyl(r + 0.03, 0.05, C.white, x, y + h - 0.02, z, sides).rotation.y = rot;
  for (let i = 0; i < fins; i++) {
    const a = ((i + 0.5) / fins) * Math.PI * 2;
    if (Math.abs(wrap(a - Math.PI / 2)) < 0.3) continue;
    k.box(0.12, h - 0.15, 0.04, C.white, x + Math.cos(a) * (r + 0.04), y + 0.1, z + Math.sin(a) * (r + 0.04)).rotation.y = -a;
  }
  return y + h + 0.03;
}

/** EO sensor ball on a short stalk that scans independently. */
function eoBall(k: Kit, parent: THREE.Object3D, x: number, y: number, z: number, r = 0.08) {
  k.box(0.05, 0.1, 0.05, C.white, x, y, z, parent);
  const g = new THREE.Group();
  g.position.set(x, y + 0.1 + r, z);
  k.add(g, parent);
  const b = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat('#e8e6e0'));
  k.add(b, g);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, 0.03, 8).rotateZ(Math.PI / 2), M('#1e2226', { metalness: 0.4, roughness: 0.2 }));
  lens.position.set(r * 0.9, 0, 0);
  g.add(lens);
  k.anims.push((t) => {
    g.rotation.y = Math.sin(t * 0.6 + x) * 1.4;
    g.rotation.z = Math.sin(t * 0.4) * 0.3 + 0.2;
  });
}

function lv11(k: Kit, y: number) {
  // Twin-35 pavilion: white modern turret with a teal stripe on a glazed podium; the turret carries
  // its own planar search radar; glass operator cab with a green roof, planters
  const cx = -0.3, cz = -0.15;
  const top = podium(k, cx, cz, y, 1.0, 0.95);
  k.stairs(cx, cz + 1.2, 0.42, 0.3, 0.3);
  k.door('front', cx, cz, 2.0, 2.0, 0, y, 0.34, 0.6, DARK_GLASS);
  const r = rig(k, cx, top, cz, 0.3, 0.12);
  cylP(k, r.yaw, 0.5, 0.06, '#d6d0c2', 0, 0, 0, 18);
  k.box(0.9, 0.44, 0.66, C.white, -0.06, 0.06, 0, r.yaw);
  k.box(0.91, 0.05, 0.67, TEAL, -0.06, 0.3, 0, r.yaw);
  k.box(0.3, 0.05, 0.64, C.white, 0.39, 0.36, 0, r.yaw).rotation.z = -0.5;
  k.box(0.04, 0.1, 0.3, DARK_GLASS, 0.39, 0.32, 0, r.yaw);
  for (const s of [-1, 1]) {
    cannon(k, r, s * 0.43, 1.3, { body: C.white, rb: 0.038, jacket: true });
    k.box(0.24, 0.14, 0.06, '#d6d0c2', -0.2, 0.14, s * 0.36, r.yaw);
  }
  k.box(0.1, 0.32, 0.1, C.white, -0.38, 0.5, 0, r.yaw);
  radar(k, -0.38, 0.82, 0, 'planar', 0.75, 1.5, r.yaw);
  eoBall(k, r.yaw, 0.15, 0.5, 0.2);
  arm(k, r, 11, { kick: 0.12 });
  glassCab(k, 0.98, -0.95, y, 0.8, 0.7, 0.62, 2);
  roofFan(k, 0.98, y + 0.77, -0.95, 0.12, '#e8e6e0');
  plantBed(k, 0.95, 0.75, y, 0.75, 0.9);
  lowWall(k, -1.38, 1.33, -0.6, 1.33, y);
  lowWall(k, 0.0, 1.33, 0.5, 1.33, y);
  k.bench(-1.0, 1.2, 0.5, y);
  edgeHedges(k, y, [-1.3, 0.9], [-1.2, 0.5]);
  carrier(k, y, -1.2, 1.0, 0.4, 1.0, 7, 5, 'tablet', 'beret', '#4a6b8a');
}

function lv12(k: Kit, y: number) {
  // Missile pod battery: first missiles: two four-tube pods either side of a sensor head,
  // missiles slide out on launch and reload; white tubular mast with a planar radar; glass control cab
  const cx = -0.3, cz = -0.2;
  const top = podium(k, cx, cz, y, 0.95, 1.5, 8, 8, 0.85);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    k.box(0.05, 0.85, 0.05, C.white, cx + Math.cos(a) * 0.96, y + 0.3, cz + Math.sin(a) * 0.96);
  }
  k.stairs(cx, cz + 1.15, 0.42, 0.3, 0.3);
  edgeHedges(k, y, [-1.3, 0.7], [-1.25, 0.6]);
  k.door('front', cx, cz, 1.9, 1.9, 0, y, 0.34, 0.6, DARK_GLASS);
  const r = rig(k, cx, top, cz, 0.36);
  cylP(k, r.yaw, 0.5, 0.08, '#d6d0c2', 0, 0, 0, 18);
  cylP(k, r.yaw, 0.51, 0.03, TEAL, 0, 0.04, 0, 18);
  k.box(0.46, 0.3, 0.34, C.white, -0.05, 0.08, 0, r.yaw);
  for (const s of [-1, 1]) k.box(0.12, 0.34, 0.06, '#d6d0c2', 0, 0.16, s * 0.19, r.yaw);
  for (const s of [-1, 1]) pod(k, r, s * 0.38, 2, 2, { cell: 0.14, len: 0.66, frame: TEAL });
  k.box(0.2, 0.14, 0.14, C.white, 0.0, -0.07, 0, r.pitch);
  rodX(k, r.pitch, 0.05, 0.04, '#1e2226', 0.1, 0, 0, 8);
  eoBall(k, r.yaw, -0.18, 0.38, 0);
  arm(k, r, 12, { kick: 0.06 });
  // White tubular mast with planar radar
  const mx = 1.05, mz = -1.05, mh = 2.4;
  k.box(0.4, 0.15, 0.4, '#d6d0c2', mx, y, mz);
  k.cyl(0.08, mh, C.white, mx, y + 0.15, mz, 10, 0.06);
  k.cyl(0.1, 0.06, TEAL, mx, y + 1.2, mz, 10);
  k.cyl(0.1, 0.06, TEAL, mx, y + mh - 0.1, mz, 10);
  radar(k, mx, y + mh + 0.15, mz, 'planar', 1.0, 1.0);
  k.blinker(mx, y + mh + 0.95, mz, '#ff3b30', 0.035);
  glassCab(k, 1.0, 0.75, y, 0.72, 0.75, 0.6, 3);
  // Spare canisters on a rack, technician
  for (let i = 0; i < 3; i++) {
    rodX(k, k.group, 0.07, 0.6, C.white, -1.1, y + 0.12 + (i % 2) * 0.14, 1.12 - i * 0.07 + (i === 2 ? 0.3 : 0), 8);
  }
  for (const dx of [-1.05, -0.55]) k.box(0.05, 0.3, 0.3, '#4a4f54', dx, y, 1.15);
  carrier(k, y, -0.2, 1.3, 0.55, 1.3, 6, 6, 'tablet', 'cap', '#4a6b8a');
  lowWall(k, 1.33, -0.55, 1.33, 0.3, y);
  lowWall(k, 0.6, 1.36, 1.38, 1.36, y);
  plantBed(k, 1.1, -0.15, y, 0.35, 0.5);
}

function lv13(k: Kit, y: number) {
  // Reload crane battery: square glazed podium, twin six-tube pods, an articulated reload crane
  // swinging a canister across, white lattice radar tower with a back-to-back planar array
  const cx = -0.35, cz = -0.25, ph = 1.4;
  edgeHedges(k, y, [-1.3, 1.3], [-1.3, 0.5]);
  k.box(1.5, ph, 1.5, C.white, cx, y, cz);
  k.box(1.52, 0.1, 1.52, '#d6d0c2', cx, y, cz);
  k.box(1.53, 0.22, 1.53, DARK_GLASS, cx, y + 0.4, cz);
  k.box(1.54, 0.05, 1.54, TEAL, cx, y + ph - 0.13, cz);
  k.box(1.56, 0.05, 1.56, C.white, cx, y + ph - 0.03, cz);
  for (let i = 0; i < 7; i++) {
    k.box(0.04, ph - 0.15, 0.1, C.white, cx - 0.66 + i * 0.22, y + 0.1, cz + 0.79);
    k.box(0.1, ph - 0.15, 0.04, C.white, cx + 0.79, y + 0.1, cz - 0.66 + i * 0.22);
  }
  k.door('front', cx, cz, 1.5, 1.5, -0.4, y, 0.34, 0.6, DARK_GLASS);
  const yt = y + ph + 0.02;
  const r = rig(k, cx, yt, cz, 0.38);
  cylP(k, r.yaw, 0.55, 0.08, '#d6d0c2', 0, 0, 0, 18);
  cylP(k, r.yaw, 0.56, 0.03, TEAL, 0, 0.04, 0, 18);
  k.box(0.5, 0.34, 0.36, C.white, -0.05, 0.08, 0, r.yaw);
  k.box(0.51, 0.05, 0.37, TEAL, -0.05, 0.26, 0, r.yaw);
  for (const s of [-1, 1]) pod(k, r, s * 0.43, 2, 3, { cell: 0.13, len: 0.7, frame: TEAL });
  eoBall(k, r.yaw, -0.15, 0.42, 0, 0.07);
  arm(k, r, 13, { kick: 0.06 });
  // Reload crane: slewing base, luffing boom and a hanging canister
  const kx = 0.65, kz = 0.85;
  k.box(1.0, 0.36, 1.1, '#d6d0c2', 0.85, y, 0.55);
  k.box(1.02, 0.05, 1.12, HAZ, 0.85, y + 0.31, 0.55);
  k.stairs(0.85, 1.22, 0.36, 0.24, 0.36);
  const slew = new THREE.Group();
  slew.position.set(kx, y + 0.36, kz);
  k.add(slew);
  k.box(0.26, 0.2, 0.26, HAZ, 0, 0, 0, slew);
  k.box(0.18, 0.18, 0.18, '#3a3f44', -0.12, 0.2, 0, slew);
  k.box(0.1, 0.1, 0.02, DARK_GLASS, -0.03, 0.26, 0.09, slew);
  const boom = new THREE.Group();
  boom.position.set(0.05, 0.3, 0);
  slew.add(boom);
  k.box(0.95, 0.07, 0.07, HAZ, 0.45, -0.035, 0, boom);
  k.box(0.04, 0.04, 0.04, '#2a2b2d', 0.92, -0.06, 0, boom);
  const hook = new THREE.Group();
  hook.position.set(0.92, -0.04, 0);
  boom.add(hook);
  k.box(0.008, 0.3, 0.008, '#2a2b2d', 0, -0.3, 0, hook);
  rodX(k, hook, 0.06, 0.5, C.white, -0.25, -0.36, 0, 8);
  k.box(0.04, 0.03, 0.04, '#d8342c', 0.25, -0.37, 0, hook);
  k.anims.push((t) => {
    slew.rotation.y = 1.9 + Math.sin(t * 0.35) * 0.9;
    boom.rotation.z = 0.55 + Math.sin(t * 0.5) * 0.18;
    hook.rotation.z = -boom.rotation.z;
  });
  for (let i = 0; i < 4; i++) rodX(k, k.group, 0.06, 0.5, C.white, 0.75, y + 0.42 + (i > 1 ? 0.11 : 0), 0.15 + (i % 2) * 0.13 + (i > 1 ? 0.065 : 0), 8);
  lowWall(k, -1.38, 1.33, -0.3, 1.33, y);
  plantBed(k, 1.1, -0.25, y, 0.4, 0.5);
  // White lattice radar tower
  const tx = 1.02, tz = -1.02;
  const tt = lattice(k, tx, tz, y, 2.0, 0.55, 0.3, C.white);
  radar(k, tx, tt, tz, 'planar', 1.05, 1.0);
  k.blinker(tx + 0.18, tt, tz + 0.18, '#ff3b30', 0.03);
  carrier(k, y, -1.0, 1.1, 0.15, 1.1, 7, 5, 'tablet', 'cap', '#4a6b8a');
}

function lv14(k: Kit, y: number) {
  // Launcher tower: four 2×2 pods on a tall white drum tower with a sensor head between them;
  // two-storey command block with fins, glass and a green roof, planar radar on top
  const cx = -0.42, cz = -0.25, th = 1.45;
  k.cyl(0.66, 0.3, '#d6d0c2', cx, y, cz, 12);
  const top = podium(k, cx, cz, y + 0.3, 0.56, th - 0.3, 12, 10);
  k.door('front', cx, cz, 1.32, 1.32, 0, y + 0.3, 0.3, 0.55, DARK_GLASS);
  k.stairs(cx, cz + 0.85, 0.36, 0.3, 0.38);
  const r = rig(k, cx, top, cz, 0.42);
  cylP(k, r.yaw, 0.48, 0.08, '#d6d0c2', 0, 0, 0, 18);
  k.box(0.42, 0.42, 0.4, C.white, -0.05, 0.08, 0, r.yaw);
  k.box(0.43, 0.05, 0.41, TEAL, -0.05, 0.3, 0, r.yaw);
  for (const s of [-1, 1]) {
    pod(k, r, s * 0.34, 2, 2, { cell: 0.13, len: 0.66, frame: TEAL, yy: 0.16 });
    pod(k, r, s * 0.34, 2, 2, { cell: 0.13, len: 0.66, frame: TEAL, yy: -0.16 });
  }
  k.box(0.22, 0.2, 0.2, C.white, 0.0, -0.1, 0, r.pitch);
  rodX(k, r.pitch, 0.06, 0.04, '#1e2226', 0.11, 0, 0, 8);
  eoBall(k, r.yaw, -0.2, 0.5, 0, 0.08);
  arm(k, r, 14, { kick: 0.06 });
  // Command block
  const bx = 0.82, bz = 0.55, bw = 1.05, bd = 1.3;
  const bh = 2 * STOREY;
  k.box(bw, bh, bd, C.white, bx, y, bz);
  k.box(bw + 0.02, 0.1, bd + 0.02, '#d6d0c2', bx, y, bz);
  k.glassBox(bw - 0.12, 0.6, 0.04, bx, y + 0.12, bz + bd / 2);
  k.box(bw - 0.2, 0.3, 0.02, DARK_GLASS, bx, y + STOREY + 0.3, bz + bd / 2 + 0.01);
  k.box(0.02, 0.3, bd - 0.2, DARK_GLASS, bx + bw / 2 + 0.01, y + STOREY + 0.3, bz);
  k.fins(bw - 0.1, STOREY - 0.1, bx, y + STOREY + 0.05, bz + bd / 2 + 0.07, 7);
  k.box(bw + 0.03, 0.05, bd + 0.03, TEAL, bx, y + STOREY, bz);
  k.box(bw + 0.14, 0.08, bd + 0.14, C.roofGreen, bx, y + bh, bz);
  k.box(bw + 0.16, 0.03, bd + 0.16, C.white, bx, y + bh - 0.02, bz);
  k.box(0.3, 0.2, 0.3, C.white, bx, y + bh + 0.08, bz - 0.2);
  radar(k, bx, y + bh + 0.28, bz - 0.2, 'planar', 0.95, 1.0);
  k.blinker(bx + 0.4, y + bh + 0.08, bz + 0.5, '#ff3b30', 0.03);
  k.aircon(bx + bw / 2 + 0.08, y + 0.3, bz - 0.3, Math.PI / 2);
  k.aircon(bx + bw / 2 + 0.08, y + 0.3 + STOREY, bz + 0.2, Math.PI / 2);
  // Link bridge from the block to the tower
  k.box(0.5, 0.06, 0.28, C.white, (bx - bw / 2 + cx + 0.56) / 2 + 0.02, y + STOREY + 0.05, 0.0);
  k.box(0.5, 0.04, 0.02, TEAL, (bx - bw / 2 + cx + 0.56) / 2 + 0.02, y + STOREY + 0.25, 0.13);
  plantBed(k, -0.95, 1.0, y, 0.75, 0.55);
  edgeHedges(k, y, [-1.3, 0.6], [-1.3, 0.6]);
  carrier(k, y, -0.3, 1.25, 0.25, 1.25, 5, 4, 'tablet', 'cap', '#4a6b8a');
  k.flagpole(1.2, -1.2, 2.2, y);
}

function lv15(k: Kit, y: number) {
  // Sky Shield centre: grand glazed drum podium with a roof terrace, launcher with four
  // 2×3 pods around a sensor mast, tall white radar mast with twin arrays, glass pavilion with a roof garden
  const cx = -0.25, cz = -0.22;
  const top = podium(k, cx, cz, y, 1.15, 1.35, 20, 16);
  k.cyl(1.2, 0.04, TEAL, cx, top - 0.02, cz, 20);
  ringWall(k, cx, cz, 1.12, 0.12, top, C.white, TEAL, 0.0, 0, 0.06);
  k.stairs(cx, cz + 1.38, 0.42, 0.3, 0.35);
  k.door('front', cx, cz, 2.3, 2.3, 0, y, 0.36, 0.62, DARK_GLASS);
  const r = rig(k, cx, top, cz, 0.46);
  cylP(k, r.yaw, 0.58, 0.08, '#d6d0c2', 0, 0, 0, 20);
  cylP(k, r.yaw, 0.59, 0.03, TEAL, 0, 0.04, 0, 20);
  k.box(0.5, 0.46, 0.42, C.white, -0.05, 0.08, 0, r.yaw);
  k.box(0.51, 0.05, 0.43, TEAL, -0.05, 0.34, 0, r.yaw);
  for (const s of [-1, 1]) {
    pod(k, r, s * 0.42, 2, 3, { cell: 0.12, len: 0.7, frame: TEAL, yy: 0.15 });
    pod(k, r, s * 0.42, 2, 3, { cell: 0.12, len: 0.7, frame: TEAL, yy: -0.15 });
  }
  k.box(0.24, 0.24, 0.2, C.white, 0.0, -0.12, 0, r.pitch);
  rodX(k, r.pitch, 0.07, 0.04, '#1e2226', 0.12, 0, 0, 8);
  k.box(0.08, 0.3, 0.08, C.white, -0.25, 0.54, 0, r.yaw);
  radar(k, -0.25, 0.84, 0, 'planar', 0.55, 1.8, r.yaw, { iff: false });
  arm(k, r, 15, { kick: 0.06 });
  // Tall radar mast with two arrays and IFF
  const mx = 1.12, mz = -1.12, mh = 3.0;
  k.box(0.4, 0.15, 0.4, '#d6d0c2', mx, y, mz);
  k.cyl(0.09, mh, C.white, mx, y + 0.15, mz, 10, 0.06);
  for (const hh of [0.9, 1.7, 2.4]) k.cyl(0.11, 0.06, TEAL, mx, y + hh, mz, 10);
  radar(k, mx, y + 1.9, mz, 'planar', 0.7, -1.3, k.group, { iff: false });
  radar(k, mx, y + mh + 0.15, mz, 'planar', 1.05, 0.9);
  k.blinker(mx, y + mh + 0.95, mz, '#ff3b30', 0.035);
  // Glass pavilion with a roof garden
  const gt = glassCab(k, 1.0, 0.85, y, 0.78, 0.8, 0.62, 3);
  k.hedge(1.0, 0.85, 0.7, 0.7, gt);
  k.flagpole(-1.25, 1.2, 2.4, y);
  k.flagpole(0.35, 1.28, 2.4, y);
  lowWall(k, -1.1, 1.36, -0.6, 1.36, y);
  lowWall(k, 0.0, 1.36, 0.2, 1.36, y);
  carrier(k, y, -1.25, -1.25, -1.25, 0.6, 7, 6, 'tablet', 'cap', '#4a6b8a');
}

// ================================================================== Secure 16–20

/** Run of precast blast wall with a hazard band and joint lines. */
function blastRun(k: Kit, x0: number, z0: number, x1: number, z1: number, y: number, h = 0.42, color = CONCRETE) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const g = new THREE.Group();
  g.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
  g.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
  k.add(g);
  k.box(len, h, 0.16, color, 0, 0, 0, g);
  k.box(len + 0.02, 0.05, 0.17, HAZ, 0, h - 0.12, 0, g);
  k.box(len + 0.04, 0.04, 0.2, ARMOR_D, 0, h, 0, g);
  for (let i = 1; i < len / 0.35; i++) k.box(0.012, h, 0.165, '#b5afa3', -len / 2 + i * 0.35, 0, 0, g);
}

/** Armoured mast (square section, hazard bands) carrying a rotating AESA. */
function armouredMast(k: Kit, x: number, z: number, y: number, h: number, s = 0.8, gold = false) {
  k.box(0.45, 0.18, 0.45, CONCRETE, x, y, z);
  k.box(0.22, h, 0.22, ARMOR, x, y + 0.18, z);
  for (const hh of [0.5, h * 0.7]) k.box(0.24, 0.06, 0.24, gold ? GOLD : HAZ, x, y + 0.18 + hh, z);
  ladder(k, x, z + 0.14, y + 0.18, h - 0.2, true, '#7f878b');
  k.box(0.42, 0.05, 0.42, ARMOR_D, x, y + 0.18 + h, z);
  radar(k, x, y + 0.23 + h, z, 'aesa', s, 0.8, k.group, { gold });
  k.blinker(x + 0.18, y + 0.23 + h, z + 0.18, '#ff3b30', 0.03);
}

/** Sensor cabinet with blinking status LEDs and a cooling fan. */
function cabinet(k: Kit, x: number, z: number, y: number, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  k.add(g);
  k.box(0.36, 0.5, 0.24, ARMOR, 0, 0, 0, g);
  k.box(0.37, 0.04, 0.25, HAZ, 0, 0.5, 0, g);
  k.add(g);
  const fan = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.012), mat('#2a2b2d'));
  fan.position.set(-0.06, 0.32, 0.13);
  k.add(fan, g);
  k.anims.push((t) => (fan.rotation.z = t * 10));
  for (let i = 0; i < 3; i++) {
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.01), glow(['#3fd16b', '#ffb020', '#3fd1ff'][i], 1));
    led.position.set(0.08, 0.15 + i * 0.07, 0.125);
    g.add(led);
    k.anims.push((t) => ((led.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(t * (3 + i) + i) > 0 ? 1.6 : 0.2));
  }
}

/** Hardened launcher: armoured body and two lidded pods; returns the rig. */
function lidLauncher(k: Kit, x: number, y: number, z: number, lv: number, rows: number, cols: number, cell: number, color = ARMOR) {
  const r = rig(k, x, y, z, 0.4);
  cylP(k, r.yaw, 0.55, 0.1, ARMOR_D, 0, 0, 0, 8);
  cylP(k, r.yaw, 0.56, 0.03, HAZ, 0, 0.06, 0, 8);
  k.box(0.55, 0.4, 0.4, color, -0.05, 0.1, 0, r.yaw);
  k.box(0.2, 0.12, 0.42, ARMOR_D, -0.25, 0.5, 0, r.yaw);
  const lids: THREE.Object3D[] = [];
  const W = cols * cell + 0.05;
  for (const s of [-1, 1]) {
    const p = pod(k, r, s * (0.22 + W / 2), rows, cols, { cell, len: 0.7, body: color, frame: ARMOR_D, nose: HAZ });
    lids.push(podLid(k, p.body, p.H, p.W, p.xf));
  }
  const t = arm(k, r, lv, { kick: 0.05, stow: true, pitch: 0.95 });
  armourFollow(k, r.pitch, t, (o) => lids.forEach((l) => (l.rotation.z = o * 1.9)), 0.3);
  eoBall(k, r.yaw, -0.25, 0.62, 0, 0.07);
  return r;
}

/**
 * Launcher housed in an armoured box on the yaw: pods rise from inside on a rear pivot and
 * stow flat under clamshell doors ('clam') or sliding roof hatches ('slide').
 */
function housedLauncher(k: Kit, x: number, y: number, z: number, lv: number, rows: number, cols: number, cell: number, kind: 'clam' | 'slide', gold = false) {
  const W = cols * cell + 0.05, H = rows * cell + 0.05;
  const ph = 0.2 + H / 2;
  const d = 2 * W + 0.16, w = 1.0, h = ph + H / 2 - 0.06;
  const r = rig(k, x, y, z, ph, -0.3);
  cylP(k, r.yaw, 0.62, 0.1, ARMOR_D, 0, 0, 0, 8);
  cylP(k, r.yaw, 0.63, 0.03, gold ? GOLD : HAZ, 0, 0.07, 0, 8);
  k.box(w, 0.08, d, ARMOR, 0, 0.1, 0, r.yaw);
  for (const s of [-1, 1]) {
    k.box(w, h - 0.08, 0.06, ARMOR, 0, 0.18, s * (d / 2 - 0.03), r.yaw);
    k.box(w + 0.02, 0.04, 0.065, gold ? GOLD : HAZ, 0, 0.3, s * (d / 2 - 0.03), r.yaw);
  }
  k.box(0.06, h - 0.08, d, ARMOR_D, -w / 2 + 0.03, 0.18, 0, r.yaw);
  k.box(0.2, 0.25, d * 0.5, ARMOR_D, -w / 2 - 0.08, 0.1, 0, r.yaw);
  for (const s of [-1, 1]) pod(k, r, s * (W / 2 + 0.04), rows, cols, { cell, len: 0.72, body: ARMOR, frame: gold ? GOLD : ARMOR_D, nose: gold ? GOLD : HAZ, yy: 0.0 });
  for (const p of r.recoil) p.position.x += 0.2;
  const doors: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(0, 0.1 + h, s * (d / 2));
    r.yaw.add(g);
    k.box(w, 0.04, d / 2, ARMOR, 0, 0, (-s * d) / 4, g);
    for (let i = 0; i < 3; i++) k.box(0.04, 0.045, d / 2 - 0.04, ARMOR_D, -w / 2 + 0.2 + i * 0.3, 0, (-s * d) / 4, g);
    k.box(w, 0.05, 0.04, gold ? GOLD : HAZ, 0, 0, -s * 0.02, g);
    if (kind === 'clam') k.box(w - 0.06, 0.012, d / 2 - 0.06, gold ? GOLD : HAZ, 0, -0.012, (-s * d) / 4, g);
    doors.push(g);
  }
  const t = arm(k, r, lv, { kick: 0.05, stow: true, pitch: 0.95 });
  armourFollow(k, r.pitch, t, (o) => doors.forEach((g, i) => {
    const s = i ? 1 : -1;
    if (kind === 'clam') g.rotation.x = s * o * 2.0;
    else {
      g.position.z = s * (d / 2 + o * (d / 2 + 0.04));
      g.position.y = 0.1 + h + o * 0.05;
    }
  }), 0.06);
  return { r, w, d };
}

function lv16(k: Kit, y: number) {
  // Hardened launcher: armoured launcher on a sloped concrete bunker, pods with flip-up armour lids
  // that close when it stows, T-wall blast barriers, armoured mast with an AESA, sensor cabinet
  const cx = -0.35, cz = -0.25, bh = 1.5;
  k.box(1.7, bh, 1.7, CONCRETE, cx, y, cz);
  for (const [dx, dz, ry] of [[0, 0.85, 0], [0.85, 0, Math.PI / 2], [0, -0.85, 0], [-0.85, 0, Math.PI / 2]] as const) {
    const sl = k.box(ry ? 0.3 : 1.7, bh * 0.6, ry ? 1.7 : 0.3, '#6fae3a', cx + dx, y, cz + dz);
    if (ry) sl.rotation.z = dx > 0 ? -0.3 : 0.3;
    else sl.rotation.x = dz > 0 ? 0.3 : -0.3;
  }
  for (let i = 0; i < 8; i++) k.box(1.72 / 8, 0.06, 0.03, i % 2 ? C.kerbB : HAZ, cx - 0.75 + i * 0.215, y + bh - 0.12, cz + 0.86);
  k.box(1.74, 0.06, 1.74, '#5f9c34', cx, y + bh, cz);
  for (let i = 0; i < 5; i++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), mat(i % 2 ? '#4f8f2e' : '#6fbf3a'));
    b.position.set(cx - 0.7 + i * 0.35, y + bh + 0.06, cz + (i % 2 ? 0.72 : -0.72));
    k.add(b);
  }
  k.box(0.34, 0.5, 0.05, ARMOR, cx - 0.35, y, cz + 0.98);
  k.box(0.36, 0.05, 0.06, HAZ, cx - 0.35, y + 0.5, cz + 0.98);
  ladder(k, cx + 0.5, cz + 0.98, y, bh, true, '#7f878b');
  lidLauncher(k, cx, y + bh + 0.06, cz, 16, 2, 3, 0.12);
  for (let i = 0; i < 3; i++) tWall(k, -1.2 + i * 0.34, 1.2, y, 0);
  blastRun(k, 1.33, -0.55, 1.33, 0.0, y);
  blastRun(k, 0.3, 1.33, 1.38, 1.33, y);
  armouredMast(k, 1.05, -1.05, y, 2.1, 0.75);
  cabinet(k, 1.1, 0.25, y, -Math.PI / 2);
  cable(k, 1.0, 0.25, cx + 0.85, 0.1, y);
  generator(k, 1.05, 0.95, y, ARMOR, Math.PI / 2);
  carrier(k, y, 0.65, -0.3, 0.65, 0.95, 6, 7, 'tablet', 'helmet', '#5d6b55');
}

function lv17(k: Kit, y: number) {
  // Phased-array post: tapered concrete sensor block with two glowing phased-array faces whose
  // scan bars sweep, an AESA on its roof; bigger nine-tube lidded launcher on a round hardened bunker
  const sx = 0.82, sz = -0.78, sh = 2.15;
  const blk = k.cyl(0.85, sh, CONCRETE, sx, y, sz, 4, 0.58);
  blk.rotation.y = Math.PI / 4;
  const tilt = Math.atan((0.85 - 0.58) * Math.SQRT1_2 / sh);
  for (const [rotY, dx, dz] of [[0, 0, 1], [Math.PI / 2, 1, 0]] as const) {
    const off = 0.85 * Math.SQRT1_2 - (0.85 - 0.58) * Math.SQRT1_2 * (0.55 / sh) + 0.03;
    const f = arrayFace(k, 0.62, 1.15, sx + dx * off, y + 0.55, sz + dz * off, rotY, ARMOR_D, rotY * 2);
    f.rotation.x = 0;
    f.rotateX(-tilt);
  }
  k.box(0.9, 0.06, 0.9, ARMOR_D, sx, y + sh, sz);
  radar(k, sx, y + sh + 0.06, sz, 'aesa', 0.6, 1.0);
  k.blinker(sx + 0.3, y + sh + 0.06, sz + 0.3, '#ff3b30', 0.03);
  k.box(0.3, 0.5, 0.04, ARMOR, sx - 0.35, y, sz + 0.62).rotation.y = 0;
  // Round hardened bunker and launcher
  const cx = -0.45, cz = 0.2, bh = 1.3;
  k.cyl(0.95, bh, CONCRETE, cx, y, cz, 16, 0.85);
  k.cyl(0.97, 0.1, ARMOR_D, cx, y, cz, 16);
  k.cyl(0.87, 0.06, HAZ, cx, y + bh - 0.12, cz, 16);
  k.cyl(0.86, 0.05, ARMOR_D, cx, y + bh, cz, 16);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    k.box(0.16, 0.08, 0.02, '#232b31', cx + Math.cos(a) * 0.9, y + 0.8, cz + Math.sin(a) * 0.9).rotation.y = -a - Math.PI / 2;
  }
  lidLauncher(k, cx, y + bh + 0.05, cz, 17, 3, 3, 0.11);
  blastRun(k, 0.55, 0.45, 1.38, 0.45, y, 0.5);
  blastRun(k, 1.33, 0.6, 1.33, 1.38, y);
  blastRun(k, -1.38, 1.33, 0.5, 1.33, y);
  cabinet(k, 0.75, 1.1, y, 0);
  carrier(k, y, -1.25, -1.25, -1.25, -0.4, 6, 8, 'tablet', 'helmet', '#5d6b55');
}

function lv18(k: Kit, y: number) {
  // Clamshell launcher: the launcher stows flat inside an armoured housing and its clamshell doors
  // swing shut over it; octagonal hardened base, big AESA on an armoured mast, phased-array pillars
  const cx = -0.35, cz = -0.2, bh = 1.35;
  k.cyl(1.1, bh, '#cdb98a', cx, y, cz, 8, 0.98).rotation.y = Math.PI / 8;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    k.box(0.06, bh - 0.2, 0.06, '#b39f6e', cx + Math.cos(a) * 1.02, y + 0.1, cz + Math.sin(a) * 1.02);
  }
  k.cyl(1.12, 0.1, ARMOR_D, cx, y, cz, 8).rotation.y = Math.PI / 8;
  k.cyl(1.0, 0.07, HAZ, cx, y + bh - 0.1, cz, 8).rotation.y = Math.PI / 8;
  k.cyl(0.99, 0.05, ARMOR_D, cx, y + bh, cz, 8).rotation.y = Math.PI / 8;
  k.box(0.36, 0.55, 0.05, ARMOR, cx, y, cz + 1.04);
  k.box(0.38, 0.05, 0.06, HAZ, cx, y + 0.55, cz + 1.04);
  housedLauncher(k, cx, y + bh + 0.05, cz, 18, 2, 4, 0.11, 'clam');
  armouredMast(k, 1.05, -1.05, y, 2.3, 0.95);
  for (const [px, pz, ry] of [[1.05, 0.35, Math.PI / 2], [0.55, 1.1, 0]] as const) {
    k.box(0.5, 1.3, 0.25, '#cdb98a', px - (ry ? 0.08 : 0), y, pz - (ry ? 0 : 0.08)).rotation.y = ry;
    arrayFace(k, 0.42, 0.9, px + (ry ? 0.05 : 0), y + 0.3, pz + (ry ? 0 : 0.05), ry, ARMOR_D, px);
  }
  for (let i = 0; i < 3; i++) tWall(k, -1.25, 0.6 + i * 0.32 - 0.6 + 0.2, y, Math.PI / 2);
  cabinet(k, 1.1, -0.35, y, -Math.PI / 2);
  blastRun(k, 1.33, 0.75, 1.33, 1.38, y);
  carrier(k, y, -1.0, 1.25, 0.1, 1.25, 6, 9, 'tablet', 'helmet', '#5d6b55');
}

function lv19(k: Kit, y: number) {
  // Sensor fortress: two-storey armoured sensor block with phased-array faces on three sides,
  // AESA and a spinning jammer array on the roof; launcher under sliding armoured roof hatches
  const sx = 0.7, sz = -0.65, sw = 1.2, sd = 1.15, sh = 2.3;
  k.box(sw, sh, sd, '#3b4650', sx, y, sz);
  k.box(sw + 0.03, 0.12, sd + 0.03, ARMOR_D, sx, y, sz);
  k.box(sw + 0.04, 0.06, sd + 0.04, HAZ, sx, y + sh - 0.12, sz);
  k.box(sw + 0.06, 0.06, sd + 0.06, ARMOR_D, sx, y + sh, sz);
  arrayFace(k, 0.85, 1.2, sx, y + 0.55, sz + sd / 2 + 0.01, 0, ARMOR_D, 0);
  arrayFace(k, 0.85, 1.2, sx + sw / 2 + 0.01, y + 0.55, sz, Math.PI / 2, ARMOR_D, 2);
  arrayFace(k, 0.85, 1.2, sx - sw / 2 - 0.01, y + 0.55, sz, -Math.PI / 2, ARMOR_D, 4);
  k.box(0.3, 0.45, 0.04, ARMOR_D, sx - 0.42, y, sz + sd / 2 + 0.02);
  radar(k, sx + 0.15, y + sh + 0.06, sz + 0.1, 'aesa', 0.75, 0.85);
  // Jammer array: ring of small yagis spinning the other way
  const jam = new THREE.Group();
  jam.position.set(sx - 0.38, y + sh + 0.06, sz - 0.35);
  k.add(jam);
  k.box(0.04, 0.45, 0.04, '#7f878b', 0, 0, 0, jam);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    const arm2 = new THREE.Group();
    arm2.position.y = 0.4;
    arm2.rotation.y = a;
    jam.add(arm2);
    k.box(0.2, 0.02, 0.02, '#7f878b', 0.1, 0, 0, arm2);
    for (let j = 0; j < 3; j++) k.box(0.012, 0.012, 0.1 - j * 0.02, C.white, 0.12 + j * 0.04, 0.0, 0, arm2);
  }
  k.anims.push((t) => (jam.rotation.y = -t * 2.2));
  k.blinker(sx + 0.5, y + sh + 0.06, sz + 0.5, '#ff3b30', 0.03);
  // Launcher on a hardened plinth with sliding roof hatches
  const cx = -0.5, cz = 0.4, bh = 1.3;
  blastRun(k, -1.38, -1.33, -0.15, -1.33, y, 0.5);
  blastRun(k, -1.33, -1.2, -1.33, -0.45, y, 0.5);
  blastRun(k, 0.4, 1.33, 1.38, 1.33, y);
  k.box(1.6, bh, 1.5, CONCRETE, cx, y, cz);
  k.box(1.62, 0.1, 1.52, ARMOR_D, cx, y, cz);
  for (let i = 0; i < 8; i++) k.box(0.2, 0.06, 0.03, i % 2 ? C.kerbB : HAZ, cx - 0.7 + i * 0.2, y + bh - 0.12, cz + 0.76);
  k.box(1.64, 0.05, 1.54, ARMOR_D, cx, y + bh, cz);
  housedLauncher(k, cx, y + bh + 0.05, cz, 19, 2, 5, 0.1, 'slide');
  ladder(k, cx + 0.81, cz + 0.2, y, bh, false, '#7f878b');
  cabinet(k, 1.1, 0.55, y, -Math.PI / 2);
  cabinet(k, 1.1, 1.0, y, -Math.PI / 2);
  carrier(k, y, 0.55, 1.25, 0.55, 0.15, 6, 10, 'tablet', 'helmet', '#5d6b55');
}

function lv20(k: Kit, y: number) {
  // Sky citadel: gold-banded armoured citadel tower with phased-array faces, gold-rimmed AESA and a
  // second counter-rotating array; the biggest clamshell launcher with gold-tipped missiles; flags
  const sx = 0.75, sz = -0.7, sw = 1.15, sd = 1.15, sh = 2.4;
  k.box(sw + 0.2, 0.3, sd + 0.2, CONCRETE, sx, y, sz);
  k.box(sw, sh, sd, '#e8e4da', sx, y + 0.3, sz);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.1, sh, 0.1, ARMOR, sx + dx * (sw / 2), y + 0.3, sz + dz * (sd / 2));
  for (const hh of [0.3, 1.25, sh + 0.3 - 0.1]) k.box(sw + 0.04, 0.07, sd + 0.04, GOLD, sx, y + hh, sz);
  arrayFace(k, 0.85, 0.8, sx, y + 0.42, sz + sd / 2 + 0.01, 0, GOLD, 0);
  arrayFace(k, 0.85, 0.8, sx + sw / 2 + 0.01, y + 0.42, sz, Math.PI / 2, GOLD, 2);
  arrayFace(k, 0.85, 0.85, sx, y + 1.38, sz + sd / 2 + 0.01, 0, ARMOR_D, 1);
  arrayFace(k, 0.85, 0.85, sx + sw / 2 + 0.01, y + 1.38, sz, Math.PI / 2, ARMOR_D, 3);
  k.box(sw + 0.1, 0.06, sd + 0.1, ARMOR_D, sx, y + sh + 0.3, sz);
  radar(k, sx, y + sh + 0.36, sz, 'aesa', 0.85, 0.8, k.group, { gold: true });
  radar(k, sx - 0.42, y + sh + 0.36, sz + 0.42, 'planar', 0.42, -1.6, k.group, { dark: true, iff: false });
  k.blinker(sx + 0.48, y + sh + 0.36, sz - 0.48, GOLD, 0.04);
  k.flagpole(sx + 0.45, sz + 0.45, 0.9, y + sh + 0.36);
  // Launcher on a gold-trimmed hardened plinth
  const cx = -0.5, cz = 0.38, bh = 1.0;
  k.cyl(1.0, bh, CONCRETE, cx, y, cz, 8, 0.9).rotation.y = Math.PI / 8;
  k.cyl(1.02, 0.1, ARMOR_D, cx, y, cz, 8).rotation.y = Math.PI / 8;
  k.cyl(0.92, 0.07, GOLD, cx, y + bh - 0.1, cz, 8).rotation.y = Math.PI / 8;
  k.cyl(0.91, 0.05, ARMOR_D, cx, y + bh, cz, 8).rotation.y = Math.PI / 8;
  housedLauncher(k, cx, y + bh + 0.05, cz, 20, 3, 4, 0.1, 'clam', true);
  for (const x of [0.45, 0.85, 1.25]) {
    k.cyl(0.07, 0.34, CONCRETE, x, y, 1.2, 8);
    k.cyl(0.072, 0.04, GOLD, x, y + 0.34, 1.2, 8);
  }
  cabinet(k, 1.2, 0.4, y, -Math.PI / 2);
  k.flagpole(-1.25, -1.2, 2.4, y);
  blastRun(k, 1.33, 0.0, 1.33, 0.75, y, 0.45, ARMOR);
  blastRun(k, -0.45, -1.33, 0.0, -1.33, y, 0.45, ARMOR);
  carrier(k, y, 0.4, 0.82, 1.2, 0.82, 6, 11, 'tablet', 'beret', '#5d6b55');
}

// ------------------------------------------------------------------ assembly

const LEVEL_FNS: ((k: Kit, y: number) => void)[] = [lv1, lv2, lv3, lv4, lv5, lv6, lv7, lv8, lv9, lv10, lv11, lv12, lv13, lv14, lv15, lv16, lv17, lv18, lv19, lv20];

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
