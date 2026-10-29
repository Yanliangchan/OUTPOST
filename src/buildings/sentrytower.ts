import * as THREE from 'three';
import { C, Kit, mat } from './kit';
import { CONCRETE, DARK_GLASS, GOLD } from './common';
import { DAY, HOUR, type BuildingDef, type LevelStats } from './types';
import type { Turret } from './turret';

/*
 * Sentry Tower: the elevated lookout with a rifleman. Hits ground and air.
 * Signature at every level: height (a raised platform or tower), a ladder or
 * stairs up to it, and the weapon at the top. The weapon grows with the bands:
 *   Lv 1–4   a sentry aiming a rifle (scans the horizon, raises binoculars now and then)
 *   Lv 5–10  a GPMG on a pintle with the gunner behind it
 *   Lv 11–20 a remote weapon station: twin MG turret with optics
 * Footprint 2×2; bulk ~1 storey at Lv 1 rising to ~3.8 storeys.
 */

// ------------------------------------------------------------------ stats

const TITLES = [
  'Lookout Stand', 'Timber Lookout', 'Stilt Lookout', 'Sentry Post', 'Gun Post', 'Gun Tower',
  'Pillbox Tower', 'Lattice Tower', 'Bastion Tower', 'Keep Tower', 'Remote Gun Tower', 'Lift Tower',
  'Sensor Mast Tower', 'Cantilever Tower', 'Terrace Tower', 'Cupola Tower', 'Armour Tower', 'Drone Sentry',
  'Fortress Tower', 'Citadel Sentry',
];
const SUPPLIES = [6_000, 8_000, 11_000, 15_000, 20_000, 27_000, 36_000, 49_000, 66_000, 89_000, 120_000, 160_000, 220_000, 300_000, 400_000, 540_000, 730_000, 980_000, 1_320_000, 1_800_000];
const REPUTATION = [250, 350, 500, 700, 950, 1_250, 1_600, 2_000, 2_500, 3_100, 3_800, 4_600, 5_500, 6_600, 7_900, 9_400, 11_200, 13_300, 15_800, 18_800];
const TIME = [1 * HOUR, 1.5 * HOUR, 2 * HOUR, 3 * HOUR, 4 * HOUR, 5 * HOUR, 7 * HOUR, 9 * HOUR, 12 * HOUR, 16 * HOUR, 20 * HOUR, 1 * DAY, 1.25 * DAY, 1.5 * DAY, 2 * DAY, 2.5 * DAY, 3 * DAY, 4 * DAY, 5 * DAY, 6 * DAY];

/** Shots per second: rifle → GPMG bursts → remote twin MG. */
const rateOf = (lv: number) => (lv <= 4 ? 1.2 : lv <= 10 ? 1.6 : 2.2);
const weaponOf = (lv: number) => (lv <= 4 ? 'Rifle sentry' : lv <= 10 ? 'Mounted GPMG' : 'Remote weapon station');

export const SENTRY_TOWER_LEVELS: LevelStats[] = TITLES.map((title, i) => {
  const level = i + 1;
  const dps = +(10 * Math.pow(1.18, i)).toFixed(1);
  const range = +(7 + (2.5 * i) / 19).toFixed(1);
  const rate = rateOf(level);
  const damage = +(dps / rate).toFixed(1);
  const unlocks = [`${weaponOf(level)}: ${dps} damage/s`, `Range ${range} tiles, hits ground and air`];
  if (level === 5) unlocks.push('GPMG mounted: faster bursts');
  if (level === 11) unlocks.push('Remote weapon station: twin MGs with optics');
  return {
    level, title,
    supplies: SUPPLIES[i],
    reputation: REPUTATION[i],
    buildTime: TIME[i],
    hp: Math.round((700 * Math.pow(1.2, i)) / 10) * 10,
    stats: { dps, range, rate, damage },
    unlocks,
  };
});

// ------------------------------------------------------------------ palette

const OLIVE = '#5b6b3a';
const OLIVE_D = '#46542c';
const BERET = '#2a3326';
const HELMET = '#4f5e33';
const SKIN = ['#e0ac7e', '#c68b5f', '#a8714b', '#f0c39a'];
const LOG = '#8a6440';
const LOG_D = '#6e4e31';
const PLANK = '#b08a5a';
const PLANK_D = '#9c7748';
const CANVAS = '#b9a878';
const CANVAS_D = '#9a8c62';
const GUN = '#2e3236';
const STEEL = '#5f6b4e';
const STEEL_D = '#4c5640';
const ARM = '#6b757b';
const ARM_D = '#4e575d';
const DCON = '#b9b4aa';
const BRASS = '#c9a24a';
const HAZ = '#f2c230';
const TEAL = '#2bb3a3';
const SAND = '#cdb98a';

const M = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8, ...o });
const glow = (c: string, i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, flatShading: true });
const GLASS = () => M('#86b7cc', { transparent: true, opacity: 0.45, roughness: 0.2 });
const smooth = (u: number) => u * u * (3 - 2 * u);
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));
/** Heading (rotation.y) that faces a figure built along +x toward (dx, dz). */
const face = (dx: number, dz: number) => Math.atan2(-dz, dx);
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Dwell-and-turn scan in -1..1: holds a heading, turns briskly to the next,
 * holds again (how a sentry or a stabilised turret actually sweeps).
 */
function scan(t: number, speed: number, seed: number, snap = 2.2) {
  const s = t * speed + seed;
  const i = Math.floor(s);
  const h = (n: number) => Math.sin(n * 2.399 + seed * 1.7) * 0.85 + Math.sin(n * 5.1) * 0.15;
  return h(i) + (h(i + 1) - h(i)) * smooth(clamp01((s - i) * snap));
}

// ------------------------------------------------------------------ geometry helpers

/** Cylinder between two points. */
function beam(k: Kit, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r: number, color: string, sides = 6, parent?: THREE.Object3D) {
  const a = new THREE.Vector3(x0, y0, z0), b = new THREE.Vector3(x1, y1, z1);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, a.distanceTo(b), sides), mat(color));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
  return k.add(m, parent);
}

/** A mesh added to a parent at a centre position (for rig parts). */
function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: string | THREE.Material, x: number, y: number, z: number) {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color) : color);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
const bx = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

/** Box in a group turned by rotY at (x, y, z). */
function rbox(k: Kit, w: number, h: number, d: number, color: string, x: number, y: number, z: number, rotY: number) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  k.box(w, h, d, color, 0, 0, 0, g);
  return k.add(g);
}

/** Box spanning (x0,z0)→(x1,z1) at height y. */
function span(k: Kit, x0: number, z0: number, x1: number, z1: number, y: number, h: number, t: number, color: string) {
  return rbox(k, Math.hypot(x1 - x0, z1 - z0), h, t, color, (x0 + x1) / 2, y, (z0 + z1) / 2, Math.atan2(-(z1 - z0), x1 - x0));
}

/** Plank deck centred at (cx, cz) with its top at y. */
function planks(k: Kit, cx: number, cz: number, w: number, d: number, y: number, n = 5) {
  for (let i = 0; i < n; i++) k.box(w, 0.05, d / n - 0.012, i % 2 ? PLANK : PLANK_D, cx, y - 0.05, cz - d / 2 + (d / n) * (i + 0.5));
}

/** Sandbag wall with a fill core (so the wall reads as a solid mass). */
function bags(k: Kit, x: number, z: number, len: number, rotY = 0, y = 0.08, layers = 2) {
  const g = k.sandbags(x, z, len, rotY, y, layers);
  k.box(Math.max(0.1, len - 0.08), layers * 0.1, 0.1, '#bba676', 0, 0, 0, g);
  return g;
}

/** Ladder: rails along local y, leaning out toward local +z at the bottom; turned by rotY. */
function ladder(k: Kit, x: number, z: number, y0: number, y1: number, rotY = 0, w = 0.22, color: string = LOG_D, lean = 0.15, r = 0.02, cage = false) {
  const g = new THREE.Group();
  g.position.set(x, y0, z);
  g.rotation.y = rotY;
  const h = y1 - y0;
  for (const s of [-1, 1]) beam(k, (s * w) / 2, 0, lean, (s * w) / 2, h + 0.16, 0, r, color, 5, g);
  const n = Math.floor(h / 0.14);
  for (let i = 1; i <= n; i++) {
    const yy = i * 0.14;
    k.box(w, 0.018, 0.026, color, 0, yy, lean * (1 - yy / h), g);
  }
  if (cage) {
    for (let yy = 0.7; yy < h + 0.1; yy += 0.28) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(w * 0.7, 0.008, 4, 10, Math.PI).rotateX(Math.PI / 2), mat(color));
      hoop.position.set(0, yy, 0.0);
      hoop.rotation.y = Math.PI;
      hoop.scale.set(1, 1, -1.3);
      g.add(hoop);
    }
    for (const a of [-0.6, 0, 0.6]) k.box(0.012, h - 0.6, 0.012, color, Math.sin(a) * w * 0.7, 0.7, Math.cos(a) * w * 0.9, g);
  }
  return k.add(g);
}

/** Steel stair flight from (x0,y0,z0) up to (x1,y1,z1) with handrails. */
function flight(k: Kit, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, w = 0.26, color: string = C.trim, tread = '#9aa3a6') {
  const dx = x1 - x0, dz = z1 - z0, run = Math.hypot(dx, dz), rise = y1 - y0;
  const g = new THREE.Group();
  g.position.set(x0, y0, z0);
  g.rotation.y = Math.atan2(-dz, dx);
  for (const s of [-1, 1]) {
    beam(k, 0, 0, (s * w) / 2, run, rise, (s * w) / 2, 0.02, color, 4, g);
    beam(k, 0, 0.34, (s * w) / 2, run, rise + 0.34, (s * w) / 2, 0.011, color, 4, g);
    k.box(0.02, 0.34, 0.02, color, 0.02, 0, (s * w) / 2, g);
  }
  const n = Math.max(3, Math.round(rise / 0.13));
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n;
    k.box(run / n + 0.02, 0.025, w - 0.02, tread, u * run, u * rise - 0.02, 0, g);
  }
  return k.add(g);
}

/** Railing along one edge: posts and two rails. */
function railSide(k: Kit, x0: number, z0: number, x1: number, z1: number, y: number, h = 0.3, color: string = C.trim) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.round(len / 0.32));
  for (let i = 0; i <= n; i++) k.box(0.03, h, 0.03, color, x0 + ((x1 - x0) * i) / n, y, z0 + ((z1 - z0) * i) / n);
  span(k, x0, z0, x1, z1, y + h - 0.03, 0.03, 0.035, color);
  span(k, x0, z0, x1, z1, y + h * 0.5, 0.02, 0.02, color);
}

/** Wall segment along one edge. */
function wallSide(k: Kit, x0: number, z0: number, x1: number, z1: number, y: number, h: number, t: number, color: string, cap?: string) {
  span(k, x0, z0, x1, z1, y, h, t, color);
  if (cap) span(k, x0, z0, x1, z1, y + h, 0.04, t + 0.03, cap);
}

/** Hexagonal ring wall matching k.cyl(r, …, 6). */
function hexWall(k: Kit, cx: number, cz: number, r: number, y: number, h: number, t: number, color: string, cap?: string) {
  const a = r * Math.cos(Math.PI / 6);
  for (let i = 0; i < 6; i++) {
    const th = Math.PI / 6 + (i * Math.PI) / 3;
    rbox(k, r + 0.02, h, t, color, cx + Math.sin(th) * (a - t / 2), y, cz + Math.cos(th) * (a - t / 2), th);
    if (cap) rbox(k, r + 0.04, 0.04, t + 0.03, cap, cx + Math.sin(th) * (a - t / 2), y + h, cz + Math.cos(th) * (a - t / 2), th);
  }
}

/** Dark firing slits round a hexagonal drum (skipping some faces). */
function hexSlits(k: Kit, cx: number, cz: number, r: number, y: number, skip: number[] = [], w = 0.28) {
  const a = r * Math.cos(Math.PI / 6);
  for (let i = 0; i < 6; i++) {
    if (skip.includes(i)) continue;
    const th = Math.PI / 6 + (i * Math.PI) / 3;
    rbox(k, w, 0.06, 0.03, '#1f2326', cx + Math.sin(th) * a, y, cz + Math.cos(th) * a, th);
    rbox(k, w + 0.06, 0.025, 0.05, '#cfcac0', cx + Math.sin(th) * a, y - 0.03, cz + Math.cos(th) * a, th);
  }
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

/** Flat sign board with lettering on its front (+z) face, turned by rotY. */
function board(k: Kit, text: string, w: number, h: number, x: number, y: number, z: number, bg: string, fg = '#ffffff', rotY = 0, font = 40) {
  const side = M(bg);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), [side, side, side, side, signMat(text, bg, fg, font), side]);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = rotY;
  return k.add(m);
}

// ------------------------------------------------------------------ small animated props

/** Item hanging from (x, top, z) that sways (canteen, lantern, bell, flap). */
function hang(k: Kit, x: number, top: number, z: number, w: number, h: number, d: number, color: string | THREE.MeshStandardMaterial, seed = 0, amp = 0.4) {
  const m = k.box(w, h, d, typeof color === 'string' ? color : '#ffffff', x, top - h, z);
  if (typeof color !== 'string') m.material = color;
  k.swing(m, top, amp, seed);
  return m;
}

/** Hurricane lantern on a hook, swaying and flickering. */
function lantern(k: Kit, x: number, y: number, z: number, seed = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  k.box(0.01, 0.08, 0.01, '#33383d', 0, -0.08, 0, g);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.09, 6), glow('#ffcf6a', 0.8));
  body.position.y = -0.14;
  const lid = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.045, 6), M('#4a4f54'));
  lid.position.y = -0.08;
  g.add(body, lid);
  k.add(g);
  k.anims.push((t) => {
    g.rotation.z = Math.sin(t * 1.5 + seed) * 0.2;
    g.rotation.x = Math.sin(t * 1.1 + seed * 2) * 0.12;
    (body.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.7 + Math.sin(t * 13 + seed) * 0.15;
  });
}

/** Triangular pennant on a thin pole that streams and veers with the wind. */
function pennant(k: Kit, x: number, y: number, z: number, h = 0.5, color = '#d8342c', poleColor: string = C.white) {
  k.cyl(0.012, h, poleColor, x, y, z, 5);
  const g = new THREE.Group();
  g.position.set(x, y + h - 0.02, z);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.3, -0.06);
  shape.lineTo(0, -0.13);
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), M(color, { side: THREE.DoubleSide }));
  g.add(m);
  k.add(g);
  k.anims.push((t) => {
    g.rotation.y = Math.sin(t * 0.4 + x) * 0.6 - 0.6;
    m.rotation.x = Math.sin(t * 6 + z) * 0.25;
  });
}

/** Pole CCTV camera that pans. */
function cctv(k: Kit, x: number, y: number, z: number, h = 0.5, base = 0, body = '#f4f4f0') {
  k.cyl(0.02, h, C.metal, x, y, z, 5);
  const cam = new THREE.Group();
  cam.position.set(x, y + h, z);
  k.box(0.15, 0.065, 0.065, body, 0.05, 0, 0, cam);
  k.box(0.03, 0.04, 0.04, '#33383d', 0.13, 0.012, 0, cam);
  k.box(0.17, 0.015, 0.08, body, 0.05, 0.065, 0, cam);
  k.add(cam);
  k.anims.push((t) => (cam.rotation.y = base + Math.sin(t * 0.4 + x + z) * 0.9));
}

/** Cup anemometer that spins. */
function anemometer(k: Kit, x: number, y: number, z: number, h = 0.35) {
  k.cyl(0.012, h, C.metal, x, y, z, 5);
  const hub = new THREE.Group();
  hub.position.set(x, y + h, z);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const arm = part(hub, bx(0.12, 0.008, 0.008), C.metal, Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06);
    arm.rotation.y = -a;
    part(hub, new THREE.SphereGeometry(0.022, 6, 4), '#f4f4f0', Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12);
  }
  k.add(hub);
  k.anims.push((t) => (hub.rotation.y = t * 7));
}

/** Rotating amber/red beacon: housing with a spinning reflector inside. */
function beacon(k: Kit, x: number, y: number, z: number, color = '#ffb020', r = 0.05) {
  k.cyl(r * 1.2, 0.03, '#33383d', x, y, z, 8);
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, r * 1.4, 8), M(color, { transparent: true, opacity: 0.55, emissive: color, emissiveIntensity: 0.4 }));
  dome.position.set(x, y + 0.03 + r * 0.7, z);
  k.add(dome);
  const g = new THREE.Group();
  g.position.set(x, y + 0.03 + r * 0.7, z);
  part(g, bx(r * 1.4, r * 0.9, r * 0.3), glow(color, 1.6), 0, 0, 0);
  k.add(g);
  k.anims.push((t) => (g.rotation.y = t * 5));
}

/** Hand-cranked siren on a post; the crank spins in bursts. */
function handSiren(k: Kit, x: number, y: number, z: number, rotY = 0) {
  k.cyl(0.02, 0.32, C.metal, x, y, z, 5);
  const g = new THREE.Group();
  g.position.set(x, y + 0.36, z);
  g.rotation.y = rotY;
  part(g, new THREE.CylinderGeometry(0.06, 0.06, 0.1, 10).rotateZ(Math.PI / 2), '#d8342c', 0, 0, 0);
  part(g, new THREE.CylinderGeometry(0.065, 0.065, 0.02, 10).rotateZ(Math.PI / 2), '#33383d', 0.055, 0, 0);
  const crank = new THREE.Group();
  crank.position.set(-0.06, 0, 0);
  part(crank, bx(0.01, 0.08, 0.01), '#33383d', 0, 0.03, 0);
  part(crank, bx(0.04, 0.012, 0.012), '#33383d', -0.02, 0.07, 0);
  g.add(crank);
  k.add(g);
  k.anims.push((t) => {
    const c = t % 9;
    crank.rotation.x = c < 2.5 ? c * 14 : 35;
  });
}

/** Jerry can. */
function jerry(k: Kit, x: number, z: number, y: number, rotY = 0, color = '#4b6b3a') {
  rbox(k, 0.08, 0.18, 0.14, color, x, y, z, rotY);
  rbox(k, 0.03, 0.03, 0.06, '#33383d', x, y + 0.18, z, rotY);
}

/** Ammo box (olive, stencilled lid). */
function ammoBox(k: Kit, x: number, z: number, y: number, rotY = 0) {
  rbox(k, 0.18, 0.1, 0.1, OLIVE, x, y, z, rotY);
  rbox(k, 0.19, 0.02, 0.11, OLIVE_D, x, y + 0.1, z, rotY);
  rbox(k, 0.06, 0.012, 0.02, HAZ, x, y + 0.115, z, rotY);
}

/** Precast T-wall blast barrier facing local +z, turned by rotY. */
function tWall(k: Kit, x: number, z: number, y: number, rotY = 0, h = 0.72, cap = HAZ, color = CONCRETE) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  k.box(0.42, h, 0.09, color, 0, 0, 0, g);
  k.box(0.42, 0.12, 0.3, color, 0, 0, 0, g);
  k.box(0.43, 0.05, 0.1, cap, 0, h - 0.1, 0, g);
  return k.add(g);
}

/** Hesco-style gabion: mesh basket full of sand. */
function hesco(k: Kit, x: number, z: number, y: number, s = 0.34) {
  k.box(s, s, s, '#c8b48a', x, y, z);
  for (let i = 1; i < 3; i++) {
    k.box(s + 0.01, 0.008, s + 0.01, '#6b6f63', x, y + (s / 3) * i, z);
    k.box(0.008, s + 0.005, s + 0.01, '#6b6f63', x - s / 2 + (s / 3) * i, y, z);
    k.box(s + 0.01, s + 0.005, 0.008, '#6b6f63', x, y, z - s / 2 + (s / 3) * i);
  }
  k.box(s + 0.01, 0.015, s + 0.01, '#8a8e82', x, y + s - 0.01, z);
}

/** Low white podium (modern plaza base) with front steps; returns its top. */
function podium(k: Kit, w: number, d: number, h: number, edge: string = C.trim, color: string = C.white) {
  const y = 0.08;
  k.box(w, h, d, color, 0, y, 0);
  k.box(w + 0.02, 0.05, d + 0.02, edge, 0, y + h - 0.1, 0);
  k.box(w - 0.06, 0.012, d - 0.06, '#e4dfd3', 0, y + h, 0);
  for (let i = 1; i < 4; i++) {
    k.box(0.015, 0.014, d - 0.1, '#cfc9bc', -w / 2 + (w / 4) * i, y + h, 0);
    k.box(w - 0.1, 0.014, 0.015, '#cfc9bc', 0, y + h, -d / 2 + (d / 4) * i);
  }
  for (let i = 0; i < 2; i++) k.box(0.5, (h * (2 - i)) / 3, 0.1, '#d9d4c8', 0.35, y, d / 2 + 0.05 + (1 - i) * 0.08);
  return y + h;
}

// ------------------------------------------------------------------ people

type Hat = 'beret' | 'helmet' | 'cap' | null;
interface Figure { root: THREE.Group; legL: THREE.Object3D; legR: THREE.Object3D; armL: THREE.Object3D; armR: THREE.Object3D }

/** A ~0.6-tall low-poly figure facing +x with pivoting limbs. */
function figure(seed: number, uniform = OLIVE, hat: Hat = 'beret', trousers = OLIVE_D): Figure {
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
  add(new THREE.IcosahedronGeometry(0.062, 0), SKIN[seed % SKIN.length], 0, 0.52, 0);
  if (hat === 'beret') {
    const b = add(new THREE.CylinderGeometry(0.068, 0.07, 0.03, 8), BERET, -0.005, 0.575, 0.01);
    b.rotation.x = 0.2;
  } else if (hat === 'helmet') {
    add(new THREE.SphereGeometry(0.078, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), HELMET, -0.004, 0.535, 0);
    add(new THREE.CylinderGeometry(0.088, 0.088, 0.014, 8), HELMET, -0.004, 0.537, 0);
  } else if (hat === 'cap') {
    add(new THREE.CylinderGeometry(0.065, 0.068, 0.04, 8), uniform, 0, 0.575, 0);
    add(new THREE.BoxGeometry(0.06, 0.012, 0.1), uniform, 0.06, 0.56, 0);
  }
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(0, 0.45, -0.105);
  armR.position.set(0, 0.45, 0.105);
  for (const a of [armL, armR]) {
    add(limb(0.05, 0.18, 0.05), uniform, 0, 0, 0, a);
    add(new THREE.BoxGeometry(0.045, 0.04, 0.045), SKIN[seed % SKIN.length], 0, -0.19, 0, a);
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

/** A sentry pacing back and forth between two points. */
function patrol(k: Kit, y: number, x0: number, z0: number, x1: number, z1: number, period = 9, seed = 1, hat: Hat = 'beret', uniform = OLIVE) {
  const f = figure(seed, uniform, hat);
  k.add(f.root);
  k.anims.push((t) => {
    const p = ((((t + seed * 3) % period) + period) % period) / period;
    const fwd = p < 0.5;
    const u = smooth(fwd ? p * 2 : 2 - p * 2);
    f.root.position.set(x0 + (x1 - x0) * u, y, z0 + (z1 - z0) * u);
    const turning = Math.min(p, Math.abs(p - 0.5), 1 - p) < 0.04;
    pose(f, turning ? 0 : t * 8);
    f.root.rotation.y = fwd ? face(x1 - x0, z1 - z0) : face(x0 - x1, z0 - z1);
  });
  return f;
}

/** A figure walking a polyline there and back (stairs, decks), optionally carrying an ammo box. */
function walker(k: Kit, pts: [number, number, number][], period: number, seed: number, hat: Hat = 'helmet', carry = true, uniform = OLIVE) {
  const f = figure(seed, uniform, hat);
  if (carry) {
    part(f.root, bx(0.14, 0.08, 0.1), OLIVE, 0.1, 0.3, 0);
    f.armL.rotation.z = f.armR.rotation.z = 0.7;
  }
  k.add(f.root);
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1], p[2] - pts[i][2]));
  const L = lens.reduce((a, b) => a + b, 0);
  k.anims.push((t) => {
    const p = ((((t + seed * 2.3) % period) + period) % period) / period;
    const fwd = p < 0.5;
    const raw = fwd ? p * 2 : 2 - p * 2;
    const u = clamp01((raw - 0.08) / 0.84);
    let d = u * L, i = 0;
    while (i < lens.length - 1 && d > lens[i]) d -= lens[i++];
    const a = pts[i], b = pts[i + 1], s = lens[i] ? d / lens[i] : 0;
    f.root.position.set(a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s);
    const dx = b[0] - a[0], dz = b[2] - a[2];
    if (Math.hypot(dx, dz) > 1e-3) f.root.rotation.y = fwd ? face(dx, dz) : face(-dx, -dz);
    const moving = u > 0 && u < 1;
    const sw = moving ? Math.sin(t * 8) * 0.5 : 0;
    f.legL.rotation.z = sw;
    f.legR.rotation.z = -sw;
    if (!carry) {
      f.armL.rotation.z = -sw * 0.8;
      f.armR.rotation.z = sw * 0.8;
    }
  });
  return f;
}

/** A figure climbing a ladder up and down, facing it (rotY). */
function climber(k: Kit, x: number, z: number, y0: number, y1: number, rotY: number, period = 10, seed = 2, hat: Hat = 'helmet') {
  const f = figure(seed, OLIVE, hat);
  f.root.position.set(x, y0, z);
  f.root.rotation.y = rotY;
  k.add(f.root);
  k.anims.push((t) => {
    const p = ((((t + seed) % period) + period) % period) / period;
    const raw = p < 0.5 ? p * 2 : 2 - p * 2;
    const u = clamp01((raw - 0.1) / 0.8);
    f.root.position.y = y0 + (y1 - y0) * smooth(u);
    const moving = u > 0 && u < 1;
    const c = moving ? Math.sin(t * 7) : 0;
    f.armL.rotation.z = 2.7 + c * 0.25;
    f.armR.rotation.z = 2.7 - c * 0.25;
    f.legL.rotation.z = 0.35 + c * 0.35;
    f.legR.rotation.z = 0.35 - c * 0.35;
  });
  return f;
}

/** A spotter who raises binoculars and scans, then lowers them. */
function spotter(k: Kit, x: number, y: number, z: number, rot: number, seed = 3, hat: Hat = 'helmet', uniform = OLIVE) {
  const f = figure(seed, uniform, hat);
  f.root.position.set(x, y, z);
  f.root.rotation.y = rot;
  const bino = part(f.root, bx(0.05, 0.045, 0.11), GUN, 0.085, 0.52, 0);
  k.add(f.root);
  k.anims.push((t) => {
    const c = ((t + seed * 1.7) % 9) / 9;
    const up = smooth(clamp01(c < 0.5 ? c / 0.08 : (0.62 - c) / 0.08));
    f.armL.rotation.set(0, -0.7 * up, 2.2 * up);
    f.armR.rotation.set(0, 0.7 * up, 2.2 * up + Math.sin(t * 0.8) * 0.05 * (1 - up));
    bino.visible = up > 0.6;
    f.root.rotation.y = rot + Math.sin(t * 0.45 + seed) * (0.25 + 0.5 * up);
  });
  return f;
}

/** Operator seated at a console, arm reaching for the controls. */
function operator(k: Kit, x: number, y: number, z: number, rot: number, seed = 4, uniform = OLIVE) {
  const f = figure(seed, uniform, 'cap');
  f.root.position.set(x, y - 0.1, z);
  f.root.rotation.y = rot;
  f.legL.rotation.z = f.legR.rotation.z = 1.4;
  k.add(f.root);
  k.anims.push((t) => {
    f.armR.rotation.z = 1.2 + Math.sin(t * 2.3 + seed) * 0.25;
    f.armL.rotation.z = 1.0 + Math.sin(t * 1.3 + seed) * 0.15;
    f.root.rotation.y = rot + Math.sin(t * 0.3) * 0.15;
  });
  return f;
}

// ------------------------------------------------------------------ weapons

interface GunOpts { rate: number; base?: number; amp?: number; seed?: number }

/**
 * Early levels: a sentry aiming a rifle. The yaw pivot turns the whole figure,
 * the pitch pivot (shoulder) elevates arms and rifle. Idle: dwell-and-turn scan,
 * and every so often the rifle comes down to low ready and binoculars go up.
 */
function rifleman(k: Kit, x: number, y: number, z: number, o: GunOpts & { scope?: boolean; bino?: number; bipod?: boolean }) {
  const base = o.base ?? -Math.PI / 4, amp = o.amp ?? 1.3, seed = o.seed ?? 0;
  const yaw = new THREE.Group();
  yaw.position.set(x, y, z);
  yaw.rotation.y = base;
  k.add(yaw);
  const f = figure(seed, OLIVE, 'helmet');
  yaw.add(f.root);
  // Webbing, pouches and a small pack
  part(f.root, bx(0.07, 0.15, 0.13), OLIVE_D, -0.095, 0.37, 0);
  part(f.root, bx(0.04, 0.05, 0.16), '#3e4a28', 0.065, 0.31, 0);
  const pitch = new THREE.Group();
  pitch.position.set(0, 0.45, 0);
  yaw.add(pitch);
  const hold = new THREE.Group();
  pitch.add(hold);
  f.root.remove(f.armL, f.armR);
  f.armR.position.set(0, 0, 0.105);
  f.armL.position.set(0, 0, -0.105);
  hold.add(f.armR, f.armL);
  f.armR.rotation.set(0, 0.3, 1.62);
  f.armL.rotation.set(0, -0.75, 1.55);
  const gun = new THREE.Group();
  gun.position.set(0, 0.035, 0.055);
  hold.add(gun);
  part(gun, bx(0.13, 0.05, 0.035), '#3a3f2c', 0.0, -0.005, 0);
  part(gun, bx(0.17, 0.055, 0.042), GUN, 0.14, 0.0, 0);
  const mag = part(gun, bx(0.035, 0.085, 0.03), GUN, 0.15, -0.06, 0);
  mag.rotation.z = 0.2;
  part(gun, bx(0.03, 0.06, 0.03), GUN, 0.07, -0.05, 0);
  part(gun, bx(0.13, 0.045, 0.048), OLIVE_D, 0.28, 0.0, 0);
  beam(k, 0.34, 0, 0, 0.46, 0, 0, 0.011, GUN, 5, gun);
  part(gun, bx(0.02, 0.04, 0.01), GUN, 0.42, 0.025, 0);
  if (o.scope) {
    part(gun, new THREE.CylinderGeometry(0.018, 0.018, 0.12, 6).rotateZ(Math.PI / 2), GUN, 0.14, 0.05, 0);
    part(gun, new THREE.CylinderGeometry(0.016, 0.016, 0.005, 6).rotateZ(Math.PI / 2), glow('#7fd6ff', 0.6), 0.2, 0.05, 0);
  }
  if (o.bipod) for (const s of [-1, 1]) beam(k, 0.36, -0.01, s * 0.008, 0.44, -0.12, s * 0.04, 0.006, GUN, 4, gun);
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0.48, 0, 0);
  gun.add(muzzle);
  // Binocular arm (left), shown when the rifle is lowered
  const bino = new THREE.Group();
  bino.position.set(0, 0.45, -0.105);
  part(bino, new THREE.BoxGeometry(0.05, 0.18, 0.05).translate(0, -0.09, 0), OLIVE, 0, 0, 0);
  part(bino, bx(0.05, 0.05, 0.1), GUN, 0.0, -0.2, 0.0);
  bino.rotation.set(0, -0.64, 2.13);
  bino.visible = false;
  yaw.add(bino);
  const binoShare = o.bino ?? 0.22;
  let tur: Turret | null = null;
  k.anims.push((t) => {
    const P = 14, c = (((t + seed * 5) % P) + P) % P / P;
    const s = 1 - binoShare;
    let u = c < s ? 0 : c < s + 0.04 ? (c - s) / 0.04 : c < 0.96 ? 1 : (1 - c) / 0.04;
    if (tur?.target) u = 0;
    u = smooth(clamp01(u));
    hold.rotation.z = -1.2 * u;
    f.armL.visible = u < 0.6;
    bino.visible = u >= 0.6;
    // Shift weight from foot to foot
    f.legL.rotation.z = Math.sin(t * 0.7 + seed) * 0.06;
    f.legR.rotation.z = -Math.sin(t * 0.7 + seed) * 0.06;
  });
  tur = k.turret({
    yaw, pitch, muzzles: [muzzle], recoil: [gun], weapon: 'rifle', targets: 'both', rate: o.rate, turnRate: 3, kick: 0.035,
    idle: (t) => {
      yaw.rotation.y = base + amp * scan(t, 0.3, seed);
      pitch.rotation.z = 0.05 * Math.sin(t * 0.6 + seed);
    },
  });
  return tur;
}

/**
 * Mid levels: a GPMG on a pintle (or tripod) with the gunner standing behind.
 * The yaw pivot carries gunner, cradle and shield; pitch elevates the gun; the
 * receiver group kicks back on each burst.
 */
function gpmg(k: Kit, x: number, y: number, z: number, o: GunOpts & { pintle?: number; shield?: boolean; tripod?: boolean; shieldColor?: string; hat?: Hat }) {
  const ph = o.pintle ?? 0.4, base = o.base ?? -Math.PI / 4, amp = o.amp ?? 1.4, seed = o.seed ?? 0;
  if (o.tripod) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      beam(k, x, y + ph - 0.05, z, x + Math.cos(a) * 0.22, y, z + Math.sin(a) * 0.22, 0.014, GUN, 4);
    }
    k.cyl(0.03, 0.1, GUN, x, y + ph - 0.1, z, 6);
  } else {
    k.cyl(0.11, 0.04, GUN, x, y, z, 8);
    k.cyl(0.028, ph - 0.03, '#40464b', x, y + 0.04, z, 6);
  }
  const yaw = new THREE.Group();
  yaw.position.set(x, y + ph, z);
  yaw.rotation.y = base;
  k.add(yaw);
  part(yaw, bx(0.1, 0.05, 0.12), GUN, 0, -0.025, 0);
  for (const s of [-1, 1]) part(yaw, bx(0.04, 0.08, 0.015), GUN, 0, 0.02, s * 0.055);
  // Gunner behind the gun, hands on the grips
  const f = figure(seed + 1, OLIVE, o.hat ?? 'helmet');
  f.root.position.set(-0.42, -ph, 0);
  f.armR.rotation.set(0, 0.25, 1.4);
  f.armL.rotation.set(0, -0.25, 1.4);
  part(f.root, bx(0.07, 0.15, 0.13), OLIVE_D, -0.095, 0.37, 0);
  yaw.add(f.root);
  const pitch = new THREE.Group();
  pitch.position.set(0, 0.04, 0);
  yaw.add(pitch);
  const slide = new THREE.Group();
  pitch.add(slide);
  part(slide, bx(0.3, 0.085, 0.085), GUN, 0.02, 0, 0);
  part(slide, bx(0.16, 0.022, 0.09), '#3a3f44', 0.0, 0.05, 0);
  part(slide, bx(0.17, 0.07, 0.05), GUN, -0.2, -0.01, 0);
  part(slide, bx(0.03, 0.09, 0.06), GUN, -0.29, -0.015, 0);
  part(slide, bx(0.03, 0.07, 0.035), GUN, -0.08, -0.07, 0);
  beam(k, 0.17, 0, 0, 0.62, 0, 0, 0.017, GUN, 6, slide);
  beam(k, 0.17, -0.03, 0, 0.5, -0.03, 0, 0.009, GUN, 4, slide);
  part(slide, bx(0.05, 0.03, 0.02), GUN, 0.32, 0.03, 0);
  part(slide, new THREE.CylinderGeometry(0.026, 0.026, 0.06, 6).rotateZ(Math.PI / 2), '#1f2326', 0.63, 0, 0);
  part(slide, bx(0.012, 0.04, 0.012), GUN, 0.6, 0.035, 0);
  for (const s of [-1, 1]) beam(k, 0.46, -0.02, s * 0.01, 0.27, -0.05, s * 0.03, 0.006, GUN, 4, slide);
  // Ammo box and a short belt swinging from it
  part(pitch, bx(0.11, 0.1, 0.07), OLIVE, 0.0, -0.08, -0.085);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.11, 0.012), mat(BRASS));
  belt.position.set(0.03, -0.18, -0.06);
  pitch.add(belt);
  k.swing(belt, 0, 0.5, seed + 3);
  if (o.shield) {
    const sc = o.shieldColor ?? STEEL;
    part(yaw, bx(0.022, 0.3, 0.44), sc, 0.15, 0.0, 0);
    part(yaw, bx(0.026, 0.06, 0.12), '#1f2326', 0.15, 0.02, 0);
    for (const s of [-1, 1]) {
      const w = part(yaw, bx(0.02, 0.26, 0.14), sc, 0.12, -0.01, s * 0.27);
      w.rotation.y = s * 0.5;
    }
    for (const s of [-1, 1]) for (const yy of [-0.11, 0.11]) part(yaw, bx(0.03, 0.018, 0.018), '#8a9196', 0.16, yy, s * 0.18);
  }
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0.67, 0, 0);
  slide.add(muzzle);
  return k.turret({
    yaw, pitch, muzzles: [muzzle], recoil: [slide], weapon: 'rifle', targets: 'both', rate: o.rate, turnRate: 2.6, kick: 0.05,
    idle: (t) => {
      yaw.rotation.y = base + amp * scan(t, 0.25, seed, 1.6);
      pitch.rotation.z = 0.06 * Math.sin(t * 0.5 + seed) + 0.02;
    },
  });
}

/**
 * Command/secure levels: remote weapon station. Twin MGs on an elevating
 * cradle, an optics block with a glowing lens, ammo bins on the flanks.
 */
function rws(k: Kit, x: number, y: number, z: number, o: GunOpts & { body?: string; trim?: string; lens?: string; dome?: boolean; heavy?: boolean; gold?: boolean; smoke?: boolean; scale?: number }) {
  const body = o.body ?? '#e8e6e0', trim = o.trim ?? '#3a4045', lens = o.lens ?? '#3fd1ff';
  const base = o.base ?? -Math.PI / 4, amp = o.amp ?? 1.6, seed = o.seed ?? 0, s = o.scale ?? 1;
  k.cyl(0.3 * s, 0.08, trim, x, y, z, 12);
  if (o.gold) k.cyl(0.31 * s, 0.025, GOLD, x, y + 0.055, z, 12);
  const yaw = new THREE.Group();
  yaw.position.set(x, y + 0.08, z);
  yaw.rotation.y = base;
  yaw.scale.setScalar(s);
  k.add(yaw);
  part(yaw, new THREE.CylinderGeometry(0.27, 0.28, 0.05, 12), trim, 0, 0.025, 0);
  if (o.dome) {
    part(yaw, new THREE.SphereGeometry(0.34, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), body, 0, 0.05, 0);
    part(yaw, new THREE.CylinderGeometry(0.345, 0.345, 0.04, 12), trim, 0, 0.07, 0);
    part(yaw, bx(0.1, 0.1, 0.1), trim, -0.06, 0.4, 0);
    part(yaw, bx(0.03, 0.05, 0.08), glow(lens, 1.2), -0.005, 0.42, 0);
    for (const a of [-0.9, 0.9]) part(yaw, bx(0.05, 0.03, 0.03), '#8a9196', Math.cos(a) * 0.3, 0.12, Math.sin(a) * 0.3);
  } else {
    part(yaw, bx(0.46, 0.24, 0.38), body, -0.04, 0.17, 0);
    part(yaw, bx(0.36, 0.06, 0.3), body, -0.07, 0.31, 0);
    part(yaw, bx(0.47, 0.025, 0.39), trim, -0.04, 0.07, 0);
    for (const sz of [-1, 1]) {
      part(yaw, bx(0.26, 0.17, 0.09), o.heavy ? trim : body, -0.08, 0.17, sz * 0.24);
      part(yaw, bx(0.27, 0.025, 0.095), trim, -0.08, 0.26, sz * 0.24);
    }
    // Optics block with glowing lens and laser rangefinder
    part(yaw, bx(0.17, 0.13, 0.13), trim, 0.02, 0.4, -0.1);
    part(yaw, new THREE.CylinderGeometry(0.04, 0.04, 0.02, 10).rotateZ(Math.PI / 2), glow(lens, 1.1), 0.11, 0.4, -0.1);
    part(yaw, new THREE.CylinderGeometry(0.018, 0.018, 0.04, 6).rotateZ(Math.PI / 2), '#d8342c', 0.12, 0.4, -0.02);
    beam(k, -0.2, 0.3, 0.12, -0.2, 0.75, 0.12, 0.006, '#33383d', 4, yaw);
    if (o.gold) {
      part(yaw, bx(0.47, 0.02, 0.39), GOLD, -0.04, 0.28, 0);
      part(yaw, bx(0.18, 0.015, 0.14), GOLD, 0.02, 0.47, -0.1);
    }
  }
  if (o.smoke) for (const sz of [-1, 1]) for (let i = 0; i < 3; i++) {
    const tube = part(yaw, new THREE.CylinderGeometry(0.022, 0.022, 0.09, 6), trim, -0.2 + i * 0.07, 0.36, sz * 0.2);
    tube.rotation.x = sz * 0.6;
  }
  const pitch = new THREE.Group();
  pitch.position.set(0.17, 0.17, 0);
  yaw.add(pitch);
  part(pitch, bx(0.12, 0.16, 0.3), trim, 0.0, 0, 0);
  const muzzles: THREE.Object3D[] = [];
  const recoil: THREE.Object3D[] = [];
  const len = o.heavy ? 0.74 : 0.64;
  for (const sz of [-1, 1]) {
    const sl = new THREE.Group();
    sl.position.set(0, 0, sz * 0.085);
    pitch.add(sl);
    part(sl, bx(0.2, 0.06, 0.06), trim, 0.14, 0, 0);
    beam(k, 0.24, 0, 0, len, 0, 0, o.heavy ? 0.022 : 0.017, '#2a2e32', 6, sl);
    part(sl, new THREE.CylinderGeometry(0.028, 0.028, 0.06, 6).rotateZ(Math.PI / 2), o.gold ? GOLD : '#1f2326', len, 0, 0);
    if (o.heavy) part(sl, new THREE.CylinderGeometry(0.03, 0.03, 0.12, 6).rotateZ(Math.PI / 2), '#3a4045', 0.32, 0, 0);
    const m = new THREE.Object3D();
    m.position.set(len + 0.04, 0, 0);
    sl.add(m);
    muzzles.push(m);
    recoil.push(sl);
  }
  return k.turret({
    yaw, pitch, muzzles, recoil, weapon: 'rifle', targets: 'both', rate: o.rate, turnRate: 3.4, kick: 0.05,
    idle: (t) => {
      yaw.rotation.y = base + amp * scan(t, 0.42, seed, 4);
      pitch.rotation.z = 0.12 * scan(t, 0.3, seed + 2, 3) + 0.02;
    },
  });
}

// ------------------------------------------------------------------ Field 1–3

function field(k: Kit, level: number, y0: number, rate: number) {
  if (level === 1) {
    // Lookout stand: low log stand, sandbagged deck, leaning ladder, rifleman
    const cx = 0, cz = -0.2, hw = 0.46, D = 0.84;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const top = sz < 0 ? D + 0.42 : D + 0.06;
      beam(k, cx + sx * (hw + 0.03), y0, cz + sz * (hw + 0.03), cx + sx * hw, top, cz + sz * hw, 0.05, sx * sz > 0 ? LOG : LOG_D, 6);
    }
    for (const sz of [-1, 1]) beam(k, cx - hw - 0.06, D - 0.08, cz + sz * hw, cx + hw + 0.06, D - 0.08, cz + sz * hw, 0.034, LOG_D, 6);
    planks(k, cx, cz, 1.06, 1.06, D, 5);
    beam(k, cx - hw, D + 0.36, cz - hw, cx + hw, D + 0.36, cz - hw, 0.026, LOG, 5);
    beam(k, cx - hw, D + 0.18, cz - hw, cx + hw, D + 0.18, cz - hw, 0.02, LOG, 5);
    beam(k, cx - hw, y0 + 0.06, cz - hw, cx + hw, D - 0.1, cz - hw, 0.022, LOG_D, 5);
    beam(k, cx - hw, y0 + 0.06, cz + hw, cx - hw, D - 0.1, cz - hw, 0.022, LOG_D, 5);
    bags(k, cx - 0.17, cz + 0.42, 0.66, 0, D, 2);
    bags(k, cx - 0.41, cz - 0.08, 0.58, Math.PI / 2, D, 2);
    ladder(k, cx + 0.3, cz + 0.52, y0, D, 0, 0.22, LOG_D, 0.3);
    // Ground: crates, jerry cans, a low sandbag arc, windsock
    k.crates(-0.62, 0.6, y0, 3);
    jerry(k, 0.74, 0.6, y0, 0.2);
    jerry(k, 0.62, 0.68, y0, -0.3);
    bags(k, -0.68, 0.0, 0.5, Math.PI / 2, y0, 2);
    k.box(0.16, 0.1, 0.16, SAND, 0.8, y0, -0.8);
    k.windsock(0.8, y0 + 0.1, -0.8);
    k.box(0.12, 0.02, 0.02, C.dark, cx - hw - 0.06, D, cz + hw);
    lantern(k, cx - hw - 0.1, D, cz + hw, 1);
    hang(k, cx + 0.22, D + 0.34, cz - hw - 0.03, 0.05, 0.1, 0.04, OLIVE, 2);
    patrol(k, y0, -0.5, 0.84, 0.45, 0.84, 8, 1, 'helmet');
    rifleman(k, cx + 0.02, D, cz - 0.04, { rate, seed: 0 });
    return;
  }
  if (level === 2) {
    // Timber lookout: taller braced stand, plank half-walls, ridge tarp shade, binoculars
    const cx = 0, cz = -0.2, hw = 0.5, D = 1.12, T = D + 0.7;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.08, T - y0, 0.08, sx * sz > 0 ? LOG : LOG_D, cx + sx * hw, y0, cz + sz * hw);
    const girt = (y: number) => {
      for (const sz of [-1, 1]) beam(k, cx - hw, y, cz + sz * hw, cx + hw, y, cz + sz * hw, 0.026, LOG_D, 5);
      for (const sx of [-1, 1]) beam(k, cx + sx * hw, y, cz - hw, cx + sx * hw, y, cz + hw, 0.026, LOG_D, 5);
    };
    girt(0.5);
    girt(D - 0.08);
    for (const [a, b] of [[0.12, 0.5], [0.5, D - 0.1]]) {
      beam(k, cx - hw, a, cz - hw, cx + hw, b, cz - hw, 0.02, LOG, 5);
      beam(k, cx + hw, a, cz - hw, cx - hw, b, cz - hw, 0.02, LOG, 5);
      for (const sx of [-1, 1]) beam(k, cx + sx * hw, a, cz + hw, cx + sx * hw, b, cz - hw, 0.02, LOG, 5);
    }
    planks(k, cx, cz, 1.1, 1.1, D, 5);
    k.box(1.0, 0.3, 0.035, PLANK, cx, D, cz - hw);
    for (const sx of [-1, 1]) k.box(0.035, 0.3, 1.0, PLANK, cx + sx * hw, D, cz);
    for (const yy of [0.1, 0.2]) {
      k.box(1.0, 0.012, 0.04, PLANK_D, cx, D + yy, cz - hw);
      for (const sx of [-1, 1]) k.box(0.04, 0.012, 1.0, PLANK_D, cx + sx * hw, D + yy, cz);
    }
    beam(k, cx - hw, D + 0.28, cz + hw, cx + 0.12, D + 0.28, cz + hw, 0.022, LOG, 5);
    // Ridge tarp
    beam(k, cx - hw - 0.1, T + 0.14, cz, cx + hw + 0.1, T + 0.14, cz, 0.022, LOG_D, 5);
    for (const sx of [-1, 1]) k.box(0.05, 0.16, 0.05, LOG_D, cx + sx * hw, T - 0.02, cz);
    for (const sz of [-1, 1]) {
      const half = k.box(1.34, 0.03, 0.74, sz > 0 ? CANVAS : '#ab9b6c', cx, T + 0.05, cz + sz * 0.34);
      half.rotation.x = sz * 0.3;
    }
    hang(k, cx, T - 0.04, cz + 0.72, 1.3, 0.12, 0.012, CANVAS_D, 3, 0.25);
    hang(k, cx, T - 0.04, cz - 0.72, 1.3, 0.1, 0.012, CANVAS_D, 5, 0.2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      beam(k, cx + sx * 0.66, T - 0.05, cz + sz * 0.72, cx + sx * 0.9, y0, cz + sz * (sz > 0 ? 1.08 : 0.72), 0.005, '#e8e0c8', 3);
      k.box(0.03, 0.06, 0.03, LOG_D, cx + sx * 0.9, y0, cz + sz * (sz > 0 ? 1.08 : 0.72));
    }
    ladder(k, cx + 0.28, cz + 0.55, y0, D, 0, 0.22, LOG_D, 0.32);
    // Ground: crates and drum stacked under the stand, field telephone, canteen
    k.crates(cx - 0.15, cz - 0.15, y0, 4);
    k.drum(cx + 0.28, cz - 0.2, '#4b6b3a', y0);
    jerry(k, -0.72, 0.62, y0, 0.4);
    k.box(0.05, 0.5, 0.05, LOG, -0.62, y0, 0.7);
    k.box(0.12, 0.13, 0.07, OLIVE_D, -0.62, y0 + 0.36, 0.75);
    hang(k, -0.62, y0 + 0.34, 0.8, 0.03, 0.07, 0.03, '#2a2b2d', 6, 0.6);
    hang(k, cx + hw + 0.05, D + 0.26, cz + 0.2, 0.04, 0.1, 0.05, OLIVE, 2);
    patrol(k, y0, -0.35, 0.82, 0.62, 0.82, 9, 2, 'helmet');
    rifleman(k, cx - 0.02, D, cz - 0.02, { rate, seed: 1, bino: 0.35 });
    return;
  }
  // 3: Stilt lookout: tapered log tower, sandbag parapet, zinc mono-pitch roof, rope-pulley ammo bucket
  const cx = 0, cz = -0.15, hb = 0.68, ht = 0.5, D = 1.32;
  const at = (y: number) => hb + (ht - hb) * ((y - y0) / (D - y0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) beam(k, cx + sx * hb, y0, cz + sz * hb, cx + sx * ht, D, cz + sz * ht, 0.055, sx * sz > 0 ? LOG : LOG_D, 6);
  for (const y of [0.55, 0.98]) {
    const h = at(y);
    for (const sz of [-1, 1]) beam(k, cx - h, y, cz + sz * h, cx + h, y, cz + sz * h, 0.028, LOG_D, 5);
    for (const sx of [-1, 1]) beam(k, cx + sx * h, y, cz - h, cx + sx * h, y, cz + h, 0.028, LOG_D, 5);
  }
  {
    const a = 0.14, b = 0.55, ha = at(a), hb2 = at(b);
    for (const sz of [-1, 1]) {
      beam(k, cx - ha, a, cz + sz * ha, cx + hb2, b, cz + sz * hb2, 0.02, LOG, 5);
      beam(k, cx + ha, a, cz + sz * ha, cx - hb2, b, cz + sz * hb2, 0.02, LOG, 5);
    }
    for (const sx of [-1, 1]) beam(k, cx + sx * ha, a, cz - ha, cx + sx * hb2, b, cz + hb2, 0.02, LOG, 5);
  }
  planks(k, cx, cz, 1.2, 1.2, D, 6);
  bags(k, cx, cz - 0.52, 1.0, 0, D, 3);
  for (const sx of [-1, 1]) bags(k, cx + sx * 0.52, cz, 0.86, Math.PI / 2, D, 3);
  bags(k, cx + 0.2, cz + 0.52, 0.6, 0, D, 3);
  // Zinc mono-pitch roof, high at the back
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.06, sz < 0 ? 0.92 : 0.74, 0.06, LOG_D, cx + sx * 0.56, D, cz + sz * 0.56);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.035, 1.42), mat(C.zinc, {}, 'zinc'));
  roof.position.set(cx, D + 0.86, cz);
  roof.rotation.x = 0.13;
  k.add(roof);
  k.box(1.44, 0.04, 0.05, LOG_D, cx, D + 0.72, cz + 0.62);
  ladder(k, cx - 0.22, cz + 0.6, y0, D, 0, 0.22, LOG_D, 0.3);
  lantern(k, cx - 0.3, D + 0.72, cz + 0.4, 2);
  // Pulley gantry on the right with an ammo bucket hauled up and down
  const px = cx + 0.86, pz = cz - 0.25, py = D + 0.62;
  beam(k, cx + 0.56, py, pz, px + 0.04, py, pz, 0.025, LOG_D, 5);
  beam(k, cx + 0.56, py - 0.3, pz, px - 0.04, py, pz, 0.018, LOG_D, 5);
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 10).rotateX(Math.PI / 2), mat('#5c6166'));
  wheel.position.set(px, py - 0.06, pz);
  k.add(wheel);
  part(wheel, bx(0.1, 0.012, 0.035), '#33383d', 0, 0, 0);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 4).translate(0, -0.5, 0), mat('#d9cfae'));
  rope.position.set(px + 0.06, py - 0.06, pz);
  k.add(rope);
  const bucket = new THREE.Group();
  part(bucket, new THREE.CylinderGeometry(0.07, 0.055, 0.12, 8), '#6b6f63', 0, -0.06, 0);
  part(bucket, bx(0.1, 0.05, 0.06), OLIVE, 0, 0.0, 0);
  bucket.position.set(px + 0.06, 0, pz);
  k.add(bucket);
  beam(k, px - 0.06, py - 0.06, pz, 0.6, y0 + 0.4, 0.55, 0.005, '#d9cfae', 3);
  const hauler = figure(4, OLIVE, 'helmet');
  hauler.root.position.set(0.5, y0, 0.66);
  hauler.root.rotation.y = face(0.3, -0.8);
  k.add(hauler.root);
  const lowY = y0 + 0.14, highY = D + 0.2;
  k.anims.push((t) => {
    const c = (t % 10) / 10;
    const u = c < 0.4 ? smooth(c / 0.4) : c < 0.55 ? 1 : c < 0.85 ? 1 - smooth((c - 0.55) / 0.3) : 0;
    const by = lowY + (highY - lowY) * u;
    bucket.position.y = by;
    rope.scale.y = Math.max(0.05, py - 0.06 - by);
    wheel.rotation.z = -by / 0.06;
    const pulling = c < 0.4;
    hauler.armR.rotation.z = 2.4 + (pulling ? Math.sin(t * 8) * 0.5 : 0);
    hauler.armL.rotation.z = 2.4 - (pulling ? Math.sin(t * 8) * 0.5 : 0);
  });
  bags(k, cx - 0.4, 0.75, 0.6, 0, y0, 2);
  k.crates(-0.75, -0.62, y0, 2);
  ammoBox(k, 0.75, 0.68, y0, 0.3);
  rifleman(k, cx - 0.04, D, cz - 0.04, { rate, seed: 2, bipod: true });
}

// ------------------------------------------------------------------ Camp 4–6

function camp(k: Kit, level: number, y0: number, rate: number) {
  if (level === 4) {
    // Sentry post: cream guard room, roof deck with green rails, red hip pavilion, scoped rifle
    const cz = -0.15, w = 1.3;
    const h = k.block(w, w, 1, 0, y0, cz);
    k.door('front', 0, cz, w, w, -0.28, y0);
    k.window('left', 0, cz, w, w, 0, y0 + 0.42, 0.34, 0.3, true);
    k.window('front', 0, cz, w, w, 0.3, y0 + 0.42, 0.3, 0.28);
    const D = y0 + h + 0.06;
    k.box(w + 0.1, 0.06, w + 0.1, '#bdb8ad', 0, y0 + h, cz);
    railSide(k, -0.66, cz - 0.66, 0.66, cz - 0.66, D, 0.3);
    railSide(k, -0.66, cz - 0.66, -0.66, cz + 0.66, D, 0.3);
    railSide(k, -0.66, cz + 0.66, 0.66, cz + 0.66, D, 0.3);
    railSide(k, 0.66, cz - 0.66, 0.66, cz - 0.1, D, 0.3);
    ladder(k, 0.7, cz + 0.22, y0, D, Math.PI / 2, 0.22, C.trim, 0.14, 0.018);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.07, 0.76, 0.07, C.trim, sx * 0.6, D, cz + sz * 0.6);
    k.hipRoof(1.2, 1.2, 0.5, 0, D + 0.76, cz, C.roof, 0.14);
    pennant(k, 0, D + 0.76 + 0.48, cz, 0.42);
    // Alarm bell under the eave
    k.box(0.14, 0.02, 0.02, C.trim, -0.66, D + 0.66, cz + 0.6);
    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.08, 8).translate(0, -0.04, 0), mat(BRASS));
    bell.position.set(-0.72, D + 0.66, cz + 0.6);
    k.add(bell);
    k.anims.push((t) => (bell.rotation.z = Math.sin(t * 2.2) * 0.25 * (Math.sin(t * 0.3) > 0.6 ? 1 : 0.2)));
    bags(k, -0.2, cz - 0.52, 0.8, 0, D, 2);
    board(k, 'SENTRY', 0.4, 0.13, 0.3, y0 + 0.66, cz + w / 2 + 0.03, C.trim, '#ffffff');
    k.aircon(-0.74, y0 + 0.3, cz - 0.3, -Math.PI / 2);
    for (let i = 0; i < 3; i++) k.box(0.06, 0.08, 0.06, '#d8342c', -0.2 + i * 0.1, y0 + 0.5, cz - w / 2 - 0.04);
    k.box(0.36, 0.02, 0.04, C.trim, -0.1, y0 + 0.5, cz - w / 2 - 0.03);
    ammoBox(k, 0.7, 0.7, y0, 0.2);
    patrol(k, y0, -0.7, 0.78, 0.4, 0.78, 9, 3, 'beret');
    rifleman(k, -0.05, D, cz + 0.02, { rate, seed: 3, scope: true });
    return;
  }
  if (level === 5) {
    // Gun post: deck on four cream columns, cream parapet, gable roof, front steel stair, GPMG arrives
    const cz = -0.15, hw = 0.55, D = 1.36;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      k.box(0.16, D - 0.1 - y0, 0.16, C.wall, sx * hw, y0, cz + sz * hw);
      k.box(0.18, 0.14, 0.18, C.trim, sx * hw, y0, cz + sz * hw);
    }
    k.box(1.42, 0.1, 1.42, C.wall, 0, D - 0.1, cz);
    k.box(1.46, 0.04, 1.46, C.trim, 0, D - 0.12, cz);
    const e = 0.67;
    wallSide(k, -e, cz - e, e, cz - e, D, 0.28, 0.07, C.wall, C.trim);
    wallSide(k, -e, cz - e, -e, cz + e, D, 0.28, 0.07, C.wall, C.trim);
    wallSide(k, e, cz - e, e, cz + e, D, 0.28, 0.07, C.wall, C.trim);
    wallSide(k, -e, cz + e, 0.22, cz + e, D, 0.28, 0.07, C.wall, C.trim);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.08, 0.74, 0.08, C.wall, sx * 0.62, D + 0.28, cz + sz * 0.62);
    k.gableRoof(1.3, 1.3, 0.42, 0, D + 1.02, cz, C.roof, 0.12, C.wall);
    // Front stair along the pad edge up to a landing
    flight(k, -0.78, y0, 0.75, 0.32, D, 0.75, 0.26, C.trim);
    k.box(0.4, 0.05, 0.3, '#9aa3a6', 0.5, D - 0.05, 0.72);
    k.box(0.05, D - 0.05 - y0, 0.05, C.trim, 0.66, y0, 0.84);
    railSide(k, 0.7, 0.58, 0.7, 0.87, D, 0.32);
    // Sandbag bunker under the deck
    bags(k, 0, cz - 0.52, 0.9, 0, y0, 3);
    bags(k, -0.52, cz, 0.8, Math.PI / 2, y0, 3);
    k.crates(0.2, cz - 0.15, y0, 3);
    handSiren(k, -0.55, D, cz - 0.55, 0.6);
    walker(k, [[-0.92, y0, 0.75], [-0.78, y0, 0.75], [0.32, D, 0.75], [0.5, D, 0.72]], 11, 5, 'helmet', true);
    patrol(k, y0, 0.84, 0.3, 0.84, -0.6, 8, 4, 'beret');
    gpmg(k, -0.06, D, cz - 0.06, { rate, seed: 4, pintle: 0.4 });
    return;
  }
  // 6: Gun tower: two-storey cream shaft, cantilevered gun deck on brackets, pyramid roof, cage ladder, GPMG with shield
  const cz = -0.15, w = 1.0, sh = 1.5;
  k.box(w, sh, w, C.wall, 0, y0, cz);
  k.box(w + 0.03, 0.16, w + 0.03, C.trim, 0, y0, cz);
  k.box(w + 0.05, 0.06, w + 0.05, C.trim, 0, y0 + 0.78, cz);
  for (const yy of [0.4, 1.12]) {
    k.box(0.06, 0.22, 0.03, '#1f2326', 0.25, y0 + yy, cz + w / 2 + 0.005);
    k.box(0.03, 0.22, 0.06, '#1f2326', -w / 2 - 0.005, y0 + yy, cz + 0.1);
  }
  k.door('front', 0, cz, w, w, -0.2, y0);
  const D = y0 + sh + 0.1;
  k.box(1.56, 0.1, 1.56, C.wall, 0, D - 0.1, cz);
  k.box(1.6, 0.04, 1.6, C.trim, 0, D - 0.12, cz);
  for (const s of [-1, 1]) {
    beam(k, s * 0.3, D - 0.42, cz + w / 2, s * 0.3, D - 0.1, cz + 0.76, 0.025, C.trim, 4);
    beam(k, -w / 2, D - 0.42, cz + s * 0.3, -0.76, D - 0.1, cz + s * 0.3, 0.025, C.trim, 4);
    beam(k, w / 2, D - 0.42, cz + s * 0.3, 0.76, D - 0.1, cz + s * 0.3, 0.025, C.trim, 4);
    beam(k, s * 0.3, D - 0.42, cz - w / 2, s * 0.3, D - 0.1, cz - 0.76, 0.025, C.trim, 4);
  }
  const e = 0.76;
  railSide(k, -e, cz - e, e, cz - e, D, 0.32);
  railSide(k, -e, cz - e, -e, cz + e, D, 0.32);
  railSide(k, -e, cz + e, e, cz + e, D, 0.32);
  railSide(k, e, cz - e, e, cz + 0.1, D, 0.32);
  bags(k, -0.1, cz + 0.68, 1.1, 0, D, 2);
  bags(k, -0.68, cz, 1.1, Math.PI / 2, D, 2);
  k.box(0.3, 0.012, 0.3, '#4a4f54', 0.58, D, cz + 0.3);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.07, 0.64, 0.07, C.trim, sx * 0.72, D, cz + sz * 0.72);
  k.hipRoof(1.44, 1.44, 0.48, 0, D + 0.64, cz, C.roof, 0.12);
  k.cyl(0.04, 0.1, C.roofDark, 0, D + 1.12, cz, 6);
  pennant(k, 0, D + 1.18, cz, 0.4);
  // Cage ladder up the right face, through a hatch in the deck
  ladder(k, w / 2 + 0.03, cz + 0.3, y0, D, Math.PI / 2, 0.22, C.trim, 0.02, 0.018, true);
  climber(k, w / 2 + 0.17, cz + 0.3, y0, D - 0.75, Math.PI, 12, 6, 'helmet');
  // Lean-to ammo store
  k.box(0.3, 0.5, 0.78, C.wall, -0.78, y0, cz + 0.05);
  const lean = k.box(0.42, 0.03, 0.9, C.zinc, -0.78, y0 + 0.52, cz + 0.05);
  lean.rotation.z = 0.25;
  board(k, 'AMMO', 0.26, 0.1, -0.78, y0 + 0.3, cz + 0.45, '#d8342c', '#ffffff');
  k.aircon(0.22, y0 + 0.3, cz - w / 2 - 0.08, Math.PI);
  ammoBox(k, 0.62, 0.72, y0, 0.4);
  patrol(k, y0, -0.6, 0.8, 0.35, 0.8, 9, 5, 'beret');
  gpmg(k, -0.08, D, cz - 0.04, { rate, seed: 5, pintle: 0.4, shield: true, shieldColor: OLIVE_D });
}

// ------------------------------------------------------------------ Base 7–10

function baseBand(k: Kit, level: number, y0: number, rate: number) {
  if (level === 7) {
    // Pillbox tower: hexagonal pillbox with firing slits, concrete stem, round sandbagged gun deck, red hex canopy
    const cx = 0, cz = -0.05, R = 0.8, ph = 0.7;
    k.cyl(R, ph, CONCRETE, cx, y0, cz, 6);
    k.cyl(R + 0.04, 0.06, '#c9c4b9', cx, y0 + ph, cz, 6);
    hexSlits(k, cx, cz, R, y0 + 0.38, [0]);
    rbox(k, 0.24, 0.46, 0.04, '#4a4f54', cx + Math.sin(Math.PI / 6) * R * 0.866, y0, cz + Math.cos(Math.PI / 6) * R * 0.866, Math.PI / 6);
    hexWall(k, cx, cz, R, y0 + ph + 0.06, 0.14, 0.08, '#c9c4b9');
    const st = y0 + ph + 0.06, top = 2.18;
    k.cyl(0.36, top - st, CONCRETE, cx, st, cz, 6);
    k.box(0.06, 0.24, 0.03, '#1f2326', cx - 0.15, st + 0.6, cz + 0.32);
    k.cyl(0.38, 0.05, C.trim, cx, st + 0.35, cz, 6);
    k.cyl(0.36, 0.26, CONCRETE, cx, top - 0.26, cz, 6, 0.74);
    k.cyl(0.76, 0.09, CONCRETE, cx, top, cz, 6);
    const D = top + 0.09;
    hexWall(k, cx, cz, 0.76, D, 0.28, 0.08, CONCRETE, C.trim);
    hexSlits(k, cx, cz, 0.76, D + 0.12, [], 0.16);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.3;
      k.box(0.04, 0.58, 0.04, C.metal, cx + Math.sin(a) * 0.58, D + 0.28, cz + Math.cos(a) * 0.58);
    }
    k.cyl(0.84, 0.05, C.trim, cx, D + 0.86, cz, 6);
    k.cyl(0.84, 0.24, C.roof, cx, D + 0.91, cz, 6, 0.12);
    beacon(k, cx, D + 1.15, cz);
    ladder(k, 0.08, cz + 0.73, y0, st, 0, 0.2, C.metal, 0.14, 0.016);
    ladder(k, cx - 0.1, cz + 0.36, st, D, 0, 0.2, C.metal, 0.02, 0.016, true);
    bags(k, -0.42, cz + 0.42, 0.5, -Math.PI / 6, st, 2);
    bags(k, 0.48, cz - 0.38, 0.5, -Math.PI / 6, st, 2);
    spotter(k, -0.48, st, cz - 0.2, -Math.PI * 0.8, 3, 'helmet');
    ammoBox(k, 0.72, 0.78, y0, 0.3);
    jerry(k, -0.8, 0.72, y0, 0.3);
    patrol(k, y0, -0.45, 0.86, 0.45, 0.86, 8, 6, 'beret');
    gpmg(k, cx - 0.1, D, cz, { rate, seed: 6, pintle: 0.4 });
    return;
  }
  if (level === 8) {
    // Lattice tower: olive steel lattice with braced bays, zig-zag stairs inside, armour-plated gun cab
    const cx = 0, cz = -0.1, hb = 0.78, ht = 0.5, D = 2.3;
    const at = (y: number) => hb + (ht - hb) * ((y - y0) / (D - y0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      beam(k, cx + sx * hb, y0, cz + sz * hb, cx + sx * ht, D, cz + sz * ht, 0.035, STEEL, 6);
      k.box(0.2, 0.12, 0.2, CONCRETE, cx + sx * hb, y0, cz + sz * hb);
      k.box(0.21, 0.04, 0.21, HAZ, cx + sx * hb, y0 + 0.08, cz + sz * hb);
    }
    const rings = [y0 + 0.08, 0.85, 1.6, D - 0.06];
    for (const y of rings) {
      const h = at(y);
      for (const sz of [-1, 1]) beam(k, cx - h, y, cz + sz * h, cx + h, y, cz + sz * h, 0.02, STEEL_D, 4);
      for (const sx of [-1, 1]) beam(k, cx + sx * h, y, cz - h, cx + sx * h, y, cz + h, 0.02, STEEL_D, 4);
    }
    for (let i = 0; i < rings.length - 1; i++) {
      const a = rings[i], b = rings[i + 1], ha = at(a), hb2 = at(b);
      for (const sz of [-1, 1]) {
        beam(k, cx - ha, a, cz + sz * ha, cx + hb2, b, cz + sz * hb2, 0.012, STEEL, 4);
        beam(k, cx + ha, a, cz + sz * ha, cx - hb2, b, cz + sz * hb2, 0.012, STEEL, 4);
      }
      for (const sx of [-1, 1]) {
        beam(k, cx + sx * ha, a, cz - ha, cx + sx * hb2, b, cz + hb2, 0.012, STEEL, 4);
        beam(k, cx + sx * ha, a, cz + ha, cx + sx * hb2, b, cz - hb2, 0.012, STEEL, 4);
      }
    }
    // Stairs: two flights with a landing
    flight(k, -0.42, y0 + 0.08, cz + 0.3, 0.28, 1.2, cz + 0.3, 0.22, STEEL_D);
    k.box(0.3, 0.04, 0.62, '#7d8570', 0.4, 1.16, cz + 0.08);
    flight(k, 0.3, 1.2, cz - 0.16, -0.28, D - 0.06, cz - 0.16, 0.22, STEEL_D);
    walker(k, [[-0.5, y0 + 0.08, cz + 0.3], [0.28, 1.2, cz + 0.3], [0.42, 1.2, cz + 0.2], [0.42, 1.2, cz - 0.16], [0.3, 1.2, cz - 0.16]], 12, 7, 'helmet', true);
    // Gun cab: steel deck and riveted armour walls
    k.box(1.24, 0.06, 1.24, '#7d8570', cx, D - 0.06, cz);
    const e = 0.6;
    for (const [x0, z0, x1, z1] of [[-e, -e, e, -e], [-e, e, e, e], [-e, -e, -e, e], [e, -e, e, e]]) {
      wallSide(k, cx + x0, cz + z0, cx + x1, cz + z1, D, 0.4, 0.05, '#64704f', STEEL_D);
      const n = 6;
      for (let i = 1; i < n; i++) {
        const u = i / n;
        const px = cx + x0 + (x1 - x0) * u, pz = cz + z0 + (z1 - z0) * u;
        const ox = z0 === z1 ? 0 : Math.sign(x0) * 0.03, oz = z0 === z1 ? Math.sign(z0) * 0.03 : 0;
        k.box(0.02, 0.02, 0.02, '#8a9196', px + ox, D + 0.34, pz + oz);
        k.box(0.02, 0.02, 0.02, '#8a9196', px + ox, D + 0.06, pz + oz);
      }
    }
    k.box(0.36, 0.08, 0.02, '#1f2326', cx, D + 0.22, cz + e + 0.02);
    k.box(0.02, 0.08, 0.36, '#1f2326', cx + e + 0.02, D + 0.22, cz);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.05, 0.62, 0.05, STEEL_D, cx + sx * 0.56, D + 0.4, cz + sz * 0.56);
    k.box(1.36, 0.06, 1.36, '#64704f', cx, D + 1.02, cz);
    k.cyl(0.34, 0.12, STEEL_D, cx, D + 1.08, cz, 4, 0.08).rotation.y = Math.PI / 4;
    anemometer(k, cx + 0.55, D + 1.08, cz - 0.55, 0.3);
    k.antenna(cx - 0.55, D + 1.08, cz - 0.55, 0.6);
    // Ammo container at the base
    k.box(0.72, 0.42, 0.42, OLIVE_D, cx - 0.05, y0, cz - 0.3);
    for (let i = 0; i < 6; i++) k.box(0.012, 0.4, 0.43, '#3a4524', cx - 0.35 + i * 0.12, y0 + 0.01, cz - 0.3);
    board(k, 'AMMO', 0.24, 0.09, cx - 0.05, y0 + 0.26, cz - 0.08, HAZ, '#2a2b2d');
    patrol(k, y0, -0.55, 0.84, 0.5, 0.84, 9, 7, 'beret');
    gpmg(k, cx - 0.08, D, cz, { rate, seed: 7, pintle: 0.42, shield: true });
    return;
  }
  if (level === 9) {
    // Bastion tower: battered plinth, crenellated gun deck, separate stair tower and bridge, flat red-edged canopy
    const tx = -0.25, tz = -0.25, w = 1.1, D = 2.32;
    k.cyl(0.93, 0.45, '#c9c4b9', tx, y0, tz, 4, 0.8).rotation.y = Math.PI / 4;
    k.box(w, D - 0.08 - y0 - 0.45, w, CONCRETE, tx, y0 + 0.45, tz);
    for (const yy of [1.0, 1.6]) k.box(w + 0.04, 0.05, w + 0.04, C.trim, tx, yy, tz);
    for (const [x, yy] of [[-0.2, 0.75], [0.2, 0.75], [-0.2, 1.3], [0.2, 1.3], [0, 1.85]]) {
      k.box(0.06, 0.2, 0.03, '#1f2326', tx + x, yy, tz + w / 2 + 0.005);
      k.box(0.03, 0.2, 0.06, '#1f2326', tx - w / 2 - 0.005, yy, tz + x);
    }
    k.box(w + 0.14, 0.1, w + 0.14, CONCRETE, tx, D - 0.1, tz);
    const e = (w + 0.14) / 2 - 0.05;
    for (const [x0, z0, x1, z1] of [[-e, -e, e, -e], [-e, e, e, e], [-e, -e, -e, e], [e, -e, e, e]]) {
      wallSide(k, tx + x0, tz + z0, tx + x1, tz + z1, D, 0.14, 0.1, CONCRETE);
      for (let i = 0; i <= 4; i++) {
        const u = i / 4;
        k.box(0.16, 0.16, 0.12, CONCRETE, tx + x0 + (x1 - x0) * u, D + 0.14, tz + z0 + (z1 - z0) * u);
      }
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.12, 0.66, 0.12, CONCRETE, tx + sx * 0.52, D + 0.14, tz + sz * 0.52);
    k.box(1.38, 0.1, 1.38, CONCRETE, tx, D + 0.8, tz);
    k.box(1.4, 0.07, 1.4, C.roof, tx, D + 0.79, tz);
    // Camouflage net draped over the canopy: olive sheet with darker blotches and sagging edges
    k.box(1.3, 0.03, 1.3, '#6b7a4a', tx, D + 0.9, tz);
    for (const [bxp, bzp, bw, bd] of [[-0.3, -0.25, 0.4, 0.3], [0.25, 0.2, 0.35, 0.45], [0.3, -0.35, 0.3, 0.25], [-0.25, 0.35, 0.3, 0.3]]) {
      k.box(bw, 0.035, bd, '#4f5c33', tx + bxp, D + 0.905, tz + bzp);
    }
    for (const [x0, z0, rr] of [[0, 0.66, 0], [0.66, 0, Math.PI / 2], [0, -0.66, 0], [-0.66, 0, Math.PI / 2]]) {
      const flap = rbox(k, 1.2, 0.14, 0.02, '#5d6b3e', tx + x0, D + 0.78, tz + z0, rr);
      k.anims.push((t) => (flap.rotation.x = Math.sin(t * 1.3 + x0 * 3 + z0) * 0.08));
    }
    for (let i = 0; i < 4; i++) {
      const tuft = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(i % 2 ? '#4f7a2e' : '#6b8a3a'));
      tuft.position.set(tx - 0.45 + i * 0.3, D + 0.95, tz + (i % 2 ? 0.4 : -0.42));
      k.add(tuft);
    }
    pennant(k, tx - 0.55, D + 0.9, tz - 0.55, 0.45);
    // Stair tower with stepped windows, linked by a bridge
    const sx0 = 0.62, sz0 = 0.05, sw = 0.5;
    k.box(sw, D - y0, sw, '#cfcac0', sx0, y0, sz0);
    k.box(sw + 0.03, 0.14, sw + 0.03, C.trim, sx0, y0, sz0);
    for (let i = 0; i < 5; i++) k.box(0.1, 0.06, 0.03, '#1f2326', sx0 - 0.12 + (i % 2) * 0.24, y0 + 0.5 + i * 0.32, sz0 + sw / 2 + 0.005);
    k.door('front', sx0, sz0, sw, sw, 0, y0, 0.24, 0.5, '#4a4f54');
    k.hipRoof(sw, sw, 0.26, sx0, D + 0.04, sz0, C.roof, 0.06);
    k.box(0.22, 0.06, 0.3, CONCRETE, 0.36, D - 0.1, sz0);
    railSide(k, 0.27, sz0 - 0.15, 0.4, sz0 - 0.15, D - 0.04, 0.26, C.trim);
    railSide(k, 0.27, sz0 + 0.15, 0.4, sz0 + 0.15, D - 0.04, 0.26, C.trim);
    cctv(k, sx0 + 0.18, D + 0.28, sz0 + 0.18, 0.12, -Math.PI / 4);
    // Front emplacement and patrol
    bags(k, -0.45, 0.78, 0.9, 0, y0, 2);
    bags(k, 0.62, 0.62, 0.4, 0, y0, 2);
    k.box(0.5, 0.06, 0.36, HAZ, -0.85 + 0.25, y0, 0.55);
    ammoBox(k, 0.75, -0.6, y0, 0.2);
    ammoBox(k, 0.72, -0.78, y0, -0.1);
    // Loader kneeling beside the gun, feeding the belt
    const ld = figure(8, OLIVE, 'helmet');
    ld.root.position.set(tx - 0.3, D - 0.1, tz + 0.25);
    ld.root.rotation.y = face(0.3, -0.3);
    ld.legL.rotation.z = 1.3;
    ld.legR.rotation.z = -0.2;
    part(ld.root, bx(0.14, 0.09, 0.1), OLIVE, 0.12, 0.05, 0.08);
    k.add(ld.root);
    k.anims.push((t) => {
      ld.armR.rotation.z = 1.0 + Math.sin(t * 2.4) * 0.35;
      ld.armL.rotation.z = 0.8 + Math.sin(t * 2.4 + 1) * 0.25;
    });
    patrol(k, y0, -0.85, 0.88, 0.1, 0.88, 8, 8, 'beret');
    gpmg(k, tx + 0.05, D, tz - 0.05, { rate, seed: 8, pintle: 0.42, shield: true });
    return;
  }
  // 10: Keep tower (release cap): perimeter blast wall, big concrete keep, corbelled gun deck, red hip roof, gunner and spotter
  const cz = -0.12, w = 1.22, D = 2.2;
  // Perimeter wall with sandbag cap and a front gateway
  const pe = 0.86;
  for (const [x0, z0, x1, z1] of [[-pe, -pe, pe, -pe], [-pe, -pe, -pe, pe], [pe, -pe, pe, pe], [-pe, pe, -0.3, pe], [0.3, pe, pe, pe]]) {
    wallSide(k, x0, z0, x1, z1, y0, 0.3, 0.1, CONCRETE, C.trim);
  }
  for (const s of [-1, 1]) {
    k.box(0.14, 0.5, 0.14, CONCRETE, s * 0.3, y0, pe);
    k.box(0.16, 0.04, 0.16, HAZ, s * 0.3, y0 + 0.5, pe);
  }
  bags(k, -0.6, pe, 0.5, 0, y0 + 0.34, 1);
  bags(k, 0.6, pe, 0.5, 0, y0 + 0.34, 1);
  // Keep shaft
  k.box(w, D - 0.1 - y0, w, CONCRETE, 0, y0, cz);
  k.box(w + 0.03, 0.16, w + 0.03, C.trim, 0, y0, cz);
  for (const yy of [0.98, 1.72]) k.box(w + 0.05, 0.05, w + 0.05, C.trim, 0, yy, cz);
  for (const yy of [1.2, 1.9]) for (const x of [-0.22, 0.22]) {
    k.box(0.06, 0.24, 0.03, '#1f2326', x, yy - 0.12, cz + w / 2 + 0.005);
    k.box(0.03, 0.24, 0.06, '#1f2326', w / 2 + 0.005, yy - 0.12, cz + x);
    k.box(0.03, 0.24, 0.06, '#1f2326', -w / 2 - 0.005, yy - 0.12, cz + x);
  }
  k.door('front', 0, cz, w, w, -0.15, y0, 0.36, 0.6);
  board(k, 'SENTRY TOWER', 0.6, 0.14, -0.15, y0 + 0.72, cz + w / 2 + 0.03, C.trim, '#ffffff', 0, 30);
  for (let i = 0; i < 4; i++) {
    const u = -0.45 + i * 0.3;
    k.box(0.12, 0.16, 0.18, CONCRETE, u, D - 0.26, cz + w / 2 + 0.05);
    k.box(0.12, 0.16, 0.18, CONCRETE, u, D - 0.26, cz - w / 2 - 0.05);
    k.box(0.18, 0.16, 0.12, CONCRETE, w / 2 + 0.05, D - 0.26, cz + u);
    k.box(0.18, 0.16, 0.12, CONCRETE, -w / 2 - 0.05, D - 0.26, cz + u);
  }
  k.box(1.6, 0.1, 1.6, CONCRETE, 0, D - 0.1, cz);
  k.box(1.64, 0.04, 1.64, C.trim, 0, D - 0.12, cz);
  const e = 0.76;
  wallSide(k, -e, cz - e, e, cz - e, D, 0.26, 0.08, CONCRETE, C.trim);
  wallSide(k, -e, cz - e, -e, cz + e, D, 0.26, 0.08, CONCRETE, C.trim);
  wallSide(k, e, cz - e, e, cz + e, D, 0.26, 0.08, CONCRETE, C.trim);
  wallSide(k, -e, cz + e, e, cz + e, D, 0.26, 0.08, CONCRETE, C.trim);
  bags(k, -0.2, cz + e - 0.1, 0.9, 0, D, 1);
  // Castle crown: round corner bartizans with red cone caps around a central gun canopy
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * 0.74, z = cz + sz * 0.74;
    k.cyl(0.11, 0.2, CONCRETE, x, D - 0.36, z, 10, 0.2);
    k.cyl(0.22, 0.62, CONCRETE, x, D - 0.16, z, 10);
    k.cyl(0.235, 0.05, C.trim, x, D + 0.42, z, 10);
    k.box(0.05, 0.14, 0.03, '#1f2326', x + sx * 0.0, D + 0.18, z + sz * 0.215);
    k.cyl(0.27, 0.42, C.roof, x, D + 0.46, z, 10, 0.02);
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.1, 0.62, 0.1, CONCRETE, sx * 0.42, D, cz + sz * 0.42);
  k.hipRoof(0.9, 0.9, 0.4, 0, D + 0.62, cz, C.roofDark, 0.14);
  pennant(k, 0, D + 1.0, cz, 0.55, '#d8342c');
  ladder(k, w / 2 + 0.03, cz - 0.25, y0, D, Math.PI / 2, 0.22, C.trim, 0.02, 0.018, true);
  k.aircon(-w / 2 - 0.08, y0 + 0.3, cz - 0.2, -Math.PI / 2);
  k.lamp(0.45, cz + w / 2 + 0.02, y0 + 0.9, 0.2);
  cctv(k, 0.3, y0 + 0.54, pe, 0.2, Math.PI / 2);
  spotter(k, 0.32, D, cz + 0.5, -Math.PI / 4, 9, 'helmet');
  patrol(k, y0, -0.62, 0.62, 0.62, 0.62, 10, 9, 'beret');
  gpmg(k, -0.12, D, cz - 0.1, { rate, seed: 9, pintle: 0.42, shield: true });
}

// ------------------------------------------------------------------ Command 11–15

function command(k: Kit, level: number, y0: number, rate: number) {
  void y0;
  if (level === 11) {
    // Remote gun tower: white finned shaft on a podium, cantilevered glass operator pod, first RWS on the roof
    const y1 = podium(k, 1.76, 1.76, 0.26);
    const sx = -0.28, sz = -0.3, sw = 0.92, top = 3.05;
    k.box(sw, top - y1, sw, C.white, sx, y1, sz);
    k.box(sw - 0.3, top - y1 - 0.7, 0.02, DARK_GLASS, sx, y1 + 0.35, sz + sw / 2 + 0.005);
    k.fins(sw - 0.24, top - y1 - 0.6, sx, y1 + 0.3, sz + sw / 2 + 0.06, 5);
    k.box(sw + 0.03, 0.09, sw + 0.03, TEAL, sx, top - 0.3, sz);
    k.box(sw + 0.08, 0.08, sw + 0.08, C.white, sx, top, sz);
    k.box(0.34, 0.5, 0.03, '#86b7cc', sx - 0.1, y1, sz + sw / 2 + 0.01);
    k.box(0.4, 0.04, 0.05, TEAL, sx - 0.1, y1 + 0.5, sz + sw / 2 + 0.02);
    // Operator pod
    const px = 0.55, pz = -0.22, py = 1.78, pw = 0.66, pd = 0.86, phh = 0.52;
    k.box(pw + 0.04, 0.07, pd + 0.04, C.white, px, py - 0.07, pz);
    const pod = new THREE.Mesh(new THREE.BoxGeometry(pw, phh, pd), GLASS());
    pod.position.set(px, py + phh / 2, pz);
    k.add(pod);
    for (const ax of [-1, 1]) for (const az of [-1, 1]) k.box(0.04, phh, 0.04, C.trim, px + ax * (pw / 2), py, pz + az * (pd / 2));
    k.box(pw + 0.1, 0.07, pd + 0.1, C.roofGreen, px, py + phh, pz);
    k.box(pw + 0.12, 0.03, pd + 0.12, TEAL, px, py + phh - 0.02, pz);
    beam(k, sx + sw / 2, py - 0.6, pz, px + 0.26, py - 0.07, pz, 0.03, C.white, 5);
    k.box(0.3, 0.18, 0.04, '#33383d', px + 0.1, py + 0.1, pz + 0.3);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.01), glow('#3fd1ff', 0.9));
    screen.position.set(px + 0.1, py + 0.24, pz + 0.32);
    k.add(screen);
    operator(k, px + 0.05, py, pz - 0.1, face(0.1, 1), 4);
    cctv(k, px + 0.25, py + phh + 0.07, pz + 0.35, 0.18, -Math.PI / 4);
    k.aircon(sx, y1 + 0.3, sz - sw / 2 - 0.08, Math.PI);
    beacon(k, sx + 0.38, top + 0.08, sz - 0.38, '#ff3b30', 0.04);
    k.planter(0.55, 0.62, 0.5, y1);
    patrol(k, y1, -0.7, 0.68, 0.0, 0.68, 8, 10, 'beret');
    rws(k, sx, top + 0.08, sz, { rate, seed: 10 });
    return;
  }
  if (level === 12) {
    // Lift tower: open white frame with a glass lift shaft and moving car, hexagonal glass gun pod, green roof
    const y1 = podium(k, 1.78, 1.78, 0.26);
    const cx = -0.05, cz = -0.2, hw = 0.42, P = 2.5;
    for (const ax of [-1, 1]) for (const az of [-1, 1]) {
      k.box(0.13, P - y1, 0.13, C.white, cx + ax * hw, y1, cz + az * hw);
      k.box(0.14, 0.06, 0.14, TEAL, cx + ax * hw, y1 + 0.9, cz + az * hw);
    }
    for (const yy of [1.4]) {
      for (const az of [-1, 1]) k.box(hw * 2, 0.08, 0.08, C.white, cx, yy, cz + az * hw);
      for (const ax of [-1, 1]) k.box(0.08, 0.08, hw * 2, C.white, cx + ax * hw, yy, cz);
    }
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.36, P - y1, 0.36), M('#a9d3e2', { transparent: true, opacity: 0.35, roughness: 0.1 }));
    shaft.position.set(cx, y1 + (P - y1) / 2, cz);
    k.add(shaft);
    for (const ax of [-1, 1]) for (const az of [-1, 1]) k.box(0.025, P - y1, 0.025, C.trim, cx + ax * 0.18, y1, cz + az * 0.18);
    const car = k.box(0.28, 0.36, 0.28, TEAL, cx, y1, cz);
    k.box(0.2, 0.18, 0.01, '#bfe0ec', 0, 0.06, 0.145, car).position.y = 0;
    k.anims.push((t) => {
      const c = (t % 12) / 12;
      const u = c < 0.3 ? smooth(c / 0.3) : c < 0.5 ? 1 : c < 0.8 ? 1 - smooth((c - 0.5) / 0.3) : 0;
      car.position.y = y1 + 0.18 + (P - 0.45 - y1) * u;
    });
    // Hex pod
    k.cyl(0.82, 0.08, C.white, cx, P - 0.08, cz, 6);
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.5, 6), GLASS());
    pod.position.set(cx, P + 0.25, cz);
    k.add(pod);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      k.box(0.04, 0.5, 0.04, C.trim, cx + Math.sin(a) * 0.74, P, cz + Math.cos(a) * 0.74);
    }
    k.cyl(0.86, 0.08, C.roofGreen, cx, P + 0.5, cz, 6);
    k.cyl(0.87, 0.03, TEAL, cx, P + 0.5, cz, 6);
    operator(k, cx + 0.35, P, cz + 0.1, face(1, 1), 11);
    k.box(0.04, 0.16, 0.24, '#33383d', cx + 0.6, P + 0.08, cz + 0.2);
    cctv(k, cx - 0.6, P + 0.58, cz + 0.3, 0.14, Math.PI * 0.75);
    k.box(0.5, 0.42, 0.03, '#86b7cc', cx, y1, cz + 0.2);
    k.planter(-0.55, 0.62, 0.5, y1);
    k.planter(0.62, -0.62, 0.4, y1);
    k.waterPoint(0.66, 0.15, y1);
    patrol(k, y1, -0.75, 0.75, 0.5, 0.75, 9, 11, 'beret');
    rws(k, cx, P + 0.58, cz, { rate, seed: 11 });
    return;
  }
  if (level === 13) {
    // Sensor mast tower: white tower with teal glass corners, glazed balcony and observer, EO sensor mast
    const y1 = podium(k, 1.8, 1.8, 0.26);
    const tx = -0.22, tz = -0.25, w = 1.04, top = 3.1;
    k.box(w, top - y1, w, C.white, tx, y1, tz);
    for (const ax of [-1, 1]) for (const az of [-1, 1]) k.box(0.14, top - y1 - 0.2, 0.14, '#5fb8b0', tx + ax * (w / 2 - 0.05), y1 + 0.1, tz + az * (w / 2 - 0.05));
    for (const yy of [1.0, 1.9]) {
      k.box(w - 0.3, 0.26, 0.02, DARK_GLASS, tx, yy, tz + w / 2 + 0.005);
      k.box(0.02, 0.26, w - 0.3, DARK_GLASS, tx + w / 2 + 0.005, yy, tz);
    }
    k.box(w + 0.1, 0.08, w + 0.1, C.white, tx, top, tz);
    k.box(w + 0.11, 0.04, w + 0.11, TEAL, tx, top - 0.02, tz);
    k.box(w - 0.1, 0.03, w - 0.1, '#55a832', tx, top + 0.08, tz);
    for (const [x, z] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.3]]) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), mat('#3f8a2e'));
      b.position.set(tx + x, top + 0.16, tz + z);
      k.add(b);
    }
    // Front balcony with glass balustrade
    const by = 2.3;
    k.box(w + 0.1, 0.07, 0.36, C.white, tx, by - 0.07, tz + w / 2 + 0.18);
    const gl = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.24, 0.02), GLASS());
    gl.position.set(tx, by + 0.12, tz + w / 2 + 0.35);
    k.add(gl);
    k.box(w + 0.12, 0.03, 0.03, TEAL, tx, by + 0.24, tz + w / 2 + 0.35);
    k.box(0.3, 0.5, 0.02, '#86b7cc', tx + 0.2, by, tz + w / 2 + 0.005);
    spotter(k, tx - 0.2, by, tz + w / 2 + 0.18, -Math.PI / 2, 12, 'beret');
    // Sensor mast with EO gimbal ball
    const mx = 0.66, mz = 0.55, mh = 3.3;
    k.box(0.26, 0.08, 0.26, CONCRETE, mx, y1, mz);
    k.cyl(0.04, mh - y1, C.metal, mx, y1 + 0.08, mz, 6);
    for (let yy = y1 + 0.4; yy < mh; yy += 0.5) k.box(0.14, 0.02, 0.02, C.metal, mx, yy, mz);
    const gimbal = new THREE.Group();
    gimbal.position.set(mx, mh + 0.1, mz);
    part(gimbal, bx(0.06, 0.1, 0.06), '#d8d4ca', 0, 0.02, 0);
    const ball = new THREE.Group();
    ball.position.y = -0.06;
    part(ball, new THREE.SphereGeometry(0.09, 10, 8), '#f4f4f0', 0, 0, 0);
    part(ball, new THREE.CylinderGeometry(0.035, 0.035, 0.02, 8).rotateZ(Math.PI / 2), glow('#3fd1ff', 1.2), 0.09, 0, 0);
    gimbal.add(ball);
    k.add(gimbal);
    k.anims.push((t) => {
      gimbal.rotation.y = scan(t, 0.35, 4, 3) * 2;
      ball.rotation.z = -0.3 + Math.sin(t * 0.7) * 0.2;
    });
    anemometer(k, mx, mh + 0.16, mz, 0.18);
    k.blinker(mx, mh + 0.36, mz, '#ff3b30', 0.03);
    k.box(0.4, 0.5, 0.03, '#86b7cc', tx + 0.25, y1, tz + w / 2 + 0.01);
    k.aircon(tx - w / 2 - 0.08, y1 + 0.3, tz, -Math.PI / 2);
    k.planter(-0.5, 0.7, 0.6, y1);
    patrol(k, y1, 0.0, 0.72, 0.4, 0.72, 7, 12, 'beret');
    rws(k, tx, top + 0.08, tz, { rate, seed: 12, smoke: true });
    return;
  }
  if (level === 14) {
    // Cantilever tower: slim core carrying a wide gun deck that overhangs the front on a steel truss
    const y1 = podium(k, 1.8, 1.8, 0.26);
    const tx = -0.45, tz = -0.45, w = 0.8, top = 2.95;
    k.box(w, top - y1, w, C.white, tx, y1, tz);
    k.box(0.22, top - y1 - 0.3, 0.02, '#86b7cc', tx + 0.15, y1 + 0.1, tz + w / 2 + 0.005);
    k.box(0.02, top - y1 - 0.3, 0.22, '#86b7cc', tx + w / 2 + 0.005, y1 + 0.1, tz + 0.15);
    k.box(w + 0.03, 0.07, w + 0.03, TEAL, tx, 1.9, tz);
    // Cantilevered deck
    const dx = -0.08, dz = -0.08, dw = 1.5;
    k.box(dw, 0.1, dw, C.white, dx, top, dz);
    k.box(dw + 0.03, 0.04, dw + 0.03, TEAL, dx, top + 0.02, dz);
    const D = top + 0.1;
    const gl = (x0: number, z0: number, x1: number, z1: number) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const g = new THREE.Mesh(new THREE.BoxGeometry(len, 0.24, 0.02), GLASS());
      g.position.set((x0 + x1) / 2, D + 0.12, (z0 + z1) / 2);
      g.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
      k.add(g);
      span(k, x0, z0, x1, z1, D + 0.24, 0.03, 0.03, C.white);
    };
    const e = dw / 2 - 0.03;
    gl(dx - e, dz + e, dx + e, dz + e);
    gl(dx + e, dz - e, dx + e, dz + e);
    gl(dx - e, dz - e, dx + e, dz - e);
    gl(dx - e, dz - e, dx - e, dz + e);
    // Steel truss under the overhang
    for (const [x, z] of [[0.6, 0.6]]) {
      k.box(0.12, 0.06, 0.12, '#4a4f54', x, y1, z);
      beam(k, x, y1 + 0.06, z, x, top, z, 0.035, '#4a4f54', 6);
      beam(k, x, y1 + 0.3, z, tx + w / 2, 1.6, tz + w / 2, 0.022, '#4a4f54', 5);
      beam(k, x, 1.6, z, tx + w / 2, top - 0.02, tz + w / 2, 0.022, '#4a4f54', 5);
      beam(k, x, top - 0.02, z, tx + w / 2, 1.6, tz + w / 2, 0.018, '#4a4f54', 5);
    }
    // Rooftop kiosk with green roof and a small vertical-axis wind turbine
    k.box(0.5, 0.42, 0.5, C.white, tx + 0.05, D, tz + 0.05);
    k.box(0.12, 0.3, 0.02, '#86b7cc', tx + 0.05, D, tz + 0.31);
    k.box(0.6, 0.06, 0.6, C.roofGreen, tx + 0.05, D + 0.42, tz + 0.05);
    k.cyl(0.015, 0.2, C.metal, tx + 0.05, D + 0.48, tz + 0.05, 5);
    const vt = new THREE.Group();
    vt.position.set(tx + 0.05, D + 0.68, tz + 0.05);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const blade = part(vt, bx(0.02, 0.22, 0.06), '#f4f4f0', Math.cos(a) * 0.09, 0, Math.sin(a) * 0.09);
      blade.rotation.y = -a;
    }
    k.add(vt);
    k.anims.push((t) => (vt.rotation.y = t * 4));
    walker(k, [[dx + 0.55, D, dz - 0.6], [dx + 0.6, D, dz + 0.1], [dx + 0.2, D, dz + 0.6], [dx - 0.5, D, dz + 0.6]], 12, 13, 'beret', false);
    cctv(k, dx - 0.65, D + 0.24, dz + 0.65, 0.12, Math.PI * 0.75);
    k.box(0.34, 0.5, 0.03, '#86b7cc', tx + 0.05, y1, tz + w / 2 + 0.01);
    k.planter(-0.55, 0.62, 0.5, y1);
    k.bench(0.0, 0.72, 0.5, y1);
    patrol(k, y1, 0.75, -0.6, 0.75, 0.25, 8, 13, 'beret');
    rws(k, dx + 0.1, D, dz + 0.1, { rate, seed: 13, smoke: true });
    return;
  }
  // 15: Terrace tower: three stepped tiers with green roof terraces, teal glass bands, flags and a camera mast
  const y1 = podium(k, 1.84, 1.84, 0.26);
  const cx = -0.08, cz = -0.12;
  const tiers: [number, number][] = [[1.54, 1.25], [1.18, 2.2], [0.86, 3.08]];
  let yb = y1;
  tiers.forEach(([w, top], i) => {
    k.box(w, top - yb, w, C.white, cx, yb, cz);
    k.box(w - 0.3, 0.24, 0.02, i === 2 ? '#5fb8b0' : DARK_GLASS, cx, yb + 0.3, cz + w / 2 + 0.005);
    k.box(0.02, 0.24, w - 0.3, i === 2 ? '#5fb8b0' : DARK_GLASS, cx + w / 2 + 0.005, yb + 0.3, cz);
    if (i < 2) k.fins(w - 0.2, top - yb - 0.1, cx, yb + 0.05, cz + w / 2 + 0.06, 6);
    k.box(w + 0.08, 0.06, w + 0.08, C.roofGreen, cx, top, cz);
    k.box(w + 0.09, 0.03, w + 0.09, TEAL, cx, top - 0.02, cz);
    yb = top + 0.06;
  });
  for (const [x, z] of [[0.55, 0.5], [-0.62, 0.48], [0.58, -0.68]]) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), mat('#3f8a2e'));
    b.position.set(cx + x, 1.42, cz + z);
    k.add(b);
  }
  railSide(k, cx - 0.7, cz + 0.72, cx + 0.7, cz + 0.72, 1.31, 0.2, C.white);
  spotter(k, cx + 0.42, 2.26, cz + 0.5, -Math.PI / 4, 14, 'beret');
  k.box(0.36, 0.5, 0.03, '#86b7cc', cx, y1, cz + 0.78);
  k.box(0.42, 0.04, 0.05, TEAL, cx, y1 + 0.5, cz + 0.79);
  board(k, 'SENTRY', 0.4, 0.12, cx, y1 + 0.58, cz + 0.79, C.trim, '#ffffff');
  k.flagpole(0.8, 0.8, 1.3, y1);
  k.planter(-0.62, 0.8, 0.5, y1);
  cctv(k, cx - 0.62, 1.31, cz - 0.62, 0.2, Math.PI);
  cctv(k, cx + 0.45, 2.26, cz - 0.45, 0.16, -Math.PI / 2);
  k.antenna(cx - 0.3, yb, cz - 0.3, 0.6);
  patrol(k, y1, -0.4, 0.84, 0.3, 0.84, 8, 14, 'beret');
  rws(k, cx + 0.06, yb, cz + 0.06, { rate, seed: 14, smoke: true, heavy: true });
}

// ------------------------------------------------------------------ Secure 16–20

function secure(k: Kit, level: number, y0: number, rate: number) {
  if (level === 16) {
    // Cupola tower: T-wall ring, hardened concrete tower with a sliding blast door, armoured dome turret
    for (const [x, z, r] of [[-0.62, -0.84, 0], [-0.2, -0.84, 0], [0.22, -0.84, 0], [0.64, -0.84, 0], [-0.84, -0.4, Math.PI / 2], [-0.84, 0.02, Math.PI / 2], [-0.84, 0.44, Math.PI / 2], [0.84, -0.4, -Math.PI / 2], [0.84, 0.02, -Math.PI / 2]] as [number, number, number][]) {
      tWall(k, x, z, y0, r, 0.72);
    }
    const tx = 0, tz = -0.15, w = 1.12, top = 2.88;
    k.box(w + 0.2, 0.5, w + 0.2, DCON, tx, y0, tz);
    // Hardened apron with jersey kerbs across the front
    for (const [ax, aw] of [[-0.66, 0.4], [0.45, 0.8]]) {
      k.box(aw, 0.34, 0.5, '#a9a59c', ax, y0, 0.62);
      k.box(aw + 0.02, 0.04, 0.52, HAZ, ax, y0 + 0.34, 0.62);
    }
    for (const x of [0.3, 0.68]) tWall(k, x, 0.68, y0 + 0.34, Math.PI, 0.5);
    k.box(w, top - y0 - 0.5, w, DCON, tx, y0 + 0.5, tz);
    for (const yy of [1.2, 2.0, 2.6]) k.box(w + 0.04, 0.06, w + 0.04, "#8f8b83", tx, yy, tz);
    for (const x of [-0.25, 0.25]) k.box(0.18, 0.05, 0.03, '#1f2326', tx + x, 1.6, tz + w / 2 + 0.005);
    k.box(0.44, 0.6, 0.04, '#4a4f54', tx - 0.2, y0, tz + w / 2 + 0.11);
    const door = k.box(0.36, 0.52, 0.04, '#6b757b', tx - 0.2, y0 + 0.02, tz + w / 2 + 0.14);
    k.box(0.38, 0.05, 0.05, HAZ, tx - 0.2, y0 + 0.6, tz + w / 2 + 0.12);
    k.anims.push((t) => {
      const c = (t % 11) / 11;
      const u = c < 0.1 ? smooth(c / 0.1) : c < 0.4 ? 1 : c < 0.5 ? 1 - smooth((c - 0.4) / 0.1) : 0;
      door.position.x = tx - 0.2 + u * 0.34;
    });
    // Corbelled armoured ring and cupola
    k.cyl(0.62, 0.22, DCON, tx, top - 0.22, tz, 12, 0.72);
    k.cyl(0.74, 0.1, ARM_D, tx, top, tz, 12);
    k.cyl(0.75, 0.03, HAZ, tx, top + 0.07, tz, 12);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      k.box(0.03, 0.03, 0.03, '#8a9196', tx + Math.sin(a) * 0.7, top + 0.1, tz + Math.cos(a) * 0.7);
    }
    ladder(k, tx + w / 2 + 0.03, tz - 0.2, y0 + 0.5, top, Math.PI / 2, 0.2, '#4a4f54', 0.02, 0.016, true);
    cctv(k, -0.84, y0 + 0.72, 0.64, 0.2, Math.PI / 4, '#d8d4ca');
    cctv(k, tx + 0.5, top + 0.1, tz - 0.5, 0.2, -Math.PI * 0.75, '#d8d4ca');
    k.blinker(tx - 0.55, top + 0.1, tz + 0.3, '#ff3b30', 0.03);
    patrol(k, y0, -0.2, 0.5, -0.2, 0.86, 9, 15, 'beret', '#4a5a3a');
    rws(k, tx, top + 0.1, tz, { rate, seed: 15, dome: true, body: ARM, trim: ARM_D, lens: '#ff4a3a', scale: 1.25 });
    return;
  }
  if (level === 17) {
    // Armour tower: shaft clad in battered armour plates, hesco ring, heavy RWS with smoke dischargers and a thermal head
    for (let i = 0; i < 5; i++) hesco(k, -0.76 + i * 0.38, -0.78, y0);
    for (let i = 1; i < 4; i++) hesco(k, -0.76, -0.78 + i * 0.38, y0);
    for (let i = 1; i < 3; i++) hesco(k, 0.76, -0.78 + i * 0.38, y0);
    const tx = 0.02, tz = -0.05, w = 1.0, top = 2.75;
    k.box(w, top - y0, w, DCON, tx, y0, tz);
    const plates = 3;
    for (let f = 0; f < 4; f++) {
      const rot = (f * Math.PI) / 2;
      for (let j = 0; j < plates; j++) {
        const yy = y0 + 0.15 + j * 0.82;
        const g = new THREE.Group();
        g.position.set(tx + Math.sin(rot) * (w / 2 + 0.05), yy, tz + Math.cos(rot) * (w / 2 + 0.05));
        g.rotation.y = rot;
        const pl = k.box(w + 0.1, 0.72, 0.06, j % 2 ? ARM : ARM_D, 0, 0, 0, g);
        pl.rotation.x = -0.1;
        for (const s of [-1, 1]) k.box(0.025, 0.025, 0.03, '#9aa3a6', s * 0.4, 0.62, 0.0, g);
        k.add(g);
      }
    }
    k.box(0.36, 0.56, 0.08, '#3a4045', tx, y0, tz + w / 2 + 0.1);
    k.box(0.4, 0.05, 0.1, HAZ, tx, y0 + 0.56, tz + w / 2 + 0.1);
    k.box(1.3, 0.12, 1.3, ARM_D, tx, top, tz);
    for (const [x0, z0, x1, z1] of [[-0.62, -0.62, 0.62, -0.62], [-0.62, 0.62, 0.62, 0.62], [-0.62, -0.62, -0.62, 0.62], [0.62, -0.62, 0.62, 0.62]]) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const g = new THREE.Group();
      g.position.set(tx + (x0 + x1) / 2, top + 0.12, tz + (z0 + z1) / 2);
      g.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
      const sk = k.box(len, 0.24, 0.05, ARM, 0, 0, 0, g);
      sk.rotation.x = (z0 === z1 ? Math.sign(z0) : -Math.sign(x0)) * 0.25;
      k.add(g);
    }
    k.box(1.32, 0.03, 1.32, HAZ, tx, top + 0.1, tz);
    // Thermal camera head on its own mast
    const mx = tx - 0.45, mz = tz - 0.45;
    k.cyl(0.03, 0.5, '#4a4f54', mx, top + 0.12, mz, 6);
    const head = new THREE.Group();
    head.position.set(mx, top + 0.66, mz);
    part(head, bx(0.2, 0.12, 0.14), '#d8d4ca', 0.03, 0, 0);
    part(head, new THREE.CylinderGeometry(0.04, 0.04, 0.02, 8).rotateZ(Math.PI / 2), glow('#ff4a3a', 1), 0.14, 0, 0);
    k.add(head);
    k.anims.push((t) => (head.rotation.y = scan(t, 0.3, 7, 3) * 2.2 + 0.8));
    ladder(k, tx + w / 2 + 0.1, tz - 0.28, y0, top, Math.PI / 2, 0.2, '#4a4f54', 0.02, 0.016, true);
    climber(k, tx + w / 2 + 0.24, tz - 0.28, y0, top - 0.9, Math.PI, 13, 16, 'helmet');
    cctv(k, 0.76, y0 + 0.34, 0.5, 0.3, -Math.PI / 4, '#d8d4ca');
    beacon(k, tx + 0.5, top + 0.12, tz - 0.5, '#ff3b30', 0.045);
    patrol(k, y0, -0.55, 0.8, 0.45, 0.8, 8, 16, 'beret', '#4a5a3a');
    rws(k, tx + 0.08, top + 0.12, tz + 0.08, { rate, seed: 16, body: ARM, trim: ARM_D, lens: '#ff4a3a', heavy: true, smoke: true, scale: 1.2 });
    return;
  }
  if (level === 18) {
    // Drone sentry: hexagonal concrete tower with a glowing sensor ring, berm, cantilever pad and a tethered drone
    const cx = -0.12, cz = -0.12, R = 0.66, top = 2.8;
    k.cyl(0.98, 0.34, '#6fa04a', 0, y0, -0.05, 8, 0.82);
    k.cyl(R + 0.08, 0.4, DCON, cx, y0, cz, 6);
    k.cyl(R, top - y0 - 0.4, DCON, cx, y0 + 0.4, cz, 6);
    for (const yy of [1.3, 2.1]) k.cyl(R + 0.02, 0.05, '#8f8b83', cx, yy, cz, 6);
    hexSlits(k, cx, cz, R, 1.7, [0, 3], 0.2);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.03, R + 0.03, 0.07, 6), glow('#3fd1ff', 0.9));
    ring.position.set(cx, top - 0.3, cz);
    k.add(ring);
    k.anims.push((t) => ((ring.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + Math.abs(Math.sin(t * 1.4)) * 1.0));
    k.cyl(R + 0.2, 0.1, ARM_D, cx, top, cz, 6);
    hexWall(k, cx, cz, R + 0.2, top + 0.1, 0.18, 0.06, ARM, HAZ);
    k.box(0.4, 0.6, 0.05, '#3a4045', cx, y0, cz + R * 0.866 + 0.03);
    k.box(0.44, 0.05, 0.06, HAZ, cx, y0 + 0.6, cz + R * 0.866 + 0.03);
    // Cantilevered drone pad
    const px = cx + 0.95, pz = cz - 0.35;
    k.box(0.5, 0.06, 0.5, '#4a4f54', px - 0.1, top - 0.35, pz);
    beam(k, cx + R * 0.8, top - 0.75, pz, px - 0.1, top - 0.36, pz, 0.025, '#4a4f54', 5);
    k.box(0.36, 0.008, 0.06, HAZ, px - 0.1, top - 0.29, pz);
    k.box(0.06, 0.008, 0.36, HAZ, px - 0.1, top - 0.29, pz);
    const drone = new THREE.Group();
    part(drone, bx(0.2, 0.06, 0.2), '#33383d', 0, 0, 0);
    part(drone, new THREE.SphereGeometry(0.04, 8, 6), glow('#3fd1ff', 1), 0.1, -0.03, 0);
    const rotors: THREE.Mesh[] = [];
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      part(drone, bx(0.14, 0.015, 0.02), '#33383d', dx * 0.07, 0.02, dz * 0.07).rotation.y = dx * dz * Math.PI / 4;
      rotors.push(part(drone, bx(0.16, 0.006, 0.02), '#d8342c', dx * 0.13, 0.05, dz * 0.13));
    }
    k.add(drone);
    const tether = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 3).translate(0, 0.5, 0), mat('#f2c230'));
    tether.position.set(px - 0.1, top - 0.29, pz);
    k.add(tether);
    k.anims.push((t) => {
      const c = (t % 16) / 16;
      const lift = c < 0.15 ? smooth(c / 0.15) : c < 0.85 ? 1 : 1 - smooth((c - 0.85) / 0.15);
      const dy = lift * (0.85 + Math.sin(t * 1.3) * 0.06);
      drone.position.set(px - 0.1 + Math.sin(t * 0.5) * 0.12 * lift, top - 0.25 + dy, pz + Math.cos(t * 0.6) * 0.1 * lift);
      drone.rotation.y = t * 0.3;
      rotors.forEach((r, i) => (r.rotation.y = t * 40 + i));
      tether.scale.y = Math.max(0.02, dy);
    });
    ladder(k, cx - R * 0.866 - 0.02, cz, y0 + 0.4, top, -Math.PI / 2, 0.2, '#4a4f54', 0.02, 0.016, true);
    cctv(k, 0.75, y0 + 0.34, 0.7, 0.3, -Math.PI / 4, '#d8d4ca');
    cctv(k, cx - 0.55, top + 0.28, cz - 0.55, 0.12, Math.PI, '#d8d4ca');
    patrol(k, y0 + 0.34, -0.55, 0.62, 0.35, 0.72, 9, 17, 'beret', '#4a5a3a');
    rws(k, cx, top + 0.1, cz, { rate, seed: 17, body: '#7a858b', trim: ARM_D, lens: '#3fd1ff', heavy: true, smoke: true, scale: 1.25 });
    return;
  }
  if (level === 19) {
    // Fortress tower: wide armoured bunker base with vents, massive keep, flanking camera pods, 360° sensor ring
    k.box(1.84, 0.62, 1.84, DCON, 0, y0, 0);
    k.box(1.86, 0.06, 1.86, HAZ, 0, y0 + 0.62, 0);
    for (const s of [-1, 1]) {
      k.box(0.3, 0.12, 0.03, '#1f2326', s * 0.55, y0 + 0.4, 0.925);
      for (let i = 0; i < 3; i++) k.box(0.28, 0.015, 0.035, '#8f8b83', s * 0.55, y0 + 0.42 + i * 0.035, 0.93);
    }
    k.box(0.44, 0.5, 0.05, '#3a4045', 0, y0, 0.93);
    const door = k.box(0.38, 0.46, 0.04, '#6b757b', 0, y0 + 0.02, 0.96);
    k.anims.push((t) => {
      const c = (t % 13) / 13;
      const u = c < 0.08 ? smooth(c / 0.08) : c < 0.35 ? 1 : c < 0.43 ? 1 - smooth((c - 0.35) / 0.08) : 0;
      door.position.y = y0 + 0.02 + u * 0.42;
    });
    const yb = y0 + 0.68, tx = -0.12, tz = -0.15, w = 1.16, top = 2.95;
    k.box(w, top - yb, w, '#a9a59c', tx, yb, tz);
    for (let f = 0; f < 4; f++) {
      const rot = (f * Math.PI) / 2;
      const g = new THREE.Group();
      g.position.set(tx + Math.sin(rot) * (w / 2 + 0.04), yb + 0.2, tz + Math.cos(rot) * (w / 2 + 0.04));
      g.rotation.y = rot;
      const pl = k.box(w - 0.1, 1.5, 0.05, ARM_D, 0, 0, 0, g);
      pl.rotation.x = -0.06;
      for (const s of [-1, 1]) for (const yy of [0.2, 1.3]) k.box(0.025, 0.025, 0.03, '#9aa3a6', s * 0.45, yy, 0.02, g);
      k.box(0.3, 0.06, 0.02, '#1f2326', 0, 1.1, 0.04, g);
      k.add(g);
    }
    k.box(w + 0.3, 0.12, w + 0.3, ARM_D, tx, top, tz);
    hexWall(k, tx, tz, 0.8, top + 0.12, 0.16, 0.06, ARM, HAZ);
    // 360° camera ring turning slowly round the parapet
    const ringG = new THREE.Group();
    ringG.position.set(tx, top + 0.3, tz);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      part(ringG, bx(0.08, 0.06, 0.06), '#d8d4ca', Math.cos(a) * 0.62, 0, Math.sin(a) * 0.62).rotation.y = -a;
      part(ringG, bx(0.012, 0.03, 0.03), glow('#3fd1ff', 1), Math.cos(a) * 0.67, 0, Math.sin(a) * 0.67).rotation.y = -a;
    }
    k.add(ringG);
    k.anims.push((t) => (ringG.rotation.y = t * 0.25));
    // Flanking camera pods on arms from the bunker roof
    for (const [x, z, b] of [[0.72, 0.62, -Math.PI / 4], [-0.75, 0.62, -Math.PI * 0.75]] as [number, number, number][]) {
      k.box(0.18, 0.08, 0.18, ARM_D, x, yb, z);
      k.cyl(0.03, 0.45, '#4a4f54', x, yb + 0.08, z, 6);
      const pod = new THREE.Group();
      pod.position.set(x, yb + 0.58, z);
      part(pod, new THREE.SphereGeometry(0.08, 8, 6), '#d8d4ca', 0, 0, 0);
      part(pod, new THREE.CylinderGeometry(0.03, 0.03, 0.02, 8).rotateZ(Math.PI / 2), glow('#ff4a3a', 1), 0.08, 0, 0);
      k.add(pod);
      k.anims.push((t) => (pod.rotation.y = b + scan(t, 0.4, x * 3, 3) * 1.0));
    }
    flight(k, 0.75, yb, -0.75, 0.55, top - 0.02, -0.05, 0.22, '#4a4f54');
    walker(k, [[0.75, yb, -0.88], [0.75, yb, -0.75], [0.55, top - 0.02, -0.05]], 13, 18, 'helmet', true, '#4a5a3a');
    k.antenna(tx - 0.6, top + 0.12, tz - 0.6, 0.7);
    patrol(k, yb, -0.8, 0.82, -0.8, -0.82, 10, 18, 'beret', '#4a5a3a');
    rws(k, tx, top + 0.12, tz, { rate, seed: 18, body: '#7a858b', trim: ARM_D, lens: '#ff4a3a', heavy: true, smoke: true, scale: 1.3 });
    return;
  }
  // 20: Citadel sentry: gold-banded armoured citadel tower, gold-trimmed heavy RWS, crest, banners, beacon
  for (const [x, z, r] of [[-0.62, -0.84, 0], [-0.2, -0.84, 0], [0.22, -0.84, 0], [0.64, -0.84, 0], [-0.84, -0.4, Math.PI / 2], [-0.84, 0.02, Math.PI / 2], [0.84, -0.4, -Math.PI / 2], [0.84, 0.02, -Math.PI / 2]] as [number, number, number][]) {
    tWall(k, x, z, y0, r, 0.8, GOLD, '#b0aca2');
  }
  const tx = 0, tz = -0.12, w = 1.2, top = 3.0;
  k.box(w + 0.3, 0.55, w + 0.3, '#a9a59c', tx, y0, tz);
  k.box(w + 0.32, 0.05, w + 0.32, GOLD, tx, y0 + 0.55, tz);
  k.box(w, top - y0 - 0.6, w, CONCRETE, tx, y0 + 0.6, tz);
  for (const ax of [-1, 1]) for (const az of [-1, 1]) k.box(0.16, top - y0 - 0.6, 0.16, ARM_D, tx + ax * (w / 2 - 0.02), y0 + 0.6, tz + az * (w / 2 - 0.02));
  for (const yy of [1.45, 2.3]) k.box(w + 0.05, 0.06, w + 0.05, GOLD, tx, yy, tz);
  k.box(w - 0.4, 0.4, 0.02, '#5fb8b0', tx, 1.65, tz + w / 2 + 0.005);
  k.box(0.02, 0.4, w - 0.4, '#5fb8b0', tx + w / 2 + 0.005, 1.65, tz);
  // Crest on the front
  const crest = new THREE.Group();
  crest.position.set(tx, 1.15, tz + w / 2 + 0.03);
  part(crest, new THREE.CylinderGeometry(0.15, 0.15, 0.03, 16).rotateX(Math.PI / 2), C.trim, 0, 0, 0);
  part(crest, new THREE.TorusGeometry(0.15, 0.02, 4, 16), GOLD, 0, 0, 0.01);
  part(crest, new THREE.CylinderGeometry(0.07, 0.07, 0.04, 5).rotateX(Math.PI / 2), GOLD, 0, 0, 0.01);
  k.add(crest);
  k.box(0.44, 0.56, 0.05, '#3a4045', tx, y0 + 0.55 - 0.55, tz + w / 2 + 0.16);
  k.box(0.48, 0.05, 0.06, GOLD, tx, y0 + 0.56, tz + w / 2 + 0.16);
  k.box(1.6, 0.12, 1.6, ARM_D, tx, top, tz);
  k.box(1.62, 0.04, 1.62, GOLD, tx, top + 0.1, tz);
  hexWall(k, tx, tz, 0.86, top + 0.14, 0.16, 0.06, ARM, GOLD);
  // Banners hanging from the deck edge
  for (const s of [-1, 1]) {
    k.box(0.04, 0.04, 0.3, GOLD, tx + s * 0.81, top - 0.02, tz + 0.3);
    hang(k, tx + s * 0.82, top - 0.02, tz + 0.3, 0.012, 0.5, 0.22, C.trim, s + 3, 0.2);
  }
  const sh = new THREE.Group();
  sh.position.set(tx - 0.55, top + 0.66, tz - 0.55);
  k.cyl(0.03, 0.5, GOLD, tx - 0.55, top + 0.14, tz - 0.55, 6);
  part(sh, bx(0.2, 0.12, 0.14), '#f4f4f0', 0.03, 0, 0);
  part(sh, new THREE.CylinderGeometry(0.04, 0.04, 0.02, 8).rotateZ(Math.PI / 2), glow('#3fd1ff', 1.2), 0.14, 0, 0);
  part(sh, bx(0.21, 0.015, 0.15), GOLD, 0.03, 0.065, 0);
  k.add(sh);
  k.anims.push((t) => (sh.rotation.y = scan(t, 0.3, 9, 3) * 2.2 + 0.8));
  beacon(k, tx + 0.58, top + 0.14, tz - 0.58, '#ffb020', 0.05);
  ladder(k, tx + w / 2 + 0.03, tz - 0.3, y0 + 0.6, top, Math.PI / 2, 0.2, '#4a4f54', 0.02, 0.016, true);
  k.flagpole(-0.62, 0.72, 1.5, y0);
  cctv(k, 0.62, y0 + 0.05, 0.75, 0.6, -Math.PI / 4, '#d8d4ca');
  cctv(k, -0.84, y0 + 0.8, 0.02, 0.15, Math.PI / 2, '#d8d4ca');
  patrol(k, y0, -0.35, 0.85, 0.45, 0.85, 9, 19, 'beret', '#4a5a3a');
  rws(k, tx, top + 0.14, tz, { rate, seed: 19, body: '#5c6870', trim: '#3a4045', lens: '#3fd1ff', heavy: true, smoke: true, gold: true, scale: 1.35 });
}

function build(level: number): Kit {
  const k = new Kit();
  const y0 = k.pad(2, 2);
  const rate = rateOf(level);
  if (level <= 3) field(k, level, y0, rate);
  else if (level <= 6) camp(k, level, y0, rate);
  else if (level <= 10) baseBand(k, level, y0, rate);
  else if (level <= 15) command(k, level, y0, rate);
  else secure(k, level, y0, rate);
  return k;
}

export const SENTRY_TOWER: BuildingDef = {
  id: 'sentrytower',
  name: 'Sentry Tower',
  role: 'Elevated lookout with a rifleman: fires on raiders on the ground and in the air.',
  footprint: [2, 2],
  unlockHq: 6,
  levels: SENTRY_TOWER_LEVELS,
  designedLevels: 20,
  build,
};
