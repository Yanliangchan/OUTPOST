import * as THREE from 'three';
import { C, Kit, STOREY, mat } from './kit';
import { CONCRETE, DARK_GLASS, GOLD } from './common';
import { timeUniform } from '../core/wind';
import { DAY, HOUR, type BuildingDef, type LevelStats } from './types';

/*
 * Firing Range: trains marksmanship. Boosts the accuracy and damage of every
 * defence camp-wide and raises troop marksmanship. Signature at every level:
 * firing lanes running along x, a firing point at the +x end where Recruits
 * shoot (prone, kneeling, standing) with muzzle flash and recoil, pop-up targets
 * at the -x end that get hit and fall on a loop, an earth berm / bullet catcher
 * behind them, a red range flag flying while the range is live, and a range
 * officer walking the line. Footprint 5×3; long and low (bulk ≤ ~3 storeys).
 */

// ------------------------------------------------------------------ stats

const TITLES = [
  'Bale Range', 'Field Range', 'Sandbag Range', 'Camp Range', 'Range Tower', 'Butts Range',
  'Concrete Range', 'Electronic Range', 'Control Tower Range', 'Range Complex', 'Baffle Range', 'Rail Target Range',
  'Indoor Range', 'Gallery Range', 'Landmark Range', 'Hardened Range', 'Smart Range', 'Armoured Hall',
  'Simulator Range', 'Citadel Range',
];
const SUPPLIES = [250_000, 320_000, 405_000, 510_000, 650_000, 825_000, 1_050_000, 1_330_000, 1_690_000, 2_150_000, 2_730_000, 3_470_000, 4_400_000, 5_590_000, 7_100_000, 9_020_000, 11_450_000, 14_550_000, 18_450_000, 23_450_000];
const REPUTATION = [3_000, 3_350, 3_750, 4_150, 4_650, 5_150, 5_750, 6_450, 7_150, 8_000, 8_900, 9_950, 11_100, 12_350, 13_750, 15_350, 17_100, 19_100, 21_300, 23_750];
const TIME = [6 * HOUR, 8 * HOUR, 10 * HOUR, 12 * HOUR, 16 * HOUR, 20 * HOUR, 1 * DAY, 1.25 * DAY, 1.5 * DAY, 2 * DAY, 2.5 * DAY, 3 * DAY, 3.5 * DAY, 4 * DAY, 4.5 * DAY, 5 * DAY, 5.5 * DAY, 6 * DAY, 7 * DAY, 8 * DAY];
/** Firing lanes per level (2 → 8). */
const LANES = [2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8, 8, 8, 8, 8, 8];

export const FIRING_RANGE_LEVELS: LevelStats[] = TITLES.map((title, i) => {
  const level = i + 1;
  const lanes = LANES[i];
  const accuracy = Math.round(2 + (i * 28) / 19);
  const damage = Math.round(1 + (i * 14) / 19);
  const marksmanship = Math.round(5 + (i * 55) / 19);
  return {
    level, title,
    supplies: SUPPLIES[i],
    reputation: REPUTATION[i],
    buildTime: TIME[i],
    hp: Math.round((1000 * Math.pow(1.2, i)) / 10) * 10,
    stats: { lanes, defenceAccuracy: accuracy, defenceDamage: damage, marksmanship },
    unlocks: [`${lanes} firing lanes`, `Defences +${accuracy}% accuracy, +${damage}% damage camp-wide`, `Troop marksmanship +${marksmanship}%`],
  };
});

// ------------------------------------------------------------------ palette & layout

const OLIVE = '#5b6b3a';
const OLIVE_D = '#46542c';
const SKIN = ['#e0ac7e', '#c68b5f', '#a8714b', '#f0c39a'];
const GUN = '#26292c';
const GUN_L = '#3b4045';
const RED = '#d8342c';
const HAZ = '#f2c230';
const STRAW = '#e0bf5c';
const STRAW_D = '#b8963e';
const EARTH = '#b07a4a';
const EARTH_D = '#9a6a42';
const GRASS = '#5f9e38';
const TEAL = '#2bb3a3';
const CYAN = '#3fd1ff';
const STEEL = '#929ba0';
const STEEL_D = '#6f787d';
const TIMBER = '#8a6040';
const M = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8, ...o });
const glow = (c: string, i = 1, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, flatShading: true, ...o });

/** Lanes run along x and span z ∈ [Z0, Z1]; the strip behind them (z < Z0) holds walls, huts and towers. */
const Z0 = -0.98;
const Z1 = 1.3;
const ZB = -1.22; // back strip centre
/** Berm front foot, target hinge line, mantlet, shooter origin, range-officer walk line, firing-point building front. */
const XB = -1.84;
const XT = -1.58;
const XM = XT + 0.2;
/** Mid-range target row (base band and up). */
const MID = -0.45;
const XF = 1.0;
const XI = 1.6;
const XS = 1.74;
/** Range tower corner (back-right). */
const TX = 2.1, TZ = -1.1, TW = 0.62, TD = 0.6;

const laneW = (n: number) => (Z1 - Z0) / n;
const laneZ = (i: number, n: number) => Z0 + laneW(n) * (i + 0.5);

// ------------------------------------------------------------------ the shooting cycle

const PERIOD = 5.6;
const smooth = (u: number) => u * u * (3 - 2 * u);
/** Position 0..1 through a lane's cycle; lanes are staggered so the line fires in a ripple. */
const lc = (t: number, lane: number) => ((((t / PERIOD) + lane * 0.37) % 1) + 1) % 1;
/** A sighter that misses, then the hit that drops the target. */
const SHOTS = [0.3, 0.42];
const HIT = 0.42;
function kickAt(c: number) {
  let k = 0;
  for (const s of SHOTS) {
    const d = c - s;
    if (d >= 0 && d < 0.07) k = Math.max(k, 1 - d / 0.07);
  }
  return k;
}
const flashAt = (c: number) => SHOTS.some((s) => c >= s && c < s + 0.02);
/** 0 = target up, 1 = flat on its back. Rises again at 0.84–0.94. */
function fallAt(c: number) {
  if (c < 0.44) return 0;
  if (c < 0.52) return smooth((c - 0.44) / 0.08);
  if (c < 0.84) return 1;
  if (c < 0.94) return 1 - smooth((c - 0.84) / 0.1);
  return 0;
}
/** Shooter rests the weapon while the target is down. */
const restAt = (c: number) => (c < 0.55 ? 0 : c < 0.62 ? smooth((c - 0.55) / 0.07) : c < 0.8 ? 1 : c < 0.88 ? 1 - smooth((c - 0.8) / 0.08) : 0);

// ------------------------------------------------------------------ small geometry helpers

function part(parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
/** Centred box. */
const cb = (parent: THREE.Object3D, w: number, h: number, d: number, c: string, x: number, y: number, z: number) => part(parent, new THREE.BoxGeometry(w, h, d), mat(c), x, y, z);
/** A limb (box) running from a to b. */
function limb(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, th: number, c: string) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const m = part(parent, new THREE.BoxGeometry(th, dir.length() + th * 0.4, th), mat(c), (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return m;
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** A prism: a polygon in the x/y plane extruded along z (berms, awnings, sloped roofs). */
function prism(k: Kit, pts: [number, number][], depth: number, color: string, x: number, y: number, z: number, material?: THREE.Material) {
  const shape = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(geo, material ?? mat(color));
  m.position.set(x, y, z);
  return k.add(m);
}

// ------------------------------------------------------------------ signs

const texCache = new Map<string, THREE.MeshStandardMaterial>();
function signMat(text: string, bg: string, fg: string, font = 40, w = 256, h = 64, glowing = false) {
  const key = [text, bg, fg, font, w, h, glowing].join('|');
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.font = `900 ${font}px Nunito, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, ...(glowing ? { emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.8 } : {}) });
  texCache.set(key, m);
  return m;
}

/** Flat sign board with lettering on its front (+z before rotY) face; base at y. */
function board(k: Kit, text: string, w: number, h: number, x: number, y: number, z: number, bg: string, fg = '#ffffff', rotY = 0, font = 40, glowing = false) {
  const side = mat(bg);
  const cw = Math.round(256 * Math.max(1, w / h / 4));
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), [side, side, side, side, signMat(text, bg, fg, font, cw, 64, glowing), side]);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = rotY;
  return k.add(m);
}

/** "LIVE FIRING" danger board on two posts. */
function dangerBoard(k: Kit, x: number, z: number, y: number, rotY = 0.6, post = C.white) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  for (const s of [-0.2, 0.2]) cb(g, 0.035, 0.5, 0.035, post, s, 0.25, 0);
  k.add(g);
  const b = board(k, 'LIVE FIRING', 0.5, 0.2, 0, 0.36, 0.025, RED, '#ffffff', 0, 34);
  g.add(b);
}

// ------------------------------------------------------------------ the red range flag

function rangeFlag(k: Kit, x: number, z: number, y: number, h = 1.5, w = 0.52, pole: string = C.white) {
  k.cyl(0.024, h, pole, x, y, z, 6);
  k.cyl(0.04, 0.04, GOLD, x, y + h, z, 6);
  const geo = new THREE.PlaneGeometry(w, w * 0.62, 8, 1).translate(w / 2, 0, 0);
  const fm = new THREE.MeshStandardMaterial({ color: '#e0302a', side: THREE.DoubleSide, flatShading: true, roughness: 0.9 });
  fm.onBeforeCompile = (s) => {
    s.uniforms.uTime = timeUniform;
    s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      transformed.z += sin(position.x * 9.0 - uTime * 6.5) * 0.07 * position.x;
      transformed.y -= position.x * position.x * 0.1;`,
    );
  };
  fm.customProgramCacheKey = () => 'range-flag';
  const flag = new THREE.Mesh(geo, fm);
  flag.position.set(x + 0.025, y + h - w * 0.31 - 0.04, z);
  k.add(flag);
  k.flags.push(flag);
  // The flag streams out with the breeze, swinging round the pole as gusts shift.
  k.anims.push((t) => (flag.rotation.y = 0.5 + Math.sin(t * 0.55) * 0.35 + Math.sin(t * 1.7) * 0.08));
}

// ------------------------------------------------------------------ people

interface Figure { root: THREE.Group; legL: THREE.Object3D; legR: THREE.Object3D; armL: THREE.Object3D; armR: THREE.Object3D }

/** A ~0.6-tall figure facing +x with pivoting limbs (the range officer and helpers). */
function figure(seed: number, uniform = OLIVE, hat = '#2a3326', vest: string | null = null): Figure {
  const root = new THREE.Group();
  const add = (geo: THREE.BufferGeometry, c: string, x: number, yy: number, z: number, parent: THREE.Object3D = root) => part(parent, geo, mat(c), x, yy, z);
  const lg = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, -h / 2, 0);
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(0, 0.26, -0.045);
  legR.position.set(0, 0.26, 0.045);
  for (const l of [legL, legR]) {
    add(lg(0.065, 0.22, 0.065), OLIVE_D, 0, 0, 0, l);
    add(new THREE.BoxGeometry(0.09, 0.045, 0.07), '#2a2b2d', 0.012, -0.24, 0, l);
    root.add(l);
  }
  add(new THREE.BoxGeometry(0.12, 0.2, 0.17), uniform, 0, 0.36, 0);
  if (vest) add(new THREE.BoxGeometry(0.135, 0.15, 0.18), vest, 0, 0.38, 0);
  add(new THREE.BoxGeometry(0.125, 0.03, 0.175), '#2a2b2d', 0, 0.27, 0);
  add(new THREE.IcosahedronGeometry(0.062, 0), SKIN[seed % SKIN.length], 0, 0.52, 0);
  const b = add(new THREE.CylinderGeometry(0.068, 0.07, 0.035, 8), hat, -0.005, 0.578, 0.01);
  b.rotation.x = 0.2;
  add(new THREE.BoxGeometry(0.06, 0.012, 0.09), hat, 0.06, 0.565, 0); // cap peak
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(0, 0.45, -0.105);
  armR.position.set(0, 0.45, 0.105);
  for (const a of [armL, armR]) {
    add(lg(0.05, 0.18, 0.05), uniform, 0, 0, 0, a);
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

/**
 * The range officer walks up and down behind the firing line, stopping at each
 * end to face the targets and point down the range.
 */
function rangeOfficer(k: Kit, y: number, vest = '#f26b1d', hat = '#2a3326', x = XI, za = Z0 + 0.2, zb = Z1 - 0.2, seed = 1) {
  const f = figure(seed, OLIVE, hat, vest);
  k.add(f.root);
  // Clipboard in the left hand
  cb(f.armL, 0.1, 0.13, 0.015, '#f4f1e8', 0.04, -0.2, -0.02);
  const per = 13;
  k.anims.push((t) => {
    const p = (((t + seed * 2.3) % per) + per) % per / per;
    let z: number, walking = false, dir = 1;
    if (p < 0.14) z = za;
    else if (p < 0.5) { z = za + (zb - za) * smooth((p - 0.14) / 0.36); walking = true; }
    else if (p < 0.64) z = zb;
    else { z = zb + (za - zb) * smooth((p - 0.64) / 0.36); walking = true; dir = -1; }
    f.root.position.set(x, y, z);
    if (walking) {
      pose(f, t * 8.5);
      f.root.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    } else {
      pose(f, 0);
      f.root.rotation.y = Math.PI;
      f.armR.rotation.z = 1.45 + Math.sin(t * 2.5) * 0.08; // pointing down the range
      f.root.position.y = y + Math.sin(t * 1.3) * 0.004;
    }
  });
  return f;
}

/** A figure standing at ease that looks around (tower lookout, coach). */
function stander(k: Kit, x: number, z: number, y: number, rotY: number, seed = 2, vest: string | null = null, binos = false) {
  const f = figure(seed, OLIVE, '#2a3326', vest);
  f.root.position.set(x, y, z);
  f.root.rotation.y = rotY;
  k.add(f.root);
  if (binos) {
    f.armL.rotation.z = f.armR.rotation.z = 2.3;
    cb(f.root, 0.05, 0.05, 0.14, '#2a2b2d', 0.09, 0.53, 0);
  }
  k.anims.push((t) => {
    f.root.rotation.y = rotY + Math.sin(t * 0.45 + seed) * 0.45;
    if (!binos) f.armL.rotation.z = Math.sin(t * 0.9 + seed) * 0.1;
  });
  return f;
}

// ------------------------------------------------------------------ shooters

type Pose = 'prone' | 'kneel' | 'stand';
interface Gear { uniform: string; helmet: string; ear?: string; vest?: string; gun?: string; tracer?: string; /** x of a mid-range target row hit by the first shot */ mid?: number }

/**
 * A Recruit on the firing line, facing the targets (-x). The upper body and
 * weapon recoil on every shot; a muzzle flash, a spent-case puff and a tracer
 * fire with it. Synced to its lane's target through the shared lane cycle.
 */
function shooter(k: Kit, lane: number, x: number, z: number, y: number, p: Pose, gear: Gear, seed: number) {
  const root = new THREE.Group();
  root.position.set(x, y, z);
  k.add(root);
  const skin = SKIN[seed % SKIN.length];
  const U = gear.uniform;
  const boot = '#2a2b2d';
  const upper = new THREE.Group();
  root.add(upper);
  const gun = new THREE.Group();
  upper.add(gun);
  let hipY: number;
  if (p === 'prone') {
    hipY = 0.08;
    upper.position.set(0, 0, 0);
    // Torso lying along +x, legs spread behind
    cb(root, 0.26, 0.1, 0.17, U, 0.1, 0.06, 0);
    if (gear.vest) cb(root, 0.2, 0.06, 0.18, gear.vest, 0.08, 0.1, 0);
    for (const s of [-1, 1]) {
      limb(root, V(0.22, 0.05, s * 0.045), V(0.47, 0.04, s * 0.1), 0.065, OLIVE_D);
      cb(root, 0.045, 0.08, 0.07, boot, 0.5, 0.05, s * 0.1);
    }
    part(upper, new THREE.IcosahedronGeometry(0.06, 0), mat(skin), -0.06, 0.14, -0.01);
    const hel = part(upper, new THREE.SphereGeometry(0.07, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(gear.helmet), -0.06, 0.16, -0.01);
    hel.scale.y = 0.8;
    // Elbows planted, hands on the weapon
    limb(upper, V(0.0, 0.09, 0.08), V(-0.11, 0.03, 0.07), 0.05, U);
    limb(upper, V(-0.11, 0.03, 0.07), V(-0.2, 0.1, 0.0), 0.045, U);
    limb(upper, V(0.0, 0.09, -0.08), V(-0.06, 0.05, -0.06), 0.05, U);
    limb(upper, V(-0.06, 0.05, -0.06), V(-0.06, 0.1, -0.02), 0.045, U);
    gun.position.set(-0.02, 0.11, -0.025);
    // Bipod legs down to the ground
    for (const s of [-1, 1]) {
      const leg = cb(gun, 0.012, 0.11, 0.012, GUN, -0.28, -0.05, s * 0.025);
      leg.rotation.x = s * 0.35;
    }
  } else {
    hipY = p === 'kneel' ? 0.19 : 0.27;
    upper.position.set(0, hipY, 0);
    if (p === 'stand') {
      for (const [s, fx] of [[1, -0.07], [-1, 0.08]] as const) {
        limb(root, V(0, hipY, s * 0.045), V(fx, 0.03, s * 0.07), 0.065, OLIVE_D);
        cb(root, 0.09, 0.045, 0.07, boot, fx - 0.01, 0.022, s * 0.07);
      }
    } else {
      // Left knee up in front, right knee on the ground
      limb(root, V(0, hipY, 0.05), V(-0.15, hipY + 0.01, 0.06), 0.065, OLIVE_D);
      limb(root, V(-0.15, hipY + 0.01, 0.06), V(-0.15, 0.03, 0.06), 0.06, OLIVE_D);
      cb(root, 0.09, 0.045, 0.07, boot, -0.17, 0.022, 0.06);
      limb(root, V(0, hipY, -0.05), V(0.03, 0.035, -0.07), 0.065, OLIVE_D);
      limb(root, V(0.03, 0.035, -0.07), V(0.18, 0.035, -0.07), 0.06, OLIVE_D);
      cb(root, 0.05, 0.08, 0.07, boot, 0.21, 0.04, -0.07);
    }
    const torso = cb(upper, 0.12, 0.2, 0.17, U, 0, 0.11, 0);
    torso.rotation.y = 0.35;
    if (gear.vest) {
      const v = cb(upper, 0.14, 0.14, 0.18, gear.vest, 0, 0.13, 0);
      v.rotation.y = 0.35;
    }
    cb(upper, 0.125, 0.03, 0.175, '#2a2b2d', 0, 0.015, 0);
    part(upper, new THREE.IcosahedronGeometry(0.062, 0), mat(skin), -0.02, 0.27, -0.02);
    const hel = part(upper, new THREE.SphereGeometry(0.074, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), mat(gear.helmet), -0.02, 0.285, -0.02);
    hel.scale.y = 0.85;
    // Right hand on the grip, left hand forward on the handguard
    limb(upper, V(0.01, 0.2, -0.09), V(-0.04, 0.12, -0.07), 0.05, U);
    limb(upper, V(-0.04, 0.12, -0.07), V(-0.08, 0.17, -0.04), 0.045, U);
    limb(upper, V(0.0, 0.2, 0.09), V(-0.12, 0.14, 0.06), 0.05, U);
    limb(upper, V(-0.12, 0.14, 0.06), V(-0.2, 0.18, -0.03), 0.045, U);
    gun.position.set(-0.02, 0.2, -0.04);
  }
  if (gear.ear) for (const s of [-1, 1]) cb(upper, 0.05, 0.05, 0.03, gear.ear, p === 'prone' ? -0.06 : -0.02, p === 'prone' ? 0.14 : 0.27, (p === 'prone' ? -0.01 : -0.02) + s * 0.07);
  // Chunky cartoon rifle silhouette pointing -x
  const gc = gear.gun ?? GUN;
  cb(gun, 0.1, 0.055, 0.035, gc, 0.04, -0.01, 0); // stock
  cb(gun, 0.2, 0.05, 0.04, gc, -0.1, 0, 0); // receiver
  cb(gun, 0.035, 0.085, 0.03, gc, -0.1, -0.06, 0); // magazine
  cb(gun, 0.03, 0.06, 0.03, gc, -0.03, -0.045, 0); // grip
  cb(gun, 0.12, 0.024, 0.024, GUN_L, -0.26, 0.005, 0); // barrel
  cb(gun, 0.06, 0.03, 0.022, GUN_L, -0.09, 0.04, 0); // sight
  // Muzzle flash: a chunky yellow star
  const flash = new THREE.Group();
  flash.position.set(-0.34, 0.005, 0);
  const fm = glow('#ffd23f', 2);
  part(flash, new THREE.IcosahedronGeometry(0.035, 0), fm, -0.02, 0, 0).castShadow = false;
  for (const r of [0, Math.PI / 2]) {
    const s = part(flash, new THREE.BoxGeometry(0.12, 0.018, 0.018), fm, -0.05, 0, 0);
    s.rotation.x = r;
    s.castShadow = false;
    const d = part(flash, new THREE.BoxGeometry(0.018, 0.09, 0.018), fm, -0.02, 0, 0);
    d.rotation.x = r;
    d.castShadow = false;
  }
  gun.add(flash);
  // Spent-case puff from the ejection port and a tracer down the lane
  const puff = part(root, new THREE.IcosahedronGeometry(0.03, 0), M('#e8e4da', { transparent: true, opacity: 0.85 }), 0, 0, 0);
  puff.castShadow = false;
  const muzzleX = x - 0.36;
  const tracer = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.012, 0.012), glow(gear.tracer ?? '#ffe28a', 1.8));
  tracer.castShadow = false;
  k.group.add(tracer);
  const gunY = y + hipY + (p === 'prone' ? 0.03 : 0.2);
  const gx0 = gun.position.x;
  k.anims.push((t) => {
    const c = lc(t, lane);
    const kick = kickAt(c);
    const rest = restAt(c);
    if (p === 'prone') {
      upper.position.x = kick * 0.03;
      gun.rotation.z = -kick * 0.12 + rest * 0.05;
    } else {
      upper.rotation.z = -kick * 0.1 - rest * 0.05;
      gun.rotation.z = -kick * 0.14 + rest * 0.35;
      upper.rotation.y = Math.sin(t * 0.7 + seed) * 0.03;
    }
    gun.position.x = gx0 + kick * 0.035;
    const on = flashAt(c);
    flash.visible = on;
    flash.scale.setScalar(on ? 0.8 + Math.random() * 0.5 : 0.01);
    flash.rotation.x = c * 40;
    // Case puff rises and fades after each shot
    let pu = -1;
    for (const s of SHOTS) if (c >= s && c < s + 0.1) pu = (c - s) / 0.1;
    if (pu >= 0) {
      puff.visible = true;
      puff.position.set(-0.08 + pu * 0.06, (p === 'prone' ? 0.16 : hipY + 0.24) + pu * 0.18, -0.08 - pu * 0.12);
      puff.scale.setScalar(0.4 + pu * 1.4);
      (puff.material as THREE.MeshStandardMaterial).opacity = 0.85 * (1 - pu);
    } else {
      puff.visible = false;
      puff.scale.setScalar(0.01);
    }
    // Tracer streaks to the target
    let tr = -1;
    let end = XT + 0.05;
    for (const s of SHOTS) if (c >= s && c < s + 0.035) {
      tr = (c - s) / 0.035;
      end = s === SHOTS[0] && gear.mid !== undefined ? gear.mid + 0.05 : XT + 0.05;
    }
    if (tr >= 0) {
      tracer.visible = true;
      tracer.position.set(muzzleX + (end - muzzleX) * tr, gunY + 0.01 - tr * 0.06, z + (p === 'prone' ? -0.025 : -0.04));
      tracer.scale.setScalar(1);
    } else {
      tracer.visible = false;
      tracer.scale.setScalar(0.01);
    }
  });
  return root;
}

/** One shooter per lane, poses cycling through the given list. */
function firingLine(k: Kit, n: number, y: number, poses: Pose[], gear: Gear, sheet: string | null = null) {
  for (let i = 0; i < n; i++) {
    const z = laneZ(i, n);
    const p = poses[i % poses.length];
    if (sheet) cb(k.group, 0.66, 0.012, Math.min(0.26, laneW(n) - 0.04), sheet, XF + 0.18, y + 0.006, z);
    shooter(k, i, p === 'prone' ? XF - 0.02 : XF + 0.14, z, y + (sheet ? 0.012 : 0), p, gear, i + 1);
  }
}

// ------------------------------------------------------------------ targets

type TargetStyle = 'paper' | 'frame' | 'electronic' | 'rail' | 'led' | 'holo' | 'gold';

/**
 * A pop-up target per lane at the -x end, hinged at its base: it stands up,
 * shakes when hit, falls flat and rises again on the lane cycle. A dust or
 * spark strike kicks up from the bullet catcher behind it.
 */
function targets(k: Kit, n: number, y: number, style: TargetStyle, strike: string | null, row = XT, hit = HIT, dustShots: number[] = SHOTS, size = 1.25) {
  const s = Math.min(1, laneW(n) / 0.33);
  for (let i = 0; i < n; i++) {
    const z = laneZ(i, n);
    const pivot = new THREE.Group();
    const face = new THREE.Group(); // everything that falls
    pivot.add(face);
    const carrier = new THREE.Group(); // rail carriers move along the lane
    carrier.position.set(row, y, z);
    carrier.scale.set(size, size, 1);
    carrier.add(pivot);
    k.add(carrier);
    const fy = style === 'paper' || style === 'frame' ? 0.05 : 0.09;
    pivot.position.y = fy;
    if (style === 'paper' || style === 'frame') {
      // Timber frame with a paper target hinged at the bottom rail
      const post = style === 'paper' ? TIMBER : C.white;
      for (const sz of [-0.15, 0.15]) cb(carrier, 0.04, 0.44, 0.04, post, -0.02, 0.22, sz * s);
      cb(carrier, 0.05, 0.04, 0.34 * s, post, -0.02, 0.05, 0);
      cb(face, 0.02, 0.34, 0.26 * s, '#efe6cc', 0, 0.18, 0);
      cb(face, 0.024, 0.16, 0.18 * s, OLIVE_D, 0.002, 0.12, 0);
      part(face, new THREE.CylinderGeometry(0.06 * s, 0.06 * s, 0.024, 10).rotateZ(Math.PI / 2), mat(OLIVE_D), 0.002, 0.25, 0);
      part(face, new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 0.028, 10).rotateZ(Math.PI / 2), mat('#ffffff'), 0.004, 0.13, 0);
      part(face, new THREE.CylinderGeometry(0.024 * s, 0.024 * s, 0.032, 10).rotateZ(Math.PI / 2), mat(RED), 0.006, 0.13, 0);
    } else if (style === 'electronic' || style === 'rail' || style === 'led') {
      // Lifter box with a hard "figure" plate on an arm
      const box = style === 'led' ? STEEL_D : style === 'rail' ? '#e8e6e0' : OLIVE_D;
      cb(carrier, 0.16, 0.09, 0.2 * s, box, 0, 0.045, 0);
      if (style === 'rail') cb(carrier, 0.17, 0.02, 0.21 * s, TEAL, 0, 0.09, 0);
      const lamp = part(carrier, new THREE.BoxGeometry(0.04, 0.03, 0.04), glow('#ffb020', 0.2), 0.05, 0.1, 0.07 * s);
      const plate = style === 'led' ? '#1f2428' : style === 'rail' ? '#ff8a3d' : '#6f8a4a';
      cb(face, 0.025, 0.2, 0.2 * s, plate, 0, 0.1, 0);
      part(face, new THREE.CylinderGeometry(0.065 * s, 0.065 * s, 0.025, 10).rotateZ(Math.PI / 2), mat(plate), 0, 0.26, 0);
      if (style === 'led') {
        // Glowing silhouette on the armoured screen
        const gm = glow('#ffb020', 1.3);
        part(face, new THREE.BoxGeometry(0.03, 0.12, 0.12 * s), gm, 0.004, 0.09, 0);
        part(face, new THREE.CylinderGeometry(0.04 * s, 0.04 * s, 0.03, 10).rotateZ(Math.PI / 2), gm, 0.004, 0.26, 0);
      } else {
        part(face, new THREE.TorusGeometry(0.05 * s, 0.008, 4, 14).rotateY(Math.PI / 2), mat('#ffffff'), 0.016, 0.12, 0);
        part(face, new THREE.CylinderGeometry(0.018 * s, 0.018 * s, 0.03, 8).rotateZ(Math.PI / 2), mat(style === 'rail' ? '#ffffff' : RED), 0.005, 0.12, 0);
      }
      k.anims.push((t) => ((lamp.material as THREE.MeshStandardMaterial).emissiveIntensity = fallAt(lc(t, i)) > 0.5 ? 1.6 : 0.15));
    } else {
      // Holographic target: an emitter base projecting a glowing figure
      const gold = style === 'gold';
      cb(carrier, 0.16, 0.08, 0.22 * s, gold ? GOLD : STEEL_D, 0, 0.04, 0);
      part(carrier, new THREE.BoxGeometry(0.1, 0.012, 0.18 * s), glow(CYAN, 1.4), 0, 0.085, 0).castShadow = false;
      const hm = glow(gold ? '#ffd86a' : CYAN, 1.1, { transparent: true, opacity: 0.62, depthWrite: false });
      const a = part(face, new THREE.BoxGeometry(0.02, 0.2, 0.19 * s), hm, 0, 0.11, 0);
      const b = part(face, new THREE.CylinderGeometry(0.06 * s, 0.06 * s, 0.02, 10).rotateZ(Math.PI / 2), hm, 0, 0.27, 0);
      const r = part(face, new THREE.TorusGeometry(0.05 * s, 0.009, 4, 14).rotateY(Math.PI / 2), glow('#ffffff', 1.2), 0.012, 0.13, 0);
      for (const m of [a, b, r]) m.castShadow = false;
    }
    const hx = XB - 0.02;
    const dust = part(k.group, new THREE.IcosahedronGeometry(0.05, 0), M(strike ?? '#c9a36a', { transparent: true, opacity: 0.9 }), hx, y + 0.25, z);
    dust.castShadow = false;
    dust.visible = false;
    const holo = style === 'holo' || style === 'gold';
    const rail = style === 'rail';
    k.anims.push((t) => {
      const raw = lc(t, i);
      const c = (((raw - (hit - HIT)) % 1) + 1) % 1;
      const f = fallAt(c);
      if (holo) {
        // Holograms glitch and collapse instead of tipping over
        const flick = c > 0.42 && c < 0.5 ? (Math.sin(t * 90) > 0 ? 1 : 0.4) : 1;
        face.scale.set(1, Math.max(0.02, (1 - f) * flick), 1);
        face.visible = f < 0.98;
      } else {
        const shake = c >= HIT && c < HIT + 0.02 ? Math.sin(t * 80) * 0.08 : 0;
        pivot.rotation.z = f * 1.48 + shake;
      }
      if (rail) {
        // Carrier runs toward the line while up, returns while down
        let u: number;
        if (c >= 0.94 || c < 0.44) u = (((c + 0.06) % 1) / 0.5);
        else if (c < 0.56) u = 1;
        else if (c < 0.84) u = 1 - smooth((c - 0.56) / 0.28);
        else u = 0;
        carrier.position.x = row + 0.62 * u;
      }
      // Strike on the berm for each shot
      let d = -1;
      if (strike) for (const sh of dustShots) if (raw >= sh + 0.03 && raw < sh + 0.13) d = (raw - sh - 0.03) / 0.1;
      if (d >= 0) {
        dust.visible = true;
        dust.position.set(hx + d * 0.08, y + 0.28 + d * 0.2, z + (i % 2 ? 0.04 : -0.04));
        dust.scale.setScalar(0.5 + d * 1.6);
        (dust.material as THREE.MeshStandardMaterial).opacity = 0.9 * (1 - d);
      } else {
        dust.visible = false;
        dust.scale.setScalar(0.01);
      }
    });
  }
}

/** Low mantlet across all lanes in front of the targets, hiding the mechanisms; returns its top. */
function mantlet(k: Kit, y: number, color: string, h = 0.12, band: string | null = null, x = XM) {
  const len = Z1 - Z0 + 0.04;
  k.box(0.14, h, len, color, x, y, (Z0 + Z1) / 2);
  if (band) for (let i = 0; i < 10; i++) k.box(0.145, 0.04, len / 10, i % 2 ? C.kerbB : band, x, y + h - 0.05, Z0 - 0.02 + (len / 10) * (i + 0.5));
  return y + h;
}

/** Lane number plates on the mantlet, facing the firing line. */
function laneNumbers(k: Kit, n: number, top: number, bg = C.white, fg = '#26332a') {
  for (let i = 0; i < n; i++) board(k, String(i + 1), 0.11, 0.1, XM + 0.075, top, laneZ(i, n), bg, fg, Math.PI / 2, 52);
}

// ------------------------------------------------------------------ lanes (the floor of the range)

type Floor = 'dirt' | 'grass' | 'turf' | 'teal' | 'slate' | 'gold';
const FLOOR: Record<Floor, [string, string, string]> = {
  dirt: ['#b98a5a', '#a87c4f', '#eadfc2'],
  grass: ['#86c24e', '#76b443', '#ffffff'],
  turf: ['#5aa33a', '#4f9533', '#ffffff'],
  teal: ['#4f9ba3', '#468d95', '#ffffff'],
  slate: ['#7a8288', '#6e767c', CYAN],
  gold: ['#7a8288', '#6e767c', GOLD],
};

function laneFloor(k: Kit, y: number, n: number, f: Floor) {
  const [a, b, line] = FLOOR[f];
  const x0 = XB, x1 = XS;
  const w = laneW(n);
  for (let i = 0; i < n; i++) k.box(x1 - x0, 0.016, w, i % 2 ? b : a, (x0 + x1) / 2, y, laneZ(i, n));
  if (f === 'dirt') {
    // Lime-washed lane lines pegged out with string, grass tufts in the dirt
    for (let i = 0; i <= n; i++) k.box(x1 - x0, 0.02, 0.025, line, (x0 + x1) / 2, y, Z0 + w * i);
    const tuft = new THREE.ConeGeometry(0.05, 0.1, 5);
    for (let j = 0; j < 22; j++) {
      const tx = XB + 0.35 + ((j * 0.618) % 1) * 2.4, tz = Z0 + 0.08 + ((j * 0.377 + 0.21) % 1) * (Z1 - Z0 - 0.16);
      part(k.group, tuft, mat(j % 3 ? '#6f9e3a' : '#8fb84a'), tx, y + 0.05, tz).scale.set(1, 0.7 + (j % 4) * 0.2, 1);
    }
  } else {
    for (let i = 0; i <= n; i++) {
      const lm = f === 'slate' ? glow(CYAN, 0.9) : f === 'gold' ? M(GOLD, { metalness: 0.4, roughness: 0.4 }) : mat(line);
      const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.022, 0.028), lm);
      m.position.set((x0 + x1) / 2, y + 0.011, Z0 + w * i);
      m.receiveShadow = true;
      k.group.add(m);
    }
    // Distance bars across the lanes
  }
  // Firing line in red
  k.box(0.05, 0.024, Z1 - Z0, RED, XF - 0.42, y, (Z0 + Z1) / 2);
  return y + 0.016;
}

// ------------------------------------------------------------------ berms / bullet catchers

/** Straw-bale wall stacked in courses (Lv 1 berm and later side walls). */
function bales(k: Kit, x: number, y: number, z0: number, z1: number, rows: number, deep = 2) {
  const bw = 0.26, bh = 0.15, bl = 0.36;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * bl * 0.5;
    const n = Math.floor((z1 - z0 - off) / bl);
    for (let d = 0; d < deep; d++) for (let i = 0; i < n; i++) {
      const bz = z0 + off + bl * (i + 0.5);
      const bx = x - d * bw;
      k.box(bw - 0.01, bh - 0.008, bl - 0.012, (i + r + d) % 3 === 1 ? STRAW_D : STRAW, bx, y + r * bh, bz);
      if (d === 0 || r === rows - 1) for (const t of [-0.09, 0.09]) k.box(bw + 0.004, bh - 0.004, 0.018, '#8f6f2a', bx, y + r * bh, bz + t);
    }
  }
}

/** Earth bank: a trapezoid prism behind the targets. */
function earthBerm(k: Kit, y: number, h: number, top: string, face: string, x0 = -2.44, x1 = XB) {
  const len = Z1 - Z0 + 0.3;
  const zc = (Z0 + Z1) / 2;
  prism(k, [[x0, 0], [x1, 0], [x1 - h * 0.45, h], [x0 + 0.05, h]], len, face, 0, y, zc);
  // Grass or straw cap on top
  k.box(Math.max(0.12, x1 - h * 0.45 - x0 - 0.06), 0.05, len, top, (x0 + 0.05 + x1 - h * 0.45) / 2, y + h - 0.01, zc);
  return y + h;
}

/** Concrete-faced berm: a vertical retaining wall with a rubber bullet trap, grass bank behind. */
function concreteBerm(k: Kit, y: number, h: number, face = CONCRETE, trap = '#8a6a4a', top = GRASS) {
  const len = Z1 - Z0 + 0.3;
  const zc = (Z0 + Z1) / 2;
  prism(k, [[-2.44, 0], [XB - 0.12, 0], [XB - 0.12, h], [-2.38, h + 0.05]], len, EARTH_D, 0, y, zc);
  k.box(1.0 - 0.38, 0.06, len, top, -2.13, y + h, zc);
  k.box(0.14, h + 0.1, len, face, XB - 0.07, y, zc);
  k.box(0.04, h - 0.25, len - 0.2, trap, XB + 0.01, y + 0.12, zc);
  // Buttress ribs between lanes
  for (const z of [Z0 - 0.08, Z1 + 0.08]) k.box(0.2, h + 0.14, 0.1, face, XB - 0.07, y, z);
  return y + h + 0.1;
}

// ------------------------------------------------------------------ firing-point structures

/** Ammo boxes and a jerrycan: the field-range kit pile. */
function ammoPile(k: Kit, x: number, z: number, y: number) {
  for (let i = 0; i < 3; i++) {
    k.box(0.2, 0.1, 0.12, OLIVE, x + (i % 2) * 0.05, y + Math.floor(i / 2) * 0.1, z + (i === 1 ? 0.13 : 0));
    k.box(0.06, 0.02, 0.02, '#c9ced2', x + (i % 2) * 0.05, y + Math.floor(i / 2) * 0.1 + 0.1, z + (i === 1 ? 0.13 : 0));
  }
  k.box(0.08, 0.16, 0.13, '#4b5a3a', x + 0.2, y, z - 0.05);
}

/** Camp-band range tower: cream base with a lookout cab and a red hip roof; returns cab floor height. */
function campTower(k: Kit, y: number) {
  const h = k.block(TW, TD, 1, TX, y, TZ);
  k.window('right', TX, TZ, TW, TD, 0, y + 0.4, 0.3, 0.3, true);
  k.door('front', TX, TZ, TW, TD, 0.08, y, 0.28, 0.58);
  const fy = y + h;
  k.box(TW + 0.14, 0.06, TD + 0.14, C.trim, TX, fy, TZ);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.06, 0.6, 0.06, C.white, TX + dx * (TW / 2), fy + 0.06, TZ + dz * (TD / 2));
  for (const s of [-1, 1]) {
    k.box(TW + 0.04, 0.22, 0.03, C.wall, TX, fy + 0.06, TZ + s * (TD / 2));
    k.box(0.03, 0.22, TD, C.wall, TX + s * (TW / 2), fy + 0.06, TZ);
  }
  k.box(TW + 0.06, 0.03, TD + 0.06, C.trim, TX, fy + 0.28, TZ);
  k.hipRoof(TW + 0.02, TD + 0.02, 0.32, TX, fy + 0.66, TZ, C.roof, 0.14);
  stander(k, TX - 0.1, TZ + 0.05, fy + 0.06, Math.PI * 0.85, 4, null, true);
  return fy;
}

/** Concrete control tower (base band) with a glazed cab; `storeys` of shaft below the cab, `wide` cab overhang. Returns roof top. */
function concreteTower(k: Kit, y: number, storeys: number, roof: string | null = null, wide = 0) {
  const sh = storeys * STOREY;
  k.box(TW - 0.08, sh, TD - 0.08, CONCRETE, TX, y, TZ);
  for (let f = 0; f < Math.floor(storeys); f++) {
    k.box(TW - 0.04, 0.05, TD - 0.04, C.trim, TX, y + f * STOREY, TZ);
    if (f > 0 || storeys < 1.5) k.box(0.03, 0.26, 0.26, DARK_GLASS, TX + (TW - 0.08) / 2 + 0.01, y + f * STOREY + 0.38, TZ);
  }
  k.door('front', TX, TZ, TW - 0.08, TD - 0.08, 0, y, 0.26, 0.56, '#4a4f54');
  const cy = y + sh;
  const cw = TW + wide, cd = TD + wide, cx = TX - wide / 2, cz = TZ + wide / 2;
  k.box(cw + 0.16, 0.07, cd + 0.16, CONCRETE, cx, cy, cz);
  k.box(cw + 0.04, 0.5, cd + 0.04, '#86b7cc', cx, cy + 0.07, cz);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.05, 0.5, 0.05, C.trim, cx + dx * (cw / 2 + 0.02), cy + 0.07, cz + dz * (cd / 2 + 0.02));
  const ry = cy + 0.57;
  k.box(cw + 0.3, 0.08, cd + 0.3, C.white, cx, ry, cz);
  if (roof) k.hipRoof(cw + 0.06, cd + 0.06, 0.3, cx, ry + 0.08, cz, roof, 0.14);
  stander(k, cx - 0.12, cz + 0.08, cy + 0.07, Math.PI * 0.9, 5, null, true);
  return ry + (roof ? 0.38 : 0.08);
}

/** Camp firing shelter: cream hut with a veranda roof over the range-officer walk. */
function campShelter(k: Kit, y: number, z0: number, z1: number) {
  const d = z1 - z0, zc = (z0 + z1) / 2;
  const bx = 2.2, bw = 0.42;
  k.block(bw, d, 1, bx, y, zc);
  k.windowRow('right', bx, zc, bw, d, Math.max(2, Math.round(d / 0.7)), y + 0.42, { louvre: true });
  k.door('front', bx, zc, bw, d, 0, y, 0.28, 0.58);
  for (let i = 0; i < 4; i++) k.box(0.07, STOREY, 0.07, C.white, XS + 0.02, y, z0 + 0.08 + ((d - 0.16) / 3) * i);
  k.hipRoof(2.42 - XS, d, 0.4, (2.42 + XS) / 2, y + STOREY, zc, C.roof, 0.14);
  // Rifle rack and bench under the veranda
  k.bench(1.92, zc + 0.3, 0.6, y, Math.PI / 2);
  k.box(0.06, 0.32, 0.5, C.wood, 1.98, y, zc - 0.5);
  for (let i = 0; i < 4; i++) {
    const r = k.box(0.03, 0.3, 0.03, GUN, 1.95, y + 0.04, zc - 0.68 + i * 0.12);
    r.rotation.z = -0.15;
  }
}

/** Low cream back wall with red coping (camp) along the back strip. */
function campBackWall(k: Kit, y: number, x0: number, x1: number, h = 0.4) {
  k.box(x1 - x0, h, 0.1, C.wall, (x0 + x1) / 2, y, Z0 - 0.08);
  k.box(x1 - x0 + 0.04, 0.05, 0.14, C.roof, (x0 + x1) / 2, y + h, Z0 - 0.08);
  k.box(x1 - x0 + 0.02, 0.08, 0.12, C.trim, (x0 + x1) / 2, y, Z0 - 0.08);
}

/** Concrete firing point: flat-roofed block with a slab canopy over the walkway. */
function concreteFiringPoint(k: Kit, y: number, z0: number, z1: number, floors = 1, roof: string | null = null) {
  const d = z1 - z0, zc = (z0 + z1) / 2;
  const bx = 2.18, bw = 0.46;
  const h = floors * STOREY;
  k.box(bw, h, d, CONCRETE, bx, y, zc);
  for (let f = 0; f < floors; f++) {
    k.box(0.03, 0.3, d - 0.3, DARK_GLASS, bx + bw / 2 + 0.01, y + f * STOREY + 0.34, zc);
    k.box(bw + 0.04, 0.05, d + 0.04, C.trim, bx, y + f * STOREY, zc);
  }
  k.door('front', bx, zc, bw, d, 0, y, 0.28, 0.58, '#4a4f54');
  // Canopy slab on round columns
  for (let i = 0; i < 4; i++) k.cyl(0.04, STOREY - 0.05, C.white, XS + 0.04, y, z0 + 0.1 + ((d - 0.2) / 3) * i, 8);
  k.box(2.44 - XS + 0.04, 0.08, d + 0.06, C.white, (2.44 + XS) / 2, y + STOREY - 0.05, zc);
  k.box(2.44 - XS + 0.06, 0.03, d + 0.08, C.trim, (2.44 + XS) / 2, y + STOREY - 0.07, zc);
  if (floors > 1) {
    // Upper gallery: balcony facing the lanes, red-roofed
    k.box(0.05, 0.28, d, C.white, XS + 0.03, y + STOREY + 0.03, zc);
    k.box(0.08, 0.04, d + 0.02, C.trim, XS + 0.03, y + STOREY + 0.31, zc);
  }
  if (roof) k.hipRoof(2.44 - XS, d, 0.36, (2.44 + XS) / 2, y + h, zc, roof, 0.12);
  else k.flatRoof(bw, d, bx, y + h, zc);
  return y + h;
}

/** Tall concrete back wall with buttresses and lamps (base band). */
function concreteBackWall(k: Kit, y: number, x0: number, x1: number, h: number) {
  const zc = Z0 - 0.1;
  k.box(x1 - x0, h, 0.12, CONCRETE, (x0 + x1) / 2, y, zc);
  k.box(x1 - x0 + 0.04, 0.06, 0.16, C.white, (x0 + x1) / 2, y + h, zc);
  k.box(x1 - x0, 0.1, 0.13, C.trim, (x0 + x1) / 2, y, zc);
  for (let x = x0 + 0.3; x < x1 - 0.1; x += 0.7) {
    k.box(0.1, h, 0.18, '#c9c4b9', x, y, zc - 0.05);
    k.box(0.12, 0.05, 0.08, '#fff2c0', x, y + h - 0.2, zc + 0.08);
  }
}

/** Small electronic scoreboard on posts (counts hits per lane). */
function scoreboard(k: Kit, x: number, z: number, y: number, n: number, rotY: number, h = 0.95, w = 0.8) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  k.add(g);
  for (const s of [-1, 1]) cb(g, 0.05, h, 0.05, '#4a4f54', s * (w / 2 - 0.06), h / 2, 0);
  cb(g, w, 0.36, 0.06, '#1f2428', 0, h + 0.14, 0);
  cb(g, w + 0.04, 0.04, 0.08, HAZ, 0, h + 0.34, 0);
  const label = board(k, 'HITS', w * 0.5, 0.08, 0, h + 0.22, 0.032, '#1f2428', '#ffd23f', 0, 46, true);
  g.add(label);
  const cells: THREE.Mesh[] = [];
  for (let i = 0; i < n; i++) {
    const c = part(g, new THREE.BoxGeometry(Math.min(0.08, (w - 0.1) / n - 0.02), 0.11, 0.01), glow('#3fd16b', 1.4), -w / 2 + 0.05 + ((w - 0.1) / n) * (i + 0.5), h + 0.07, 0.035);
    c.castShadow = false;
    cells.push(c);
  }
  // Each lane's bar grows with its hit count and resets
  k.anims.push((t) => cells.forEach((c, i) => {
    const hits = Math.floor((t / PERIOD + i * 0.37 + 0.58) % 6);
    c.scale.y = 0.2 + hits * 0.16;
    c.position.y = h + 0.02 + 0.055 * c.scale.y;
  }));
}

// ------------------------------------------------------------------ command & secure structures

/** White firing hall with fins and a green roof over the firing point (command band). */
function commandHall(k: Kit, y: number, z0: number, z1: number, h = STOREY * 1.3, roof = C.roofGreen, wall = '#f2f1ec', trim = TEAL) {
  const d = z1 - z0, zc = (z0 + z1) / 2;
  const bx = 2.16, bw = 0.5;
  k.box(bw, h, d, wall, bx, y, zc);
  k.box(0.03, h - 0.3, d - 0.3, '#86b7cc', bx + bw / 2 + 0.01, y + 0.15, zc);
  // Vertical sun fins across the +x face
  for (let i = 0; i <= 7; i++) k.box(0.12, h - 0.3, 0.04, C.white, bx + bw / 2 + 0.06, y + 0.15, z0 + 0.15 + ((d - 0.3) / 7) * i);
  k.box(bw + 0.04, 0.06, d + 0.04, trim, bx, y + 0.06, zc);
  // Cantilever roof over the walkway
  k.box(2.46 - XS + 0.04, 0.1, d + 0.1, roof, (2.46 + XS) / 2, y + h, zc);
  k.box(2.46 - XS + 0.06, 0.04, d + 0.12, C.white, (2.46 + XS) / 2, y + h - 0.04, zc);
  k.box(0.04, 0.05, d + 0.12, trim, XS - 0.02, y + h - 0.02, zc);
  for (let i = 0; i < 3; i++) k.box(0.05, h, 0.05, C.white, XS + 0.03, y, z0 + 0.1 + ((d - 0.2) / 2) * i);
  k.door('front', bx, zc, bw, d, 0, y, 0.3, 0.6, '#33383d');
  return y + h + 0.1;
}

/** Overhead baffle portal across all lanes: posts at the sides, angled deflector slat on top. */
function baffle(k: Kit, x: number, y: number, h: number, frame: string, slat: string, band: string | null = null, sw = 0.34) {
  const z0 = Z0 - 0.06, z1 = Z1 + 0.06;
  for (const z of [z0, z1]) k.box(0.1, h, 0.1, frame, x, y, z);
  k.box(0.12, 0.08, z1 - z0 + 0.1, frame, x, y + h, (z0 + z1) / 2);
  const s = k.box(sw, 0.05, z1 - z0, slat, x + 0.04, y + h - 0.12, (z0 + z1) / 2);
  s.rotation.z = 0.5;
  if (band) k.box(0.13, 0.04, z1 - z0 + 0.12, band, x, y + h + 0.08, (z0 + z1) / 2);
}

/** Continuous louvred roof over the lanes (indoor ranges); thin slats let the line show through. */
function louvreRoof(k: Kit, y: number, x0: number, x1: number, h: number, frame: string, slat: string, step = 0.42) {
  const z0 = Z0 - 0.06, z1 = Z1 + 0.06;
  for (const z of [z0, z1]) k.box(x1 - x0, 0.08, 0.08, frame, (x0 + x1) / 2, y + h, z);
  for (let x = x0; x <= x1 + 0.01; x += (x1 - x0) / Math.round((x1 - x0) / 0.9)) {
    k.box(0.07, h, 0.07, frame, x, y, z0);
    k.box(0.07, h, 0.07, frame, x, y, z1);
  }
  for (let x = x0 + 0.1; x < x1; x += step) {
    const s = k.box(0.24, 0.035, z1 - z0, slat, x, y + h - 0.02, (z0 + z1) / 2);
    s.rotation.z = 0.7;
  }
}

/** Glass control room (box with mullions and a cap). */
function glassRoom(k: Kit, x: number, y: number, z: number, w: number, h: number, d: number, cap: string, band: string) {
  k.box(w, h, d, '#86b7cc', x, y, z);
  const n = Math.max(2, Math.round(d / 0.3));
  for (let i = 0; i <= n; i++) k.box(w + 0.02, h, 0.03, C.trim, x, y, z - d / 2 + (d / n) * i);
  k.box(w + 0.12, 0.08, d + 0.12, cap, x, y + h, z);
  k.box(w + 0.13, 0.03, d + 0.13, band, x, y + h - 0.02, z);
  return y + h + 0.08;
}

/** White command-band tower: slim shaft with fins, glazed cab with a teal band and green cap. */
function commandTower(k: Kit, y: number, sh: number, crown = false) {
  k.box(TW - 0.14, sh, TD - 0.14, '#f2f1ec', TX, y, TZ);
  k.box(0.03, sh - 0.3, 0.2, '#86b7cc', TX + (TW - 0.14) / 2 + 0.01, y + 0.15, TZ);
  for (const dz of [-0.17, 0.17]) k.box(0.1, sh, 0.04, C.white, TX + (TW - 0.14) / 2 + 0.04, y, TZ + dz);
  const top = glassRoom(k, TX, y + sh, TZ, TW + 0.06, 0.5, TD + 0.06, C.roofGreen, TEAL);
  stander(k, TX - 0.12, TZ + 0.1, y + sh, Math.PI * 0.9, 6, null, true);
  if (crown) {
    // Landmark crown: teal drum and a slim spire with a beacon
    k.cyl(0.24, 0.3, TEAL, TX, top, TZ, 12);
    k.cyl(0.3, 0.05, C.white, TX, top + 0.3, TZ, 12);
    k.cyl(0.02, 0.5, C.white, TX, top + 0.35, TZ, 6);
    k.blinker(TX, top + 0.85, TZ, '#ff3b30', 0.04, 1.6);
    return top + 0.35;
  }
  return top;
}

/** Spinning sensor head on a mast. */
function sensorMast(k: Kit, x: number, z: number, y: number, h: number, c = CYAN) {
  k.cyl(0.04, h, STEEL, x, y, z, 6);
  const head = new THREE.Group();
  head.position.set(x, y + h, z);
  cb(head, 0.34, 0.05, 0.06, '#e8e6e0', 0, 0.02, 0);
  part(head, new THREE.SphereGeometry(0.06, 8, 6), glow(c, 1), 0, 0.09, 0);
  k.add(head);
  k.anims.push((t) => (head.rotation.y = t * 1.8 + x));
}

/** Dark armoured firing bunker with slit windows (secure band). */
function bunker(k: Kit, y: number, z0: number, z1: number, h = STOREY * 1.4, gold = false) {
  const d = z1 - z0, zc = (z0 + z1) / 2;
  const bx = 2.14, bw = 0.56;
  k.box(bw, h, d, '#a3abaf', bx, y, zc);
  for (let i = 0; i < 4; i++) k.box(0.03, 0.06, d / 5, '#1f2428', bx + bw / 2 + 0.01, y + h * 0.62, z0 + (d / 4) * (i + 0.5));
  k.box(bw + 0.06, 0.08, d + 0.06, gold ? GOLD : HAZ, bx, y + h - 0.08, zc);
  // Armoured canopy over the walkway, plates angled
  k.box(2.46 - XS, 0.1, d + 0.08, gold ? GOLD : STEEL, (2.46 + XS) / 2, y + h, zc);
  const p = k.box(0.08, 0.36, d + 0.08, STEEL_D, XS + 0.02, y + h - 0.3, zc);
  p.rotation.z = 0.25;
  for (let i = 0; i < 3; i++) k.box(0.08, h, 0.08, STEEL_D, XS + 0.05, y, z0 + 0.1 + ((d - 0.2) / 2) * i);
  k.door('front', bx, zc, bw, d, 0, y, 0.3, 0.6, STEEL_D);
  const band = part(k.group, new THREE.BoxGeometry(0.02, 0.04, d - 0.2), glow(CYAN, 1.2), bx + bw / 2 + 0.02, y + 0.25, zc);
  band.castShadow = false;
  return y + h + 0.1;
}

/** Armoured secure tower: dark shaft, slit cab with a cyan band, rotating sensor; optional gold crown. */
function secureTower(k: Kit, y: number, sh: number, gold = false) {
  k.box(TW - 0.1, sh, TD - 0.1, '#a3abaf', TX, y, TZ);
  for (let f = 0; f < Math.round(sh / STOREY); f++) k.box(TW - 0.06, 0.05, TD - 0.06, gold ? GOLD : HAZ, TX, y + f * STOREY + 0.05, TZ);
  const cy = y + sh;
  k.box(TW + 0.1, 0.5, TD + 0.1, STEEL, TX, cy, TZ);
  k.box(TW + 0.12, 0.08, TD + 0.12, '#1f2a2e', TX, cy + 0.22, TZ);
  const band = part(k.group, new THREE.BoxGeometry(TW + 0.13, 0.025, TD + 0.13), glow(gold ? '#ffd86a' : CYAN, 1.3), TX, cy + 0.36, TZ);
  band.castShadow = false;
  k.box(TW + 0.2, 0.08, TD + 0.2, gold ? GOLD : STEEL_D, TX, cy + 0.5, TZ);
  stander(k, TX - 0.14, TZ + 0.1, cy, Math.PI * 0.9, 7, null, true);
  const top = cy + 0.58;
  if (gold) {
    k.hipRoof(TW - 0.1, TD - 0.1, 0.36, TX, top, TZ, GOLD, 0.04);
    k.cyl(0.03, 0.5, GOLD, TX, top + 0.36, TZ, 6, 0.006);
    return top + 0.36;
  }
  sensorMast(k, TX, TZ, top, 0.32);
  return top;
}

/** Tall armour wall along the back strip with bolted plates and a hazard band. */
function armourWall(k: Kit, y: number, x0: number, x1: number, h: number, band = HAZ) {
  const zc = Z0 - 0.1;
  k.box(x1 - x0, h, 0.14, STEEL, (x0 + x1) / 2, y, zc);
  for (let x = x0 + 0.25; x < x1; x += 0.5) k.box(0.42, h - 0.16, 0.03, STEEL_D, x, y + 0.08, zc + 0.08);
  k.box(x1 - x0 + 0.02, 0.07, 0.17, band, (x0 + x1) / 2, y + h - 0.12, zc);
}

/** Armoured steel bullet catcher with angled deflector plates (secure band). */
function armourBerm(k: Kit, y: number, h: number, band = HAZ) {
  const len = Z1 - Z0 + 0.3, zc = (Z0 + Z1) / 2;
  prism(k, [[-2.44, 0], [XB - 0.1, 0], [XB - 0.1, h], [-2.36, h]], len, '#5c656b', 0, y, zc);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const p = k.box(0.08, h * 0.42, len / n - 0.03, STEEL_D, XB - 0.02, y + 0.06 + (i % 2) * 0.02, Z0 - 0.15 + (len / n) * (i + 0.5));
    p.rotation.z = 0.35;
    const q = k.box(0.08, h * 0.42, len / n - 0.03, STEEL_D, XB - 0.1, y + h * 0.48, Z0 - 0.15 + (len / n) * (i + 0.5));
    q.rotation.z = 0.35;
  }
  k.box(0.6, 0.06, len, band, -2.12, y + h, zc);
  return y + h;
}

// ------------------------------------------------------------------ field (1–3)

const FIELD_GEAR: Gear = { uniform: OLIVE, helmet: '#4f5e33' };

function field(k: Kit, level: number, y: number) {
  const n = LANES[level - 1];
  const fy = laneFloor(k, y, n, 'dirt');
  if (level === 1) {
    // Bale Range: a wall of straw bales stops the rounds; paper targets on timber frames
    bales(k, XB - 0.12, y, Z0 - 0.1, Z1 + 0.1, 3, 2);
    for (let i = 0; i < n; i++) k.box(0.16, 0.08, 0.28, EARTH, XM, fy, laneZ(i, n)); // earth mound hides the hinge
    targets(k, n, fy, 'paper', '#c9a36a', XT, HIT, SHOTS, 1.45);
    firingLine(k, n, fy, ['prone'], FIELD_GEAR, '#4b5a3a');
    rangeFlag(k, -2.2, Z1 + 0.05, y + 0.45, 1.3, 0.48, '#c9a36a');
    ammoPile(k, 2.05, Z0 + 0.25, y);
    ammoPile(k, 2.1, 0.75, y);
    k.box(0.04, 0.6, 0.04, TIMBER, 2.25, y, 0.1);
    board(k, 'RANGE', 0.36, 0.14, 2.25, y + 0.5, 0.13, '#efe6cc', RED, 0, 40);
    k.drum(-1.2, ZB, '#3f7d4a', y);
    k.crates(-0.4, ZB, y, 2);
    bales(k, 0.5, y, ZB - 0.18, ZB + 0.18, 2, 1);
    rangeOfficer(k, fy, '#f26b1d');
    dangerBoard(k, 2.1, 1.25, y, 0.5, TIMBER);
    return;
  }
  if (level === 2) {
    // Field Range: an earth bank faced with bales; canvas awning over the range control point
    earthBerm(k, y, 0.62, '#7aa64a', EARTH, -2.44, XB + 0.05);
    bales(k, XB + 0.12, y, Z0 - 0.05, Z1 + 0.05, 1, 1);
    for (let i = 0; i < n; i++) k.box(0.16, 0.1, 0.3, EARTH, XM, fy, laneZ(i, n));
    targets(k, n, fy, 'paper', '#b98a5a', XT, HIT, SHOTS, 1.45);
    firingLine(k, n, fy, ['prone'], FIELD_GEAR, '#4b5a3a');
    // Canvas fly on timber poles
    const ax0 = 1.74, ax1 = 2.42, az0 = -1.3, az1 = 1.36;
    for (const ax of [ax0 + 0.04, ax1 - 0.04]) for (const az of [az0 + 0.05, 0.03, az1 - 0.05]) k.box(0.05, 0.78, 0.05, TIMBER, ax, y, az);
    const cx = (ax0 + ax1) / 2, hw = (ax1 - ax0) / 2 + 0.08;
    prism(k, [[-hw, 0], [hw, 0], [hw - 0.04, 0.05], [0, 0.36], [-hw + 0.04, 0.05]], az1 - az0 + 0.12, '#b9a878', cx, y + 0.78, (az0 + az1) / 2);
    k.box(0.05, 0.05, az1 - az0 + 0.2, '#8a7a50', cx, y + 1.13, (az0 + az1) / 2);
    // Range control table and kit under the fly
    k.box(0.36, 0.03, 0.6, C.wood, 2.1, y + 0.28, 0.5);
    for (const dz of [-0.26, 0.26]) k.box(0.3, 0.28, 0.03, C.metal, 2.1, y, 0.5 + dz);
    k.box(0.14, 0.08, 0.12, OLIVE, 2.08, y + 0.31, 0.38);
    k.box(0.12, 0.01, 0.16, '#ffffff', 2.12, y + 0.31, 0.65);
    ammoPile(k, 2.05, -0.75, y);
    bales(k, 0.2, y, ZB - 0.18, ZB + 0.18, 2, 1);
    k.drum(-0.8, ZB, '#3f7d4a', y);
    k.drum(-0.55, ZB, '#2f6fa8', y);
    rangeFlag(k, -2.25, Z1 + 0.05, y + 0.62, 1.4, 0.5, '#c9a36a');
    rangeOfficer(k, fy, '#f26b1d');
    stander(k, 2.0, -0.2, y, Math.PI, 3);
    dangerBoard(k, 2.25, 1.38, y, 0.5, TIMBER);
    return;
  }
  // 3: Sandbag Range: taller timber-revetted bank, sandbag firing bays, zinc lean-to
  const bt = y + 0.78;
  earthBerm(k, y, 0.78, GRASS, EARTH, -2.44, XB + 0.04);
  for (let i = 0; i < 9; i++) k.box(0.04, 0.5, (Z1 - Z0 + 0.3) / 9 - 0.02, TIMBER, XB + 0.04 - 0.15, y, Z0 - 0.15 + ((Z1 - Z0 + 0.3) / 9) * (i + 0.5));
  k.sandbags(XM, (Z0 + Z1) / 2, Z1 - Z0, Math.PI / 2, fy, 2);
  targets(k, n, fy, 'paper', '#b98a5a', XT, HIT, SHOTS, 1.45);
  laneNumbers(k, n, fy + 0.2, '#efe6cc');
  firingLine(k, n, fy, ['prone', 'kneel'], FIELD_GEAR, '#4b5a3a');
  for (let i = 1; i < n; i++) k.sandbags(XF + 0.15, Z0 + laneW(n) * i, 0.6, 0, fy, 2);
  // Zinc lean-to on timber posts, high side toward the lanes
  const lz0 = -1.38, lz1 = 1.4;
  for (const [lx, lh] of [[XS + 0.03, 1.0], [2.38, 0.74]] as const) for (const lz of [lz0 + 0.06, 0.0, lz1 - 0.06]) k.box(0.06, lh, 0.06, TIMBER, lx, y, lz);
  prism(k, [[XS - 0.1, 1.0], [2.47, 0.72], [2.47, 0.77], [XS - 0.1, 1.05]], lz1 - lz0 + 0.1, C.zinc, 0, y, (lz0 + lz1) / 2, mat(C.zinc, {}, 'zinc'));
  k.box(0.06, 0.06, lz1 - lz0 + 0.12, TIMBER, XS - 0.06, y + 0.98, (lz0 + lz1) / 2);
  k.box(0.36, 0.03, 0.6, C.wood, 2.12, y + 0.28, 0.6);
  for (const dz of [-0.26, 0.26]) k.box(0.3, 0.28, 0.03, C.metal, 2.12, y, 0.6 + dz);
  ammoPile(k, 2.1, -0.6, y);
  k.sandbags(-0.5, ZB, 2.2, 0, y, 3);
  // Spotter's stand: a short timber platform for the range officer's assistant
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.05, 0.5, 0.05, TIMBER, 1.25 + dx * 0.16, y, ZB + dz * 0.13);
  k.box(0.4, 0.05, 0.34, C.wood, 1.25, y + 0.5, ZB);
  stander(k, 1.25, ZB, y + 0.55, Math.PI, 3, null, true);
  rangeFlag(k, -2.25, Z1 + 0.05, bt, 1.45, 0.52, TIMBER);
  rangeOfficer(k, fy, '#f26b1d');
  dangerBoard(k, 2.25, 1.38, y, 0.5, TIMBER);
}

// ------------------------------------------------------------------ camp (4–6)

const CAMP_GEAR: Gear = { uniform: OLIVE, helmet: '#4f5e33' };

function camp(k: Kit, level: number, y: number) {
  const n = LANES[level - 1];
  const fy = laneFloor(k, y, n, 'grass');
  const bh = level === 4 ? 0.9 : level === 5 ? 0.95 : 1.0;
  earthBerm(k, y, bh, GRASS, EARTH_D, -2.44, XB + 0.04);
  // Concrete kerb along the berm foot, with a sand trap strip
  k.box(0.12, 0.1, Z1 - Z0 + 0.3, C.concrete, XB + 0.06, y, (Z0 + Z1) / 2);
  const mt = mantlet(k, fy, level === 6 ? C.wall : CONCRETE, level === 6 ? 0.2 : 0.13, HAZ);
  targets(k, n, fy, 'frame', '#b98a5a', XT, HIT, SHOTS, 1.4);
  laneNumbers(k, n, mt);
  // Concrete firing apron
  k.box(0.9, 0.025, Z1 - Z0, '#cfc9bc', XF + 0.2, fy, (Z0 + Z1) / 2);
  firingLine(k, n, fy + 0.025, level === 4 ? ['kneel', 'prone'] : ['prone', 'kneel', 'stand'], CAMP_GEAR);
  rangeOfficer(k, fy, '#f26b1d', '#7a1f1f');
  if (level === 4) {
    // Camp Range: first permanent firing shelter, cream with a red hip roof
    campShelter(k, y, -1.42, 1.42);
    campBackWall(k, y, XB + 0.05, XS - 0.05);
    rangeFlag(k, -2.25, Z1 + 0.05, y + bh, 1.5, 0.55);
    k.lamp(XS - 0.12, Z1 + 0.08, y, 1.1);
    dangerBoard(k, 1.3, 1.4, y, 0.4);
    return;
  }
  // 5–6: a range tower at the back-right corner flies the flag
  campShelter(k, y, TZ + TD / 2 + 0.04, 1.42);
  const fyT = campTower(k, y);
  rangeFlag(k, TX + 0.2, TZ - 0.18, fyT + 0.66 + 0.25, 1.0, 0.55);
  rangeFlag(k, -2.25, Z1 + 0.05, y + bh, 1.4, 0.5);
  dangerBoard(k, 1.3, 1.4, y, 0.4);
  if (level === 5) {
    campBackWall(k, y, XB + 0.05, TX - TW / 2 - 0.05);
    k.lamp(XS - 0.12, Z1 + 0.08, y, 1.1);
    return;
  }
  // 6: Butts Range: raised butts wall and a red-roofed markers' hut behind it
  const hx0 = XB + 0.04, hx1 = -0.9;
  const hw = hx1 - hx0, hd = 0.42, hxc = (hx0 + hx1) / 2;
  k.block(hw, hd, 1, hxc, y, ZB);
  k.windowRow('front', hxc, ZB, hw, hd, 2, y + 0.42, { louvre: true });
  k.hipRoof(hw, hd, 0.3, hxc, y + STOREY, ZB, C.roof, 0.12);
  board(k, 'BUTTS', 0.4, 0.13, hxc, y + STOREY - 0.28, ZB + hd / 2 + 0.03, C.trim);
  campBackWall(k, y, hx1, TX - TW / 2 - 0.05, 0.45);
  k.lamp(XS - 0.12, Z1 + 0.08, y, 1.1);
  k.lamp(-0.8, Z0 - 0.05, y, 1.0);
}

// ------------------------------------------------------------------ base (7–10)

const BASE_GEAR: Gear = { uniform: OLIVE, helmet: '#4f5e33', ear: '#d8342c' };

function base(k: Kit, level: number, y: number) {
  const n = LANES[level - 1];
  const fy = laneFloor(k, y, n, 'turf');
  const bh = level <= 8 ? 1.05 : 1.15;
  const bt = concreteBerm(k, y, bh);
  const mt = mantlet(k, fy, CONCRETE, 0.14, HAZ);
  targets(k, n, fy, 'electronic', '#9a8f80', XT, HIT, [HIT]);
  laneNumbers(k, n, mt);
  // Mid-range row of pop-ups, hit by the first shot
  mantlet(k, fy, CONCRETE, 0.1, HAZ, MID + 0.2);
  targets(k, n, fy, 'electronic', null, MID, SHOTS[0], [], 1.0);
  k.box(0.95, 0.04, Z1 - Z0, '#d6d1c6', XF + 0.2, fy, (Z0 + Z1) / 2);
  // Low booth dividers between lanes on the firing point
  for (let i = 1; i < n; i++) k.box(0.4, 0.3, 0.03, '#e8e6e0', XF + 0.38, fy + 0.04, Z0 + laneW(n) * i);
  firingLine(k, n, fy + 0.04, ['prone', 'kneel', 'stand'], { ...BASE_GEAR, mid: MID });
  rangeOfficer(k, fy, '#f26b1d', '#7a1f1f');
  rangeFlag(k, -2.25, Z1 + 0.05, bt, 1.5, 0.55);
  dangerBoard(k, 1.3, 1.4, y, 0.4);
  if (level < 10) {
    concreteFiringPoint(k, y, TZ + TD / 2 + 0.04, 1.42, 1);
  } else {
    // 10: Range Complex: two-storey firing point with a gallery and a red roof
    concreteFiringPoint(k, y, TZ + TD / 2 + 0.04, 1.42, 2, C.roof);
    for (let i = 0; i < 5; i++) stander(k, 1.86, -0.3 + i * 0.36, y + STOREY + 0.03, Math.PI, 10 + i);
    board(k, 'RANGE COMPLEX', 1.0, 0.18, 2.44, y + STOREY + 0.32, 0.4, C.trim, '#ffffff', Math.PI / 2, 40);
  }
  // Tower: a two-storey concrete lookout, raised to a three-storey control tower at Lv 9
  const top = concreteTower(k, y, level >= 9 ? 1.4 : 1.32, level >= 9 ? C.roof : null, level >= 9 ? 0.3 : 0);
  rangeFlag(k, TX + 0.24, TZ - 0.2, top, 0.9, 0.55);
  if (level >= 9) k.antenna(TX - 0.2, top + 0.3, TZ - 0.15, 0.7);
  if (level === 7) {
    campBackWall(k, y, XB + 0.05, TX - TW / 2 - 0.05, 0.45);
    k.lamp(XS - 0.12, Z1 + 0.08, y, 1.1);
    return;
  }
  // 8+: tall concrete back wall with lamps and a scoreboard
  concreteBackWall(k, y, XB + 0.05, TX - TW / 2 - 0.05, 1.05);
  scoreboard(k, -0.5, Z0 - 0.02, y + 1.05, n, 0, 0.12, 0.9);
  if (level >= 10) {
    // Floodlight masts at the front corners
    for (const x of [-1.6, 0.9]) {
      k.cyl(0.04, 1.9, C.metal, x, y, Z1 + 0.12, 6);
      k.box(0.3, 0.16, 0.08, '#4a4f54', x, y + 1.9, Z1 + 0.12);
      k.box(0.26, 0.11, 0.01, '#fff6c8', x, y + 1.92, Z1 + 0.075);
    }
    k.flagpole(2.3, 1.32, 1.9, y);
  }
}

// ------------------------------------------------------------------ command (11–15)

const CMD_GEAR: Gear = { uniform: OLIVE, helmet: '#3f4a2a', ear: TEAL, vest: '#3f4a2a' };

function command(k: Kit, level: number, y: number) {
  const n = LANES[level - 1];
  const fy = laneFloor(k, y, n, 'teal');
  // White bullet catcher with steel deflector plates
  const bh = 1.2 + (level - 11) * 0.04;
  const bt = concreteBerm(k, y, bh, '#eeefe9', '#4a5258', GRASS);
  for (let i = 0; i < 4; i++) {
    const p = k.box(0.06, 0.3, Z1 - Z0 - 0.1, '#8a9196', XB + 0.06, y + 0.25 + i * 0.22, (Z0 + Z1) / 2);
    p.rotation.z = 0.5;
  }
  const mt = mantlet(k, fy, '#eeefe9', 0.15, TEAL);
  targets(k, n, fy, level >= 12 ? 'rail' : 'electronic', '#c9c4b9', XT, HIT, [HIT]);
  mantlet(k, fy, '#eeefe9', 0.1, TEAL, MID + 0.2);
  targets(k, n, fy, 'electronic', null, MID, SHOTS[0], [], 1.0);
  if (level >= 12) for (let i = 0; i < n; i++) for (const dz of [-0.06, 0.06]) k.box(0.8, 0.02, 0.02, '#33383d', XT + 0.33, fy, laneZ(i, n) + dz);
  laneNumbers(k, n, mt, TEAL, '#ffffff');
  k.box(0.95, 0.04, Z1 - Z0, '#e8e6e0', XF + 0.2, fy, (Z0 + Z1) / 2);
  for (let i = 1; i < n; i++) {
    k.box(0.42, 0.42, 0.025, '#bfe6f2', XF + 0.36, fy + 0.04, Z0 + laneW(n) * i);
    k.box(0.44, 0.03, 0.03, TEAL, XF + 0.36, fy + 0.46, Z0 + laneW(n) * i);
  }
  firingLine(k, n, fy + 0.04, ['stand', 'kneel', 'prone'], { ...CMD_GEAR, mid: MID });
  rangeOfficer(k, fy, '#2bb3a3', '#7a1f1f');
  rangeFlag(k, -2.25, Z1 + 0.05, bt, 1.5, 0.55);
  // Hall over the firing point and a white tower
  const ht = commandHall(k, y, TZ + TD / 2 + 0.04, 1.42, STOREY * 2);
  const tt = commandTower(k, y, STOREY * (level >= 15 ? 2.2 : 2.0), level >= 15);
  rangeFlag(k, TX + 0.26, TZ - 0.22, tt, 0.7, 0.5);
  if (level === 11 || level === 12) {
    // Baffle Range: overhead white baffles stop any round leaving the range
    for (const x of [-1.0, -0.1, 0.75]) baffle(k, x, y, 1.35, '#f2f1ec', '#d8dcd8', TEAL);
    campBackWall(k, y, XB + 0.05, TX - TW / 2 - 0.05, 0.5);
  }
  if (level >= 12) {
    // Glass control room on the hall roof overlooking the lanes
    if (level === 12) glassRoom(k, 2.12, ht, 0.35, 0.6, 0.42, 1.7, C.roofGreen, TEAL);
  }
  if (level >= 13) {
    // Indoor Range: continuous baffled roof over the lanes and a tall white back wall
    louvreRoof(k, y, -1.65, XS - 0.05, 1.45, '#f2f1ec', '#dfe3df');
    const wx0 = XB + 0.05, wx1 = TX - TW / 2 - 0.05;
    if (level === 13) {
      k.box(wx1 - wx0, 1.25, 0.12, '#f2f1ec', (wx0 + wx1) / 2, y, Z0 - 0.1);
      k.box(wx1 - wx0, 0.06, 0.14, TEAL, (wx0 + wx1) / 2, y + 1.0, Z0 - 0.1);
      glassRoom(k, 2.12, ht, 0.35, 0.6, 0.42, 1.7, C.roofGreen, TEAL);
    } else {
      // 14+: two-storey glass viewing gallery along the whole back of the range
      const gd = 0.4, gz = Z0 - 0.04 - gd / 2;
      k.box(wx1 - wx0, STOREY * 0.9, gd, '#f2f1ec', (wx0 + wx1) / 2, y, gz);
      glassRoom(k, (wx0 + wx1) / 2, y + STOREY * 0.9, gz, wx1 - wx0, 0.75, gd, C.roofGreen, TEAL);
      // Mullions across the long face
      for (let x = wx0 + 0.25; x < wx1; x += 0.35) k.box(0.03, 0.75, gd + 0.02, C.trim, x, y + STOREY * 0.9, gz);
      for (let i = 0; i < 4; i++) stander(k, wx0 + 0.6 + i * 0.75, gz + 0.06, y + STOREY * 0.9, -Math.PI / 2, 20 + i);
      glassRoom(k, 2.12, ht, 0.35, 0.6, 0.42, 1.7, C.roofGreen, TEAL);
    }
  }
  if (level === 15) {
    // Landmark Range: LED strip, plaza flags and a scoreboard on the gallery
    const led = part(k.group, new THREE.BoxGeometry(0.02, 0.1, 2.0), glow(TEAL, 1.4), 2.47, y + STOREY * 1.45 - 0.2, 0.35);
    led.castShadow = false;
    k.anims.push((t) => (led.scale.z = 0.6 + 0.4 * Math.abs(Math.sin(t * 0.8))));
    for (const z of [0.2, 0.7]) k.flagpole(2.36, z + 0.3, 1.6, y);
  }
  scoreboard(k, 0.9, Z0 - 0.05, y, n, 0.3, level >= 14 ? 1.0 : 0.85, 0.7);
}

// ------------------------------------------------------------------ secure (16–20)

const SEC_GEAR: Gear = { uniform: '#4a5242', helmet: '#2f3530', ear: '#33383d', vest: '#2a2f2c', tracer: '#7fe3ff' };

function secure(k: Kit, level: number, y: number) {
  const n = LANES[level - 1];
  const gold = level === 20;
  const fy = laneFloor(k, y, n, gold ? 'gold' : 'slate');
  const band = gold ? GOLD : HAZ;
  const bh = 1.3 + (level - 16) * 0.03;
  let bt: number;
  if (level >= 19) {
    // Simulator wall: the bullet catcher is a towering LED screen
    bt = armourBerm(k, y, bh, band);
    const sw = Z1 - Z0 + 0.1, sh = 1.15;
    k.box(0.16, sh + 0.16, sw + 0.12, STEEL_D, XB - 0.22, y + bh - 0.1, (Z0 + Z1) / 2);
    const scr = part(k.group, new THREE.BoxGeometry(0.03, sh, sw), glow('#1a6f8a', 0.9), XB - 0.13, y + bh + 0.0, (Z0 + Z1) / 2);
    scr.position.y = y + bh - 0.02 + sh / 2;
    scr.castShadow = false;
    // Moving figures and a sweeping scan bar on the screen
    for (let i = 0; i < 3; i++) {
      const fig = new THREE.Group();
      part(fig, new THREE.BoxGeometry(0.02, 0.32, 0.18), glow('#ffb020', 1.4), 0, 0, 0).castShadow = false;
      part(fig, new THREE.CylinderGeometry(0.07, 0.07, 0.02, 10).rotateZ(Math.PI / 2), glow('#ffb020', 1.4), 0, 0.24, 0).castShadow = false;
      fig.position.set(XB - 0.11, y + bh + 0.3, 0);
      k.add(fig);
      k.anims.push((t) => {
        const u = ((t * 0.12 + i / 3) % 1);
        fig.position.z = Z0 + (Z1 - Z0) * u;
        fig.position.y = y + bh + 0.32 + Math.abs(Math.sin(t * 3 + i)) * 0.05;
      });
    }
    const bar = part(k.group, new THREE.BoxGeometry(0.035, sh, 0.05), glow('#bff4ff', 1.8), XB - 0.11, y + bh - 0.02 + sh / 2, 0);
    bar.castShadow = false;
    k.anims.push((t) => (bar.position.z = Z0 + (Z1 - Z0) * (0.5 + 0.5 * Math.sin(t * 0.9))));
    k.box(0.18, 0.08, sw + 0.16, band, XB - 0.22, y + bh + sh + 0.06, (Z0 + Z1) / 2);
  } else bt = armourBerm(k, y, bh, band);
  const mt = mantlet(k, fy, STEEL, 0.16, band);
  const ts: TargetStyle = level === 16 ? 'led' : gold ? 'gold' : 'holo';
  targets(k, n, fy, ts, '#ffcf6a', XT, HIT, [HIT]);
  mantlet(k, fy, STEEL, 0.1, band, MID + 0.2);
  targets(k, n, fy, ts, null, MID, SHOTS[0], [], 1.0);
  laneNumbers(k, n, mt, '#1f2428', gold ? GOLD : CYAN);
  k.box(0.95, 0.04, Z1 - Z0, '#5c656b', XF + 0.2, fy, (Z0 + Z1) / 2);
  for (let i = 1; i < n; i++) {
    k.box(0.44, 0.46, 0.035, STEEL, XF + 0.36, fy + 0.04, Z0 + laneW(n) * i);
    k.box(0.45, 0.025, 0.04, gold ? GOLD : CYAN, XF + 0.36, fy + 0.5, Z0 + laneW(n) * i);
  }
  firingLine(k, n, fy + 0.04, ['stand', 'kneel', 'prone'], { ...SEC_GEAR, ear: gold ? GOLD : SEC_GEAR.ear, mid: MID });
  rangeOfficer(k, fy, '#f26b1d', '#1f2428');
  rangeFlag(k, -2.28, Z1 + 0.05, bt + 0.05, 1.5, 0.55, gold ? GOLD : C.white);
  // Bunker firing point and armoured tower
  const ht = bunker(k, y, TZ + TD / 2 + 0.04, 1.42, STOREY * 2.25, gold);
  const tt = secureTower(k, y, STOREY * (level >= 17 ? 2.05 : 1.9), gold);
  rangeFlag(k, TX + 0.28, TZ - 0.24, tt, 0.7, 0.5, gold ? GOLD : C.white);
  const wx0 = XB + 0.05, wx1 = TX - TW / 2 - 0.05;
  if (level === 16 || level === 17) {
    // Hardened Range: a dense row of armoured steel baffles with hazard bands
    for (let i = 0; i < 6; i++) baffle(k, -1.35 + i * 0.5, y, 1.4, STEEL, STEEL_D, band, 0.44);
    armourWall(k, y, wx0, wx1, level === 16 ? 0.6 : 0.75, band);
  } else {
    // 18+: Armoured hall: continuous louvred roof, tall armour wall with sensor pods
    louvreRoof(k, y, -1.65, XS - 0.05, 1.5, STEEL, gold ? GOLD : STEEL_D, 0.36);
    armourWall(k, y, wx0, wx1, 1.3, band);
    for (let x = wx0 + 0.4; x < wx1; x += 0.9) {
      const pod = part(k.group, new THREE.SphereGeometry(0.06, 8, 6), glow(gold ? '#ffd86a' : CYAN, 1), x, y + 1.42, Z0 - 0.1);
      pod.castShadow = false;
    }
  }
  if (level >= 17) {
    // Armoured control pod with a sensor visor on the bunker roof
    k.box(0.5, 0.36, 1.5, STEEL, 2.14, ht, 0.35);
    k.box(0.02, 0.12, 1.3, '#1f2a2e', 1.88, ht + 0.22, 0.35);
    const ps = part(k.group, new THREE.BoxGeometry(0.02, 0.03, 1.3), glow(gold ? '#ffd86a' : CYAN, 1.3), 1.88, ht + 0.12, 0.35);
    ps.castShadow = false;
    k.box(0.56, 0.06, 1.56, gold ? GOLD : STEEL_D, 2.14, ht + 0.36, 0.35);
  }
  if (level >= 17) {
    // Smart range: sensor masts track every shot
    sensorMast(k, -1.75, Z1 + 0.1, y, 1.6);
    sensorMast(k, 0.7, Z1 + 0.12, y, 1.5);
  }
  if (gold) {
    // Citadel: gold trims, a gold trophy plinth and twin gold-capped flagpoles
    k.box(0.32, 0.22, 0.32, '#2f3530', 2.2, y, 1.15);
    k.cyl(0.08, 0.06, GOLD, 2.2, y + 0.22, 1.15, 10);
    k.cyl(0.03, 0.12, GOLD, 2.2, y + 0.28, 1.15, 6);
    k.cyl(0.1, 0.12, GOLD, 2.2, y + 0.4, 1.15, 10, 0.13);
  }
  scoreboard(k, 0.9, Z0 - 0.05, y, n, 0.3, level >= 18 ? 1.3 : 0.85, 0.7);
}

// ------------------------------------------------------------------ assembly

function build(level: number): Kit {
  const k = new Kit();
  const y = k.pad(5, 3);
  if (level <= 3) field(k, level, y);
  else if (level <= 6) camp(k, level, y);
  else if (level <= 10) base(k, level, y);
  else if (level <= 15) command(k, level, y);
  else secure(k, level, y);
  return k;
}

export const FIRING_RANGE: BuildingDef = {
  id: 'firingrange',
  name: 'Firing Range',
  role: 'Trains marksmanship: boosts defence accuracy and damage camp-wide and raises troop marksmanship.',
  footprint: [5, 3],
  unlockHq: 10,
  levels: FIRING_RANGE_LEVELS,
  designedLevels: 20,
  build,
};
