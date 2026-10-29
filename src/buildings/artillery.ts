import * as THREE from 'three';
import { C, Kit, STOREY, mat } from './kit';
import { CONCRETE, DARK_GLASS, GOLD } from './common';
import type { Turret } from './turret';
import { DAY, HOUR, type BuildingDef, type LevelStats } from './types';

/*
 * Artillery Emplacement: the long-range heavy hitter against ground raiders.
 * Signature at every level: a long-barrelled field gun / howitzer that holds its
 * barrel raised while it traverses, with a big recoil (the barrel slides back on
 * its cradle), and a gun drill: a loader fetches a round and slides it into the
 * breech, the rammer drives it home with his staff, the layer pulls the lanyard
 * and the empty brass case drops out. Shell racks and cartridge cases at every
 * level. From the Command band the crew gives way to an auto-loader: rounds ride
 * a conveyor into the mount.
 * Progression: towed field gun in a sandbag pit → gun on a concrete turntable
 * with an ammo store → concrete barbette, coastal gunhouse and casemate → modern
 * gun station and turreted gun → hardened auto-loading turret → twin-barrel turret.
 * Footprint 3×3; unlocked at HQ 11; bulk stays at or under ~3 storeys.
 */

const TITLES = [
  'Gun Pit', 'Camouflaged Gun Pit', 'Dug-in Howitzer',
  'Gun Turntable', 'Shell Gantry Battery', 'Range-Finder Battery',
  'Concrete Emplacement', 'Coastal Battery', 'Casemate Battery', 'Fortress Battery',
  'Modern Gun Station', 'Fire Direction Centre', 'Turret Battery', 'Elevated Turret', 'Landmark Battery',
  'Hardened Gun Bunker', 'Auto-Loader Battery', 'Sensor Battery', 'Twin-Gun Turret', 'Citadel Battery',
];
const SUPPLIES = [
  120_000, 156_000, 203_000, 264_000, 343_000, 446_000, 580_000, 754_000, 980_000, 1_270_000,
  1_650_000, 2_150_000, 2_800_000, 3_640_000, 4_730_000, 6_150_000, 8_000_000, 10_400_000, 13_500_000, 17_500_000,
];
const REPUTATION = [
  4_000, 4_600, 5_300, 6_100, 7_000, 8_000, 9_200, 10_600, 12_200, 14_000,
  16_100, 18_500, 21_300, 24_500, 28_200, 32_400, 37_300, 42_900, 49_300, 56_700,
];
const TIME = [
  6 * HOUR, 7 * HOUR, 9 * HOUR, 11 * HOUR, 13 * HOUR, 16 * HOUR, 19 * HOUR, 22 * HOUR, 1.1 * DAY, 1.3 * DAY,
  1.6 * DAY, 1.9 * DAY, 2.3 * DAY, 2.7 * DAY, 3.25 * DAY, 3.9 * DAY, 4.6 * DAY, 5.5 * DAY, 6.6 * DAY, 8 * DAY,
];

/** Shots per second (one round every 5 s); the crew drill runs on the same period. */
const RATE = 0.2;
const P = 1 / RATE;

export const ARTILLERY_LEVELS: LevelStats[] = TITLES.map((title, i) => {
  const level = i + 1;
  const damage = Math.round(80 * Math.pow(1.2, i));
  const range = Math.round((11 + (i * 4) / 19) * 2) / 2;
  const splash = level >= 19 ? 1.5 : 1;
  const barrels = level >= 19 ? 2 : 1;
  return {
    level, title,
    supplies: SUPPLIES[i],
    reputation: REPUTATION[i],
    buildTime: TIME[i],
    hp: Math.round((1400 * Math.pow(1.2, i)) / 10) * 10,
    stats: { damage, range, minRange: 4, splash, reload: P, barrels },
    unlocks: [
      `Shells hit for ${damage} (${splash}-tile splash)`,
      `Range ${range} tiles (cannot fire inside 4)`,
      ...(level === 19 ? ['Twin barrels fire alternately'] : []),
    ],
  };
});

// ------------------------------------------------------------------ palette

const OLIVE = '#5b6b3a';
const OLIVE_D = '#46542c';
const SKIN = ['#e0ac7e', '#c68b5f', '#a8714b', '#f0c39a'];
const GUN_G = '#566640';
const GUN_C = '#5f6d4f';
const GUN_GREY = '#6f7a72';
const STEEL = '#5c6166';
const STEEL_D = '#44494e';
const BRASS = '#d6a840';
const PROJ = '#4f5a34';
const LOG = '#7a5a3b';
const EARTH = '#8f7a52';
const GRASS = '#5f9a3a';
const HAZ = '#f2c230';
const TEAL = '#2bb3a3';
const MODERN = '#e9ebe6';
const MODERN_D = '#c9cec9';
const ARMOUR = '#6b7468';
const M = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8, ...o });
const glow = (c: string, i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, flatShading: true });
const smooth = (u: number) => u * u * (3 - 2 * u);
const clamp01 = (u: number) => Math.min(1, Math.max(0, u));
/** 0 → 1 over [a, b]. */
const ramp = (u: number, a: number, b: number) => smooth(clamp01((u - a) / (b - a)));
const loop = (t: number, p: number) => (((t % p) + p) % p) / p;

// ------------------------------------------------------------------ geometry helpers

/** Cylinder along +x (rTip at +x). */
const xCyl = (r: number, len: number, rTip = r, sides = 10) => new THREE.CylinderGeometry(rTip, r, len, sides).rotateZ(-Math.PI / 2);
/** Cylinder along z. */
const zCyl = (r: number, w: number, sides = 12) => new THREE.CylinderGeometry(r, r, w, sides).rotateX(Math.PI / 2);

function mesh(k: Kit, geo: THREE.BufferGeometry, color: string | THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D) {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color) : color);
  m.position.set(x, y, z);
  return k.add(m, parent);
}

/** Box stretched between two points (struts, trails, braces). */
function strut(k: Kit, parent: THREE.Object3D | undefined, a: THREE.Vector3, b: THREE.Vector3, w: number, h: number, color: string) {
  const dir = b.clone().sub(a);
  const m = new THREE.Mesh(new THREE.BoxGeometry(dir.length(), h, w), mat(color));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
  return k.add(m, parent);
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A group placed at (x, y, z) turned by rotY, already added to the kit. */
function grp(k: Kit, x: number, y: number, z: number, rotY = 0, parent?: THREE.Object3D) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  return k.add(g, parent);
}

/** Point on a circle round (cx, cz); angle θ measured so the point is (cos θ, sin θ) in x/z. */
const onArc = (cx: number, cz: number, r: number, a: number) => [cx + Math.cos(a) * r, cz + Math.sin(a) * r] as const;
/** rotY that lays a part's local x along the circle's tangent at θ. */
const tangent = (a: number) => -a - Math.PI / 2;

/** Curved run of sandbags. */
function bagArc(k: Kit, cx: number, cz: number, r: number, a0: number, a1: number, y: number, layers: number) {
  const n = Math.max(1, Math.round((r * (a1 - a0)) / 0.52));
  const da = (a1 - a0) / n;
  for (let i = 0; i < n; i++) {
    const a = a0 + da * (i + 0.5);
    const [x, z] = onArc(cx, cz, r, a);
    k.sandbags(x, z, r * da + 0.05, tangent(a), y, layers - (i % 4 === 3 ? 1 : 0));
  }
}

/** Curved wall of short straight segments with an optional coping. */
function arcWall(k: Kit, cx: number, cz: number, r: number, a0: number, a1: number, y: number, h: number, t: number, color: string, cap?: string) {
  const n = Math.max(2, Math.round((r * (a1 - a0)) / 0.3));
  const da = (a1 - a0) / n;
  for (let i = 0; i < n; i++) {
    const a = a0 + da * (i + 0.5);
    const [x, z] = onArc(cx, cz, r, a);
    const g = grp(k, x, y, z, tangent(a));
    k.box(r * da + 0.03, h, t, color, 0, 0, 0, g);
    if (cap) k.box(r * da + 0.04, 0.05, t + 0.05, cap, 0, h, 0, g);
  }
}

// ------------------------------------------------------------------ ammunition props

/** One round: brass cartridge case, olive projectile with a yellow band and a fuze. Upright, or lying along +x. */
function shell(k: Kit, parent: THREE.Object3D | undefined, x: number, y: number, z: number, along = false, s = 1) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (along) g.rotation.z = -Math.PI / 2;
  mesh(k, new THREE.CylinderGeometry(0.034 * s, 0.036 * s, 0.1 * s, 8), BRASS, 0, 0.05 * s, 0, g);
  mesh(k, new THREE.CylinderGeometry(0.032 * s, 0.032 * s, 0.07 * s, 8), PROJ, 0, 0.135 * s, 0, g);
  mesh(k, new THREE.CylinderGeometry(0.033 * s, 0.033 * s, 0.014 * s, 8), HAZ, 0, 0.115 * s, 0, g);
  mesh(k, new THREE.ConeGeometry(0.032 * s, 0.06 * s, 8), '#3d4529', 0, 0.2 * s, 0, g);
  k.add(g, parent);
  return g;
}

/** Spent brass cartridge cases lying about. */
function empties(k: Kit, x: number, z: number, y: number, n = 4, seed = 0) {
  for (let i = 0; i < n; i++) {
    const c = mesh(k, xCyl(0.034, 0.11, 0.03, 8), BRASS, x + Math.sin(i * 2.1 + seed) * 0.13, y + 0.034, z + Math.cos(i * 1.7 + seed) * 0.11);
    c.rotation.y = i * 1.3 + seed;
  }
}

/** Upright shells in a timber (or steel) rack. */
function shellRack(k: Kit, x: number, z: number, y: number, n = 4, rows = 2, rotY = 0, frame: string = C.wood) {
  const g = grp(k, x, y, z, rotY);
  const w = n * 0.09 + 0.06, d = rows * 0.09 + 0.04;
  k.box(w, 0.04, d, frame, 0, 0, 0, g);
  for (const sx of [-1, 1]) k.box(0.04, 0.3, d, frame, (sx * w) / 2, 0, 0, g);
  k.box(w + 0.04, 0.03, 0.03, frame, 0, 0.18, d / 2, g);
  for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) shell(k, g, -w / 2 + 0.075 + i * 0.09, 0.04, -d / 2 + 0.065 + r * 0.09);
  return g;
}

/** Green ammunition box with a yellow stencil band and rope handles. */
function ammoBox(k: Kit, x: number, z: number, y: number, rotY = 0, color = OLIVE) {
  const g = grp(k, x, y, z, rotY);
  k.box(0.32, 0.14, 0.18, color, 0, 0, 0, g);
  k.box(0.33, 0.025, 0.185, HAZ, 0, 0.09, 0, g);
  for (const s of [-1, 1]) k.box(0.02, 0.03, 0.06, '#c9b27a', (s * 0.17), 0.08, 0, g);
  return g;
}

/** Red/white striped aiming post (the layer's reference point). */
function aimingPost(k: Kit, x: number, z: number, y: number, h = 0.8) {
  for (let i = 0; i < 5; i++) k.cyl(0.022, h / 5, i % 2 ? '#f4f1e8' : '#d8342c', x, y + (h / 5) * i, z, 6);
  k.cyl(0.03, 0.03, C.dark, x, y + h, z, 6);
}

/** Camouflage net: mottled patches on poles that breathe in the breeze. */
function camoNet(k: Kit, x0: number, z0: number, x1: number, z1: number, h: number, y: number, seed = 0, poles = true) {
  const cols = ['#4f6a32', '#6b7a3c', '#3f5528', '#7d6b45', '#5a7a36'];
  const nx = Math.max(2, Math.round((x1 - x0) / 0.34)), nz = Math.max(2, Math.round((z1 - z0) / 0.34));
  const sx = (x1 - x0) / nx, sz = (z1 - z0) / nz;
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    if ((i * 7 + j * 3 + seed) % 11 === 0) continue; // a gap here and there
    const px = x0 + sx * (i + 0.5), pz = z0 + sz * (j + 0.5);
    const edge = Math.min(i, nx - 1 - i, j, nz - 1 - j);
    const sag = edge === 0 ? -0.12 : -0.02 * Math.min(edge, 2);
    const p = new THREE.Mesh(new THREE.BoxGeometry(sx * 1.12, 0.025, sz * 1.12), mat(cols[(i * 3 + j * 5 + seed) % cols.length]));
    p.position.set(px, y + h + sag, pz);
    p.rotation.set(Math.sin(i * 1.3 + j) * 0.12, 0, Math.cos(j * 1.7 + i) * 0.12);
    k.add(p);
    const ph = i * 0.7 + j * 1.1 + seed;
    const rx = p.rotation.x, rz = p.rotation.z, py = p.position.y;
    k.anims.push((t) => {
      p.position.y = py + Math.sin(t * 1.4 + ph) * 0.018;
      p.rotation.x = rx + Math.sin(t * 1.1 + ph) * 0.05;
      p.rotation.z = rz + Math.cos(t * 1.3 + ph) * 0.05;
    });
  }
  if (poles) for (const [px, pz] of [[x0 + 0.05, z0 + 0.05], [x1 - 0.05, z0 + 0.05], [x0 + 0.05, z1 - 0.05], [x1 - 0.05, z1 - 0.05]]) k.box(0.04, h - 0.1, 0.04, LOG, px, y, pz);
}

/** Hurricane lantern hanging from (x, y, z), swaying. */
function lantern(k: Kit, x: number, y: number, z: number, seed = 0) {
  const g = grp(k, x, y, z);
  k.box(0.01, 0.1, 0.01, C.dark, 0, -0.1, 0, g);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.09, 6), glow('#ffcf6a', 0.8));
  body.position.y = -0.16;
  const lid = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.045, 6), M('#4a4f54'));
  lid.position.y = -0.1;
  g.add(body, lid);
  k.anims.push((t) => {
    g.rotation.z = Math.sin(t * 1.5 + seed) * 0.2;
    g.rotation.x = Math.sin(t * 1.1 + seed * 2) * 0.12;
  });
}

/** Field telephone on a post. */
function fieldPhone(k: Kit, x: number, z: number, y: number) {
  k.box(0.05, 0.5, 0.05, C.wood, x, y, z);
  k.box(0.12, 0.13, 0.07, OLIVE_D, x, y + 0.38, z + 0.05);
  k.box(0.08, 0.03, 0.03, '#2a2b2d', x, y + 0.52, z + 0.06);
}

/** Pole-mounted CCTV camera that pans. */
function cctv(k: Kit, x: number, z: number, y: number, h = 1.1, base = 0) {
  k.cyl(0.025, h, C.metal, x, y, z, 5);
  const cam = grp(k, x, y + h, z, base);
  k.box(0.16, 0.07, 0.07, '#f4f4f0', 0.05, 0, 0, cam);
  k.box(0.03, 0.04, 0.04, '#33383d', 0.14, 0.01, 0, cam);
  k.anims.push((t) => (cam.rotation.y = base + Math.sin(t * 0.4 + x + z) * 0.8));
}

/** Crest disc (camp emblem). */
function crest(k: Kit, x: number, y: number, z: number, r = 0.16, rotY = 0, parent?: THREE.Object3D) {
  const g = grp(k, x, y, z, rotY, parent);
  mesh(k, new THREE.CylinderGeometry(r, r, 0.03, 16).rotateX(Math.PI / 2), C.trim, 0, 0, 0, g);
  mesh(k, new THREE.TorusGeometry(r, 0.022, 4, 16), GOLD, 0, 0, 0.01, g);
  mesh(k, new THREE.CylinderGeometry(r * 0.45, r * 0.45, 0.04, 5).rotateX(Math.PI / 2), GOLD, 0, 0, 0.01, g);
  return g;
}

/** Precast T-wall blast barrier. */
function tWall(k: Kit, x: number, z: number, y: number, rotY = 0, h = 0.9) {
  const g = grp(k, x, y, z, rotY);
  k.box(0.46, h, 0.1, CONCRETE, 0, 0, 0, g);
  k.box(0.46, 0.14, 0.34, CONCRETE, 0, 0, 0, g);
  k.box(0.47, 0.06, 0.11, HAZ, 0, h - 0.12, 0, g);
  return g;
}

/** Yellow/black hazard band of short blocks along x. */
function hazardBand(k: Kit, len: number, x: number, y: number, z: number, h = 0.05, d = 0.03, parent?: THREE.Object3D) {
  const n = Math.max(2, Math.round(len / 0.12));
  for (let i = 0; i < n; i++) k.box(len / n, h, d, i % 2 ? C.kerbB : HAZ, x - len / 2 + (len / n) * (i + 0.5), y, z, parent);
}

// ------------------------------------------------------------------ signs

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

/** Flat sign board with lettering on its front (+z) face. */
function board(k: Kit, text: string, w: number, h: number, x: number, y: number, z: number, bg: string, fg = '#ffffff', rotY = 0, font = 40) {
  const side = M(bg);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), [side, side, side, side, signMat(text, bg, fg, font), side]);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = rotY;
  return k.add(m);
}

/** Sign on two posts. */
function postSign(k: Kit, text: string, x: number, z: number, y: number, rotY = 0, bg = C.trim, w = 0.5, post: string = C.wood) {
  const g = grp(k, x, y, z, rotY);
  for (const s of [-1, 1]) k.box(0.035, 0.42, 0.035, post, (s * w) / 2 - s * 0.04, 0, 0, g);
  const side = M(bg);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, w * 0.32, 0.03), [side, side, side, side, signMat(text, bg, '#ffffff'), side]);
  m.position.set(0, 0.36 + w * 0.16, 0.025);
  g.add(m);
  return g;
}

// ------------------------------------------------------------------ people

interface Figure { root: THREE.Group; legL: THREE.Object3D; legR: THREE.Object3D; armL: THREE.Object3D; armR: THREE.Object3D; head: THREE.Mesh }

/** A ~0.6-tall low-poly gunner facing +x with pivoting limbs; helmet or beret. */
function figure(k: Kit, seed: number, uniform = OLIVE, hat: 'helmet' | 'beret' | 'cap' | null = 'helmet', trousers = OLIVE_D) {
  const root = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, c: string, x: number, yy: number, z: number, parent: THREE.Object3D = root) => mesh(k, geo, c, x, yy, z, parent);
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
  const head = add(new THREE.IcosahedronGeometry(0.062, 0), SKIN[seed % SKIN.length], 0, 0.52, 0);
  if (hat === 'helmet') {
    const h = add(new THREE.SphereGeometry(0.075, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#4a5a30', 0, 0.54, 0);
    h.scale.y = 0.85;
    add(new THREE.CylinderGeometry(0.085, 0.085, 0.012, 8), '#4a5a30', 0, 0.54, 0);
  } else if (hat === 'beret') {
    const b = add(new THREE.CylinderGeometry(0.068, 0.07, 0.03, 8), '#2a3326', -0.005, 0.575, 0.01);
    b.rotation.x = 0.2;
  } else if (hat === 'cap') {
    add(new THREE.CylinderGeometry(0.066, 0.066, 0.035, 8), uniform, 0, 0.575, 0);
    add(new THREE.BoxGeometry(0.06, 0.012, 0.09), uniform, 0.06, 0.56, 0);
  }
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(0, 0.45, -0.105);
  armR.position.set(0, 0.45, 0.105);
  for (const a of [armL, armR]) {
    add(limb(0.05, 0.18, 0.05), uniform, 0, 0, 0, a);
    add(new THREE.BoxGeometry(0.045, 0.04, 0.045), SKIN[seed % SKIN.length], 0, -0.19, 0, a);
    root.add(a);
  }
  return { root, legL, legR, armL, armR, head } as Figure;
}

function pose(f: Figure, walk: number, amp = 0.5) {
  const s = Math.sin(walk);
  f.legL.rotation.z = s * amp;
  f.legR.rotation.z = -s * amp;
  f.armL.rotation.z = -s * amp * 0.8;
  f.armR.rotation.z = s * amp * 0.8;
  f.armL.rotation.x = f.armR.rotation.x = 0;
}

/** Heading (rotation.y) that faces a figure built along +x toward (dx, dz). */
const face = (dx: number, dz: number) => Math.atan2(-dz, dx);

/** An ammunition number carrying rounds from a store (a) to the gun (b) and walking back empty-handed. */
function bearer(k: Kit, ax: number, az: number, bx: number, bz: number, y: number, period = 10, seed = 1, uniform = OLIVE, hat: 'helmet' | 'beret' | 'cap' = 'helmet') {
  const f = figure(k, seed, uniform, hat);
  k.add(f.root);
  const sh = shell(k, f.root, 0.15, 0.3, 0, true, 1.1);
  k.anims.push((t) => {
    const p = loop(t + seed * 2.3, period);
    const out = p < 0.5;
    const u = smooth(out ? p * 2 : 2 - p * 2);
    f.root.position.set(ax + (bx - ax) * u, y, az + (bz - az) * u);
    const turning = Math.min(p, Math.abs(p - 0.5), 1 - p) < 0.05;
    pose(f, turning ? 0 : t * 8, 0.45);
    f.root.rotation.y = out ? face(bx - ax, bz - az) : face(ax - bx, az - bz);
    sh.visible = out;
    if (out) f.armL.rotation.z = f.armR.rotation.z = 0.75;
  });
  return f;
}

/** Observer with binoculars scanning the ground ahead. */
function spotter(k: Kit, x: number, z: number, y: number, rotY: number, seed = 3, uniform = OLIVE, hat: 'helmet' | 'beret' | 'cap' = 'beret') {
  const f = figure(k, seed, uniform, hat);
  f.root.position.set(x, y, z);
  f.root.rotation.y = rotY;
  k.add(f.root);
  f.armL.rotation.z = f.armR.rotation.z = 2.5;
  f.armL.rotation.x = 0.35;
  f.armR.rotation.x = -0.35;
  mesh(k, new THREE.BoxGeometry(0.05, 0.04, 0.1), '#2a2b2d', 0.07, 0.53, 0, f.root);
  k.anims.push((t) => {
    f.root.rotation.y = rotY + Math.sin(t * 0.35 + seed) * 0.7;
    f.root.position.y = y + Math.max(0, Math.sin(t * 0.7 + seed)) * 0.01;
  });
  return f;
}

// ------------------------------------------------------------------ the gun

type Carriage = 'field' | 'heavy' | 'pedestal' | 'modern' | 'turret';
type Shield = 'none' | 'flat' | 'wrap' | 'house' | 'gunhouse' | 'drum';

interface GunSpec {
  carriage: Carriage;
  shield: Shield;
  /** Barrel length forward of the trunnions, and its bore radius. */
  len: number;
  r: number;
  /** Height of the trunnions (pitch pivot) above the yaw pivot. */
  trunH: number;
  color: string;
  barrel?: string;
  brake?: boolean;
  recup?: boolean;
  evac?: boolean;
  twin?: boolean;
  /** Turret body tint / band colour (turret carriage). */
  band?: string;
  wheelR?: number;
  lob?: number;
}

interface Rig {
  yaw: THREE.Group;
  pitch: THREE.Group;
  slides: THREE.Group[];
  muzzles: THREE.Object3D[];
  spec: GunSpec;
  /** Breech distance behind the trunnions (pitch-local x = -bl). */
  bl: number;
  lob: number;
}

/** Barrel, breech and muzzle brake on a recoiling slide (pitch-local), with an empty muzzle at the tip. */
function barrel(k: Kit, pitch: THREE.Group, s: GunSpec, z: number, bl: number) {
  const slide = new THREE.Group();
  slide.position.set(0, 0, z);
  pitch.add(slide);
  const bc = s.barrel ?? s.color;
  const L = s.len + bl;
  mesh(k, xCyl(s.r * 1.25, L * 0.42, s.r * 1.1), bc, -bl + L * 0.21, 0, 0, slide); // thick chase
  mesh(k, xCyl(s.r * 1.05, L * 0.62, s.r * 0.92), bc, -bl + L * 0.69, 0, 0, slide);
  // Breech ring and block with an operating lever
  k.box(0.13, s.r * 3.2, s.r * 3.2, STEEL_D, -bl + 0.02, -s.r * 1.6, 0, slide);
  k.box(0.03, 0.02, 0.09, '#a9b0b4', -bl - 0.05, s.r * 0.6, s.r * 1.6, slide);
  if (s.evac) mesh(k, xCyl(s.r * 1.5, 0.16, s.r * 1.5, 10), bc, s.len * 0.62, 0, 0, slide);
  if (s.brake) {
    k.box(0.12, s.r * 2.6, s.r * 3.4, STEEL_D, s.len - 0.04, -s.r * 1.3, 0, slide);
    for (const sz of [-1, 1]) k.box(0.05, s.r * 2.0, 0.012, '#2a2b2d', s.len - 0.04, -s.r, sz * s.r * 1.71, slide);
  } else mesh(k, xCyl(s.r * 1.18, 0.04, s.r * 1.18), STEEL_D, s.len - 0.01, 0, 0, slide);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(s.len + (s.brake ? 0.04 : 0.02), 0, 0);
  slide.add(muzzle);
  return { slide, muzzle };
}

/**
 * Build the gun pointing along local +x on a yaw group at (x, y, z), with a pitch
 * group at the trunnions holding the cradle and the recoiling barrel(s).
 */
function buildGun(k: Kit, x: number, y: number, z: number, s: GunSpec): Rig {
  const yaw = grp(k, x, y, z);
  const pitch = new THREE.Group();
  pitch.position.set(0, s.trunH, 0);
  yaw.add(pitch);
  const lob = s.lob ?? 0.45;
  const bl = s.carriage === 'turret' ? 0.2 : s.carriage === 'field' ? 0.3 : 0.36;
  const c = s.color;
  const slides: THREE.Group[] = [];
  const muzzles: THREE.Object3D[] = [];

  if (s.carriage === 'field' || s.carriage === 'heavy') {
    const wr = s.wheelR ?? 0.25;
    const heavy = s.carriage === 'heavy';
    const wz = heavy ? 0.36 : 0.32;
    k.box(0.14, 0.08, wz * 2, c, 0, wr - 0.04, 0, yaw); // axle
    k.box(0.5, 0.16, 0.26, c, -0.06, wr - 0.02, 0, yaw); // saddle
    for (const sz of [-1, 1]) {
      const w = mesh(k, zCyl(wr, heavy ? 0.12 : 0.09, 14), '#2a2b2d', 0, wr, sz * wz, yaw);
      mesh(k, zCyl(wr * 0.72, heavy ? 0.13 : 0.1, 10), c, 0, 0, 0, w);
      mesh(k, zCyl(wr * 0.2, heavy ? 0.16 : 0.13, 8), STEEL_D, 0, 0, 0, w);
      for (let i = 0; i < 3; i++) {
        const sp = k.box(wr * 1.3, 0.025, heavy ? 0.135 : 0.105, '#3f4a2c', 0, -0.0125, 0, w);
        sp.rotation.z = (i * Math.PI) / 3;
      }
      // Split trail to a spade dug into the ground
      const a = V(-0.18, wr + 0.02, sz * 0.09), b = V(-1.0, 0.06, sz * 0.36);
      strut(k, yaw, a, b, 0.07, 0.09, c);
      const sp = k.box(0.05, 0.14, 0.2, STEEL_D, -1.02, 0.0, sz * 0.37, yaw);
      sp.rotation.z = -0.35;
      k.box(0.06, 0.04, 0.06, STEEL_D, -0.92, 0.07, sz * 0.33, yaw); // handspike socket
    }
    // Traversing handspike across the trail ends
    k.box(0.03, 0.03, 0.66, C.wood, -0.86, 0.13, 0, yaw);
    // Cradle cheeks up to the trunnions
    for (const sz of [-1, 1]) k.box(0.22, s.trunH - wr + 0.04, 0.04, c, 0, wr, sz * (s.r + 0.06), yaw);
  } else if (s.carriage === 'pedestal') {
    mesh(k, new THREE.CylinderGeometry(0.36, 0.36, 0.06, 14), STEEL_D, 0, 0.03, 0, yaw);
    mesh(k, new THREE.CylinderGeometry(0.16, 0.24, s.trunH - 0.08, 10), c, 0, (s.trunH - 0.08) / 2 + 0.04, 0, yaw);
    for (const sz of [-1, 1]) {
      const cheek = k.box(0.36, 0.22, 0.04, c, 0, s.trunH - 0.14, sz * (s.r + 0.08), yaw);
      cheek.rotation.z = 0.15;
    }
    // Layer's handwheels on the left cheek
    for (const [hx, hy] of [[-0.12, s.trunH - 0.12], [0.06, s.trunH - 0.22]]) {
      const hw = mesh(k, new THREE.TorusGeometry(0.06, 0.012, 4, 10), STEEL_D, hx, hy, -(s.r + 0.14), yaw);
      k.anims.push((t) => (hw.rotation.z = t * 2.2 + hx * 9));
    }
    k.box(0.16, 0.03, 0.14, '#2a2b2d', -0.22, s.trunH - 0.3, -(s.r + 0.26), yaw); // layer's seat
    k.box(0.03, s.trunH - 0.3, 0.03, STEEL_D, -0.22, 0, -(s.r + 0.26), yaw);
  } else if (s.carriage === 'modern') {
    // Low slab mount with hydraulic cylinders, side boxes and a loading tray arm
    mesh(k, new THREE.CylinderGeometry(0.48, 0.52, 0.12, 16), STEEL_D, 0, 0.06, 0, yaw);
    k.box(0.7, 0.16, 0.6, c, -0.05, 0.12, 0, yaw);
    k.box(0.71, 0.03, 0.61, s.band ?? TEAL, -0.05, 0.22, 0, yaw);
    for (const sz of [-1, 1]) {
      k.box(0.34, s.trunH - 0.2, 0.06, c, 0, 0.28, sz * (s.r + 0.1), yaw);
      k.box(0.3, 0.2, 0.16, MODERN_D, -0.18, 0.28, sz * 0.36, yaw); // electronics boxes
      const cylH = strut(k, yaw, V(0.25, 0.28, sz * (s.r + 0.16)), V(0.05, s.trunH - 0.04, sz * (s.r + 0.16)), 0.035, 0.035, '#b8bdb8');
      void cylH;
    }
  } else {
    // Turret: angular armoured gunhouse turned on a ring
    const tw = s.twin ? 0.86 : 0.74, tl = 1.0, th = s.trunH + 0.2;
    const body = s.color;
    mesh(k, new THREE.CylinderGeometry(0.5, 0.54, 0.1, 16), STEEL_D, 0, 0.05, 0, yaw);
    k.box(tl, th - 0.12, tw, body, -0.12, 0.1, 0, yaw);
    // Sloped glacis plates on the front and cheeks
    const gl = k.box(0.3, th - 0.18, tw - 0.04, body, 0.34, 0.08, 0, yaw);
    gl.rotation.z = 0.5;
    for (const sz of [-1, 1]) {
      const ch = k.box(tl - 0.1, th - 0.22, 0.16, body, -0.1, 0.1, sz * (tw / 2 + 0.02), yaw);
      ch.rotation.x = sz * 0.35;
    }
    k.box(tl - 0.12, 0.05, tw - 0.08, body, -0.16, th - 0.02, 0, yaw); // roof
    k.box(tl + 0.02, 0.05, tw + 0.06, s.band ?? TEAL, -0.12, 0.2, 0, yaw); // accent band
    // Bustle (auto-loader magazine) at the rear
    k.box(0.38, th - 0.24, tw - 0.12, body, -0.74, 0.16, 0, yaw);
    k.box(0.39, 0.04, tw - 0.1, '#2a2b2d', -0.74, th * 0.5, 0, yaw);
    // Commander's sight and hatch on the roof
    k.box(0.16, 0.12, 0.14, STEEL_D, -0.3, th + 0.03, -tw * 0.22, yaw);
    k.box(0.04, 0.06, 0.1, '#3b6b8a', -0.22, th + 0.07, -tw * 0.22, yaw);
    mesh(k, new THREE.CylinderGeometry(0.09, 0.09, 0.03, 10), STEEL_D, -0.48, th + 0.03, tw * 0.2, yaw);
    // Mantlet on the pitch group
    k.box(0.14, 0.28, s.twin ? 0.56 : 0.3, STEEL_D, 0.36, -0.14, 0, pitch);
  }

  // Cradle and recuperator (non-recoiling, on the pitch group)
  if (s.carriage !== 'turret') {
    const zs = s.twin ? [-0.15, 0.15] : [0];
    for (const zz of zs) {
      k.box(0.82, s.r * 1.6, s.r * 2.9, s.carriage === 'modern' ? MODERN_D : c, 0.12, -s.r * 2.1, zz, pitch);
      if (s.recup || s.carriage === 'modern') mesh(k, xCyl(s.r * 0.75, 0.7, s.r * 0.75, 8), s.carriage === 'modern' ? '#b8bdb8' : c, 0.18, s.r * 1.85, zz, pitch);
    }
    mesh(k, zCyl(0.04, (s.r + 0.1) * 2 + 0.06, 8), STEEL_D, 0, 0, 0, pitch); // trunnion pin
  }
  // Recoiling barrel(s)
  for (const zz of s.twin ? [-0.15, 0.15] : [0]) {
    const b = barrel(k, pitch, s, zz, bl);
    slides.push(b.slide);
    muzzles.push(b.muzzle);
  }

  // Gun shields (on the yaw group: the barrel rises through a slot)
  const sx = 0.2;
  const shTop = s.trunH + (s.shield === 'flat' ? 0.24 : 0.3);
  const shBot = s.carriage === 'field' || s.carriage === 'heavy' ? (s.wheelR ?? 0.25) * 0.7 : s.trunH - 0.26;
  const half = s.shield === 'flat' ? 0.4 : 0.46;
  const gap = s.r + 0.05;
  const plate = (w: number, h: number, zc: number, yb: number) => {
    const p = k.box(0.03, h, w, c, sx, yb, zc, yaw);
    p.rotation.z = 0.12;
    return p;
  };
  if (s.shield !== 'none' && s.shield !== 'drum' && s.carriage !== 'turret') {
    for (const sz of [-1, 1]) plate(half - gap, shTop - shBot, (sz * (half + gap)) / 2, shBot);
    plate(gap * 2 + 0.01, s.trunH - shBot - 0.12, 0, shBot);
    // Sight port and rivet strip
    k.box(0.035, 0.05, 0.09, '#2a2b2d', sx - 0.01, s.trunH + 0.05, -half * 0.62, yaw);
    if (s.shield === 'flat') {
      const topEdge = k.box(0.04, 0.03, half * 2 + 0.02, OLIVE_D, sx - 0.03, shTop - 0.02, 0, yaw);
      topEdge.rotation.z = 0.12;
    }
  }
  if (s.shield === 'wrap' || s.shield === 'house' || s.shield === 'gunhouse') {
    for (const sz of [-1, 1]) {
      const wing = k.box(s.shield === 'gunhouse' ? 0.9 : 0.36, shTop - shBot, 0.03, c, sx - (s.shield === 'gunhouse' ? 0.47 : 0.17), shBot, sz * half, yaw);
      wing.rotation.y = s.shield === 'gunhouse' ? 0 : -sz * 0.2;
    }
  }
  if (s.shield === 'house' || s.shield === 'gunhouse') {
    const deep = s.shield === 'gunhouse' ? 0.96 : 0.46;
    const roof = k.box(deep, 0.035, half * 2 + 0.04, c, sx - deep / 2 + 0.03, shTop, 0, yaw);
    roof.rotation.z = 0.05;
    if (s.shield === 'gunhouse') {
      // Riveted bands, a sighting hood and a rear canvas flap
      for (const sz of [-1, 1]) k.box(0.92, 0.03, 0.035, STEEL_D, sx - 0.47, shBot + 0.12, sz * half, yaw);
      k.box(0.2, 0.1, 0.16, c, sx - 0.3, shTop + 0.03, -half * 0.5, yaw);
      k.box(0.03, 0.05, 0.12, '#2a2b2d', sx - 0.19, shTop + 0.06, -half * 0.5, yaw);
    }
  }
  if (s.shield === 'drum') {
    // Classic enclosed turret: armoured drum with a domed roof and an embrasure slot
    const R = 0.52, H = s.trunH + 0.28;
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(R, R + 0.03, H, 16, 1, true, -Math.PI * 0.42, Math.PI * 1.84), new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8, side: THREE.DoubleSide }));
    drum.position.set(-0.08, H / 2, 0);
    k.add(drum, yaw);
    // Embrasure surround above and below the slot
    k.box(0.12, 0.12, 0.42, c, R - 0.12, s.trunH + 0.14, 0, yaw);
    k.box(0.12, s.trunH - 0.1, 0.42, c, R - 0.12, 0, 0, yaw);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(R + 0.02, 16, 5, 0, Math.PI * 2, 0, Math.PI / 2), mat(c));
    dome.scale.y = 0.35;
    dome.position.set(-0.08, H, 0);
    k.add(dome, yaw);
    for (let i = 0; i < 2; i++) mesh(k, new THREE.CylinderGeometry(R + 0.035, R + 0.035, 0.03, 16), STEEL_D, -0.08, 0.15 + i * (H - 0.3), 0, yaw);
    k.box(0.18, 0.12, 0.16, STEEL_D, -0.25, H + 0.13, -0.2, yaw); // sighting hood
    k.box(0.03, 0.05, 0.12, '#2a2b2d', -0.15, H + 0.17, -0.2, yaw);
    mesh(k, new THREE.CylinderGeometry(0.1, 0.1, 0.04, 10), STEEL_D, -0.3, H + 0.15, 0.2, yaw);
  }

  pitch.rotation.z = lob;
  return { yaw, pitch, slides, muzzles, spec: s, bl, lob };
}

// ------------------------------------------------------------------ combat rig and gun drill

interface Drill { now: number; fired: number; turret: Turret | null }

/** Position 0..1 through the 5-second gun drill; in combat it restarts at every shot and waits at "ready". */
function drillU(d: Drill, t: number) {
  if (d.turret && d.turret.target) {
    const e = d.now - d.fired;
    return e >= P || e < 0 ? 0.999 : e / P;
  }
  return loop(t, P);
}

/**
 * Register the gun with the combat rig. Idle: a laying drill: the gun swings
 * onto a new bearing every few seconds, holds, and adjusts its elevation.
 */
function arm(k: Kit, rig: Rig, base = Math.PI / 4, amp = 0.65, turnRate = 1.2): Drill {
  const d: Drill = { now: 0, fired: -99, turret: null };
  k.anims.push((t) => (d.now = t));
  const bearing = (n: number) => base + amp * Math.sin(n * 2.37 + 0.6);
  const elev = (n: number) => rig.lob + 0.09 * Math.sin(n * 1.71 + 1.1);
  const tur = k.turret({
    yaw: rig.yaw, pitch: rig.pitch, muzzles: rig.muzzles, recoil: rig.slides,
    weapon: 'howitzer', targets: 'ground', rate: RATE, lob: rig.lob, turnRate, kick: 0.25,
    idle: (t) => {
      const c = t / 9, n = Math.floor(c), f = c - n;
      const m = ramp(f, 0.05, 0.4);
      rig.yaw.rotation.y = bearing(n) + (bearing(n + 1) - bearing(n)) * m;
      rig.pitch.rotation.z = elev(n) + (elev(n + 1) - elev(n)) * ramp(f, 0.35, 0.55);
    },
  });
  tur.onFire.push(() => (d.fired = d.now));
  d.turret = tur;
  return d;
}

/**
 * The gun crew on the yaw group (they ride the platform as the gun traverses):
 * the loader fetches a round from the ready rack and lifts it to the breech,
 * the rammer drives it home with his staff, the layer pulls the lanyard and the
 * empty case drops out. `deck` is the height they stand at in yaw space.
 */
function gunCrew(k: Kit, rig: Rig, d: Drill, deck = 0, uniform = OLIVE, hat: 'helmet' | 'beret' | 'cap' = 'helmet', layer = true) {
  const { yaw, pitch, bl, lob, spec } = rig;
  const bx = -bl * Math.cos(lob);
  const by = spec.trunH - bl * Math.sin(lob);
  // Loader
  const ld = figure(k, 0, uniform, hat);
  k.add(ld.root, yaw);
  const carry = shell(k, ld.root, 0.14, 0.28, 0, true, 1.2);
  const B = [bx - 0.3, 0.2], R = [bx - 0.62, 0.5];
  // Round being rammed (pitch space: it slides along the bore axis into the breech)
  const ram = shell(k, pitch, -bl - 0.34, 0, 0, true, 1.2);
  // Ejected empty case
  const empty = mesh(k, xCyl(0.04, 0.13, 0.035, 8), BRASS, 0, 0, 0, yaw);
  // Ready rack beside the loader's fetch point
  const rack = grp(k, R[0] - 0.12, deck, R[1] + 0.22, 0, yaw);
  k.box(0.3, 0.16, 0.12, C.wood, 0, 0, 0, rack);
  for (let i = 0; i < 3; i++) shell(k, rack, -0.09 + i * 0.09, 0.16, 0);
  // Rammer with his staff
  const rm = figure(k, 1, uniform, hat);
  rm.root.position.set(bx - 0.62, deck, -0.12);
  k.add(rm.root, yaw);
  const staff = k.box(0.62, 0.025, 0.025, C.wood, 0.2, 0.29, 0.06, rm.root);
  k.box(0.06, 0.05, 0.05, '#2a2b2d', 0.52, 0.28, 0.06, rm.root);
  // Layer at the sights with the lanyard
  const ly = layer ? figure(k, 2, uniform, hat) : null;
  if (ly) {
    ly.root.position.set(-0.12, deck, -(spec.r + 0.36));
    ly.root.rotation.y = 0.25;
    k.add(ly.root, yaw);
  }
  k.anims.push((t) => {
    const u = drillU(d, t);
    // Loader path: at the breech → back to the rack → pick up → to the breech → lift
    const back = ramp(u, 0.1, 0.3), fwd = ramp(u, 0.38, 0.58);
    const p = u < 0.38 ? back : 1 - fwd;
    ld.root.position.set(B[0] + (R[0] - B[0]) * p, deck, B[1] + (R[1] - B[1]) * p);
    const walking = (u > 0.1 && u < 0.3) || (u > 0.38 && u < 0.58);
    pose(ld, walking ? t * 9 : 0, 0.45);
    ld.root.rotation.y = walking ? (u < 0.38 ? face(R[0] - B[0], R[1] - B[1]) : face(B[0] - R[0], B[1] - R[1])) : u < 0.38 && u > 0.3 ? 2.4 : 0.35;
    const holding = u > 0.33 && u < 0.64;
    carry.visible = holding;
    if (holding) ld.armL.rotation.z = ld.armR.rotation.z = u < 0.38 ? 0.4 : u > 0.58 ? 0.75 + ramp(u, 0.58, 0.64) * 0.5 : 0.75;
    if (u > 0.3 && u < 0.36) ld.armL.rotation.z = ld.armR.rotation.z = 0.9; // bending to the rack
    // Round on the loading tray, rammed home 0.64 → 0.8
    ram.visible = u >= 0.64 && u < 0.8;
    ram.position.x = -bl - 0.34 + ramp(u, 0.68, 0.8) * 0.3;
    // Rammer thrusts in with his staff
    const thrust = ramp(u, 0.66, 0.76) * (1 - ramp(u, 0.8, 0.9));
    rm.root.position.x = bx - 0.62 + thrust * 0.16;
    rm.armL.rotation.z = rm.armR.rotation.z = 0.95 + thrust * 0.5;
    staff.position.x = 0.2 + thrust * 0.12;
    rm.legL.rotation.z = thrust * 0.5;
    rm.legR.rotation.z = -thrust * 0.3;
    // Layer: hand on the wheels while laying, pulls the lanyard at the shot
    if (ly) {
      const pull = u < 0.06 ? Math.sin((u / 0.06) * Math.PI) : 0;
      ly.armR.rotation.z = 0.7 - pull * 1.4 + (u > 0.15 && u < 0.6 ? Math.sin(t * 7) * 0.25 : 0);
      ly.armL.rotation.z = 0.9 + (u > 0.15 && u < 0.6 ? Math.cos(t * 7) * 0.25 : 0);
      ly.root.rotation.y = 0.25 - pull * 0.2;
    }
    // Empty case drops out of the breech and lies on the deck until cleared
    const e = clamp01((u - 0.03) / 0.12);
    empty.visible = u > 0.03 && u < 0.95;
    empty.position.set(bx - 0.08 - e * 0.3, deck + 0.04 + (by + 0.02 - deck - 0.04) * (1 - e * e), 0.08 + e * 0.08);
    empty.rotation.y = e * 2.2;
  });
}

/** Auto-loader: rounds ride a conveyor from (x0, z0) to (x1, z1) at height y, disappearing into the mount. */
function conveyor(k: Kit, x0: number, z0: number, x1: number, z1: number, y: number, n = 5, frame = STEEL, belt = '#2a2b2d', period = 5, legs = true) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const g = grp(k, x0, y, z0, face(x1 - x0, z1 - z0));
  k.box(len, 0.03, 0.16, belt, len / 2, 0.06, 0, g);
  for (const s of [-1, 1]) k.box(len, 0.07, 0.025, frame, len / 2, 0.04, s * 0.09, g);
  if (legs) for (let i = 0; i <= Math.floor(len / 0.4); i++) k.box(0.03, y > 0.12 ? 0.06 : 0.04, 0.2, frame, 0.1 + i * 0.4, -0.02, 0, g);
  // Rollers turning along the belt
  const rollers: THREE.Mesh[] = [];
  for (let i = 0; i < Math.floor(len / 0.2); i++) rollers.push(mesh(k, zCyl(0.02, 0.16, 6), '#8a9196', 0.1 + i * 0.2, 0.05, 0, g));
  const rounds: THREE.Group[] = [];
  for (let i = 0; i < n; i++) rounds.push(shell(k, g, 0, 0.11, 0, true, 1.25));
  k.anims.push((t) => {
    for (let i = 0; i < n; i++) {
      const p = loop(t / period + i / n, 1);
      rounds[i].position.x = p * len - 0.12;
      rounds[i].visible = p > 0.04 && p < 0.96;
    }
    for (const r of rollers) r.rotation.z = -t * 6;
  });
  return g;
}

/** Shell lift: a cage carrying a round rises up a shaft from (x, y0) to y1 and drops back down. */
function hoist(k: Kit, x: number, z: number, y0: number, y1: number, period = 5, offset = 0, frame = STEEL) {
  const cage = grp(k, x, y0, z);
  k.box(0.2, 0.03, 0.2, frame, 0, 0, 0, cage);
  for (const [dx, dz] of [[-1, -1], [1, 1]]) k.box(0.02, 0.26, 0.02, frame, dx * 0.09, 0, dz * 0.09, cage);
  shell(k, cage, 0, 0.03, 0, false, 1.1);
  k.anims.push((t) => {
    const p = loop(t + offset, period);
    const u = p < 0.45 ? ramp(p, 0.05, 0.45) : p < 0.7 ? 1 : 1 - ramp(p, 0.7, 0.95);
    cage.position.y = y0 + (y1 - y0) * u;
  });
  return cage;
}

/** Stereoscopic range-finder: a long tube with end windows on a pedestal, slowly turning. */
function rangeFinder(k: Kit, x: number, y: number, z: number, w = 0.7, color = OLIVE_D, seed = 0) {
  k.cyl(0.05, 0.22, STEEL_D, x, y, z, 8);
  const g = grp(k, x, y + 0.26, z);
  mesh(k, zCyl(0.045, w, 10), color, 0, 0, 0, g);
  for (const s of [-1, 1]) {
    mesh(k, zCyl(0.06, 0.05, 10), STEEL_D, 0, 0, (s * w) / 2, g);
    k.box(0.02, 0.04, 0.04, '#bfe0ec', 0.055, 0, (s * w) / 2, g);
  }
  k.box(0.12, 0.08, 0.12, color, -0.06, -0.02, 0, g);
  k.box(0.06, 0.03, 0.05, '#2a2b2d', -0.13, 0.02, 0, g);
  k.anims.push((t) => (g.rotation.y = Math.sin(t * 0.3 + seed) * 1.1 + 0.6));
  return g;
}

/** Meteorological mast: spinning anemometer cups and a vane. */
function metMast(k: Kit, x: number, y: number, z: number, h = 1.0) {
  k.cyl(0.02, h, C.metal, x, y, z, 5);
  const cups = grp(k, x, y + h, z);
  for (let i = 0; i < 3; i++) {
    const a = grp(k, 0, 0, 0, (i * Math.PI * 2) / 3, cups);
    k.box(0.14, 0.01, 0.01, C.metal, 0.07, 0, 0, a);
    mesh(k, new THREE.SphereGeometry(0.025, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(Math.PI / 2), '#f4f4f0', 0.14, 0, 0, a);
  }
  const vane = grp(k, x, y + h - 0.16, z);
  k.box(0.2, 0.012, 0.012, C.metal, 0.02, 0, 0, vane);
  k.box(0.05, 0.06, 0.01, '#ff7a1a', -0.08, -0.03, 0, vane);
  k.anims.push((t) => {
    cups.rotation.y = t * 5;
    vane.rotation.y = Math.sin(t * 0.4) * 0.6;
  });
}

/** Small spotter drone hovering on a circuit with spinning rotors. */
function drone(k: Kit, cx: number, cz: number, y: number, r = 0.6, seed = 0) {
  const g = grp(k, cx, y, cz);
  k.box(0.18, 0.05, 0.18, '#3a3f44', 0, 0, 0, g);
  k.box(0.06, 0.05, 0.06, '#2a2b2d', 0.06, -0.05, 0, g);
  const props: THREE.Mesh[] = [];
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    k.box(0.12, 0.015, 0.02, '#3a3f44', dx * 0.08, 0.02, dz * 0.08, g).rotation.y = Math.atan2(dz, dx);
    props.push(k.box(0.14, 0.008, 0.02, '#c9ced2', dx * 0.12, 0.04, dz * 0.12, g));
  }
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), glow('#3fd16b', 1.5));
  led.position.set(-0.09, 0.03, 0);
  g.add(led);
  k.anims.push((t) => {
    const a = t * 0.45 + seed;
    g.position.set(cx + Math.cos(a) * r, y + Math.sin(t * 1.3) * 0.06, cz + Math.sin(a) * r);
    g.rotation.y = -a - Math.PI / 2;
    for (const p of props) p.rotation.y = t * 30;
  });
}

/** Steel door panel that slides open and shut in its frame (blast doors). */
function slidingDoor(k: Kit, x: number, y: number, z: number, w: number, h: number, rotY = 0, color = STEEL, period = 10, seed = 0) {
  const g = grp(k, x, y, z, rotY);
  k.box(w + 0.1, h + 0.06, 0.03, '#2a2b2d', 0, 0, -0.01, g);
  const door = new THREE.Group();
  g.add(door);
  k.box(w, h, 0.05, color, 0, 0, 0.02, door);
  hazardBand(k, w, 0, h - 0.1, 0.05, 0.05, 0.01, door);
  for (let i = 0; i < 3; i++) k.box(w * 0.9, 0.02, 0.06, STEEL_D, 0, 0.12 + i * (h / 3.3), 0.02, door);
  k.anims.push((t) => {
    const p = loop(t + seed, period);
    door.position.x = (p < 0.15 ? ramp(p, 0, 0.15) : p < 0.55 ? 1 : 1 - ramp(p, 0.55, 0.7)) * w * 0.8;
  });
  return g;
}

/** Floodlight on a post. */
function floodlight(k: Kit, x: number, z: number, y: number, h = 1.2, rotY = 0) {
  k.cyl(0.025, h, '#4a4f54', x, y, z, 6);
  const g = grp(k, x, y + h, z, rotY);
  k.box(0.14, 0.1, 0.06, '#33383d', 0.04, 0, 0, g);
  const lens = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.01), glow('#fff6c8', 1.2));
  lens.position.set(0.04, 0.05, 0.035);
  g.add(lens);
}

// ------------------------------------------------------------------ field (1–3)

/** Gun centre: offset toward the front-right so the back-left corner holds stores and towers. */
const GX = 0.15, GZ = 0.15;

function field(k: Kit, level: number, y: number) {
  // Timber firing platform under the wheels
  k.cyl(0.62, 0.03, '#8a6a48', GX, y, GZ, 12);
  for (let i = 0; i < 6; i++) k.box(1.2, 0.006, 0.02, '#6e5236', GX, y + 0.03, GZ - 0.5 + i * 0.2);
  const gy = y + 0.03;
  if (level === 1) {
    // Gun Pit: towed field gun with a flat shield in a horseshoe of sandbags
    const rig = buildGun(k, GX, gy, GZ, { carriage: 'field', shield: 'flat', len: 1.0, r: 0.04, trunH: 0.32, color: GUN_G, wheelR: 0.24 });
    const d = arm(k, rig);
    gunCrew(k, rig, d, 0, OLIVE, 'helmet', false);
    bagArc(k, GX, GZ, 1.16, -Math.PI * 1.2, Math.PI * 0.55, y, 3);
    // Ready ammunition and spent cases by the pit mouth
    ammoBox(k, -1.15, 1.0, y, 0.3);
    ammoBox(k, -1.12, 1.0, y + 0.14, 0.1);
    ammoBox(k, -0.82, 1.22, y, -0.4);
    empties(k, -0.5, 1.15, y, 5);
    aimingPost(k, 1.25, 1.25, y);
    // Spotter perched on an ammo box at the back corner with a field phone
    k.box(0.2, 0.16, 0.2, '#7a5a3b', -1.15, y, -1.12);
    spotter(k, -1.15, -1.12, y + 0.16, Math.PI * 0.75, 3, OLIVE, 'beret');
    fieldPhone(k, -0.85, -1.25, y);
    bearer(k, -1.0, 0.85, -0.55, 0.45, y, 9, 4);
    k.box(0.04, 0.8, 0.04, LOG, -1.3, y, 0.55);
    k.box(0.3, 0.03, 0.03, LOG, -1.2, y + 0.78, 0.55);
    lantern(k, -1.08, y + 0.78, 0.55);
    return;
  }
  if (level === 2) {
    // Camouflaged Gun Pit: higher ring of bags, longer barrel with a muzzle brake, camo net over the ammunition and limber
    const rig = buildGun(k, GX, gy, GZ, { carriage: 'field', shield: 'flat', len: 1.1, r: 0.043, trunH: 0.33, color: GUN_G, brake: true, wheelR: 0.25 });
    const d = arm(k, rig);
    gunCrew(k, rig, d, 0, OLIVE, 'helmet');
    bagArc(k, GX, GZ, 1.16, -Math.PI * 1.25, Math.PI * 0.58, y, 4);
    camoNet(k, -1.42, -1.42, 0.1, 0.0, 0.95, y, 2);
    // Ammunition limber under the net: two-wheeled trailer with an open locker of rounds
    const lb = grp(k, -0.8, y, -0.85, 0.5);
    for (const s of [-1, 1]) {
      const w = mesh(k, zCyl(0.17, 0.07, 12), '#2a2b2d', 0, 0.17, s * 0.26, lb);
      mesh(k, zCyl(0.11, 0.08, 8), GUN_G, 0, 0, 0, w);
    }
    k.box(0.5, 0.26, 0.42, GUN_G, 0, 0.17, 0, lb);
    k.box(0.52, 0.03, 0.44, OLIVE_D, 0, 0.43, 0, lb);
    for (let i = 0; i < 4; i++) shell(k, lb, -0.18 + i * 0.12, 0.43, 0.08);
    strut(k, lb, V(0.25, 0.22, 0), V(0.62, 0.06, 0), 0.05, 0.05, GUN_G);
    shellRack(k, -0.25, -1.2, y, 4, 2, 0.1);
    ammoBox(k, -1.2, -0.25, y, 1.4);
    ammoBox(k, -1.2, -0.25, y + 0.14, 1.6);
    spotter(k, -1.1, 1.1, y, Math.PI * 0.6, 3);
    fieldPhone(k, -1.3, 0.75, y);
    empties(k, -0.45, 1.2, y, 6, 1);
    aimingPost(k, 1.25, 1.25, y);
    aimingPost(k, 1.3, -1.25, y, 0.7);
    bearer(k, -0.55, -0.25, -0.35, 0.5, y, 9, 5);
    return;
  }
  // 3 · Dug-in Howitzer: heavier gun with a wrap shield and recuperator in a log-revetted pit, zinc-roofed dugout
  const rig = buildGun(k, GX, gy, GZ, { carriage: 'heavy', shield: 'wrap', len: 1.15, r: 0.05, trunH: 0.37, color: GUN_G, brake: true, recup: true, wheelR: 0.28 });
  const d = arm(k, rig);
  gunCrew(k, rig, d, 0, OLIVE, 'helmet');
  // Log revetment: stacked logs on posts, sandbags on top
  const logWall = (x: number, z: number, len: number, rotY: number) => {
    const g = grp(k, x, y, z, rotY);
    for (let i = 0; i < 3; i++) mesh(k, xCyl(0.055, len, 0.055, 7), i % 2 ? LOG : '#6e5034', 0, 0.055 + i * 0.1, 0, g);
    for (const s of [-0.48, 0, 0.48]) if (Math.abs(s) < len / 2) k.box(0.05, 0.36, 0.05, '#5e4430', s * (len / 1.1), 0, 0.07, g);
    return g;
  };
  logWall(1.32, 0.0, 2.3, Math.PI / 2);
  k.sandbags(1.32, 0.0, 2.3, Math.PI / 2, y + 0.3, 1);
  logWall(0.4, -1.32, 1.8, 0);
  k.sandbags(0.4, -1.32, 1.8, 0, y + 0.3, 1);
  logWall(0.6, 1.32, 1.4, 0);
  k.sandbags(0.6, 1.32, 1.4, 0, y + 0.3, 1);
  // Dugout shelter at the back-left: sandbag walls, timber posts, zinc mono-pitch roof, doorway
  const sx = -0.95, sz = -0.85;
  k.sandbags(sx, sz - 0.42, 0.9, 0, y, 8);
  k.sandbags(sx - 0.42, sz, 0.8, Math.PI / 2, y, 8);
  k.sandbags(sx + 0.42, sz - 0.2, 0.42, Math.PI / 2, y, 8);
  for (const [dx, dz] of [[-0.42, 0.4], [0.42, 0.4]]) k.box(0.06, 0.9, 0.06, LOG, sx + dx, y, sz + dz);
  const roof = k.box(1.05, 0.04, 1.05, C.zinc, sx, y + 0.92, sz);
  roof.rotation.x = -0.14;
  roof.material = mat(C.zinc, {}, 'zinc');
  k.box(0.32, 0.55, 0.02, '#2a2b2d', sx + 0.1, y, sz - 0.33);
  camoNet(k, sx - 0.5, sz - 0.5, sx + 0.55, sz + 0.5, 1.0, y, 4, false);
  lantern(k, sx + 0.3, y + 0.86, sz + 0.44, 2);
  shellRack(k, -1.12, 0.05, y, 4, 2, Math.PI / 2);
  shellRack(k, -0.3, -1.12, y, 3, 2, 0);
  ammoBox(k, -1.15, 0.65, y, 1.5);
  empties(k, -0.55, 1.15, y, 7, 2);
  postSign(k, 'No.1 GUN', -0.75, 1.32, y, 0, C.trim, 0.5);
  aimingPost(k, 1.3, 1.3, y);
  bearer(k, -0.9, -0.3, -0.55, 0.5, y, 9, 6);
  spotter(k, -0.6, -0.45, y, Math.PI * 0.6, 3); // at the dugout door
}

// ------------------------------------------------------------------ camp (4–6)

/** Concrete turntable: a static ring with bearing ticks and a turning deck on the yaw group. Returns deck height. */
function turntable(k: Kit, y: number, r: number, h = 0.12, deckColour = '#c9c3b5') {
  k.cyl(r, h, CONCRETE, GX, y, GZ, 18);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const [x, z] = onArc(GX, GZ, r + 0.005, a);
    const tick = k.box(0.02, 0.05, i % 6 ? 0.06 : 0.12, i % 6 ? '#f4f1e8' : '#d8342c', x, y + h - 0.06, z);
    tick.rotation.y = tangent(a) + Math.PI / 2;
  }
  return { top: y + h, deck: deckColour };
}

/** Rotating deck plate with a yellow/black rim (child of the yaw group). */
function deckPlate(k: Kit, rig: Rig, r: number, color: string) {
  mesh(k, new THREE.CylinderGeometry(r, r, 0.04, 18), color, 0, 0.02, 0, rig.yaw);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const seg = k.box(0.05, 0.045, (2 * Math.PI * r) / 16, i % 2 ? C.kerbB : C.kerbY, Math.cos(a) * (r - 0.02), 0, Math.sin(a) * (r - 0.02), rig.yaw);
    seg.rotation.y = -a;
  }
}

/** Cream ammunition store with a red-brown roof and a green door. */
function ammoStore(k: Kit, x: number, z: number, y: number, w: number, d: number, storeys = 1, gable = false, doorFace: 'front' | 'right' = 'right') {
  const h = k.block(w, d, storeys, x, y, z);
  if (gable) k.gableRoof(w, d, 0.36, x, y + h, z, C.roof, 0.1);
  else k.hipRoof(w, d, 0.32, x, y + h, z, C.roof, 0.1);
  k.door(doorFace, x, z, w, d, 0, y, 0.3, 0.55);
  board(k, 'AMMO', 0.3, 0.1, x + (doorFace === 'right' ? w / 2 + 0.025 : 0), y + 0.62, z + (doorFace === 'front' ? d / 2 + 0.025 : 0), '#d8342c', '#ffffff', doorFace === 'right' ? Math.PI / 2 : 0);
  return h;
}

function camp(k: Kit, level: number, y: number) {
  const tr = 0.9;
  const tt = turntable(k, y, tr + 0.08, 0.1);
  const big = level >= 5;
  const spec: GunSpec = {
    carriage: 'pedestal', shield: level === 4 ? 'flat' : level === 5 ? 'wrap' : 'house',
    len: level === 4 ? 1.12 : level === 5 ? 1.2 : 1.25, r: big ? 0.052 : 0.048, trunH: 0.44, color: GUN_C, brake: true, recup: level >= 5,
  };
  const rig = buildGun(k, GX, tt.top, GZ, spec);
  deckPlate(k, rig, tr, '#b9b3a6');
  const d = arm(k, rig);
  gunCrew(k, rig, d, 0.04, OLIVE, 'helmet');
  // Cream parapet: green coping, open toward the crew side (front-left)
  const wallR = 1.25;
  arcWall(k, GX, GZ, wallR, -Math.PI * 1.15, Math.PI * 0.5, y, level >= 5 ? 0.42 : 0.34, 0.12, C.wall, C.trim);
  // Painted kerb at the wall foot
  if (level >= 5) {
    // Ammunition niches let into the parapet, rounds standing inside
    for (const a of [-0.9, -0.35, 0.2]) {
      const [x, z] = onArc(GX, GZ, wallR - 0.07, a);
      const g = grp(k, x, y, z, tangent(a));
      k.box(0.22, 0.26, 0.03, '#6e6a60', 0, 0.06, 0, g);
      for (let i = 0; i < 2; i++) shell(k, g, -0.05 + i * 0.1, 0.06, 0.02);
    }
  }
  postSign(k, 'No.1 GUN', -1.0, 1.32, y, 0, C.trim, 0.5, C.trim);
  aimingPost(k, 1.32, 1.32, y);
  empties(k, -0.4, 1.22, y, 6, 3);
  k.lamp(-1.35, 0.35, y, 1.2);

  if (level === 4) {
    // Gun Turntable: cream ammunition store with a red hip roof; a gunner wheels rounds out on a trolley
    ammoStore(k, -1.0, -1.0, y, 0.75, 0.75, 1, false, 'right');
    shellRack(k, -1.18, 0.0, y, 4, 2, Math.PI / 2, C.trim);
    trolley(k, -0.5, -0.95, -0.7, 0.55, y, 10);
    k.bin(1.25, -1.25, y);
    return;
  }
  if (level === 5) {
    // Shell Gantry Battery: gable-roofed magazine and a green steel gantry whose hoist trolley carries rounds out
    ammoStore(k, -1.0, -0.95, y, 0.8, 0.85, 1, true, 'front');
    gantry(k, y, 1.3);
    shellRack(k, -1.25, 0.35, y, 4, 2, Math.PI / 2, C.trim);
    trolley(k, -0.45, -0.5, -0.65, 0.65, y, 11);
    k.flagpole(1.3, -1.3, 1.6, y);
    return;
  }
  // 6 · Range-Finder Battery: two-storey battery office with a range-finder platform on the roof, gantry, roofed shield
  const bx = -1.0, bz = -0.95, bw = 0.85, bd = 0.85;
  const h = k.block(bw, bd, 1, bx, y, bz);
  k.door('front', bx, bz, bw, bd, -0.15, y, 0.3, 0.55);
  k.window('right', bx, bz, bw, bd, 0, y + 0.42, 0.3, 0.28, true);
  k.window('front', bx, bz, bw, bd, 0.22, y + 0.42, 0.22, 0.28, true);
  board(k, 'AMMO', 0.3, 0.1, bx - 0.15, y + 0.66, bz + bd / 2 + 0.025, '#d8342c');
  // Roof platform: railing, small red canopy on posts over the range-finder
  k.flatRoof(bw, bd, bx, y + h, bz, 0.12);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.04, 0.42, 0.04, C.trim, bx + dx * (bw / 2 - 0.05), y + h, bz + dz * (bd / 2 - 0.05));
  k.hipRoof(bw - 0.05, bd - 0.05, 0.22, bx, y + h + 0.42, bz, C.roof, 0.08);
  rangeFinder(k, bx, y + h + 0.06, bz, 0.62, OLIVE_D, 1);
  spotter(k, bx + 0.22, bz + 0.25, y + h + 0.06, Math.PI * 0.25, 5, OLIVE, 'beret');
  gantry(k, y, 1.3);
  shellRack(k, -1.25, 0.35, y, 4, 2, Math.PI / 2, C.trim);
  trolley(k, -0.45, -0.45, -0.65, 0.65, y, 11);
  k.flagpole(1.3, -1.3, 1.8, y);
  k.aircon(bx - bw / 2 - 0.08, y + 0.4, bz, -Math.PI / 2);
}

/** Two-wheeled shell trolley pushed by a gunner between the store and the gun. */
function trolley(k: Kit, ax: number, az: number, bx: number, bz: number, y: number, period: number) {
  const g = grp(k, ax, y, az);
  const t0 = grp(k, 0.2, 0, 0, 0, g);
  k.box(0.26, 0.03, 0.2, STEEL, 0, 0.1, 0, t0);
  k.box(0.03, 0.22, 0.2, STEEL, -0.13, 0.1, 0, t0);
  const wheels: THREE.Mesh[] = [];
  for (const s of [-1, 1]) wheels.push(mesh(k, zCyl(0.06, 0.03, 8), '#2a2b2d', 0.05, 0.06, s * 0.11, t0));
  const sh = [shell(k, t0, -0.04, 0.13, -0.05, true), shell(k, t0, -0.04, 0.13, 0.05, true)];
  const f = figure(k, 7, OLIVE, 'helmet');
  g.add(f.root);
  f.armL.rotation.z = f.armR.rotation.z = 1.0;
  const len = Math.hypot(bx - ax, bz - az);
  k.anims.push((t) => {
    const p = loop(t, period);
    const out = p < 0.5;
    const u = smooth(out ? p * 2 : 2 - p * 2);
    g.position.set(ax + (bx - ax) * u, y, az + (bz - az) * u);
    g.rotation.y = face(bx - ax, bz - az) + (out ? 0 : 0);
    const turning = Math.min(p, Math.abs(p - 0.5), 1 - p) < 0.05;
    pose(f, turning ? 0 : t * 8, 0.4);
    f.armL.rotation.z = f.armR.rotation.z = 1.0;
    f.root.position.x = 0;
    t0.position.x = 0.24;
    for (const w of wheels) w.rotation.z = -u * len / 0.06;
    sh.forEach((s) => (s.visible = out));
    if (!out) {
      // Walking back: pull the trolley (figure walks backwards)
      pose(f, turning ? 0 : -t * 8, 0.4);
      f.armL.rotation.z = f.armR.rotation.z = 1.0;
    }
  });
}

/** Green steel gantry along the left side; a hoist trolley carries a crate of rounds from the store to the ready rack. */
function gantry(k: Kit, y: number, h: number) {
  const gx = -1.3, z0 = -0.5, z1 = 1.15;
  for (const z of [z0, z1]) {
    strut(k, undefined, V(gx - 0.1, y, z), V(gx, y + h, z), 0.05, 0.05, C.trim);
    strut(k, undefined, V(gx + 0.1, y, z), V(gx, y + h, z), 0.05, 0.05, C.trim);
    k.box(0.26, 0.05, 0.08, C.concrete, gx, y, z);
  }
  k.box(0.08, 0.1, z1 - z0 + 0.2, C.trim, gx, y + h, (z0 + z1) / 2);
  k.box(0.09, 0.03, 0.09, HAZ, gx, y + h - 0.02, z1 + 0.06);
  const trolleyG = grp(k, gx, y + h, z0);
  k.box(0.14, 0.08, 0.16, HAZ, 0, -0.08, 0, trolleyG);
  const chain = k.box(0.015, 1, 0.015, '#4a4f54', 0, -0.08, 0, trolleyG);
  chain.geometry.translate(0, -0.5, 0);
  chain.position.y = -0.08;
  const crate = grp(k, 0, 0, 0, 0, trolleyG);
  k.box(0.22, 0.12, 0.18, OLIVE, 0, -0.06, 0, crate);
  for (let i = 0; i < 3; i++) shell(k, crate, -0.06 + i * 0.06, 0.06, 0, false, 0.8);
  k.anims.push((t) => {
    const p = loop(t, 12);
    // Travel out (0–0.35), lower (0.35–0.5), raise empty (0.55–0.65), travel back (0.65–0.95)
    const travel = p < 0.35 ? ramp(p, 0.02, 0.35) : p < 0.65 ? 1 : 1 - ramp(p, 0.65, 0.95);
    const drop = ramp(p, 0.35, 0.5) * (1 - ramp(p, 0.55, 0.65));
    trolleyG.position.z = z0 + (z1 - z0) * travel;
    const len = 0.35 + drop * (h - 0.62);
    chain.scale.y = len;
    crate.position.y = -0.08 - len;
    crate.visible = p < 0.55 || p > 0.97;
  });
}

// ------------------------------------------------------------------ base (7–10)

/** Raised concrete barbette with a parapet; returns its deck height. */
function barbette(k: Kit, y: number, r: number, h: number, parapetH: number, color = CONCRETE) {
  k.cyl(r, h, color, GX, y, GZ, 20);
  k.cyl(r + 0.02, 0.05, C.trim, GX, y + h - 0.05, GZ, 20);
  // Parapet ring, open toward the steps at the front-left
  arcWall(k, GX, GZ, r - 0.06, -Math.PI * 1.2, Math.PI * 0.55, y + h, parapetH, 0.13, color, '#bdb8ad');
  // Steps down to the pad at the gap
  const a = Math.PI * 0.69;
  for (let i = 0; i < 3; i++) {
    const [x, z] = onArc(GX, GZ, r + 0.06 + i * 0.12, a);
    const st = k.box(0.5, h * (1 - i / 3), 0.13, '#c2bcae', x, y, z);
    st.rotation.y = tangent(a);
  }
  return y + h;
}

/** Shell niches set into the inside of the parapet. */
function niches(k: Kit, r: number, deck: number, angles: number[]) {
  for (const a of angles) {
    const [x, z] = onArc(GX, GZ, r, a);
    const g = grp(k, x, deck, z, tangent(a));
    k.box(0.26, 0.28, 0.03, '#5c5a52', 0, 0.02, 0, g);
    k.box(0.3, 0.03, 0.1, '#bdb8ad', 0, 0.3, 0.02, g);
    for (let i = 0; i < 3; i++) shell(k, g, -0.08 + i * 0.08, 0.02, 0.03, false, 1.05);
  }
}

/** Earth-covered magazine bunker with a concrete portal and a door. */
function magazine(k: Kit, x: number, z: number, y: number, w: number, d: number, h: number, sliding = false) {
  k.box(w, h, d, CONCRETE, x, y, z);
  k.box(w + 0.1, 0.12, d + 0.1, EARTH, x, y + h, z);
  k.box(w - 0.05, 0.06, d - 0.05, GRASS, x, y + h + 0.12, z);
  for (let i = 0; i < 3; i++) {
    const tuft = mesh(k, new THREE.IcosahedronGeometry(0.08, 0), '#4f8a2e', x - w / 3 + i * (w / 3), y + h + 0.2, z + (i % 2 ? 0.1 : -0.12));
    tuft.scale.y = 0.6;
  }
  if (sliding) slidingDoor(k, x + w / 2 + 0.02, y, z, 0.36, 0.5, Math.PI / 2, STEEL, 10, 2);
  else {
    k.box(0.03, 0.52, 0.42, '#2a2b2d', x + w / 2 + 0.01, y, z);
    k.box(0.04, 0.48, 0.36, C.trim, x + w / 2 + 0.02, y, z);
  }
  board(k, 'MAGAZINE', 0.42, 0.1, x + w / 2 + 0.03, y + 0.58, z, '#d8342c', '#ffffff', Math.PI / 2, 34);
}

/** Battery observation post: concrete tower with a slit window, flat roof and railing. */
function observationPost(k: Kit, x: number, z: number, y: number, w: number, storeys: number) {
  const h = storeys * STOREY;
  k.box(w, h, w, CONCRETE, x, y, z);
  for (let s = 1; s <= storeys; s++) k.box(w + 0.03, 0.05, w + 0.03, '#bdb8ad', x, y + s * STOREY - 0.05, z);
  // Long observation slit facing the front and right
  k.box(w - 0.12, 0.08, 0.02, '#2a2b2d', x, y + h - 0.32, z + w / 2 + 0.01);
  k.box(0.02, 0.08, w - 0.12, '#2a2b2d', x + w / 2 + 0.01, y + h - 0.32, z);
  k.box(w + 0.1, 0.04, 0.08, '#bdb8ad', x, y + h - 0.22, z + w / 2 + 0.04);
  k.box(0.08, 0.04, w + 0.1, '#bdb8ad', x + w / 2 + 0.04, y + h - 0.22, z);
  k.door('front', x, z, w, w, 0, y, 0.26, 0.5, C.trim);
  k.flatRoof(w, w, x, y + h, z, 0.1);
  // Observation deck: sandbagged parapet and a concrete sun-roof on posts
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.06, 0.42, 0.06, '#bdb8ad', x + dx * (w / 2 - 0.03), y + h + 0.06, z + dz * (w / 2 - 0.03));
  k.box(w + 0.22, 0.07, w + 0.22, CONCRETE, x, y + h + 0.48, z);
  k.box(w + 0.24, 0.03, w + 0.24, C.trim, x, y + h + 0.47, z);
  k.sandbags(x, z + w / 2 - 0.08, w - 0.1, 0, y + h + 0.06, 1);
  k.sandbags(x + w / 2 - 0.08, z, w - 0.1, Math.PI / 2, y + h + 0.06, 1);
  return y + h + 0.06;
}

function base(k: Kit, level: number, y: number) {
  const r = 1.3;
  const deckH = level >= 10 ? 0.42 : level >= 8 ? 0.34 : 0.28;
  const deck = barbette(k, y, r, deckH, level >= 9 ? 0.38 : 0.3);
  const spec: GunSpec =
    level === 7 ? { carriage: 'pedestal', shield: 'house', len: 1.3, r: 0.055, trunH: 0.46, color: GUN_GREY, brake: true, recup: true }
      : level === 8 ? { carriage: 'pedestal', shield: 'gunhouse', len: 1.36, r: 0.058, trunH: 0.48, color: GUN_GREY, brake: false, recup: true }
        : level === 9 ? { carriage: 'pedestal', shield: 'gunhouse', len: 1.42, r: 0.06, trunH: 0.5, color: '#66705f', brake: true, recup: true, evac: true }
          : { carriage: 'pedestal', shield: 'drum', len: 1.5, r: 0.064, trunH: 0.52, color: '#6a7468', brake: true, recup: true, evac: true };
  const rig = buildGun(k, GX, deck, GZ, spec);
  deckPlate(k, rig, 0.95, '#a9a395');
  const d = arm(k, rig, Math.PI / 4, 0.65, 1.1);
  if (level < 10) gunCrew(k, rig, d, 0.04, OLIVE, 'helmet', level !== 8);
  else {
    // Enclosed turret: crew inside; a rammer arm shows at the open rear hatch as rounds go in
    const tray = k.box(0.36, 0.04, 0.14, STEEL, -0.5, 0.22, 0, rig.yaw);
    const rnd = shell(k, rig.yaw, -0.62, 0.27, 0, true, 1.3);
    k.anims.push((t) => {
      const u = drillU(d, t);
      const p = ramp(u, 0.4, 0.75);
      rnd.position.x = -0.66 + p * 0.3;
      rnd.visible = u > 0.3 && u < 0.78;
      tray.position.y = 0.22 + Math.sin(u * Math.PI) * 0.02;
    });
  }
  niches(k, r - 0.16, deck, level >= 9 ? [-1.0, -0.55, -0.1, 0.35] : [-0.8, -0.2, 0.3]);
  // Hoist hatch on the deck by the steps: a round rises up from the magazine below
  const [hx, hz] = onArc(GX, GZ, 1.02, Math.PI * 0.78);
  k.box(0.26, 0.02, 0.26, '#2a2b2d', hx, deck, hz);
  hazardBand(k, 0.3, hx, deck, hz + 0.15, 0.025, 0.04);
  hazardBand(k, 0.3, hx, deck, hz - 0.15, 0.025, 0.04);
  hoist(k, hx, hz, deck - 0.22, deck + 0.06, 5, 1.5);
  k.box(0.04, 0.5, 0.04, HAZ, hx + 0.16, deck, hz + 0.16);
  aimingPost(k, 1.38, 1.36, y, 0.9);
  empties(k, -0.35, 1.38, y, 5, 4);

  if (level === 7) {
    // Concrete Emplacement: barbette, ammunition niches, deck hoist, earth-covered magazine
    magazine(k, -1.02, -1.02, y, 0.8, 0.8, 1.0);
    k.lamp(-1.38, 0.5, y, 1.25);
    postSign(k, 'No.1 GUN', 1.05, 1.38, y, -0.2, C.trim, 0.5, '#bdb8ad');
    bearer(k, -1.3, 0.2, -0.9, 1.25, y, 9, 2);
    k.flagpole(1.32, -1.32, 1.8, y);
    return;
  }
  if (level === 8) {
    // Coastal Battery: open-backed gunhouse, concrete observation post with a spotter on the roof
    const top = observationPost(k, -1.0, -1.0, y, 0.8, 1.5);
    spotter(k, -1.05, -1.05, top, Math.PI * 0.25, 2, OLIVE, 'cap');
    k.antenna(-1.3, top + 0.45, -1.3, 0.6);
    magazine(k, -1.15, 0.0, y, 0.45, 0.6, 0.45, true);
    postSign(k, 'BATTERY', 1.05, 1.38, y, -0.2, C.trim, 0.5, '#bdb8ad');
    bearer(k, -1.3, 0.55, -0.9, 1.25, y, 9, 2);
    signalMast(k, 1.3, -1.3, y, 1.9);
    return;
  }
  if (level === 9) {
    // Casemate Battery: heavy concrete casemate roof over the rear half, grassed on top, camo fringe
    const cy = deck + 1.18;
    // Solid rear walls (the casemate's back and flank) with piers on the open side
    k.box(1.85, cy - y, 0.22, CONCRETE, -0.45, y, -1.3);
    k.box(0.22, cy - y, 1.35, CONCRETE, -1.3, y, -0.08);
    for (const [px, pz] of [[0.42, -1.1], [-1.1, 0.5]]) {
      k.box(0.3, cy - y, 0.3, CONCRETE, px, y, pz);
      k.box(0.32, 0.05, 0.32, '#bdb8ad', px, cy - 0.05, pz);
    }
    for (let i = 0; i < 4; i++) k.box(0.03, cy - y - 0.2, 0.012, '#bdb8ad', -1.2 + i * 0.45, y + 0.1, -1.18);
    const slab = (w: number, d: number, x: number, z: number) => {
      k.box(w, 0.2, d, CONCRETE, x, cy, z);
      k.box(w + 0.04, 0.06, d + 0.04, '#bdb8ad', x, cy, z);
      k.box(w - 0.1, 0.1, d - 0.1, EARTH, x, cy + 0.2, z);
      k.box(w - 0.18, 0.05, d - 0.18, GRASS, x, cy + 0.3, z);
    };
    slab(1.75, 0.55, -0.45, -1.1);
    slab(0.55, 1.2, -1.1, -0.0);
    camoNet(k, -1.35, -0.85, 0.35, -0.6, cy - deck - 0.05, deck, 3, false);
    for (let i = 0; i < 3; i++) k.cyl(0.07, 0.2, '#4f8a2e', -1.0 + i * 0.4, cy + 0.33, -1.1, 6).scale.set(1, 0.7, 1);
    magazine(k, -1.15, 1.0, y, 0.4, 0.5, 0.42, true);
    k.lamp(1.38, -0.2, y, 1.3);
    floodlight(k, 0.45, -1.32, cy + 0.35, 0.3, Math.PI / 2);
    postSign(k, 'CASEMATE 1', 1.05, 1.38, y, -0.2, C.trim, 0.55, '#bdb8ad');
    k.flagpole(1.32, -1.32, 2.3, y);
    signalMast(k, -1.3, -0.5, cy + 0.35, 0.8);
    bearer(k, -1.3, 0.6, -0.9, 1.25, y, 9, 2);
    return;
  }
  // 10 · Fortress Battery: enclosed armoured turret on a high barbette, two-storey fortress block, magazine lift tower
  const fx = -0.95, fz = -1.05, fw = 1.05, fd = 0.75;
  const fh = 2 * STOREY;
  k.box(fw, fh, fd, CONCRETE, fx, y, fz);
  for (let s = 1; s <= 2; s++) k.box(fw + 0.04, 0.06, fd + 0.04, '#bdb8ad', fx, y + s * STOREY - 0.06, fz);
  for (let i = 0; i < 3; i++) k.box(0.12, 0.06, 0.02, '#2a2b2d', fx - 0.3 + i * 0.3, y + fh - 0.35, fz + fd / 2 + 0.01);
  for (let i = 0; i < 2; i++) k.box(0.02, 0.06, 0.12, '#2a2b2d', fx + fw / 2 + 0.01, y + fh - 0.35, fz - 0.15 + i * 0.3);
  // Crenellated parapet and a flag
  for (let i = 0; i < 5; i++) k.box(0.14, 0.14, 0.12, CONCRETE, fx - fw / 2 + 0.07 + i * ((fw - 0.14) / 4), y + fh, fz + fd / 2 - 0.06);
  k.box(fw, 0.06, fd, '#bdb8ad', fx, y + fh, fz);
  slidingDoor(k, fx + 0.15, y, fz + fd / 2 + 0.02, 0.36, 0.55, 0, STEEL, 10, 1);
  crest(k, fx - 0.3, y + 0.95, fz + fd / 2 + 0.03, 0.14);
  board(k, 'FORTRESS BATTERY', 0.62, 0.11, fx, y + 1.25, fz + fd / 2 + 0.03, C.trim, '#ffffff', 0, 30);
  k.flagpole(fx + 0.35, fz - 0.15, 1.3, y + fh + 0.06);
  k.antenna(fx - 0.4, y + fh + 0.06, fz - 0.15, 0.7);
  // Magazine lift tower beside it: steel frame shaft with a cage riding up and down
  const lx = -1.25, lz = 0.25;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.04, 1.6, 0.04, C.trim, lx + dx * 0.12, y, lz + dz * 0.12);
  for (let i = 1; i <= 4; i++) k.box(0.28, 0.03, 0.28, C.trim, lx, y + i * 0.4 - 0.03, lz);
  k.box(0.32, 0.12, 0.32, C.trim, lx, y + 1.6, lz);
  hoist(k, lx, lz, y + 0.05, y + 1.3, 6, 0);
  k.lamp(1.38, -0.4, y, 1.35);
  k.lamp(-1.38, 1.0, y, 1.35);
  postSign(k, 'No.1 GUN', 1.05, 1.38, y, -0.2, C.trim, 0.5, '#bdb8ad');
  bearer(k, -1.25, 0.6, -0.95, 1.25, y, 9, 2);
  spotter(k, fx + 0.1, fz - 0.1, y + fh + 0.06, Math.PI * 0.2, 5, OLIVE, 'beret');
}

/** Signal mast with flag hoists swinging on a yard. */
function signalMast(k: Kit, x: number, z: number, y: number, h: number) {
  k.cyl(0.025, h, C.white, x, y, z, 6);
  k.box(0.5, 0.025, 0.025, C.white, x, y + h * 0.8, z);
  const cols = [['#d8342c', '#ffc93c'], ['#2f5a8a', '#f4f1e8']];
  [-1, 1].forEach((s, i) => {
    for (let j = 0; j < 2; j++) {
      const f = k.box(0.12, 0.09, 0.01, cols[i][j], x + s * 0.2, y + h * 0.8 - 0.06 - j * 0.11, z);
      k.swing(f, 0, 0.5, i * 2 + j);
    }
  });
}

// ------------------------------------------------------------------ command (11–15)

/** White hexagonal gun platform with a teal edge; returns its top. */
function platform(k: Kit, y: number, r: number, h: number, sides = 6) {
  const p = mesh(k, new THREE.CylinderGeometry(r, r + 0.04, h, sides), MODERN, GX, y + h / 2, GZ);
  p.rotation.y = Math.PI / sides;
  const band = mesh(k, new THREE.CylinderGeometry(r + 0.045, r + 0.045, 0.05, sides), TEAL, GX, y + h - 0.08, GZ);
  band.rotation.y = Math.PI / sides;
  const top = mesh(k, new THREE.CylinderGeometry(r - 0.04, r - 0.04, 0.02, sides), '#c9cec9', GX, y + h + 0.01, GZ);
  top.rotation.y = Math.PI / sides;
  return y + h + 0.02;
}

/** Modern white block with dark glass, teal trim and a green roof slab. */
function whiteBlock(k: Kit, x: number, z: number, y: number, w: number, d: number, storeys: number, fins = false) {
  const h = storeys * STOREY;
  k.box(w, h, d, MODERN, x, y, z);
  for (let s = 0; s < storeys; s++) {
    k.box(w - 0.16, 0.3, 0.02, DARK_GLASS, x, y + s * STOREY + 0.36, z + d / 2 + 0.01);
    k.box(0.02, 0.3, d - 0.16, DARK_GLASS, x + w / 2 + 0.01, y + s * STOREY + 0.36, z);
    if (s) k.box(w + 0.03, 0.04, d + 0.03, TEAL, x, y + s * STOREY - 0.02, z);
  }
  if (fins) k.fins(w - 0.1, h - 0.1, x, y + 0.05, z + d / 2 + 0.06, Math.round(w / 0.16));
  k.box(w + 0.12, 0.07, d + 0.12, C.roofGreen, x, y + h, z);
  k.box(w + 0.13, 0.025, d + 0.13, TEAL, x, y + h - 0.02, z);
  return y + h + 0.07;
}

function command(k: Kit, level: number, y: number) {
  const pr = level >= 13 ? 1.12 : 1.05;
  const ph = level === 14 ? 0.7 : level === 15 ? 0.5 : level === 13 ? 0.32 : 0.26;
  const deck = platform(k, y, pr, ph, level >= 13 ? 8 : 6);
  const turreted = level >= 13;
  const spec: GunSpec = turreted
    ? { carriage: 'turret', shield: 'none', len: level === 13 ? 1.3 : 1.42, r: 0.058, trunH: 0.38, color: MODERN, barrel: '#7c8a84', brake: true, evac: level >= 14, band: TEAL }
    : { carriage: 'modern', shield: level === 12 ? 'wrap' : 'flat', len: level === 11 ? 1.3 : 1.36, r: 0.055, trunH: 0.46, color: MODERN, barrel: '#7c8a84', brake: true, recup: true, band: TEAL };
  const rig = buildGun(k, GX, deck, GZ, spec);
  const d = arm(k, rig, Math.PI / 4, 0.7, 1.3);
  // Auto-loader: rounds ride a conveyor from the magazine into the mount centre
  if (!turreted) {
    // Hydraulic loading arm swings a round up to the breech in time with the drill
    const armG = grp(k, -0.55, 0.32, 0, 0, rig.yaw);
    k.box(0.08, 0.08, 0.08, STEEL_D, 0, 0, 0, armG);
    const boom = new THREE.Group();
    armG.add(boom);
    k.box(0.32, 0.04, 0.06, HAZ, 0.16, 0, 0, boom);
    const rnd = shell(k, boom, 0.18, 0.04, 0, true, 1.2);
    k.anims.push((t) => {
      const u = drillU(d, t);
      const lift = ramp(u, 0.3, 0.6) * (1 - ramp(u, 0.75, 0.9));
      boom.rotation.z = -0.5 + lift * 0.9;
      rnd.visible = u > 0.2 && u < 0.72;
    });
    // Technician with a tablet on the platform
    const tech = figure(k, 2, '#3e5a4a', 'cap', '#2f3b34');
    tech.root.position.set(-0.25, 0, -0.5);
    tech.root.rotation.y = 0.6;
    k.add(tech.root, rig.yaw);
    k.box(0.02, 0.08, 0.1, '#2a2b2d', 0.1, 0.36, 0, tech.root);
    k.anims.push((t) => {
      tech.armL.rotation.z = tech.armR.rotation.z = 0.9 + Math.sin(t * 2) * 0.08;
      tech.head.rotation.y = Math.sin(t * 0.8) * 0.4;
    });
  }
  const mx = -1.0, mz = -1.0;
  if (level === 11) {
    // Modern Gun Station: open mount with a loading arm, white magazine block, conveyor and a glass fire-control cabin
    const top = whiteBlock(k, mx, mz, y, 0.8, 0.8, 2);
    k.shutter('right', mx, mz, 0.8, 0.8, 0, 0.4, 0.5);
    conveyor(k, mx + 0.42, mz + 0.1, GX - 0.5, GZ - 0.1, y + 0.02, 4, MODERN_D, '#2a2b2d', 5);
    metMast(k, mx + 0.2, top, mz - 0.2, 0.6);
    cabin(k, -1.05, 0.75, y, 0.62, 0.62);
    floodlight(k, 1.35, -1.35, y, 1.3, Math.PI * 0.75);
    k.lamp(1.38, 0.6, y, 1.25);
    shellRack(k, 1.0, 1.32, y, 4, 2, 0, STEEL);
    return;
  }
  if (level === 12) {
    // Fire Direction Centre: two-storey white FDC with fins and glass, rooftop met mast, conveyor from the magazine
    const top = whiteBlock(k, -0.95, -1.0, y, 1.05, 0.75, 2, true);
    metMast(k, -1.25, top, -1.2, 0.8);
    k.antenna(-0.7, top, -1.25, 0.8);
    k.aircon(-0.95, top, -0.85);
    board(k, 'FIRE DIRECTION', 0.7, 0.11, -0.95, y + 0.68, -1.0 + 0.4, TEAL, '#ffffff', 0, 30);
    const g = whiteBlock(k, -1.15, 0.45, y, 0.5, 0.75, 1);
    void g;
    k.shutter('right', -1.15, 0.45, 0.5, 0.75, 0, 0.36, 0.5);
    conveyor(k, -0.88, 0.45, GX - 0.5, GZ + 0.05, y + 0.02, 4, MODERN_D, '#2a2b2d', 5);
    floodlight(k, 1.35, -1.35, y, 1.4, Math.PI * 0.75);
    shellRack(k, 1.0, 1.32, y, 4, 2, 0, STEEL);
    return;
  }
  // Turreted gun: rounds disappear into the turret base through a feed chute
  const feed = mesh(k, new THREE.CylinderGeometry(0.12, 0.12, 0.08, 10), STEEL_D, -0.62, 0.12, 0, rig.yaw);
  void feed;
  if (level === 13) {
    // Turret Battery: first enclosed turret; glass control pod; conveyor tunnel from the magazine
    const top = whiteBlock(k, mx, mz, y, 0.85, 0.8, 2);
    k.shutter('right', mx, mz, 0.85, 0.8, 0, 0.4, 0.5);
    metMast(k, mx - 0.2, top, mz - 0.2, 0.7);
    k.antenna(mx + 0.25, top, mz - 0.25, 0.8);
    conveyor(k, mx + 0.45, mz + 0.15, GX - 0.75, GZ - 0.35, y + 0.02, 4, MODERN_D, '#2a2b2d', 5);
    pod(k, -1.05, 0.85, y, 0.36);
    floodlight(k, 1.35, -1.35, y, 1.4, Math.PI * 0.75);
    shellRack(k, 1.05, 1.32, y, 4, 2, 0, STEEL);
    turretTech(k, 1.0, 0.95, y);
    return;
  }
  if (level === 14) {
    // Elevated Turret: turret on a tall plinth with a glass band; glass ammunition lift; spotter drone circling
    k.box(0.02, 0.12, 0.5, DARK_GLASS, GX + pr * 0.86, y + 0.3, GZ);
    const top = whiteBlock(k, mx, mz, y, 0.8, 0.8, 2, true);
    metMast(k, mx - 0.2, top, mz - 0.2, 0.7);
    // Glass lift shaft carrying rounds up to the plinth deck
    const lx = -1.15, lz = 0.35;
    k.box(0.3, 1.3, 0.3, '#bfe6f2', lx, y, lz).material = M('#bfe6f2', { transparent: true, opacity: 0.45 });
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.03, 1.3, 0.03, MODERN_D, lx + dx * 0.14, y, lz + dz * 0.14);
    k.box(0.36, 0.08, 0.36, MODERN, lx, y + 1.3, lz);
    k.box(0.37, 0.03, 0.37, TEAL, lx, y + 1.3, lz);
    hoist(k, lx, lz, y + 0.05, y + 1.0, 5, 0, MODERN_D);
    strut(k, undefined, V(lx + 0.15, y + 0.75, lz), V(GX - 0.75, deck - 0.02, GZ + 0.1), 0.12, 0.05, MODERN_D);
    drone(k, GX, GZ, deck + 1.35, 0.85, 1);
    pod(k, -0.75, 1.15, y, 0.3);
    floodlight(k, 1.35, -1.35, y, 1.5, Math.PI * 0.75);
    shellRack(k, 1.05, 1.32, y, 4, 2, 0, STEEL);
    k.stairs(GX + 0.5, GZ + pr + 0.12, 0.4, 0.3, ph, false);
    return;
  }
  // 15 · Landmark Battery: turret on a plinth inside a ring colonnade with a green roof, plaque, flags
  const cr = 1.33, ch = 0.7;
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI * 1.2 + (i / 13) * Math.PI * 1.75;
    const [x, z] = onArc(GX, GZ, cr, a);
    if (Math.abs(x) > 1.42 || Math.abs(z) > 1.42) continue;
    k.box(0.07, ch, 0.07, C.white, x, y, z);
  }
  arcWall(k, GX, GZ, cr, -Math.PI * 1.2, Math.PI * 0.55, y + ch, 0.06, 0.24, TEAL, C.roofGreen);
  const top = whiteBlock(k, mx, mz, y, 0.75, 0.75, 2, true);
  metMast(k, mx - 0.18, top, mz - 0.2, 0.7);
  k.antenna(mx + 0.2, top, mz - 0.2, 0.9);
  conveyor(k, mx + 0.4, mz + 0.2, GX - 0.75, GZ - 0.25, y + 0.02, 4, MODERN_D, '#2a2b2d', 5, false);
  k.plaque('No.1 GUN', -0.85, 1.3, y, 0.7);
  k.flagpole(1.3, 1.3, 1.9, y);
  k.flagpole(-1.32, 0.5, 1.9, y);
  drone(k, GX, GZ, deck + 1.35, 0.9, 2);
  turretTech(k, 1.15, 0.2, y);
}

/** Glass fire-control cabin with a green roof. */
function cabin(k: Kit, x: number, z: number, y: number, w: number, d: number) {
  k.box(w, 0.2, d, MODERN, x, y, z);
  k.glassBox(w, 0.5, d, x, y + 0.2, z);
  k.box(w + 0.12, 0.06, d + 0.12, C.roofGreen, x, y + 0.76, z);
  k.box(w + 0.13, 0.025, d + 0.13, TEAL, x, y + 0.74, z);
  // Fire-control screen glowing inside
  const scr = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.02), glow('#7cf0d9', 0.9));
  scr.position.set(x, y + 0.42, z + d / 2 - 0.08);
  k.add(scr);
}

/** Cylindrical glass control pod with a green dome roof and a pulsing display. */
function pod(k: Kit, x: number, z: number, y: number, r: number) {
  k.cyl(r + 0.03, 0.18, MODERN, x, y, z, 12);
  k.cyl(r, 0.5, '#86b7cc', x, y + 0.18, z, 12);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.box(0.03, 0.5, 0.03, C.trim, x + Math.cos(a) * r, y + 0.18, z + Math.sin(a) * r);
  }
  k.cyl(r + 0.06, 0.06, C.roofGreen, x, y + 0.68, z, 12);
  k.cyl(r + 0.065, 0.025, TEAL, x, y + 0.66, z, 12);
  k.blinker(x, y + 0.74, z, '#2bb3a3', 0.04, 1.2);
}

/** Technician in coveralls pacing the deck with a tablet. */
function turretTech(k: Kit, x: number, z: number, y: number) {
  const f = figure(k, 3, '#3e5a4a', 'cap', '#2f3b34');
  k.add(f.root);
  k.box(0.02, 0.08, 0.1, '#2a2b2d', 0.1, 0.36, 0, f.root);
  k.anims.push((t) => {
    const p = loop(t, 10);
    const u = smooth(p < 0.5 ? p * 2 : 2 - p * 2);
    f.root.position.set(x, y, z - 0.45 * u);
    const turning = Math.min(p, Math.abs(p - 0.5), 1 - p) < 0.06;
    pose(f, turning ? 0 : t * 7, 0.35);
    f.armL.rotation.z = f.armR.rotation.z = 0.9;
    f.root.rotation.y = p < 0.5 ? face(0, -1) : face(0, 1);
  });
}

// ------------------------------------------------------------------ secure (16–20)

/** Octagonal hardened concrete gun bunker; returns its deck height. */
function hardBase(k: Kit, y: number, r: number, h: number, gold = false) {
  const b = mesh(k, new THREE.CylinderGeometry(r, r + 0.08, h, 8), CONCRETE, GX, y + h / 2, GZ);
  b.rotation.y = Math.PI / 8;
  const band = mesh(k, new THREE.CylinderGeometry(r + 0.045, r + 0.075, 0.08, 8), gold ? GOLD : HAZ, GX, y + h - 0.16, GZ);
  band.rotation.y = Math.PI / 8;
  // Slit windows round the drum
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8 + Math.PI / 8;
    if (i === 5) continue;
    const [x, z] = onArc(GX, GZ, r + 0.03, a);
    const s = k.box(0.24, 0.05, 0.02, '#2a2b2d', x, y + h * 0.42, z);
    s.rotation.y = tangent(a);
  }
  const top = mesh(k, new THREE.CylinderGeometry(r - 0.05, r - 0.05, 0.03, 8), '#bdb8ad', GX, y + h + 0.015, GZ);
  top.rotation.y = Math.PI / 8;
  return y + h + 0.03;
}

function secure(k: Kit, level: number, y: number) {
  const twin = level >= 19;
  const gold = level === 20;
  const bh = level >= 19 ? 0.66 : level >= 17 ? 0.58 : 0.5;
  const deck = hardBase(k, y, 1.12, bh, gold);
  const body = gold ? '#6d756a' : level >= 17 ? ARMOUR : '#717a6e';
  const spec: GunSpec = {
    carriage: 'turret', shield: 'none', len: twin ? 1.45 : level >= 18 ? 1.58 : 1.48, r: twin ? 0.055 : 0.062, trunH: 0.4,
    color: body, barrel: '#4f5650', brake: true, evac: true, twin, band: gold ? GOLD : HAZ,
  };
  const rig = buildGun(k, GX, deck, GZ, spec);
  // Armour skirts on the turret flanks
  for (const sz of [-1, 1]) k.box(0.7, 0.14, 0.03, STEEL_D, -0.15, 0.08, sz * ((twin ? 0.43 : 0.37) + 0.11), rig.yaw);
  if (level >= 18) {
    // Slat armour cage round the bustle
    for (const sz of [-1, 1]) for (let i = 0; i < 5; i++) k.box(0.025, 0.26, 0.02, STEEL_D, -0.92 + i * 0.07, 0.12, sz * ((twin ? 0.43 : 0.37) - 0.02), rig.yaw);
    k.box(0.04, 0.03, (twin ? 0.86 : 0.74), STEEL_D, -0.95, 0.4, 0, rig.yaw);
  }
  if (gold) {
    for (const sz of [-1, 1]) k.box(0.6, 0.03, 0.035, GOLD, -0.15, 0.45, sz * 0.555, rig.yaw);
    crest(k, -0.2, 0.3, 0.56, 0.09, 0, rig.yaw);
  }
  arm(k, rig, Math.PI / 4, 0.7, twin ? 1.1 : 1.2);
  // Rounds ride a conveyor to a hoist that lifts them into the turret ring
  const feedX = GX - 0.85, feedZ = GZ - 0.4;
  hoist(k, feedX, feedZ, y + 0.1, deck - 0.12, 5, 2.5);
  cctv(k, 1.35, -1.35, y, 1.4, Math.PI * 0.75);
  floodlight(k, -1.38, 0.9, y, 1.5, -Math.PI * 0.25);
  shellRack(k, -1.25, 0.3, y, 4, 2, Math.PI / 2, STEEL);
  const mx = -1.0, mz = -1.0;

  /** Square hardened magazine with a sliding blast door; returns its roof height. */
  const magBlock = (mh: number, w = 0.8) => {
    k.box(w, mh, w, CONCRETE, mx, y, mz);
    k.box(w + 0.05, 0.08, w + 0.05, gold ? GOLD : HAZ, mx, y + mh - 0.18, mz);
    k.box(w + 0.06, 0.06, w + 0.06, '#bdb8ad', mx, y + mh, mz);
    k.box(w + 0.04, 0.05, w + 0.04, '#bdb8ad', mx, y + STOREY, mz);
    for (const s of [-1, 1]) k.box(0.02, 0.06, 0.24, '#2a2b2d', mx + w / 2 + 0.01, y + mh - 0.55, mz + s * 0.18);
    slidingDoor(k, mx + w / 2 + 0.02, y, mz, 0.38, 0.55, Math.PI / 2, STEEL, 10, 3);
    board(k, 'MAGAZINE', 0.42, 0.1, mx, y + 0.7, mz + w / 2 + 0.02, '#d8342c', '#ffffff', 0, 34);
    conveyor(k, mx + w / 2 + 0.02, mz + 0.3, feedX, feedZ, y + 0.02, 3, STEEL, '#2a2b2d', 5);
    return y + mh + 0.06;
  };

  if (level === 16) {
    // Hardened Gun Bunker: armoured turret on an octagonal bunker, square blast-door magazine, T-wall screen
    const top = magBlock(1.95);
    k.antenna(mx + 0.25, top, mz - 0.25, 0.8);
    k.blinker(mx - 0.25, top, mz + 0.25, '#ff3b30', 0.04, 1.2);
    for (const [x, z, r] of [[0.6, 1.36, 0], [1.2, 1.32, 0], [1.32, 0.75, Math.PI / 2], [1.32, 0.15, Math.PI / 2]] as const) tWall(k, x, z, y, r, 0.8);
    turretTech(k, -0.55, 1.3, y);
    return;
  }
  if (level === 17) {
    // Auto-Loader Battery: the magazine wears a rotating ammunition carousel; an armoured feed gallery slopes to the gun
    const top = magBlock(1.85);
    carousel(k, mx, top, mz, 0.32);
    strut(k, undefined, V(mx + 0.3, top - 0.35, mz + 0.4), V(feedX - 0.05, deck - 0.05, feedZ - 0.05), 0.2, 0.18, STEEL_D);
    strut(k, undefined, V(mx + 0.3, top - 0.25, mz + 0.4), V(feedX - 0.05, deck + 0.05, feedZ - 0.05), 0.22, 0.03, HAZ);
    for (const [x, z, r] of [[0.6, 1.36, 0], [1.2, 1.32, 0], [1.32, 0.75, Math.PI / 2]] as const) tWall(k, x, z, y, r, 0.8);
    turretTech(k, -0.55, 1.3, y);
    return;
  }
  if (level === 18) {
    // Sensor Battery: round hardened sensor tower with a slewing electro-optical turret, sensor mast, armoured slats
    const tr = 0.42, th = 2.3;
    k.cyl(tr + 0.04, 0.12, CONCRETE, mx, y, mz, 14);
    k.cyl(tr, th, CONCRETE, mx, y, mz, 14);
    k.cyl(tr + 0.02, 0.07, HAZ, mx, y + th - 0.2, mz, 14);
    for (let i = 0; i < 3; i++) k.cyl(tr + 0.01, 0.04, '#bdb8ad', mx, y + 0.5 + i * 0.5, mz, 14);
    k.cyl(tr + 0.05, 0.06, '#bdb8ad', mx, y + th, mz, 14);
    k.box(0.03, 0.5, 0.26, '#2a2b2d', mx + tr - 0.01, y, mz);
    // EO turret on the roof
    const eo = grp(k, mx, y + th + 0.06, mz);
    mesh(k, new THREE.CylinderGeometry(0.16, 0.2, 0.12, 10), STEEL_D, 0, 0.06, 0, eo);
    const head = grp(k, 0, 0.22, 0, 0, eo);
    k.box(0.3, 0.18, 0.22, '#e8e6e0', 0, -0.09, 0, head);
    for (const s of [-1, 1]) k.box(0.02, 0.06, 0.06, '#ff5a3a', 0.16, -0.03, s * 0.06, head).material = glow('#ff5a3a', 0.9);
    k.anims.push((t) => {
      eo.rotation.y = Math.sin(t * 0.25) * 2.2;
      head.rotation.z = Math.sin(t * 0.6) * 0.15;
    });
    sensorMast(k, -0.35, -1.3, y, 1.7);
    conveyor(k, -1.25, -0.35, feedX, feedZ, y + 0.02, 3, STEEL, '#2a2b2d', 5);
    k.box(0.4, 0.5, 0.35, CONCRETE, -1.25, y, -0.45);
    for (const [x, z, r] of [[0.6, 1.36, 0], [1.2, 1.32, 0]] as const) tWall(k, x, z, y, r, 0.8);
    return;
  }
  // 19 · Twin-Gun Turret / 20 · Citadel Battery: magazine keep with a drone deck; ground-level caged carousel
  const top = magBlock(2.3, 0.85);
  k.box(0.6, 0.02, 0.6, '#4a4f54', mx, top, mz);
  for (const s of [-1, 1]) k.box(0.42, 0.006, 0.05, HAZ, mx, top + 0.02, mz + s * 0.24);
  // Drone lifts off the deck, patrols, and lands again
  const dr = grp(k, mx, top + 0.05, mz);
  k.box(0.18, 0.05, 0.18, '#3a3f44', 0, 0, 0, dr);
  const props: THREE.Mesh[] = [];
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) props.push(k.box(0.14, 0.008, 0.02, '#c9ced2', dx * 0.12, 0.04, dz * 0.12, dr));
  k.anims.push((t) => {
    const p = loop(t, 14);
    const up = p < 0.1 ? 0 : p < 0.2 ? ramp(p, 0.1, 0.2) : p < 0.8 ? 1 : p < 0.9 ? 1 - ramp(p, 0.8, 0.9) : 0;
    const a = p > 0.2 && p < 0.8 ? (p - 0.2) / 0.6 * Math.PI * 2 : 0;
    dr.position.set(mx + Math.sin(a) * 0.9 * up, top + 0.05 + up * 0.9, mz + (1 - Math.cos(a)) * 0.9 * up);
    for (const pr of props) pr.rotation.y = p > 0.08 && p < 0.92 ? t * 30 : 0;
  });
  carousel(k, -1.05, y, 1.0, 0.3);
  sensorMast(k, -0.35, -1.32, y, 1.8);
  if (level === 19) {
    for (const [x, z, r] of [[0.6, 1.36, 0], [1.2, 1.32, 0], [1.32, 0.75, Math.PI / 2]] as const) tWall(k, x, z, y, r, 0.8);
    k.blinker(GX + 1.0, deck, GZ - 0.4, '#ff3b30', 0.04, 1.0);
    return;
  }
  // Citadel: gold crest wall, gold-capped bollards, flag, gold trim on the keep
  k.box(0.9, 0.7, 0.14, CONCRETE, 0.55, y, 1.35);
  k.box(0.92, 0.05, 0.16, GOLD, 0.55, y + 0.7, 1.35);
  crest(k, 0.55, y + 0.4, 1.43, 0.16);
  board(k, 'CITADEL BATTERY', 0.75, 0.1, 0.55, y + 0.06, 1.43, '#2a2b2d', GOLD, 0, 30);
  for (const z of [0.2, 0.6]) {
    k.cyl(0.06, 0.32, CONCRETE, 1.35, y, z, 8);
    k.cyl(0.062, 0.04, GOLD, 1.35, y + 0.32, z, 8);
  }
  k.flagpole(1.3, -0.55, 2.2, y);
  k.box(0.91, 0.04, 0.91, GOLD, mx, top - 0.02, mz);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.08, 0.12, 0.08, GOLD, mx + dx * 0.4, top, mz + dz * 0.4);
}

/** Rotating ammunition carousel: a ring of rounds turning inside a caged drum. */
function carousel(k: Kit, x: number, y: number, z: number, r: number) {
  k.cyl(r + 0.05, 0.06, STEEL_D, x, y, z, 12);
  const ring = grp(k, x, y + 0.06, z);
  mesh(k, new THREE.CylinderGeometry(r * 0.35, r * 0.35, 0.36, 8), STEEL, 0, 0.18, 0, ring);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    shell(k, ring, Math.cos(a) * r * 0.75, 0, Math.sin(a) * r * 0.75, false, 1.4);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    k.box(0.025, 0.42, 0.025, HAZ, x + Math.cos(a) * (r + 0.03), y + 0.06, z + Math.sin(a) * (r + 0.03));
  }
  k.cyl(r + 0.05, 0.04, STEEL_D, x, y + 0.48, z, 12);
  k.anims.push((t) => (ring.rotation.y = Math.floor(t * 2) * 0.628 + smooth(loop(t * 2, 1)) * 0.628));
}

/** Electro-optical sensor ball on a mast, slewing and nodding. */
function sensorMast(k: Kit, x: number, z: number, y: number, h: number) {
  k.box(0.2, 0.1, 0.2, CONCRETE, x, y, z);
  k.cyl(0.05, h, '#8a9196', x, y + 0.1, z, 6);
  for (let i = 1; i < 4; i++) k.box(0.16, 0.02, 0.02, '#8a9196', x, y + 0.1 + (h * i) / 4, z);
  const yoke = grp(k, x, y + 0.1 + h, z);
  k.box(0.04, 0.16, 0.22, STEEL_D, 0, 0, 0, yoke);
  const ball = new THREE.Group();
  ball.position.y = 0.12;
  yoke.add(ball);
  mesh(k, new THREE.SphereGeometry(0.11, 10, 8), '#e8e6e0', 0, 0, 0, ball);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 10).rotateZ(Math.PI / 2), glow('#ff5a3a', 0.8));
  lens.position.x = 0.1;
  ball.add(lens);
  k.blinker(x, y + 0.1 + h + 0.24, z, '#ff3b30', 0.03, 1.6);
  k.anims.push((t) => {
    yoke.rotation.y = Math.sin(t * 0.3) * 1.6;
    ball.rotation.z = -0.2 + Math.sin(t * 0.7) * 0.15;
  });
}

// ------------------------------------------------------------------ entry point

export function buildArtillery(level: number): Kit {
  const k = new Kit();
  const y = k.pad(3, 3);
  if (level <= 3) field(k, level, y);
  else if (level <= 6) camp(k, level, y);
  else if (level <= 10) base(k, level, y);
  else if (level <= 15) command(k, level, y);
  else secure(k, level, y);
  return k;
}

export const ARTILLERY: BuildingDef = {
  id: 'artillery',
  name: 'Artillery Emplacement',
  role: 'Long-range heavy gun: lobs high-explosive shells at ground raiders from far out, but cannot hit anything that gets close.',
  footprint: [3, 3],
  unlockHq: 11,
  levels: ARTILLERY_LEVELS,
  designedLevels: 20,
  build: buildArtillery,
};
