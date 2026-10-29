import * as THREE from 'three';
import { C, Kit, STOREY } from './kit';
import { CONCRETE, DARK_GLASS, GOLD } from './common';
import { DAY, HOUR, type BuildingDef, type LevelStats } from './types';

/*
 * Guardhouse: the camp entrance and first line of defence. Spots raiders early
 * and puts sentries on duty. Signature at every level: a vehicle lane on the
 * left with a barrier that lifts for an arriving vehicle, and a sentry who steps
 * out to check it, then salutes it through. The barrier itself evolves with the
 * bands (timber pole → boom → swing gates → bollards → wedge → portcullis).
 * Footprint 3×2; height cap ~3 storeys.
 */

const TITLES = [
  'Sandbag Checkpoint', 'Atap Sentry Post', 'Stilt Guard Hut', 'Guardroom', 'Guardroom · Sentry Box', 'Guardroom · Alarm Post',
  'Main Gate', 'Inspection Canopy', 'Watchtower Gate', 'Main Guardhouse', 'Visitor Centre', 'Vehicle Screening Bay',
  'Rising-Bollard Gate', 'Gate Bridge', 'Landmark Gate', 'Hardened Checkpoint', 'Serpentine Chicane', 'Biometric Gate',
  'Sensor Gate', 'Citadel Gate',
];
const SUPPLIES = [8_000, 14_000, 22_000, 33_000, 48_000, 68_000, 95_000, 130_000, 175_000, 235_000, 310_000, 400_000, 510_000, 650_000, 820_000, 1_020_000, 1_260_000, 1_550_000, 1_900_000, 2_300_000];
const REPUTATION = [300, 450, 650, 900, 1_200, 1_550, 1_950, 2_400, 2_900, 3_500, 4_200, 5_000, 6_000, 7_200, 8_500, 10_000, 12_000, 14_300, 16_900, 19_800];
const TIME = [2 * HOUR, 3 * HOUR, 4 * HOUR, 6 * HOUR, 8 * HOUR, 11 * HOUR, 14 * HOUR, 18 * HOUR, 22 * HOUR, 1.25 * DAY, 1.5 * DAY, 2 * DAY, 2.5 * DAY, 3 * DAY, 3.5 * DAY, 4 * DAY, 4.5 * DAY, 5 * DAY, 5.5 * DAY, 6 * DAY];

export const GUARDHOUSE_LEVELS: LevelStats[] = TITLES.map((title, i) => {
  const level = i + 1;
  const sentries = 1 + Math.floor(i / 4);
  const alert = 6 + i;
  return {
    level, title,
    supplies: SUPPLIES[i],
    reputation: REPUTATION[i],
    buildTime: TIME[i],
    hp: Math.round((900 * Math.pow(1.22, i)) / 10) * 10,
    stats: { sentries, alertRadius: alert },
    unlocks: [`${sentries} sentr${sentries > 1 ? 'ies' : 'y'} on duty`, `Spots raiders ${alert} tiles out`],
  };
});

// ------------------------------------------------------------------ palette & layout

const OLIVE = '#5b6b3a';
const OLIVE_D = '#46542c';
const BERET = '#2a3326';
const SKIN = ['#e0ac7e', '#c68b5f', '#a8714b', '#f0c39a'];
const DIRT = '#b98a5a';
const TARMAC = '#6b6f73';
const ASPHALT = '#4f5459';
const ATAP = '#a8854f';
const HAZ = '#f2c230';
const M = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8, ...o });
const glow = (c: string, i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, flatShading: true });

/** Lane centre and width (runs front to back on the left of the pad), and the barrier line. */
const LX = -0.85;
const LW = 1.0;
const BZ = -0.1;
const Z_IN = 1.3;
const Z_OUT = -1.35;
const PERIOD = 12;

// ------------------------------------------------------------------ the gate cycle

/** Position 0..1 through the gate cycle; every animated piece of a level shares it. */
const cyc = (t: number) => (((t % PERIOD) + PERIOD) % PERIOD) / PERIOD;
const smooth = (u: number) => u * u * (3 - 2 * u);
/**
 * How open the barrier is: a vehicle arrives (0–0.25), waits while the sentry
 * checks it (0.25–0.4), the barrier opens (0.4–0.48), the vehicle drives
 * through (0.48–0.72), and the barrier closes again (0.72–0.8).
 */
function openAt(c: number) {
  const u = c < 0.4 ? 0 : c < 0.48 ? (c - 0.4) / 0.08 : c < 0.72 ? 1 : c < 0.8 ? 1 - (c - 0.72) / 0.08 : 0;
  return smooth(u);
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
function board(k: Kit, text: string, w: number, h: number, x: number, y: number, z: number, bg: string, fg = '#ffffff', rotY = 0) {
  const side = M(bg);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), [side, side, side, side, signMat(text, bg, fg), side]);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = rotY;
  return k.add(m);
}

function haltSign(k: Kit, x: number, z: number, y: number, text = 'HALT', bg = '#d8342c', h = 0.6) {
  k.box(0.04, h, 0.04, C.metal, x, y, z);
  board(k, text, 0.42, 0.18, x, y + h - 0.06, z + 0.03, bg);
}

// ------------------------------------------------------------------ people

interface Figure { root: THREE.Group; legL: THREE.Object3D; legR: THREE.Object3D; armL: THREE.Object3D; armR: THREE.Object3D }

/** A ~0.6-tall low-poly figure facing +x with pivoting limbs: a Recruit in uniform and beret, or a visitor. */
function figure(seed: number, uniform = OLIVE, beret: string | null = BERET, trousers = OLIVE_D): Figure {
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
  if (beret) {
    const b = add(new THREE.CylinderGeometry(0.068, 0.07, 0.03, 8), beret, -0.005, 0.575, 0.01);
    b.rotation.x = 0.2;
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
  f.armR.rotation.x = 0;
}

/** Heading (rotation.y) that faces a figure built along +x toward (dx, dz). */
const face = (dx: number, dz: number) => Math.atan2(-dz, dx);

/**
 * The gate sentry: waits at (hx, hz), walks to the driver's window when the
 * vehicle stops, raises a hand to check the pass, walks back and salutes
 * while the barrier is up.
 */
function checker(k: Kit, y: number, hx: number, hz: number, stopZ: number, seed = 0, uniform = OLIVE) {
  const f = figure(seed, uniform);
  k.add(f.root);
  const tx = LX + 0.5, tz = stopZ - 0.05;
  const homeRot = face(LX - hx, 0.15);
  k.anims.push((t) => {
    const c = cyc(t);
    const out = c < 0.2 ? 0 : c < 0.27 ? (c - 0.2) / 0.07 : c < 0.38 ? 1 : c < 0.45 ? 1 - (c - 0.38) / 0.07 : 0;
    const e = smooth(out);
    f.root.position.set(hx + (tx - hx) * e, y, hz + (tz - hz) * e);
    const going = c > 0.2 && c < 0.27, back = c > 0.38 && c < 0.45;
    if (going || back) {
      pose(f, t * 9);
      f.root.rotation.y = going ? face(tx - hx, tz - hz) : face(hx - tx, hz - tz);
    } else if (out >= 1) {
      pose(f, 0);
      f.root.rotation.y = Math.PI;
      f.armR.rotation.z = 1.25 + Math.sin(t * 5) * 0.1; // holding up the pass
    } else {
      pose(f, 0);
      f.root.rotation.y = homeRot;
      if (c > 0.47 && c < 0.72) f.armR.rotation.z = 2.55; // salute
      f.root.position.y = y + Math.sin(t * 1.3) * 0.004;
    }
  });
  return f;
}

/** A sentry pacing back and forth between two points. */
function patrol(k: Kit, y: number, x0: number, z0: number, x1: number, z1: number, period = 9, seed = 1, uniform = OLIVE) {
  const f = figure(seed, uniform);
  k.add(f.root);
  k.anims.push((t) => {
    const p = (((t + seed * 3) % period) + period) % period / period;
    const fwd = p < 0.5;
    const u = smooth(fwd ? p * 2 : 2 - p * 2);
    f.root.position.set(x0 + (x1 - x0) * u, y, z0 + (z1 - z0) * u);
    const turning = Math.min(p, Math.abs(p - 0.5), 1 - p) < 0.04;
    pose(f, turning ? 0 : t * 8);
    f.root.rotation.y = fwd ? face(x1 - x0, z1 - z0) : face(x0 - x1, z0 - z1);
  });
  return f;
}

/** A sentry standing at ease (shifts weight, glances around). */
function stander(k: Kit, x: number, z: number, y: number, rotY: number, seed = 2, uniform = OLIVE) {
  const f = figure(seed, uniform);
  f.root.position.set(x, y, z);
  f.root.rotation.y = rotY;
  k.add(f.root);
  k.anims.push((t) => {
    f.root.rotation.y = rotY + Math.sin(t * 0.5 + seed) * 0.35;
    f.armL.rotation.z = Math.sin(t * 0.9 + seed) * 0.08;
  });
  return f;
}

/** A pedestrian walking through the gate (front to back), fading in and out at the pad edges. */
function walker(k: Kit, x: number, y: number, z0: number, z1: number, period: number, offset: number, seed: number, shirt: string) {
  const f = figure(seed, shirt, null, '#2f3b4a');
  f.root.rotation.y = face(0, z1 - z0);
  k.add(f.root);
  k.anims.push((t) => {
    const p = (((t + offset) % period) + period) % period / period;
    f.root.position.set(x, y, z0 + (z1 - z0) * p);
    f.root.scale.setScalar(Math.max(0.01, Math.min(1, p / 0.08, (1 - p) / 0.08)));
    pose(f, t * 8, 0.45);
  });
  return f;
}

// ------------------------------------------------------------------ vehicles

type CarKind = 'bike' | 'jeep' | 'truck' | 'sedan' | 'van';
interface Car { root: THREE.Group; wheels: THREE.Mesh[]; r: number; half: number }

function wheel(g: THREE.Group, x: number, z: number, r: number, wheels: THREE.Mesh[], w = 0.08) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 10).rotateX(Math.PI / 2), M('#2a2b2d'));
  m.position.set(x, r, z);
  const hub = new THREE.Mesh(new THREE.BoxGeometry(r * 1.1, r * 0.35, w + 0.01), M('#c9ced2'));
  m.add(hub);
  g.add(m);
  wheels.push(m);
}

/** A vehicle built facing +x, turned to drive into the camp (toward -z). */
function car(k: Kit, kind: CarKind, color = OLIVE): Car {
  const root = new THREE.Group();
  const v = new Kit();
  const wheels: THREE.Mesh[] = [];
  let r = 0.11, half = 0.52;
  if (kind === 'bike') {
    r = 0.1;
    half = 0.3;
    for (const sx of [-0.2, 0.2]) {
      const w = new THREE.Mesh(new THREE.TorusGeometry(r, 0.016, 5, 12), M('#2a2b2d'));
      w.position.set(sx, r, 0);
      w.add(new THREE.Mesh(new THREE.BoxGeometry(r * 1.8, 0.012, 0.012), M('#c9ced2')));
      v.group.add(w);
      wheels.push(w);
    }
    const bar = v.box(0.42, 0.025, 0.025, '#2f6fa8', 0, 0.2, 0);
    bar.rotation.z = 0.15;
    v.box(0.025, 0.2, 0.025, '#2f6fa8', -0.08, 0.12, 0);
    v.box(0.025, 0.18, 0.18, '#33383d', 0.18, 0.28, 0);
    v.box(0.12, 0.08, 0.14, '#7a5a3b', -0.24, 0.2, 0); // carrier with a parcel
    const rider = figure(3);
    rider.root.position.set(-0.07, 0.04, 0);
    rider.legL.rotation.z = 0.7;
    rider.legR.rotation.z = -0.2;
    rider.armL.rotation.z = rider.armR.rotation.z = 1.1;
    v.group.add(rider.root);
    k.anims.push((t) => {
      rider.legL.rotation.z = 0.25 + Math.sin(t * 7) * 0.45;
      rider.legR.rotation.z = 0.25 - Math.sin(t * 7) * 0.45;
    });
  } else if (kind === 'jeep') {
    v.box(0.95, 0.22, 0.48, color, 0, 0.14, 0);
    v.box(0.36, 0.14, 0.46, color, 0.27, 0.36, 0);
    v.box(0.04, 0.2, 0.44, DARK_GLASS, 0.08, 0.36, 0);
    v.box(0.5, 0.04, 0.5, OLIVE_D, -0.22, 0.58, 0);
    for (const sz of [-0.23, 0.23]) v.box(0.03, 0.22, 0.03, OLIVE_D, -0.45, 0.36, sz);
    v.box(0.06, 0.06, 0.5, '#33383d', 0.49, 0.18, 0);
    for (const sz of [-0.16, 0.16]) v.box(0.02, 0.05, 0.08, '#fff2c0', 0.5, 0.25, sz);
    v.box(0.1, 0.22, 0.2, '#33383d', -0.52, 0.2, 0);
    for (const sx of [-0.3, 0.3]) for (const sz of [-0.24, 0.24]) wheel(v.group, sx, sz, r, wheels);
  } else if (kind === 'truck') {
    r = 0.13;
    half = 0.75;
    v.box(0.45, 0.42, 0.56, color, 0.55, 0.18, 0);
    v.box(0.03, 0.2, 0.5, DARK_GLASS, 0.78, 0.4, 0);
    v.box(0.47, 0.04, 0.58, OLIVE_D, 0.55, 0.6, 0);
    v.box(1.05, 0.1, 0.6, '#3f4a2a', -0.25, 0.2, 0);
    v.box(1.03, 0.2, 0.58, color, -0.25, 0.3, 0);
    const canopy = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 1.0, 10, 1, false, 0, Math.PI).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2), M('#8a8458'));
    canopy.position.set(-0.25, 0.5, 0);
    canopy.scale.set(1, 0.9, 1);
    v.group.add(canopy);
    v.box(0.06, 0.08, 0.58, '#33383d', 0.79, 0.18, 0);
    for (const sx of [0.55, -0.3, -0.6]) for (const sz of [-0.28, 0.28]) wheel(v.group, sx, sz, r, wheels, 0.1);
  } else if (kind === 'sedan') {
    r = 0.1;
    half = 0.55;
    v.box(1.05, 0.2, 0.5, color, 0, 0.1, 0);
    v.box(0.56, 0.18, 0.46, DARK_GLASS, -0.06, 0.3, 0);
    v.box(0.5, 0.03, 0.44, color, -0.06, 0.48, 0);
    for (const sz of [-0.15, 0.15]) v.box(0.02, 0.05, 0.1, '#fff2c0', 0.53, 0.18, sz);
    for (const sz of [-0.17, 0.17]) v.box(0.02, 0.05, 0.1, '#e94f37', -0.53, 0.18, sz);
    v.box(0.12, 0.02, 0.06, '#ffc93c', 0.3, 0.31, 0.24); // visitor pass on the dashboard
    for (const sx of [-0.32, 0.32]) for (const sz of [-0.25, 0.25]) wheel(v.group, sx, sz, r, wheels);
  } else {
    r = 0.11;
    half = 0.65;
    v.box(1.25, 0.5, 0.56, color, 0, 0.12, 0);
    v.box(1.15, 0.16, 0.58, DARK_GLASS, -0.03, 0.42, 0);
    v.box(0.03, 0.22, 0.5, DARK_GLASS, 0.63, 0.36, 0);
    v.box(1.27, 0.04, 0.58, '#f4f4f0', 0, 0.62, 0);
    v.box(0.8, 0.06, 0.59, '#2f6fa8', -0.05, 0.3, 0);
    for (const sx of [-0.38, 0.38]) for (const sz of [-0.27, 0.27]) wheel(v.group, sx, sz, r, wheels);
  }
  v.group.rotation.y = Math.PI / 2;
  root.add(v.group);
  k.add(root);
  return { root, wheels, r, half };
}

const stopOf = (v: Car) => BZ + v.half + 0.12;

/** Drive a vehicle through the gate on the shared cycle; `weave` slaloms it through a chicane. */
function drive(k: Kit, v: Car, y: number, weave = 0) {
  const stop = stopOf(v);
  const xAt = (z: number) => LX + (weave ? Math.sin((z - Z_IN) * 2.4) * weave : 0);
  k.anims.push((t) => {
    const c = cyc(t);
    let z: number;
    if (c < 0.25) {
      const u = c / 0.25;
      z = Z_IN + (stop - Z_IN) * (1 - (1 - u) * (1 - u));
    } else if (c < 0.48) z = stop;
    else if (c < 0.72) {
      const u = (c - 0.48) / 0.24;
      z = stop + (Z_OUT - stop) * u * u;
    } else z = Z_OUT;
    const s = c < 0.05 ? c / 0.05 : c > 0.66 ? Math.max(0, (0.72 - c) / 0.06) : 1;
    v.root.visible = s > 0.01;
    v.root.scale.setScalar(Math.max(0.01, s));
    v.root.position.set(xAt(z), y, z);
    if (weave) v.root.rotation.y = Math.atan(weave * 2.4 * Math.cos((z - Z_IN) * 2.4));
    for (const w of v.wheels) w.rotation.z = -(Z_IN - z) / v.r;
  });
}

// ------------------------------------------------------------------ barriers

/** The vehicle lane: a raised strip over the pad kerb, with markings to suit the band. Returns its top. */
function lane(k: Kit, surface: string, style: 'dirt' | 'road' | 'modern' = 'road') {
  const top = 0.14;
  k.box(LW + 0.1, top, 2.0, surface, LX, 0, 0);
  if (style === 'dirt') {
    for (const dx of [-0.24, 0.24]) k.box(0.12, 0.004, 2.0, '#9c7148', LX + dx, top, 0); // tyre ruts
    return top;
  }
  k.box(LW - 0.1, 0.006, 0.06, '#f4f1e8', LX, top, BZ + 0.12); // stop line
  for (let i = 0; i < 3; i++) k.box(0.05, 0.006, 0.2, '#f4f1e8', LX, top, -0.45 - i * 0.32);
  for (const s of [-1, 1]) k.box(0.05, 0.03, 2.0, style === 'modern' ? '#f4f1e8' : '#c9c3b5', LX + s * (LW / 2 + 0.02), top - 0.01, 0);
  if (style === 'modern') for (let i = 0; i < 4; i++) k.box(0.12, 0.007, 0.12, '#f4f1e8', LX - 0.36 + i * 0.24, top, 0.85);
  return top;
}

/** Yellow-and-black speed hump across the lane. */
function hump(k: Kit, y: number, z = 0.88) {
  for (let i = 0; i < 6; i++) k.box(LW / 6, 0.035, 0.14, i % 2 ? C.kerbB : HAZ, LX - LW / 2 + (LW / 6) * (i + 0.5), y, z);
}

type BoomStyle = 'pole' | 'counter' | 'standard' | 'modern' | 'heavy';

/** Lifting barrier arm across the lane, pivoting at a post on the island side. */
function boom(k: Kit, y: number, style: BoomStyle) {
  const px = LX + LW / 2 + 0.12;
  const len = LW + 0.08;
  const h = style === 'pole' || style === 'counter' ? 0.42 : 0.4;
  const arm = new THREE.Group();
  arm.position.set(px, y + h, BZ);
  if (style === 'pole') {
    for (const dz of [-0.05, 0.05]) k.box(0.05, h + 0.05, 0.04, '#7a5a3b', px, y, BZ + dz);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, len, 6).rotateZ(Math.PI / 2), M('#c9a36a'));
    pole.position.x = -len / 2;
    arm.add(pole);
    for (let i = 0; i < 4; i++) k.box(0.1, 0.058, 0.058, '#d8342c', -0.15 - i * 0.26, 0, 0, arm);
    k.box(0.22, 0.1, 0.14, '#cdb98a', 0.16, -0.02, 0, arm); // sandbag counterweight
    k.box(0.05, 0.36, 0.05, '#7a5a3b', LX - LW / 2 + 0.02, y, BZ); // rest fork
  } else if (style === 'counter') {
    k.box(0.1, h, 0.1, '#f4f1e8', px, y, BZ);
    for (let i = 0; i < 3; i++) k.box(0.105, 0.06, 0.105, '#d8342c', px, y + 0.06 + i * 0.12, BZ);
    for (let i = 0; i < 5; i++) k.box(len / 5, 0.045, 0.045, i % 2 ? '#f4f1e8' : '#d8342c', -len / 10 - (len / 5) * i, 0, 0, arm);
    const wt = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.16, 8), M('#8a9196'));
    wt.position.set(0.18, -0.02, 0);
    arm.add(wt);
    k.box(0.05, 0.38, 0.05, C.wood, LX - LW / 2 + 0.02, y, BZ);
  } else if (style === 'standard') {
    k.box(0.16, h + 0.05, 0.16, HAZ, px, y, BZ);
    for (let i = 0; i < 3; i++) k.box(0.165, 0.05, 0.165, C.kerbB, px, y + 0.08 + i * 0.13, BZ);
    for (let i = 0; i < 6; i++) k.box(len / 6, 0.05, 0.04, i % 2 ? '#ffffff' : '#d8342c', -len / 12 - (len / 6) * i, 0, 0, arm);
    k.box(0.16, 0.08, 0.08, '#33383d', 0.12, 0, 0, arm);
    k.box(0.04, 0.36, 0.04, HAZ, LX - LW / 2 + 0.02, y, BZ);
    k.box(0.08, 0.03, 0.06, C.kerbB, LX - LW / 2 + 0.02, y + 0.36, BZ);
  } else {
    const heavy = style === 'heavy';
    k.box(0.2, h + 0.12, 0.22, heavy ? '#4a5258' : '#e8e6e0', px + 0.03, y, BZ);
    k.box(0.21, 0.03, 0.23, heavy ? HAZ : '#2bb3a3', px + 0.03, y + h + 0.02, BZ);
    k.box(len, 0.06, 0.03, heavy ? HAZ : '#f7f5ef', -len / 2, -0.01, 0, arm);
    for (let i = 0; i < 4; i++) k.box(0.1, 0.062, 0.032, heavy ? C.kerbB : '#d8342c', -0.2 - i * 0.26, -0.01, 0, arm);
    if (heavy) {
      // Hanging steel skirt so nothing ducks under
      for (let i = 0; i < 7; i++) k.box(0.02, 0.2, 0.02, '#8a9196', -0.12 - i * 0.14, -0.2, 0, arm);
      k.box(len - 0.1, 0.02, 0.02, '#8a9196', -len / 2 - 0.02, -0.21, 0, arm);
    }
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.04), glow('#ff3b30'));
    tip.position.set(-len + 0.03, 0.01, 0);
    arm.add(tip);
    k.anims.push((t) => ((tip.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(t * 6) > 0 ? 1.4 : 0.15));
  }
  k.add(arm);
  k.anims.push((t) => (arm.rotation.z = -openAt(cyc(t)) * 1.35));
}

/** Red/green signal light that turns green while the barrier is open. */
function trafficLight(k: Kit, x: number, z: number, y: number, h = 0.95) {
  k.cyl(0.025, h, '#4a4f54', x, y, z, 6);
  k.box(0.1, 0.22, 0.08, '#2a2f33', x, y + h, z);
  const red = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 8).rotateX(Math.PI / 2), glow('#ff3b30', 0.2));
  const grn = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 8).rotateX(Math.PI / 2), glow('#3fd16b', 0.2));
  red.position.set(x, y + h + 0.16, z + 0.045);
  grn.position.set(x, y + h + 0.06, z + 0.045);
  k.add(red);
  k.add(grn);
  k.anims.push((t) => {
    const go = openAt(cyc(t)) > 0.5;
    (red.material as THREE.MeshStandardMaterial).emissiveIntensity = go ? 0.1 : 1.6;
    (grn.material as THREE.MeshStandardMaterial).emissiveIntensity = go ? 1.6 : 0.1;
  });
}

/** Two gate leaves hinged at the lane edges that swing open into the camp. */
function swingGates(k: Kit, y: number) {
  const leaf = (hx: number, dir: 1 | -1) => {
    const g = new THREE.Group();
    g.position.set(hx, y, BZ);
    const w = LW / 2 - 0.02;
    for (const yy of [0.08, 0.62]) k.box(w, 0.04, 0.04, C.trim, (dir * w) / 2, yy, 0, g);
    for (let i = 0; i <= 6; i++) k.box(0.025, 0.6, 0.025, C.trim, dir * (0.03 + (w - 0.06) * (i / 6)), 0.06, 0, g);
    for (let i = 0; i <= 6; i++) k.box(0.03, 0.05, 0.03, GOLD, dir * (0.03 + (w - 0.06) * (i / 6)), 0.66, 0, g);
    const crest = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 12).rotateX(Math.PI / 2), M(GOLD));
    crest.position.set(dir * (w - 0.04), 0.36, 0.01);
    g.add(crest);
    k.add(g);
    return g;
  };
  const l = leaf(LX - LW / 2, 1), r = leaf(LX + LW / 2, -1);
  k.anims.push((t) => {
    const o = openAt(cyc(t)) * 1.45;
    l.rotation.y = o;
    r.rotation.y = -o;
  });
}

/** Row of bollards across the lane that sink into the road while the barrier is open. */
function risingBollards(k: Kit, y: number, z = BZ, n = 4) {
  for (let i = 0; i < n; i++) {
    const x = LX - LW / 2 + (LW / n) * (i + 0.5);
    k.cyl(0.085, 0.015, '#33383d', x, y, z, 10);
    const b = new THREE.Group();
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.42, 10), M('#c9ced2'));
    post.position.y = 0.21;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.067, 0.067, 0.06, 10), M(HAZ));
    band.position.y = 0.33;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 10), glow('#ff3b30', 1));
    cap.position.y = 0.43;
    b.add(post, band, cap);
    b.position.set(x, y, z);
    k.add(b);
    k.anims.push((t) => {
      const o = openAt(cyc(t));
      b.position.y = y - o * 0.43;
      (cap.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(t * 5 + i) > 0 ? 1.4 : 0.2;
    });
  }
}

/** Hinged steel wedge plate that tilts up out of the road to block the lane. */
function wedge(k: Kit, y: number, z = BZ) {
  k.box(LW - 0.04, 0.02, 0.42, '#33383d', LX, y, z);
  const g = new THREE.Group();
  g.position.set(LX, y + 0.02, z - 0.18);
  k.box(LW - 0.1, 0.05, 0.38, '#5c6166', 0, 0, 0.19, g);
  for (let i = 0; i < 6; i++) k.box((LW - 0.1) / 6 - 0.01, 0.052, 0.08, i % 2 ? C.kerbB : HAZ, -(LW - 0.1) / 2 + ((LW - 0.1) / 6) * (i + 0.5), 0.001, 0.36, g);
  k.add(g);
  k.anims.push((t) => (g.rotation.x = -(1 - openAt(cyc(t))) * 0.55));
}

/** Tyre-killer spikes that stand up across the lane until the barrier opens. */
function spikes(k: Kit, y: number, z: number) {
  k.box(LW - 0.04, 0.02, 0.12, '#33383d', LX, y, z);
  const teeth: THREE.Mesh[] = [];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4).translate(0, 0.06, 0), M('#c9ced2'));
    s.position.set(LX - LW / 2 + 0.08 + i * ((LW - 0.16) / 8), y + 0.02, z);
    k.add(s);
    teeth.push(s);
  }
  k.anims.push((t) => {
    const o = openAt(cyc(t));
    for (const s of teeth) s.rotation.x = -o * 1.4;
  });
}

// ------------------------------------------------------------------ props

/** Oil drum painted with red and white bands (checkpoint chicane). */
function stripedDrum(k: Kit, x: number, z: number, y: number) {
  k.cyl(0.11, 0.32, '#f4f1e8', x, y, z, 10);
  for (const yy of [0.04, 0.2]) k.cyl(0.113, 0.08, '#d8342c', x, y + yy, z, 10);
}

/** Hurricane lantern hanging from (x, y, z), swaying in the breeze. */
function lantern(k: Kit, x: number, y: number, z: number, seed = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  k.box(0.01, 0.12, 0.01, '#33383d', 0, -0.12, 0, g);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 6), glow('#ffcf6a', 0.8));
  body.position.y = -0.19;
  const lid = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.05, 6), M('#4a4f54'));
  lid.position.y = -0.12;
  g.add(body, lid);
  k.add(g);
  k.anims.push((t) => {
    g.rotation.z = Math.sin(t * 1.5 + seed) * 0.18;
    g.rotation.x = Math.sin(t * 1.1 + seed * 2) * 0.1;
    (body.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.7 + Math.sin(t * 13 + seed) * 0.15;
  });
}

/** Field telephone in a box on a post. */
function fieldPhone(k: Kit, x: number, z: number, y: number) {
  k.box(0.05, 0.55, 0.05, C.wood, x, y, z);
  k.box(0.12, 0.13, 0.07, OLIVE_D, x, y + 0.42, z + 0.05);
  k.box(0.08, 0.03, 0.03, '#2a2b2d', x, y + 0.56, z + 0.06);
}

/** Searchlight on a yoke that sweeps back and forth, with a faint beam. */
function searchlight(k: Kit, x: number, y: number, z: number, base = 0.8, seed = 0) {
  k.cyl(0.06, 0.08, '#4a4f54', x, y, z, 8);
  const g = new THREE.Group();
  g.position.set(x, y + 0.08, z);
  k.box(0.03, 0.14, 0.12, '#4a4f54', 0, 0, 0, g);
  const head = new THREE.Group();
  head.position.y = 0.12;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.14, 10).rotateZ(Math.PI / 2), M('#5c6166'));
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.01, 10).rotateZ(Math.PI / 2), glow('#fff6c8', 1.5));
  lens.position.x = 0.075;
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(0.28, 1.4, 10, 1, true).rotateZ(Math.PI / 2).translate(0.78, 0, 0),
    new THREE.MeshBasicMaterial({ color: '#fff6c8', transparent: true, opacity: 0.14, depthWrite: false, side: THREE.DoubleSide }),
  );
  head.add(drum, lens, beam);
  head.rotation.z = -0.32;
  g.add(head);
  k.add(g);
  k.anims.push((t) => (g.rotation.y = base + Math.sin(t * 0.45 + seed) * 1.1));
}

/** Pole-mounted CCTV camera that pans. */
function cctv(k: Kit, x: number, z: number, y: number, h = 1.1, base = 0) {
  k.cyl(0.025, h, C.metal, x, y, z, 5);
  const cam = new THREE.Group();
  cam.position.set(x, y + h, z);
  k.box(0.16, 0.07, 0.07, '#f4f4f0', 0.05, 0, 0, cam);
  k.box(0.03, 0.04, 0.04, '#33383d', 0.14, 0.01, 0, cam);
  k.add(cam);
  k.anims.push((t) => (cam.rotation.y = base + Math.sin(t * 0.4 + x + z) * 0.8));
}

/** Crest disc (camp emblem) facing front. */
function crest(k: Kit, x: number, y: number, z: number, r = 0.16, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.03, 16).rotateX(Math.PI / 2), M(C.trim));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.022, 4, 16), M(GOLD));
  const star = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.45, r * 0.45, 0.04, 5).rotateX(Math.PI / 2), M(GOLD));
  g.add(disc, ring, star);
  return k.add(g);
}

/** Concrete jersey barrier (lane chicanes). */
function jersey(k: Kit, x: number, z: number, y: number, len = 0.55, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  k.box(len, 0.1, 0.2, '#d8d4ca', 0, 0, 0, g);
  k.box(len, 0.16, 0.11, '#d8d4ca', 0, 0.1, 0, g);
  for (let i = 0; i < 3; i++) k.box(len / 6, 0.07, 0.115, i % 2 ? '#f4f1e8' : '#d8342c', -len / 3 + (len / 3) * i, 0.17, 0, g);
  return k.add(g);
}

/** Tall precast T-wall blast barrier. */
function tWall(k: Kit, x: number, z: number, y: number, rotY = 0, h = 1.05) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  k.box(0.48, h, 0.1, CONCRETE, 0, 0, 0, g);
  k.box(0.48, 0.14, 0.34, CONCRETE, 0, 0, 0.0, g);
  k.box(0.49, 0.06, 0.11, HAZ, 0, h - 0.12, 0, g);
  return k.add(g);
}

/** Tripod turnstile whose arms index round a third of a turn as each visitor passes. */
function turnstile(k: Kit, x: number, z: number, y: number, period: number, offset: number) {
  k.box(0.14, 0.36, 0.2, '#c9ced2', x + 0.12, y, z);
  const hub = new THREE.Group();
  hub.position.set(x + 0.05, y + 0.32, z);
  for (let i = 0; i < 3; i++) {
    const a = new THREE.Group();
    a.rotation.x = (i / 3) * Math.PI * 2;
    k.box(0.02, 0.02, 0.2, '#e8e6e0', -0.05, 0, 0.1, a);
    hub.add(a);
  }
  hub.rotation.z = -0.5;
  k.add(hub);
  k.anims.push((t) => {
    const p = (((t + offset) % period) + period) % period / period;
    const u = p < 0.45 ? 0 : p < 0.6 ? smooth((p - 0.45) / 0.15) : 1;
    hub.rotation.x = (Math.floor((t + offset) / period) + u) * ((Math.PI * 2) / 3);
  });
}

/** Glass speed-gate flaps that retract as a pedestrian walks through. */
function speedGate(k: Kit, x: number, z: number, y: number, period: number, offset: number) {
  for (const s of [-1, 1]) {
    k.box(0.1, 0.4, 0.5, '#e8e6e0', x + s * 0.2, y, z);
    k.box(0.1, 0.02, 0.5, '#2bb3a3', x + s * 0.2, y + 0.4, z);
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.24, 0.02), M('#bfe6f2', { transparent: true, opacity: 0.65 }));
    flap.geometry.translate((-s * 0.14) / 2, 0, 0);
    flap.position.set(x + s * 0.15, y + 0.24, z);
    k.add(flap);
    k.anims.push((t) => {
      const p = (((t + offset) % period) + period) % period / period;
      const open = p > 0.3 && p < 0.62 ? 1 : 0;
      flap.scale.x = 1 - open * 0.85;
    });
  }
}

// ------------------------------------------------------------------ field (1–3)

function field(k: Kit, level: number, y: number) {
  const ly = lane(k, DIRT, 'dirt');
  for (const x of [LX - 0.4, LX + 0.4]) stripedDrum(k, x, 0.8, ly);
  if (level === 1) {
    // Sandbag checkpoint: a sangar of sandbags, timber pole barrier, HALT board, field telephone
    boom(k, ly, 'pole');
    k.sandbags(0.6, 0.3, 1.0, 0, y, 3);
    k.sandbags(0.08, -0.12, 0.7, Math.PI / 2, y, 3);
    k.sandbags(1.12, -0.12, 0.7, Math.PI / 2, y, 3);
    fieldPhone(k, 0.85, -0.45, y);
    k.box(0.05, 0.85, 0.05, C.wood, 0.3, y, -0.45);
    k.box(0.3, 0.04, 0.04, C.wood, 0.3, y + 0.82, -0.32);
    lantern(k, 0.3, y + 0.82, -0.2);
    k.box(0.2, 0.18, 0.2, '#7a5a3b', 0.6, y, -0.2); // ammo box seat
    haltSign(k, -0.14, 0.72, y);
    k.crates(1.15, -0.72, y, 2);
    k.fieldFlag(1.32, 0.72, y);
    stander(k, 0.6, 0.0, y, -Math.PI / 2, 4);
    const v = car(k, 'bike');
    drive(k, v, ly);
    checker(k, y, -0.12, 0.3, stopOf(v));
    return;
  }
  if (level === 2) {
    // Atap sentry post: timber sentry box with a thatched roof, cook fire with a kettle
    boom(k, ly, 'pole');
    const bx = 0.2, bz = 0.15;
    for (const [dx, dz] of [[-0.27, -0.27], [0.27, -0.27], [-0.27, 0.27], [0.27, 0.27]]) k.box(0.06, 1.0, 0.06, '#7a5a3b', bx + dx, y, bz + dz);
    k.box(0.6, 0.55, 0.04, C.wood, bx, y, bz - 0.27);
    k.box(0.04, 0.55, 0.56, C.wood, bx + 0.27, y, bz);
    k.box(0.6, 0.35, 0.04, C.wood, bx, y, bz + 0.27);
    for (let i = 1; i < 4; i++) k.box(0.61, 0.012, 0.05, '#8a6040', bx, y + i * 0.13, bz - 0.27);
    k.hipRoof(0.6, 0.6, 0.4, bx, y + 1.0, bz, ATAP, 0.16);
    lantern(k, bx - 0.36, y + 0.96, bz + 0.36, 1);
    k.sandbags(bx, bz + 0.55, 0.75, 0, y, 2);
    fieldPhone(k, bx + 0.42, bz - 0.2, y);
    // Cook fire with a kettle on a tripod
    const fx = 0.95, fz = -0.55;
    for (let i = 0; i < 7; i++) k.box(0.07, 0.05, 0.07, '#8f8a80', fx + Math.cos(i) * 0.15, y, fz + Math.sin(i) * 0.15);
    for (let i = 0; i < 3; i++) {
      const log = k.box(0.24, 0.04, 0.04, '#6b4a30', fx, y + 0.03, fz);
      log.rotation.y = i * 1.05;
    }
    for (let i = 0; i < 3; i++) {
      const leg = k.box(0.02, 0.4, 0.02, '#4a4f54', fx + Math.cos(i * 2.1) * 0.1, y, fz + Math.sin(i * 2.1) * 0.1);
      leg.rotation.set(Math.sin(i * 2.1) * 0.25, 0, -Math.cos(i * 2.1) * 0.25);
    }
    k.cyl(0.06, 0.08, '#4a4f54', fx, y + 0.18, fz, 8);
    k.emitters.push({ pos: new THREE.Vector3(fx, y + 0.35, fz), kind: 'smoke' });
    k.bench(1.0, 0.05, 0.6, y);
    haltSign(k, -0.14, 0.75, y);
    k.fieldFlag(1.32, 0.72, y);
    const v = car(k, 'jeep');
    drive(k, v, ly);
    checker(k, y, bx - 0.1, bz, stopOf(v));
    return;
  }
  // 3: stilt guard hut: timber hut on stilts with a veranda, zinc roof, painted pole barrier
  boom(k, ly, 'counter');
  const hx = 0.7, hz = -0.42, hw = 1.0, hd = 0.75, fl = 0.32;
  for (const [dx, dz] of [[-0.45, -0.32], [0.45, -0.32], [-0.45, 0.6], [0.45, 0.6], [-0.45, 0.32], [0.45, 0.32]]) k.box(0.07, fl, 0.07, '#6b4a30', hx + dx, y, hz + dz);
  k.box(hw + 0.1, 0.06, hd + 0.35, '#8a6040', hx, y + fl, hz + 0.15);
  const wy = y + fl + 0.06;
  k.box(hw, 0.65, hd, C.wood, hx, wy, hz);
  for (let i = 1; i < 5; i++) k.box(hw + 0.01, 0.012, hd + 0.01, '#8a6040', hx, wy + i * 0.13, hz);
  k.window('left', hx, hz, hw, hd, 0.05, wy + 0.3, 0.36, 0.22);
  k.window('front', hx, hz, hw, hd, 0.25, wy + 0.3, 0.3, 0.22, true);
  k.door('front', hx, hz, hw, hd, -0.2, wy, 0.28, 0.52, '#7a5a3b');
  k.gableRoof(hw, hd, 0.32, hx, wy + 0.65, hz, C.zinc, 0.16, C.wood);
  k.stairs(hx - 0.2, hz + 0.72, 0.28, 0.24, fl + 0.06);
  for (const dx of [0.0, 0.25, 0.5]) k.box(0.03, 0.3, 0.03, '#6b4a30', hx + dx - 0.05, wy, hz + 0.7);
  k.box(0.6, 0.03, 0.03, '#6b4a30', hx + 0.2, wy + 0.3, hz + 0.7);
  lantern(k, hx - hw / 2 - 0.08, wy + 0.62, hz + 0.3, 2);
  k.antenna(hx + 0.35, wy + 0.8, hz - 0.2, 0.8);
  k.sandbags(0.0, 0.62, 0.5, Math.PI / 2, y, 2);
  haltSign(k, -0.14, 0.82, y);
  k.drum(1.32, 0.62, '#2f6fa8', y);
  k.drum(1.32, 0.35, '#3f7d4a', y);
  fieldPhone(k, 0.05, -0.75, y);
  stander(k, hx + 0.2, hz + 0.58, wy, -Math.PI / 2, 5);
  const v = car(k, 'jeep');
  drive(k, v, ly);
  checker(k, y, -0.1, 0.25, stopOf(v));
}

// ------------------------------------------------------------------ camp (4–6)

/** Cream single-storey guardroom with a red hip roof and a pass hatch facing the lane. */
function guardroom(k: Kit, bx: number, bz: number, bw: number, bd: number, y: number, roof: 'hip' | 'gable' = 'hip') {
  const h = k.block(bw, bd, 1, bx, y, bz);
  if (roof === 'hip') k.hipRoof(bw, bd, 0.36, bx, y + h, bz, C.roof, 0.16);
  else {
    k.gableRoof(bw, bd, 0.4, bx, y + h, bz, C.roof, 0.16);
    // Entrance gable projecting over the door
    const ex = bx - bw / 2 + 0.3;
    k.box(0.5, 0.06, 0.3, C.roofGreen, ex, y + h - 0.12, bz + bd / 2 + 0.15);
    for (const s of [-1, 1]) k.box(0.05, h - 0.12, 0.05, C.white, ex + s * 0.21, y, bz + bd / 2 + 0.27);
  }
  k.window('left', bx, bz, bw, bd, 0.12, y + 0.4, 0.42, 0.3);
  k.box(0.1, 0.03, 0.5, C.white, bx - bw / 2 - 0.06, y + 0.37, bz + 0.12);
  k.door('front', bx, bz, bw, bd, -bw / 2 + 0.3, y);
  k.window('front', bx, bz, bw, bd, 0.2, y + 0.42, 0.38, 0.3, true);
  return h;
}

function camp(k: Kit, level: number, y: number) {
  const ly = lane(k, TARMAC, 'road');
  boom(k, ly, 'standard');
  hump(k, ly);
  if (level === 4) {
    // Guardroom: first permanent cream guardroom, red roof, pass hatch, standard boom barrier
    guardroom(k, 0.7, -0.38, 1.25, 0.95, y);
    board(k, 'GUARDROOM', 0.8, 0.16, 0.7, y + 0.98, 0.1, C.trim);
    haltSign(k, -0.14, 0.8, y, 'STOP');
    k.bicycleRack(1.1, 0.55, 2, y);
    k.cyl(0.05, 0.22, '#d8342c', 1.38, y, -0.1, 8); // fire extinguisher
    k.lamp(-0.12, -0.75, y, 1.2);
    k.aircon(1.38, y + 0.3, -0.6, Math.PI / 2);
    const v = car(k, 'jeep');
    drive(k, v, ly);
    checker(k, y, -0.12, 0.28, stopOf(v));
    return;
  }
  // Classic sentry box beside the barrier (5–6)
  const sx = 0.02, sz = 0.36;
  k.box(0.5, 0.06, 0.5, CONCRETE, sx, y, sz);
  k.box(0.42, 0.85, 0.42, C.wall, sx, y + 0.06, sz);
  k.box(0.43, 0.14, 0.43, C.trim, sx, y + 0.06, sz);
  k.box(0.03, 0.55, 0.26, '#2a2f33', sx - 0.215, y + 0.2, sz);
  k.box(0.26, 0.2, 0.03, DARK_GLASS, sx, y + 0.55, sz + 0.215);
  k.hipRoof(0.42, 0.42, 0.24, sx, y + 0.91, sz, C.roofGreen, 0.08);
  if (level === 5) {
    // + classic sentry box at the barrier, lamps over the lane, convex traffic mirror, hedge
    guardroom(k, 0.85, -0.42, 1.15, 0.9, y, 'gable');
    board(k, 'GUARDROOM', 0.6, 0.13, 1.0, y + 0.72, 0.05, C.trim);
    k.lamp(-1.45, 0.55, ly, 1.25);
    k.lamp(-0.15, -0.78, y, 1.25);
    k.cyl(0.02, 0.9, C.metal, -0.22, y, 0.85, 5);
    const mirror = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 12).rotateX(Math.PI / 2), M('#ff8a3d'));
    mirror.position.set(-0.24, y + 0.95, 0.85);
    mirror.rotation.y = -0.7;
    k.add(mirror);
    k.hedge(0.95, 0.72, 0.9, 0.18, y);
    k.flagpole(1.35, -0.85, 1.8, y);
    const v = car(k, 'jeep');
    drive(k, v, ly);
    checker(k, y, -0.26, 0.32, stopOf(v));
    return;
  }
  // 6: guardroom with a green veranda, alarm siren mast, fire-bucket rack, off-duty sentry
  guardroom(k, 0.85, -0.45, 1.15, 0.9, y);
  k.porch(0.85, 0.24, 1.15, 0.42, 0.82, y, 3, C.roofGreen);
  board(k, 'GUARDROOM', 0.75, 0.15, 0.85, y + 0.98, 0.0, C.trim);
  k.bench(0.95, 0.12, 0.6, y);
  stander(k, 0.6, 0.15, y, -Math.PI / 2, 6);
  // Alarm siren: horn rotating on a steel mast with a beacon
  k.cyl(0.035, 1.5, C.metal, 1.32, y, 0.78, 6);
  k.box(0.18, 0.06, 0.18, C.metal, 1.32, y + 1.45, 0.78);
  const siren = new THREE.Group();
  siren.position.set(1.32, y + 1.62, 0.78);
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.05, 0.16, 8).rotateZ(Math.PI / 2), M('#d8342c'));
  horn.position.x = 0.08;
  siren.add(horn, new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 8), M('#33383d')));
  k.add(siren);
  k.anims.push((t) => (siren.rotation.y = t * 1.8));
  k.blinker(1.32, y + 1.68, 0.78, '#ff8a1f', 0.04, 1.2);
  // Fire-bucket rack
  k.box(0.5, 0.04, 0.12, '#d8342c', -0.02, y + 0.55, -0.75);
  for (const dx of [-0.2, 0.2]) k.box(0.04, 0.6, 0.04, '#d8342c', -0.02 + dx, y, -0.75);
  for (let i = 0; i < 3; i++) {
    const b = k.cyl(0.05, 0.1, '#d8342c', -0.17 + i * 0.15, y + 0.4, -0.72, 8, 0.065);
    k.swing(b, 0, 0.15, i);
  }
  k.lamp(-1.45, 0.55, ly, 1.25);
  const v = car(k, 'jeep');
  drive(k, v, ly);
  checker(k, y, -0.26, 0.32, stopOf(v));
}

// ------------------------------------------------------------------ base (7–10)

/** Concrete boundary wall with concertina wire along the back edge. */
function backWall(k: Kit, y: number, x0 = -0.2, x1 = 1.45) {
  const len = x1 - x0, cx = (x0 + x1) / 2;
  k.box(len, 0.45, 0.1, C.wallAlt, cx, y, -0.9);
  k.box(len + 0.02, 0.05, 0.12, C.trim, cx, y + 0.45, -0.9);
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 3, 10), M('#b9c0c4'));
  for (let i = 0; i < Math.floor(len / 0.1); i++) {
    const c = coil.clone();
    c.position.set(x0 + 0.05 + i * 0.1, y + 0.57, -0.9);
    c.rotation.y = Math.PI / 2 + 0.3;
    k.add(c);
  }
}

/** Concrete watchtower: square shaft, glazed cab with a green roof, sweeping searchlight. */
function watchtower(k: Kit, x: number, z: number, y: number, shaft: number, gold = false) {
  k.box(0.5, shaft, 0.5, C.wallAlt, x, y, z);
  for (let i = 1; i < 3; i++) k.box(0.52, 0.04, 0.52, C.trim, x, y + (shaft / 3) * i, z);
  for (let i = 0; i < 6; i++) k.box(0.2, 0.025, 0.03, C.metal, x - 0.12, y + 0.2 + i * (shaft / 6.5), z + 0.27); // ladder rungs
  const cy = y + shaft;
  k.box(0.72, 0.08, 0.72, CONCRETE, x, cy, z);
  k.box(0.66, 0.42, 0.66, '#86b7cc', x, cy + 0.08, z);
  for (const [dx, dz] of [[-0.31, -0.31], [0.31, -0.31], [-0.31, 0.31], [0.31, 0.31]]) k.box(0.05, 0.42, 0.05, C.trim, x + dx, cy + 0.08, z + dz);
  k.box(0.68, 0.16, 0.68, C.wallAlt, x, cy + 0.08, z);
  if (gold) k.box(0.7, 0.05, 0.7, GOLD, x, cy + 0.48, z);
  k.hipRoof(0.66, 0.66, 0.28, x, cy + 0.53, z, C.roofGreen, 0.1);
  searchlight(k, x - 0.38, cy + 0.08, z + 0.2, 2.6);
  return cy + 0.81;
}

function base(k: Kit, level: number, y: number) {
  const ly = lane(k, ASPHALT, 'road');
  if (level === 7) {
    // Main gate: twin pillars with lamp globes and a crest, steel swing gates instead of a boom
    swingGates(k, ly);
    for (const x of [LX - LW / 2 - 0.09, LX + LW / 2 + 0.09]) {
      k.box(0.2, 1.0, 0.24, C.wall, x, y, BZ);
      k.box(0.21, 0.14, 0.25, C.trim, x, y, BZ);
      k.box(0.26, 0.06, 0.3, C.trim, x, y + 1.0, BZ);
      const globe = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 1), glow('#fff2c0', 0.7));
      globe.position.set(x, y + 1.13, BZ);
      k.add(globe);
    }
    crest(k, LX + LW / 2 + 0.09, y + 0.62, BZ + 0.13, 0.08);
    guardroom(k, 0.75, -0.4, 1.2, 0.9, y);
    k.box(0.4, 0.5, 0.3, C.wall, 0.03, y, -0.22); // gatekeeper's bay window
    k.box(0.41, 0.2, 0.02, DARK_GLASS, 0.03, y + 0.26, -0.06);
    k.box(0.46, 0.05, 0.36, C.roofGreen, 0.03, y + 0.5, -0.22);
    backWall(k, y, 0.2, 1.45);
    board(k, 'STOP · ID CHECK', 0.6, 0.16, 0.6, y + 0.6, 0.68, '#d8342c');
    for (const dx of [-0.27, 0.27]) k.box(0.04, 0.6, 0.04, C.metal, 0.6 + dx, y, 0.66);
    k.planter(1.15, 0.7, 0.5, y);
    k.lamp(-1.45, 0.6, ly, 1.3);
    const v = car(k, 'jeep');
    drive(k, v, ly);
    checker(k, y, -0.1, 0.35, stopOf(v));
    return;
  }
  boom(k, ly, 'standard');
  if (level === 8) {
    // Inspection canopy: green drive-through canopy where an inspector checks under a 3-tonner with a mirror
    const v = car(k, 'truck');
    const sz = stopOf(v);
    for (const x of [LX - LW / 2 - 0.06, LX + LW / 2 + 0.06]) for (const z of [sz - 0.45, sz + 0.35]) k.box(0.07, 1.3, 0.07, C.white, x, ly, z);
    k.box(LW + 0.4, 0.08, 1.1, C.roofGreen, LX, ly + 1.3, sz - 0.05);
    k.box(LW + 0.42, 0.05, 1.12, C.white, LX, ly + 1.27, sz - 0.05);
    for (const z of [sz - 0.3, sz + 0.2]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.06), glow('#fff6c8', 1));
      strip.position.set(LX, ly + 1.26, z);
      k.add(strip);
    }
    board(k, 'INSPECTION', 0.7, 0.14, LX, ly + 1.38, sz + 0.5, C.trim);
    const h = k.block(1.1, 0.9, 1, 0.82, y, -0.45);
    k.hipRoof(1.1, 0.9, 0.34, 0.82, y + h, -0.45, C.roof, 0.16);
    k.window('left', 0.82, -0.45, 1.1, 0.9, 0.1, y + 0.4, 0.42, 0.3);
    k.window('front', 0.82, -0.45, 1.1, 0.9, 0.22, y + 0.42, 0.38, 0.3, true);
    k.door('front', 0.82, -0.45, 1.1, 0.9, -0.2, y);
    k.waterTank(1.3, y, 0.6);
    k.aircon(1.36, y + 0.4, -0.3, Math.PI / 2);
    // Inspector with an under-vehicle mirror on a pole, walking along the truck while it waits
    const ins = figure(7);
    const pole = new THREE.Group();
    pole.position.set(0.05, 0.32, 0);
    k.box(0.36, 0.015, 0.015, C.metal, 0.18, 0, 0, pole);
    k.box(0.14, 0.01, 0.12, '#bfe6f2', 0.38, -0.12, 0, pole);
    pole.rotation.z = -0.55;
    ins.armR.add(pole);
    pole.position.set(0, -0.18, 0);
    k.add(ins.root);
    k.anims.push((t) => {
      const c = cyc(t);
      const u = c < 0.25 ? 0 : c < 0.45 ? (c - 0.25) / 0.2 : 1;
      const zz = sz + 0.5 - u * 1.0;
      ins.root.position.set(LX + 0.48, ly, zz);
      ins.root.rotation.y = c > 0.45 ? Math.PI / 2 + Math.sin(t) * 0.2 : Math.PI / 2;
      pose(ins, u > 0 && u < 1 ? t * 8 : 0, 0.35);
      ins.armR.rotation.z = 0.9;
    });
    drive(k, v, ly);
    checker(k, y, -0.12, 0.62, sz);
    hump(k, ly, 0.95);
    return;
  }
  if (level === 9) {
    // Watchtower gate: guardhouse plus a concrete watchtower with a sweeping searchlight, jersey chicane
    guardroom(k, 0.4, -0.35, 1.0, 0.85, y);
    board(k, 'GUARDROOM', 0.7, 0.14, 0.4, y + 0.98, 0.09, C.trim);
    watchtower(k, 1.15, -0.62, y, 1.55);
    jersey(k, LX - 0.3, 0.92, ly, 0.38);
    jersey(k, 0.3, 0.75, y, 0.55);
    k.lamp(-1.45, 0.55, ly, 1.3);
    trafficLight(k, -0.2, 0.62, y, 0.75);
    patrol(k, y, 0.15, 0.45, 1.2, 0.45, 10, 3);
    const v = car(k, 'jeep');
    drive(k, v, ly);
    checker(k, y, -0.12, 0.28, stopOf(v));
    return;
  }
  // 10: main guardhouse (release cap): two-storey guardhouse, gold-banded watchtower, glass sentry booth, crest wall
  const bx = 0.35, bz = -0.42, bw = 0.95, bd = 0.85;
  const h = k.block(bw, bd, 2, bx, y, bz);
  k.hipRoof(bw, bd, 0.34, bx, y + h, bz, C.roof, 0.16);
  k.window('left', bx, bz, bw, bd, 0.1, y + 0.4, 0.42, 0.3);
  k.windowRow('front', bx, bz, bw, bd, 2, y + STOREY + 0.42, { louvre: true });
  k.door('front', bx, bz, bw, bd, -0.2, y);
  // Balcony over the lane side
  k.box(0.22, 0.05, 0.6, '#cfc9bc', bx - bw / 2 - 0.11, y + STOREY, bz + 0.05);
  k.box(0.03, 0.28, 0.6, C.white, bx - bw / 2 - 0.21, y + STOREY + 0.05, bz + 0.05);
  k.door('left', bx, bz, bw, bd, 0.05, y + STOREY, 0.3, 0.55, DARK_GLASS);
  // Round release-cap watchtower: drum shaft, glazed ring cab, gold band and a conical red roof with a pennant
  const tx = 1.13, tz = -0.6, sh = 1.65;
  k.cyl(0.28, sh, C.wallAlt, tx, y, tz, 14);
  for (let i = 1; i < 3; i++) k.cyl(0.29, 0.04, C.trim, tx, y + (sh / 3) * i, tz, 14);
  k.cyl(0.4, 0.08, CONCRETE, tx, y + sh, tz, 14);
  k.cyl(0.36, 0.4, '#86b7cc', tx, y + sh + 0.08, tz, 14);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    k.box(0.04, 0.4, 0.04, C.trim, tx + Math.cos(a) * 0.36, y + sh + 0.08, tz + Math.sin(a) * 0.36);
  }
  k.cyl(0.39, 0.06, GOLD, tx, y + sh + 0.48, tz, 14);
  k.cyl(0.46, 0.38, C.roof, tx, y + sh + 0.54, tz, 14, 0.02);
  k.flagpole(tx, tz, 0.5, y + sh + 0.9);
  searchlight(k, tx - 0.42, y + sh + 0.08, tz + 0.2, 2.6);
  // Glass sentry booth at the barrier
  k.glassBox(0.42, 0.85, 0.42, 0.0, y, 0.42);
  k.box(0.52, 0.06, 0.52, C.roofGreen, 0.0, y + 0.9, 0.42);
  // Crest wall with the camp name
  k.box(0.85, 0.42, 0.14, C.wall, 0.95, y, 0.78);
  k.box(0.87, 0.05, 0.16, C.trim, 0.95, y + 0.42, 0.78);
  board(k, 'OUTPOST', 0.5, 0.14, 1.05, y + 0.14, 0.86, C.trim, GOLD);
  crest(k, 0.67, y + 0.22, 0.86, 0.09);
  k.planter(0.55, 0.78, 0.25, y);
  k.flagpole(1.4, 0.2, 2.0, y);
  k.lamp(-1.45, 0.55, ly, 1.3);
  trafficLight(k, -0.22, 0.75, y, 0.75);
  const v = car(k, 'jeep');
  drive(k, v, ly);
  checker(k, y, -0.22, 0.2, stopOf(v));
  patrol(k, y, 0.55, 0.3, 1.3, 0.3, 9, 4);
}

// ------------------------------------------------------------------ command (11–15)

function command(k: Kit, level: number, y: number) {
  const ly = lane(k, ASPHALT, 'modern');
  if (level === 11) {
    // Visitor centre: white two-storey pavilion with fins, glass ground floor, turnstiles and a visitor queue
    boom(k, ly, 'modern');
    trafficLight(k, -0.22, 0.75, y, 0.8);
    const bx = 0.7, bz = -0.42, bw = 1.45, bd = 0.95;
    k.glassBox(bw, STOREY, bd, bx, y, bz);
    k.box(bw + 0.1, STOREY * 1.1, bd + 0.1, '#f2f0ea', bx, y + STOREY, bz);
    k.fins(bw, STOREY * 1.1, bx, y + STOREY, bz + bd / 2 + 0.08, 9);
    k.box(bw + 0.4, 0.08, bd + 0.35, C.white, bx, y + STOREY * 2.1, bz + 0.1);
    k.box(bw + 0.42, 0.04, bd + 0.37, '#2bb3a3', bx, y + STOREY * 2.1 - 0.03, bz + 0.1);
    k.hedge(bx, bz, bw * 0.7, bd * 0.6, y + STOREY * 2.1 + 0.08);
    board(k, 'VISITOR CENTRE', 0.9, 0.15, bx, y + STOREY + 0.1, bz + bd / 2 + 0.2, '#2bb3a3');
    k.box(0.4, 0.3, 0.02, '#2f3640', bx + 0.4, y + 0.35, bz + bd / 2 + 0.01); // pass office counter
    k.box(1.4, 0.06, 0.55, C.white, 0.62, y + STOREY * 1.05, 0.42);
    k.box(1.42, 0.03, 0.57, '#2bb3a3', 0.62, y + STOREY * 1.05 - 0.02, 0.42);
    for (const x of [-0.02, 1.27]) k.box(0.05, STOREY * 1.05, 0.05, C.white, x, y, 0.66);
    turnstile(k, 0.25, 0.55, y, 5, 0);
    turnstile(k, 0.85, 0.55, y, 5, 2.5);
    walker(k, 0.18, y, 1.1, 0.15, 5, 0, 1, '#e94f37');
    walker(k, 0.78, y, 1.1, 0.15, 5, 2.5, 2, '#2f6fa8');
    k.bench(1.25, 0.75, 0.4, y, Math.PI / 2);
    const v = car(k, 'sedan', '#2f6fa8');
    drive(k, v, ly);
    checker(k, y, -0.15, 0.18, stopOf(v));
    return;
  }
  if (level === 12) {
    // Vehicle screening bay: yellow X-ray gantry glides over a waiting truck; control room with a glowing scan screen
    boom(k, ly, 'modern');
    const v = car(k, 'truck');
    const sz = stopOf(v);
    const gantry = new THREE.Group();
    for (const s of [-1, 1]) k.box(0.1, 1.35, 0.16, HAZ, s * (LW / 2 + 0.08), 0, 0, gantry);
    k.box(LW + 0.3, 0.16, 0.2, HAZ, 0, 1.35, 0, gantry);
    k.box(LW * 0.7, 0.08, 0.14, '#33383d', 0, 1.27, 0, gantry);
    const scan = new THREE.Mesh(new THREE.BoxGeometry(LW * 0.7, 0.02, 0.04), glow('#3fd1ff', 1.4));
    scan.position.y = 1.22;
    gantry.add(scan);
    k.add(gantry);
    for (const s of [-1, 1]) k.box(0.06, 0.02, 1.4, '#33383d', LX + s * (LW / 2 + 0.08), ly, sz - 0.1);
    k.anims.push((t) => {
      const c = cyc(t);
      const u = c < 0.27 ? 0 : c < 0.4 ? smooth((c - 0.27) / 0.13) : c < 0.9 ? 1 - smooth(Math.min(1, (c - 0.4) / 0.2)) : 0;
      gantry.position.set(LX, ly, sz + 0.6 - u * 1.15);
    });
    const bx = 0.75, bz = -0.4, bw = 1.25, bd = 0.95;
    k.box(bw, STOREY, bd, '#b9b4aa', bx, y, bz);
    k.door('front', bx, bz, bw, bd, 0.3, y, 0.36, 0.62, '#4a4f54');
    k.box(bw + 0.25, STOREY * 1.05, bd + 0.05, '#86b7cc', bx - 0.12, y + STOREY, bz);
    for (let i = 0; i <= 5; i++) k.box(0.03, STOREY * 1.05, bd + 0.07, C.trim, bx - 0.12 - (bw + 0.25) / 2 + ((bw + 0.25) / 5) * i, y + STOREY, bz);
    k.box(bw + 0.35, 0.1, bd + 0.15, C.white, bx - 0.12, y + STOREY * 2.05, bz);
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.3, 0.5), glow('#3fd1ff', 0.8));
    screen.position.set(bx - 0.12 - (bw + 0.25) / 2 + 0.06, y + STOREY + 0.45, bz);
    k.add(screen);
    k.anims.push((t) => ((screen.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + Math.abs(Math.sin(t * 2.2)) * 0.9));
    k.box(0.8, 0.5, 0.55, '#d8d4ca', bx + 0.05, y + STOREY * 2.15, bz - 0.12);
    for (let i = 0; i < 5; i++) k.box(0.6, 0.03, 0.02, '#a9a49a', bx + 0.05, y + STOREY * 2.15 + 0.1 + i * 0.08, bz + 0.16);
    k.aircon(bx - 0.4, y + STOREY * 2.15, bz + 0.25);
    k.antenna(bx + 0.45, y + STOREY * 2.15, bz + 0.25, 0.7);
    board(k, 'SCREENING', 0.7, 0.14, LX, ly + 1.55, sz + 0.62, '#33383d', HAZ);
    trafficLight(k, -0.22, 0.85, y, 0.8);
    drive(k, v, ly);
    checker(k, y, -0.15, 0.4, sz);
    return;
  }
  if (level === 13) {
    // Rising-bollard gate: steel bollards sink to let traffic through; mono-pitch green-roofed booth cantilevered over the island
    risingBollards(k, ly);
    trafficLight(k, -0.22, 0.5, y, 0.85);
    const bx = 0.75, bz = -0.45, bw = 1.3, bd = 0.8;
    k.box(bw, STOREY, bd, '#e8e6e0', bx, y, bz);
    k.box(bw - 0.05, 0.3, 0.02, DARK_GLASS, bx, y + 0.4, bz + bd / 2 + 0.01);
    k.box(0.02, 0.3, bd - 0.1, DARK_GLASS, bx - bw / 2 - 0.01, y + 0.4, bz);
    // Upper floor cantilevers forward over the island, under a green mono-pitch roof
    const uz = bz + 0.25;
    k.box(bw + 0.1, STOREY, bd + 0.5, '#f2f0ea', bx - 0.05, y + STOREY, uz);
    k.box(bw + 0.12, 0.36, 0.02, DARK_GLASS, bx - 0.05, y + STOREY + 0.32, uz + (bd + 0.5) / 2 + 0.01);
    k.box(0.02, 0.36, bd + 0.3, DARK_GLASS, bx - 0.05 - (bw + 0.1) / 2 - 0.01, y + STOREY + 0.32, uz);
    const roof = k.box(bw + 0.3, 0.07, bd + 0.75, C.roofGreen, bx - 0.05, y + STOREY * 2 + 0.12, uz);
    roof.rotation.z = 0.16;
    k.box(bw + 0.32, 0.04, bd + 0.77, C.white, bx - 0.05, y + STOREY * 2 + 0.06, uz);
    for (const x of [bx - 0.6, bx + 0.5]) k.box(0.06, STOREY, 0.06, C.white, x, y, uz + (bd + 0.5) / 2 - 0.06);
    k.planter(1.15, 0.75, 0.5, y);
    k.bicycleRack(0.55, 0.78, 2, y);
    cctv(k, -0.22, -0.85, y, 1.2, Math.PI);
    const v = car(k, 'jeep');
    drive(k, v, ly);
    checker(k, y, -0.15, 0.2, stopOf(v));
    return;
  }
  if (level === 14) {
    // Gate bridge: the guard office bridges over the lane on columns; traffic passes underneath
    boom(k, ly, 'modern');
    trafficLight(k, -0.22, 0.75, y, 0.8);
    const bz = -0.5, bd = 0.7, by = y + 1.05;
    // Tower on the island
    const tx = 0.75, tw = 1.25;
    k.box(tw, STOREY * 2.5, bd + 0.2, '#f2f0ea', tx, y, bz);
    for (let i = 0; i < 2; i++) k.box(tw - 0.1, 0.32, 0.02, DARK_GLASS, tx, y + 0.4 + i * STOREY * 1.1, bz + (bd + 0.2) / 2 + 0.01);
    k.box(tw + 0.06, 0.07, bd + 0.26, C.trim, tx, y + STOREY * 2.5, bz);
    k.door('front', tx, bz, tw, bd + 0.2, 0.35, y, 0.36, 0.62, DARK_GLASS);
    // Bridge span over the lane
    const x0 = LX - LW / 2 - 0.1, x1 = tx - tw / 2;
    const bw = x1 - x0, bx = (x0 + x1) / 2;
    k.box(bw, 0.9, bd, '#e8e6e0', bx, by, bz);
    k.box(bw, 0.32, 0.02, DARK_GLASS, bx, by + 0.36, bz + bd / 2 + 0.01);
    k.box(bw + 0.04, 0.06, bd + 0.04, C.trim, bx, by + 0.9, bz);
    k.box(bw + 0.04, 0.06, bd + 0.04, C.trim, bx, by - 0.03, bz);
    for (const z of [bz - bd / 2 + 0.06, bz + bd / 2 - 0.06]) k.box(0.1, 1.05, 0.1, '#e8e6e0', x0 + 0.05, y, z);
    crest(k, LX, by + 0.6, bz + bd / 2 + 0.03, 0.12);
    for (const s of [-1, 1]) {
      const cam = new THREE.Group();
      cam.position.set(s < 0 ? x0 + 0.05 : x1 - 0.05, by - 0.06, bz + bd / 2 + 0.02);
      k.box(0.14, 0.06, 0.06, '#f4f4f0', 0, 0, 0.05, cam);
      k.add(cam);
      k.anims.push((t) => (cam.rotation.y = Math.sin(t * 0.5 + s) * 0.6));
    }
    k.solarPanels(tx, y + STOREY * 2.5 + 0.07, bz, 0.9, 0.5);
    k.planter(0.5, 0.75, 0.6, y);
    k.hedge(1.15, 0.75, 0.5, 0.2, y);
    const v = car(k, 'jeep');
    drive(k, v, ly);
    checker(k, y, -0.15, 0.22, stopOf(v));
    return;
  }
  // 15: landmark gate: sweeping white wing canopy with a gold edge and LED welcome strip over a glass drum pavilion
  boom(k, ly, 'modern');
  trafficLight(k, -0.22, 0.82, y, 0.8);
  const px = 0.75, pz = -0.3;
  k.cyl(0.55, STOREY * 2, '#86b7cc', px, y, pz, 16);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    k.box(0.04, STOREY * 2, 0.04, C.trim, px + Math.cos(a) * 0.55, y, pz + Math.sin(a) * 0.55);
  }
  k.cyl(0.57, 0.06, GOLD, px, y + STOREY, pz, 16);
  k.cyl(0.62, 0.1, C.white, px, y + STOREY * 2, pz, 16);
  // Wing canopy: three tilted white slabs sweeping up over the lane
  const wing = new THREE.Group();
  wing.position.set(0.2, y + STOREY * 2 + 0.12, -0.15);
  k.box(2.4, 0.07, 0.95, C.white, -0.45, 0, 0.1, wing);
  k.box(2.42, 0.05, 0.06, GOLD, -0.45, 0.01, 0.59, wing);
  k.box(2.42, 0.05, 0.06, GOLD, -0.45, 0.01, -0.39, wing);
  wing.rotation.z = -0.13;
  k.add(wing);
  for (const z of [-0.35, 0.5]) k.box(0.07, STOREY * 2 + 0.35, 0.07, C.white, -1.42, y, z);
  // LED welcome strip that scrolls
  const tex = (signMat('WELCOME  ·  SELAMAT DATANG  ·  ', '#1f2a2e', '#ffc93c', 30).map)!;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(0.6, 1);
  const led = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 0.02), new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.7 }));
  led.position.set(LX, y + STOREY * 2 + 0.05, 0.47);
  k.add(led);
  k.anims.push((t) => (tex.offset.x = (t * 0.08) % 1));
  // Monument with the crest
  k.box(0.3, 0.9, 0.3, CONCRETE, 1.25, y, 0.65);
  k.box(0.32, 0.05, 0.32, GOLD, 1.25, y + 0.9, 0.65);
  crest(k, 1.25, y + 0.55, 0.81, 0.11);
  for (const x of [0.25, 0.55]) k.planter(x, 0.78, 0.25, y);
  for (const x of [1.05, 1.25, 1.42]) k.flagpole(x, -0.85, 2.1, y);
  const v = car(k, 'sedan', '#f2f0ea');
  drive(k, v, ly);
  checker(k, y, -0.15, 0.2, stopOf(v));
  patrol(k, y, 0.2, 0.45, 1.05, 0.45, 9, 5);
}

// ------------------------------------------------------------------ secure (16–20)

function secure(k: Kit, level: number, y: number) {
  const ly = lane(k, '#3f4448', 'modern');
  if (level === 16) {
    // Hardened checkpoint: T-wall blast barriers, concrete bunker with slit windows and a camera turret, wedge barrier and tyre spikes
    wedge(k, ly);
    spikes(k, ly, BZ - 0.42);
    trafficLight(k, -0.22, 0.6, y, 0.85);
    for (let i = 0; i < 4; i++) tWall(k, -1.44, -0.72 + i * 0.48, y, Math.PI / 2);
    const bx = 0.75, bz = -0.4, bw = 1.3, bd = 0.95;
    k.box(bw, STOREY * 2.2, bd, CONCRETE, bx, y, bz);
    for (let i = 1; i < 4; i++) k.box(bw + 0.02, 0.025, bd + 0.02, '#a9a49a', bx, y + i * 0.5, bz);
    for (const yy of [0.55, 0.55 + STOREY]) {
      k.box(bw - 0.3, 0.07, 0.02, '#1f2326', bx, y + yy, bz + bd / 2 + 0.01);
      k.box(0.02, 0.07, bd - 0.3, '#1f2326', bx - bw / 2 - 0.01, y + yy, bz);
    }
    k.box(0.4, 0.62, 0.04, '#5c6166', bx + 0.3, y, bz + bd / 2 + 0.01); // blast door
    for (let i = 0; i < 6; i++) k.box(0.07, 0.06, 0.045, i % 2 ? C.kerbB : HAZ, bx + 0.3 - 0.175 + i * 0.07, y + 0.62, bz + bd / 2 + 0.012);
    k.box(bw + 0.2, 0.14, bd + 0.2, '#a9a49a', bx, y + STOREY * 2.2, bz);
    // Armoured cupola with a rotating camera turret
    k.cyl(0.26, 0.3, '#5c6166', bx - 0.2, y + STOREY * 2.2 + 0.14, bz, 8);
    const turret = new THREE.Group();
    turret.position.set(bx - 0.2, y + STOREY * 2.2 + 0.44, bz);
    k.box(0.3, 0.14, 0.22, '#4a4f54', 0, 0, 0, turret);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8).rotateZ(Math.PI / 2), glow('#ff3b30', 0.8));
    lens.position.set(0.16, 0.07, 0);
    turret.add(lens);
    k.add(turret);
    k.anims.push((t) => (turret.rotation.y = Math.sin(t * 0.35) * 1.4 + Math.PI * 0.8));
    k.antenna(bx + 0.45, y + STOREY * 2.2 + 0.14, bz - 0.3, 0.8);
    k.sandbags(0.15, 0.75, 0.6, 0, y, 3);
    // Sally port: a heavy concrete roof over the rear of the lane, on the T-walls and a pier
    k.box(0.16, 1.2, 0.5, CONCRETE, -0.26, y, -0.68);
    k.box(LW + 0.35, 0.22, 0.8, CONCRETE, LX + 0.05, y + 1.2, -0.58);
    for (let i = 0; i < 6; i++) k.box((LW + 0.35) / 6 - 0.01, 0.08, 0.02, i % 2 ? C.kerbB : HAZ, LX + 0.05 - (LW + 0.35) / 2 + ((LW + 0.35) / 6) * (i + 0.5), y + 1.2, -0.17);
    const v = car(k, 'jeep');
    drive(k, v, ly);
    checker(k, y, -0.15, 0.22, stopOf(v));
    return;
  }
  if (level === 17) {
    // Serpentine chicane: staggered jersey barriers the jeep slaloms through, armoured cab on a steel stilt frame
    boom(k, ly, 'heavy');
    jersey(k, LX + 0.33, 0.65, ly, 0.36);
    jersey(k, LX - 0.33, -0.66, ly, 0.36);
    trafficLight(k, -0.22, 0.85, y, 0.85);
    const bx = 0.75, bz = -0.35;
    k.box(1.2, 0.85, 0.8, '#5d6b35', bx, y, bz); // container office
    for (let i = 0; i < 9; i++) k.box(0.02, 0.85, 0.82, '#4b5a2c', bx - 0.56 + i * 0.14, y, bz);
    k.box(0.3, 0.6, 0.02, '#4b5a2c', bx + 0.3, y, bz + 0.41);
    for (const [dx, dz] of [[-0.55, -0.4], [0.55, -0.4], [-0.55, 0.4], [0.55, 0.4]]) k.box(0.08, 1.6, 0.08, '#4a4f54', bx + dx, y, bz + dz);
    for (const dz of [-0.4, 0.4]) {
      const brace = k.box(1.2, 0.04, 0.04, '#4a4f54', bx, y + 1.15, bz + dz);
      brace.rotation.z = 0.5;
    }
    // Armoured observation cab
    const cy = y + 1.6;
    k.box(1.3, 0.08, 1.0, '#4a4f54', bx, cy, bz);
    k.box(1.15, 0.7, 0.85, '#6b7a4a', bx, cy + 0.08, bz);
    for (let i = 0; i < 4; i++) k.box(0.2, 0.06, 0.02, '#1f2326', bx - 0.4 + i * 0.27, cy + 0.5, bz + 0.43);
    k.box(0.02, 0.06, 0.6, '#1f2326', bx - 0.585, cy + 0.5, bz);
    const lid = k.box(1.3, 0.08, 1.0, '#5d6b35', bx, cy + 0.78, bz);
    lid.rotation.z = -0.05;
    k.stairs(bx + 0.3, bz + 0.85, 0.24, 0.6, 0.85);
    searchlight(k, bx - 0.4, cy + 0.86, bz + 0.2, 2.4, 1);
    cctv(k, 1.38, 0.8, y, 1.2, Math.PI / 2);
    // Camouflage net strung over the rear of the lane; it breathes in the wind
    for (const [x, z] of [[-1.44, -0.9], [-1.44, -0.05], [-0.26, -0.05]]) k.box(0.04, 1.35, 0.04, '#6b4a30', x, y, z);
    const net = new THREE.Group();
    net.position.set(LX, y + 1.35, -0.48);
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.3), M(['#5d6b35', '#4b5a2c', '#6e7a45', '#7a6a4a'][i % 4]));
      p.position.set(-0.42 + (i % 4) * 0.28, (i % 3) * 0.02, -0.2 + Math.floor(i / 4) * 0.3);
      p.rotation.y = i * 0.4;
      net.add(p);
    }
    k.add(net);
    k.anims.push((t) => {
      net.position.y = y + 1.35 + Math.sin(t * 1.3) * 0.025;
      net.rotation.z = Math.sin(t * 0.9) * 0.03;
    });
    patrol(k, y, 0.1, 0.7, 1.05, 0.7, 10, 6);
    const v = car(k, 'jeep');
    drive(k, v, ly, 0.2);
    checker(k, y, -0.15, 0.2, stopOf(v));
    return;
  }
  if (level === 18) {
    // Biometric gate: sleek white curved block, pedestrian speed gates, face-scan arch over the lane
    boom(k, ly, 'modern');
    const bx = 0.72, bz = -0.42, bw = 1.4, bd = 0.95;
    k.box(bw - 0.35, STOREY * 2.4, bd, '#f4f4f0', bx + 0.17, y, bz);
    k.cyl(bd / 2, STOREY * 2.4, '#f4f4f0', bx - bw / 2 + bd / 2, y, bz, 16);
    for (let i = 0; i < 2; i++) {
      k.box(bw - 0.3, 0.2, 0.02, '#2a3a44', bx + 0.17, y + 0.5 + i * STOREY * 1.1, bz + bd / 2 + 0.01);
      k.cyl(bd / 2 + 0.01, 0.2, '#2a3a44', bx - bw / 2 + bd / 2, y + 0.5 + i * STOREY * 1.1, bz, 16);
    }
    k.cyl(bd / 2 + 0.04, 0.06, '#2bb3a3', bx - bw / 2 + bd / 2, y + STOREY * 2.4, bz, 16);
    k.hedge(bx + 0.17, bz, bw - 0.45, bd - 0.15, y + STOREY * 2.4);
    k.cyl(bd / 2 - 0.05, 0.12, '#3f8a2e', bx - bw / 2 + bd / 2, y + STOREY * 2.4, bz, 16);
    // Face-scan arch: a light bar runs up and down the posts while the vehicle waits
    const v = car(k, 'van', '#f4f4f0');
    const az = stopOf(v) - 0.25;
    for (const s of [-1, 1]) k.box(0.1, 1.2, 0.12, '#e8e6e0', LX + s * (LW / 2 + 0.06), ly, az);
    k.box(LW + 0.22, 0.12, 0.14, '#e8e6e0', LX, ly + 1.2, az);
    const bars: THREE.Mesh[] = [];
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.1), glow('#3fd1ff', 1.5));
      b.position.set(LX + s * (LW / 2 + 0.005), ly + 0.3, az);
      k.add(b);
      bars.push(b);
    }
    k.anims.push((t) => {
      const c = cyc(t);
      const on = c > 0.25 && c < 0.42;
      for (const b of bars) {
        b.visible = on;
        b.position.y = ly + 0.2 + (0.5 + 0.5 * Math.sin(t * 6)) * 0.85;
      }
    });
    // Pedestrian speed gates with people passing through
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.04, 0.6), M('#bfe6f2', { transparent: true, opacity: 0.55 }));
    canopy.position.set(0.58, y + STOREY * 1.15, 0.52);
    k.add(canopy);
    k.box(1.17, 0.05, 0.04, '#2bb3a3', 0.58, y + STOREY * 1.15 - 0.02, 0.83);
    for (const x of [0.03, 1.13]) k.box(0.05, STOREY * 1.15, 0.05, '#e8e6e0', x, y, 0.8);
    speedGate(k, 0.3, 0.55, y, 4.5, 0);
    speedGate(k, 0.85, 0.55, y, 4.5, 2.2);
    walker(k, 0.3, y, 1.05, 0.05, 4.5, 0, 1, '#ff8a3d');
    walker(k, 0.85, y, 1.05, 0.05, 4.5, 2.2, 3, '#8a5cb8');
    trafficLight(k, -0.22, 0.88, y, 0.8);
    drive(k, v, ly);
    checker(k, y, -0.15, 0.25, stopOf(v));
    return;
  }
  if (level === 19) {
    // Sensor gate: red laser tripwires across the lane, thermal-camera mast with a spinning radar bar, armour-plated guard post
    boom(k, ly, 'heavy');
    const lz = BZ - 0.35;
    for (const s of [-1, 1]) k.box(0.08, 0.75, 0.08, '#33383d', LX + s * (LW / 2 + 0.05), ly, lz);
    const beams: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(LW + 0.05, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: '#ff2a2a', transparent: true, opacity: 0.8 }));
      b.position.set(LX, ly + 0.18 + i * 0.22, lz);
      k.add(b);
      beams.push(b);
    }
    k.anims.push((t) => {
      const o = openAt(cyc(t));
      beams.forEach((b, i) => {
        b.visible = o < 0.3;
        (b.material as THREE.MeshBasicMaterial).opacity = 0.5 + 0.4 * Math.abs(Math.sin(t * 4 + i));
      });
    });
    // Sensor canopy over the rear of the lane with pods that scan passing vehicles
    for (const x of [LX - LW / 2 - 0.05, LX + LW / 2 + 0.05]) k.box(0.08, 1.45, 0.08, '#33383d', x, y, -0.7);
    k.box(LW + 0.3, 0.1, 0.55, '#3f474d', LX, y + 1.45, -0.62);
    k.box(LW + 0.32, 0.04, 0.04, HAZ, LX, y + 1.45, -0.34);
    for (const x of [LX - 0.3, LX + 0.3]) {
      const pod = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), glow('#3fd1ff', 0.6));
      pod.position.set(x, y + 1.4, -0.5);
      k.add(pod);
      k.anims.push((t) => ((pod.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3 + Math.abs(Math.sin(t * 3 + x)) * 1.2));
    }
    const bx = 0.62, bz = -0.4, bw = 1.4, bd = 1.0;
    k.box(bw, STOREY * 2.3, bd, '#5c6870', bx, y, bz);
    k.box(1.2, 0.1, 0.6, '#4a555c', 0.5, y + STOREY * 1.2, 0.4);
    k.box(1.22, 0.04, 0.62, HAZ, 0.5, y + STOREY * 1.2 - 0.03, 0.4);
    for (const x of [0.0, 0.9]) k.box(0.06, STOREY * 1.2, 0.06, '#33383d', x, y, 0.6);
    for (const s of [-1, 1]) {
      const plate = k.box(0.12, STOREY * 2.2, bd + 0.04, '#4a555c', bx + s * (bw / 2 + 0.02), y, bz);
      plate.rotation.z = -s * 0.08;
    }
    k.box(bw - 0.2, 0.34, 0.02, '#1f2a2e', bx, y + STOREY + 0.32, bz + bd / 2 + 0.01);
    for (let i = 0; i < 3; i++) {
      const sc = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.01), glow(['#3fd1ff', '#3fd16b', '#ffb020'][i], 0.9));
      sc.position.set(bx - 0.3 + i * 0.3, y + STOREY + 0.5, bz + bd / 2 + 0.02);
      k.add(sc);
      k.anims.push((t) => ((sc.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.5 + Math.abs(Math.sin(t * 1.7 + i)) * 0.9));
    }
    k.door('front', bx, bz, bw, bd, -0.35, y, 0.36, 0.62, '#33383d');
    k.solarPanels(bx, y + STOREY * 2.3, bz, bw - 0.2, bd - 0.3);
    // Sensor mast
    const mx = 1.3, mz = 0.6;
    k.box(0.3, 0.1, 0.3, CONCRETE, mx, y, mz);
    k.cyl(0.05, 2.3, C.metal, mx, y + 0.1, mz, 6);
    const head = new THREE.Group();
    head.position.set(mx, y + 2.0, mz);
    k.box(0.22, 0.14, 0.16, '#e8e6e0', 0.06, 0, 0, head);
    const ir = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 8).rotateZ(Math.PI / 2), glow('#ff3b30', 0.9));
    ir.position.set(0.18, 0.07, 0);
    head.add(ir);
    k.add(head);
    k.anims.push((t) => (head.rotation.y = Math.PI * 0.8 + Math.sin(t * 0.5) * 1.2));
    const radar = new THREE.Group();
    radar.position.set(mx, y + 2.42, mz);
    k.box(0.6, 0.05, 0.05, '#e8e6e0', 0, 0, 0, radar);
    k.box(0.04, 0.12, 0.06, '#e8e6e0', 0.28, 0.04, 0, radar);
    k.add(radar);
    k.anims.push((t) => (radar.rotation.y = t * 2.2));
    k.blinker(mx, y + 2.5, mz, '#ff3b30', 0.03, 1.1);
    trafficLight(k, -0.22, 0.88, y, 0.8);
    const v = car(k, 'jeep');
    drive(k, v, ly);
    checker(k, y, -0.15, 0.25, stopOf(v));
    return;
  }
  // 20: citadel gate: fortress portal over the lane with a rising steel portcullis, gold crest, glass command cab
  const pz = BZ, pd = 0.42;
  const portcullis = new THREE.Group();
  for (let i = 0; i < 7; i++) k.box(0.04, 0.85, 0.04, '#4a4f54', -LW / 2 + 0.07 + i * ((LW - 0.14) / 6), 0, 0, portcullis);
  for (let j = 0; j < 4; j++) k.box(LW - 0.04, 0.04, 0.05, '#5c6166', 0, 0.1 + j * 0.24, 0, portcullis);
  k.box(LW - 0.04, 0.06, 0.06, HAZ, 0, 0.02, 0, portcullis);
  k.add(portcullis);
  k.anims.push((t) => portcullis.position.set(LX, ly + openAt(cyc(t)) * 0.95, pz));
  // Piers and lintel
  const lx0 = LX - LW / 2 - 0.12, lx1 = LX + LW / 2 + 0.12;
  k.box(0.16, 1.15, pd, CONCRETE, lx0 + 0.02, y, pz);
  k.box(lx1 - lx0 + 0.1, 0.75, pd + 0.06, CONCRETE, LX, y + 1.15, pz);
  k.box(lx1 - lx0 + 0.12, 0.07, pd + 0.08, GOLD, LX, y + 1.86, pz);
  crest(k, LX, y + 1.5, pz + pd / 2 + 0.04, 0.17);
  // Main block on the island with gold fins and a glass command cab above
  const bx = 0.6, bz = -0.35, bw = 1.6, bd = 1.0;
  k.box(bw, STOREY * 2, bd, CONCRETE, bx, y, bz);
  k.box(bw - 0.3, 0.34, 0.02, DARK_GLASS, bx, y + 0.42, bz + bd / 2 + 0.01);
  k.fins(bw - 0.3, STOREY * 2 - 0.1, bx, y + 0.05, bz + bd / 2 + 0.07, 8);
  for (let i = 0; i < 9; i++) k.box(0.02, STOREY * 2 - 0.1, 0.02, GOLD, bx - (bw - 0.3) / 2 + ((bw - 0.3) / 8) * i, y + 0.05, bz + bd / 2 + 0.135);
  k.box(bw + 0.08, 0.08, bd + 0.08, GOLD, bx, y + STOREY * 2, bz);
  const cx = 0.2, cw = 1.5;
  k.box(cw, 0.62, 0.8, '#86b7cc', cx, y + STOREY * 2 + 0.08, bz);
  for (let i = 0; i <= 5; i++) k.box(0.03, 0.62, 0.82, C.trim, cx - cw / 2 + (cw / 5) * i, y + STOREY * 2 + 0.08, bz);
  k.box(cw + 0.12, 0.08, 0.92, C.roofGreen, cx, y + STOREY * 2 + 0.7, bz);
  k.box(cw + 0.14, 0.04, 0.94, GOLD, cx, y + STOREY * 2 + 0.67, bz);
  k.antenna(cx + 0.6, y + STOREY * 2 + 0.78, bz - 0.25, 0.7);
  for (const x of [0.35, 0.75, 1.15]) k.cyl(0.06, 0.32, CONCRETE, x, y, 0.78, 8);
  for (const x of [0.35, 0.75, 1.15]) k.cyl(0.062, 0.04, GOLD, x, y + 0.32, 0.78, 8);
  cctv(k, -0.22, 0.85, y, 1.3, Math.PI / 2);
  cctv(k, 1.4, -0.85, y, 1.3, Math.PI);
  trafficLight(k, -0.22, 0.45, y, 0.8);
  k.flagpole(1.35, 0.5, 2.2, y);
  const v = car(k, 'jeep', OLIVE_D);
  drive(k, v, ly);
  checker(k, y, -0.15, 0.25, stopOf(v));
}

export function buildGuardhouse(level: number): Kit {
  const k = new Kit();
  const y = k.pad(3, 2);
  if (level <= 3) field(k, level, y);
  else if (level <= 6) camp(k, level, y);
  else if (level <= 10) base(k, level, y);
  else if (level <= 15) command(k, level, y);
  else secure(k, level, y);
  return k;
}

export const GUARDHOUSE: BuildingDef = {
  id: 'guardhouse',
  name: 'Guardhouse',
  role: 'The camp entrance and first line of defence. Puts sentries on duty and spots raiders early.',
  footprint: [3, 2],
  unlockHq: 6,
  levels: GUARDHOUSE_LEVELS,
  designedLevels: 20,
  build: buildGuardhouse,
};
