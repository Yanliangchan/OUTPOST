import * as THREE from 'three';
import { C, Kit, STOREY, mat } from './kit';
import { CONCRETE, DARK_GLASS, GOLD } from './common';
import { DAY, HOUR, type BuildingDef, type LevelStats } from './types';

/*
 * Training Shed: turns Recruits into trained squads (the troops that later
 * defend the camp and go on raids). Signature at every level: Recruits visibly
 * training in field-craft drills (rope climb, low crawl under a net, scaling
 * wall, tyre run, monkey bars, sandbag carry, push-ups, sand-table lessons)
 * led by an instructor in a campaign hat who paces, points and blows a whistle.
 * The shed itself evolves: tarp basha → atap/zinc shed → red-roofed camp shed →
 * concrete drill hall with a rope tower → white sim centre with VR, holo
 * sand-table and abseil tower → hardened tactical complex with a drone cage
 * and a fast-rope helicopter mock-up.
 * Footprint 4×3; bulk stays at or under ~3.5 storeys.
 */

const TITLES = [
  'Basha Drill Shed', 'Atap Drill Shed', 'Zinc Training Shed', 'Training Shed', 'Training Shed · Store Annex', 'Twin-Bay Training Shed',
  'Drill Hall', 'Drill Hall · Rope Tower', 'Drill Hall · Classroom Wing', 'Training Wing', 'Sim Training Centre', 'Holo Sand-Table Pavilion',
  'VR Training Deck', 'Abseil Tower', 'Training Campus', 'Urban Ops Village', 'Bermed Drill Bunker', 'Drone Ops Cage',
  'Fast-Rope Gantry', 'Training Citadel',
];
const SUPPLIES = [60_000, 78_000, 101_000, 132_000, 171_000, 223_000, 290_000, 377_000, 490_000, 637_000, 828_000, 1_076_000, 1_399_000, 1_819_000, 2_365_000, 3_074_000, 3_996_000, 5_195_000, 6_754_000, 8_780_000];
const REPUTATION = [1_000, 1_250, 1_550, 1_900, 2_300, 2_750, 3_250, 3_800, 4_400, 5_100, 5_900, 6_800, 7_800, 8_900, 10_100, 11_500, 13_000, 14_700, 16_600, 18_700];
const TIME = [2 * HOUR, 3 * HOUR, 4 * HOUR, 6 * HOUR, 8 * HOUR, 10 * HOUR, 14 * HOUR, 18 * HOUR, 22 * HOUR, 1.25 * DAY, 1.5 * DAY, 2 * DAY, 2.5 * DAY, 3 * DAY, 3.5 * DAY, 4 * DAY, 4.5 * DAY, 5.25 * DAY, 6 * DAY, 7 * DAY];
/** Troop types unlocked at a level. */
const TROOPS: Record<number, string> = { 1: 'Riflemen', 3: 'Scouts', 6: 'Engineers', 9: 'Medics', 12: 'Signallers', 15: 'Commandos', 18: 'Drone Operators' };

export const TRAINING_SHED_LEVELS: LevelStats[] = TITLES.map((title, i) => {
  const level = i + 1;
  const capacity = Math.round((10 + (50 * i) / 19) / 2) * 2;
  const speed = Math.round((95 * i) / 19);
  const troopTypes = Object.keys(TROOPS).filter((l) => +l <= level).length;
  const unlocks = [`Squad capacity ${capacity} Recruits`, `Training speed +${speed}%`];
  if (TROOPS[level]) unlocks.unshift(`Troop type: ${TROOPS[level]}`);
  return {
    level, title,
    supplies: SUPPLIES[i],
    reputation: REPUTATION[i],
    buildTime: TIME[i],
    hp: Math.round((900 * Math.pow(1.2, i)) / 10) * 10,
    stats: { squadCapacity: capacity, trainingSpeed: speed, troopTypes },
    unlocks,
  };
});

// ------------------------------------------------------------------ palette

const TEE = '#6f9440';
const OLIVE_D = '#46542c';
const HELMET = '#55643a';
const INSTR = '#4a5a2e';
const HAT = '#c9a86a';
const OPS = '#3d4750';
const SKIN = ['#e0ac7e', '#c68b5f', '#a8714b', '#f0c39a'];
const DIRT = '#b98a5a';
const SAND = '#e3c98a';
const TARP = '#62723e';
const TARP_D = '#4f5c31';
const ATAP = '#a8854f';
const LOG = '#7a5a3b';
const LOG_D = '#5e4630';
const ROPE = '#d2b071';
const NET = '#3e3a2c';
const TYRE = '#2a2b2d';
const MAT_G = '#4f8f3e';
const RUBBER = '#a5483a';
const TEAL = '#2bb3a3';
const TEAL_MAT = '#3a9e98';
const ASPH = '#555a5f';
const HAZ = '#f2c230';
const BAG = '#c9b383';
const GRASS = '#5f9a3a';
const ARMOUR = '#5b6440';

const glow = (c: string, i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, flatShading: true });
const GLASS_T = new THREE.MeshStandardMaterial({ color: '#a8d8e6', transparent: true, opacity: 0.32, roughness: 0.1, flatShading: true, depthWrite: false });
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const smooth = (u: number) => u * u * (3 - 2 * u);
const clamp01 = (u: number) => Math.max(0, Math.min(1, u));
/** Phase 0..1 through a repeating cycle. */
const fr = (t: number, period: number, off = 0) => ((((t + off) % period) + period) % period) / period;
/** Heading (rotation.y) that faces a figure built along +x toward (dx, dz). */
const face = (dx: number, dz: number) => Math.atan2(-dz, dx);
const fade = (o: THREE.Object3D, p: number, a = 0.06, b = 0.08) => o.scale.setScalar(Math.max(0.01, Math.min(1, p / a, (1 - p) / b)));

// ------------------------------------------------------------------ helpers

type P = THREE.Object3D;

function grp(k: Kit, x: number, y: number, z: number, rotY = 0, parent: P = k.group) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  parent.add(g);
  return g;
}

function cyl(k: Kit, r: number, h: number, color: string | THREE.Material, x: number, y: number, z: number, parent: P = k.group, sides = 8, rTop = r) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, sides), typeof color === 'string' ? mat(color) : color);
  m.position.set(x, y + h / 2, z);
  return k.add(m, parent);
}

/** A round bar between two points (logs, braces, guy ropes). */
function strut(k: Kit, a: THREE.Vector3, b: THREE.Vector3, r: number, color: string, parent: P = k.group, sides = 6) {
  // Long slanted bars are split into short pieces so each stays a thin part (not counted as building mass).
  const d = b.clone().sub(a);
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(d.x), Math.abs(d.z)) / 0.2));
  const step = d.clone().divideScalar(n);
  const geo = new THREE.CylinderGeometry(r, r, step.length() + r, sides);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  let first: THREE.Mesh | null = null;
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, mat(color));
    m.position.copy(a).addScaledVector(step, i + 0.5);
    m.quaternion.copy(q);
    k.add(m, parent);
    first ??= m;
  }
  return first!;
}

function signMat(text: string, bg: string, fg: string, font = 40) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, 512, 96);
  g.fillStyle = fg;
  g.font = `900 ${font * 1.5}px Nunito, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 52, 490);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
}

/** Flat sign board with lettering on its front (+z) face. */
function board(k: Kit, text: string, w: number, h: number, x: number, y: number, z: number, bg: string, fg = '#ffffff', rotY = 0) {
  const side = mat(bg);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), [side, side, side, side, signMat(text, bg, fg), side]);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = rotY;
  return k.add(m);
}

/** Painted ground area (mat, sand pit, rubber yard). */
function floor(k: Kit, w: number, d: number, color: string, x: number, y: number, z: number, h = 0.02, parent?: P) {
  return k.box(w, h, d, color, x, y, z, parent);
}

// ------------------------------------------------------------------ people

interface Fig { root: THREE.Group; legL: THREE.Group; legR: THREE.Group; armL: THREE.Group; armR: THREE.Group }
type Role = 'recruit' | 'instructor' | 'vr' | 'op';

/** A ~0.6-tall figure facing +x with pivoting limbs: a Recruit in helmet, an instructor in a campaign hat, or a VR trainee. */
function fig(seed: number, role: Role = 'recruit'): Fig {
  const root = new THREE.Group();
  const shirt = role === 'instructor' ? INSTR : role === 'op' ? OPS : TEE;
  const legs = role === 'op' ? '#2f3438' : OLIVE_D;
  const skin = SKIN[seed % SKIN.length];
  const add = (geo: THREE.BufferGeometry, c: string | THREE.Material, x: number, yy: number, z: number, parent: P = root) => {
    const m = new THREE.Mesh(geo, typeof c === 'string' ? mat(c) : c);
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
    add(limb(0.065, 0.22, 0.065), legs, 0, 0, 0, l);
    add(new THREE.BoxGeometry(0.09, 0.045, 0.07), '#2a2b2d', 0.012, -0.24, 0, l);
    root.add(l);
  }
  add(new THREE.BoxGeometry(0.12, 0.2, 0.17), shirt, 0, 0.36, 0);
  add(new THREE.BoxGeometry(0.125, 0.03, 0.175), '#2a2b2d', 0, 0.27, 0);
  add(new THREE.IcosahedronGeometry(0.062, 0), skin, 0, 0.52, 0);
  if (role === 'recruit') add(new THREE.SphereGeometry(0.074, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), HELMET, -0.005, 0.53, 0);
  if (role === 'instructor') {
    add(new THREE.CylinderGeometry(0.115, 0.115, 0.014, 10), HAT, 0, 0.565, 0);
    add(new THREE.ConeGeometry(0.065, 0.08, 4), HAT, 0, 0.61, 0);
    add(new THREE.BoxGeometry(0.02, 0.1, 0.12), '#f4f1e8', 0.062, 0.4, 0); // lanyard
  }
  if (role === 'vr' || role === 'op') {
    add(new THREE.BoxGeometry(0.05, 0.05, 0.13), '#1d2226', 0.05, 0.53, 0);
    add(new THREE.BoxGeometry(0.01, 0.015, 0.11), glow(TEAL, 1.4), 0.077, 0.535, 0);
  }
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(0, 0.45, -0.105);
  armR.position.set(0, 0.45, 0.105);
  for (const a of [armL, armR]) {
    add(limb(0.05, 0.18, 0.05), shirt, 0, 0, 0, a);
    add(new THREE.BoxGeometry(0.045, 0.04, 0.045), skin, 0, -0.19, 0, a);
    root.add(a);
  }
  return { root, legL, legR, armL, armR };
}

function rest(f: Fig) {
  for (const l of [f.legL, f.legR, f.armL, f.armR]) {
    l.rotation.set(0, 0, 0);
    l.scale.set(1, 1, 1);
  }
}

function pose(f: Fig, walk: number, amp = 0.5) {
  const s = Math.sin(walk);
  f.legL.rotation.set(0, 0, s * amp);
  f.legR.rotation.set(0, 0, -s * amp);
  f.armL.rotation.set(0, 0, -s * amp * 0.8);
  f.armR.rotation.set(0, 0, s * amp * 0.8);
}

function place(k: Kit, p: P, f: Fig, x: number, z: number, rotY = 0, y = 0) {
  f.root.position.set(x, y, z);
  f.root.rotation.y = rotY;
  k.add(f.root, p);
  return f;
}

// ------------------------------------------------------------------ drill stations

/** A Recruit doing push-ups (body pivots on the toes; arms keep the hands on the ground). */
function pushups(k: Kit, p: P, x: number, z: number, rot: number, seed: number) {
  const f = place(k, p, fig(seed), x, z, rot);
  k.anims.push((t) => {
    const u = 0.5 + 0.5 * Math.sin(t * 3.4 + seed);
    const phi = 1.1 + u * 0.27;
    f.root.rotation.set(0, rot, -phi);
    const s = Math.max(0.4, (0.45 * Math.cos(phi)) / 0.21);
    for (const a of [f.armL, f.armR]) {
      a.rotation.set(0, 0, phi);
      a.scale.set(1, s, 1);
    }
  });
}

/** A Recruit doing jumping jacks. */
function jacks(k: Kit, p: P, x: number, z: number, rot: number, seed: number) {
  const f = place(k, p, fig(seed), x, z, rot);
  k.anims.push((t) => {
    const a = t * 3.6 + seed;
    const s = Math.abs(Math.sin(a));
    f.armL.rotation.set(s * 2.7, 0, 0);
    f.armR.rotation.set(-s * 2.7, 0, 0);
    f.legL.rotation.set(s * 0.32, 0, 0);
    f.legR.rotation.set(-s * 0.32, 0, 0);
    f.root.position.y = Math.abs(Math.sin(a * 2)) * 0.035;
  });
}

/** Low-crawl lane: a net pegged low over the ground with Recruits crawling under it (along local +x). */
function crawlLane(k: Kit, p: P, x: number, z: number, len: number, rot: number, seed: number, n = 2, ground: string | null = SAND, netColor = NET, wire = false, pipes = false) {
  const g = grp(k, x, 0, z, rot, p);
  if (ground) floor(k, len + 0.1, 0.56, ground, 0, 0, 0, 0.02, g);
  if (pipes) {
    // Concrete culvert pipes to crawl through, in a staggered pair of lines
    const seg = (len - 0.3) / 3;
    for (const lz of [-0.13, 0.13]) for (let i = 0; i < 3; i++) {
      const px = -len / 2 + seg / 2 + i * (seg + 0.15);
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, seg, 10, 1, true).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c9c4b8', side: THREE.DoubleSide, flatShading: true }));
      pipe.position.set(px, 0.15, lz);
      k.add(pipe, g);
      for (const e of [-1, 1]) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 4, 10).rotateY(Math.PI / 2), mat('#aaa59a'));
        rim.position.set(px + (e * seg) / 2, 0.15, lz);
        k.add(rim, g);
      }
    }
  }
  if (pipes) netColor = '';
  const nh = 0.2;
  if (netColor) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.035, 0.22, 0.035, wire ? C.metal : LOG, (sx * len) / 2, 0, sz * 0.24, g);
    for (let i = 0; i < 5; i++) k.box(len, 0.012, 0.012, netColor, 0, nh - (i % 2) * 0.012, -0.2 + i * 0.1, g);
    const m = Math.round(len / 0.12);
    for (let i = 0; i <= m; i++) k.box(0.012, 0.012, 0.46, netColor, -len / 2 + (i * len) / m, nh, 0, g);
  }
  if (wire && netColor) {
    const coil = new THREE.TorusGeometry(0.05, 0.006, 3, 8);
    for (let i = 0; i < Math.floor(len / 0.1); i++) {
      const c = new THREE.Mesh(coil, mat('#b9c0c4'));
      c.position.set(-len / 2 + 0.05 + i * 0.1, nh + 0.04, 0);
      c.rotation.y = Math.PI / 2 + 0.3;
      g.add(c);
    }
  }
  for (let i = 0; i < n; i++) {
    const f = place(k, g, fig(seed + i), 0, 0);
    const lz = pipes ? (i % 2 ? 0.13 : -0.13) : n === 1 ? 0 : -0.1 + (0.2 * i) / (n - 1);
    k.anims.push((t) => {
      const q = fr(t, 9, seed + (i * 9) / n);
      f.root.position.set(-len / 2 + 0.03 + (len - 0.66) * q, 0.065, lz);
      const a = t * 5 + i;
      f.root.rotation.set(Math.sin(a) * 0.08, 0, -Math.PI / 2);
      f.armL.rotation.set(0.7 + 0.45 * Math.sin(a), 0, Math.PI - 0.25);
      f.armR.rotation.set(-(0.7 - 0.45 * Math.sin(a)), 0, Math.PI - 0.25);
      f.legL.rotation.set(0.35 - 0.3 * Math.sin(a), 0, 0);
      f.legR.rotation.set(-(0.35 + 0.3 * Math.sin(a)), 0, 0);
      fade(f.root, q, 0.05, 0.05);
    });
  }
  return g;
}

/** Rope hanging from `top` (local height) with a Recruit climbing it hand over hand, then sliding down. */
function ropeClimb(k: Kit, p: P, x: number, z: number, top: number, seed: number, climber = true, rot = 0) {
  const r = grp(k, x, top, z, rot, p);
  const len = top - 0.03;
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, len, 5), mat(ROPE));
  rope.position.y = -len / 2;
  k.add(rope, r);
  k.box(0.06, 0.05, 0.06, C.dark, 0, -0.05, 0, r);
  k.box(0.045, 0.05, 0.045, ROPE, 0, -len + 0.03, 0, r);
  k.anims.push((t) => {
    r.rotation.z = Math.sin(t * 1.2 + seed) * 0.05;
    r.rotation.x = Math.sin(t * 0.8 + seed * 1.3) * 0.045;
  });
  if (!climber) return r;
  const f = place(k, r, fig(seed), -0.075, 0);
  const hmax = len - 0.72;
  k.anims.push((t) => {
    const q = fr(t, 8, seed * 1.7);
    let h = 0, a = 0;
    const climbing = q < 0.6;
    if (climbing) {
      const s = (q / 0.6) * 5;
      h = (hmax * (Math.floor(s) + smooth(s % 1))) / 5;
      a = (s % 1) * Math.PI * 2;
    } else if (q < 0.72) h = hmax;
    else if (q < 0.82) h = hmax * (1 - smooth((q - 0.72) / 0.1));
    f.root.position.set(-0.075, -len + h, 0);
    rest(f);
    f.armL.rotation.z = Math.PI - 0.25 + (climbing ? Math.sin(a) * 0.25 : 0);
    f.armR.rotation.z = Math.PI - 0.25 - (climbing ? Math.sin(a) * 0.25 : 0);
    if (h > 0.03) {
      f.legL.rotation.z = 0.55 + Math.sin(a) * 0.3;
      f.legR.rotation.z = 0.25 - Math.sin(a) * 0.2;
    }
    if (q >= 0.6 && q < 0.72) f.armL.rotation.set(0.7, 0, Math.PI - 0.6 + Math.sin(t * 9) * 0.25); // slaps the beam
  });
  return r;
}

/** Scaling wall: a Recruit runs up, climbs over, drops down the far side and jogs off (along local +x). */
function scalingWall(k: Kit, p: P, x: number, z: number, rot: number, h: number, color: string, seed: number, top: string = C.white, span = 0.85) {
  const g = grp(k, x, 0, z, rot, p);
  k.box(0.08, h, 0.78, color, 0, 0, 0, g);
  k.box(0.11, 0.05, 0.8, top, 0, h, 0, g);
  for (const sz of [-0.36, 0.36]) strut(k, V(0.04, h * 0.85, sz), V(0.42, 0, sz), 0.022, LOG_D, g);
  const f = place(k, g, fig(seed), -span, 0);
  k.anims.push((t) => {
    const q = fr(t, 6, seed);
    rest(f);
    f.root.rotation.set(0, 0, 0);
    let xx = -span, yy = 0;
    if (q < 0.2) {
      xx = -span + (span - 0.13) * (q / 0.2);
      pose(f, t * 11, 0.7);
    } else if (q < 0.45) {
      const u = smooth((q - 0.2) / 0.25);
      xx = -0.12;
      yy = (h - 0.28) * u;
      f.armL.rotation.z = Math.PI - 0.3 + Math.sin(t * 8) * 0.2;
      f.armR.rotation.z = Math.PI - 0.3 - Math.sin(t * 8) * 0.2;
      f.legL.rotation.z = 0.6 + Math.sin(t * 8) * 0.35;
      f.legR.rotation.z = 0.6 - Math.sin(t * 8) * 0.35;
    } else if (q < 0.58) {
      const u = smooth((q - 0.45) / 0.13);
      xx = -0.12 + 0.12 * u;
      yy = h - 0.28 + 0.06 * u;
      f.legL.rotation.x = 1.2 * u;
      f.legR.rotation.x = -1.2 * u;
      f.armL.rotation.z = f.armR.rotation.z = 0.4;
      yy = h - 0.22 * (1 - u) - 0.2 * u;
    } else if (q < 0.68) {
      const u = (q - 0.58) / 0.1;
      xx = 0.16 * u + 0.02;
      yy = (h - 0.2) * (1 - u * u);
      f.armL.rotation.set(0.5, 0, 2.2);
      f.armR.rotation.set(-0.5, 0, 2.2);
    } else {
      const u = (q - 0.68) / 0.32;
      xx = 0.18 + (span - 0.18) * u;
      pose(f, t * 11, 0.7);
    }
    f.root.position.set(xx, yy, 0);
    fade(f.root, q, 0.04, 0.06);
  });
  return g;
}

/** Monkey bars: a Recruit swings hand over hand along the rungs (local +x). */
function monkeyBars(k: Kit, p: P, x: number, z: number, rot: number, len: number, h: number, color: string, seed: number) {
  const g = grp(k, x, 0, z, rot, p);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.05, h, 0.05, color, (sx * len) / 2, 0, sz * 0.15, g);
  for (const sz of [-1, 1]) k.box(len + 0.05, 0.045, 0.045, color, 0, h - 0.045, sz * 0.15, g);
  const n = Math.round(len / 0.14);
  for (let i = 1; i < n; i++) k.box(0.03, 0.03, 0.3, C.metal, -len / 2 + (i * len) / n, h - 0.03, 0, g);
  for (let i = 1; i < 4; i++) k.box(0.03, 0.03, 0.3, C.metal, -len / 2, (h * i) / 4, 0, g);
  const f = place(k, g, fig(seed), -len / 2, 0);
  const steps = Math.max(3, n - 2);
  k.anims.push((t) => {
    const q = fr(t, 7, seed);
    rest(f);
    f.root.rotation.set(0, 0, 0);
    let xx = -len / 2 + 0.1, yy = h - 0.67;
    if (q < 0.1) {
      yy = (h - 0.67) * smooth(q / 0.1);
      f.armL.rotation.z = f.armR.rotation.z = Math.PI;
    } else if (q < 0.82) {
      const s = ((q - 0.1) / 0.72) * steps;
      const u = (Math.floor(s) + smooth(s % 1)) / steps;
      xx = -len / 2 + 0.1 + (len - 0.2) * u;
      const sw = Math.cos(s * Math.PI);
      f.armL.rotation.z = Math.PI + 0.38 * sw;
      f.armR.rotation.z = Math.PI - 0.38 * sw;
      f.root.rotation.z = 0.12 * Math.sin(s * Math.PI);
      f.legL.rotation.z = 0.3 * Math.sin(s * Math.PI + 1);
      f.legR.rotation.z = 0.2 * Math.sin(s * Math.PI + 2);
    } else if (q < 0.88) {
      xx = len / 2 - 0.1;
      const u = (q - 0.82) / 0.06;
      yy = (h - 0.67) * (1 - u * u);
      f.armL.rotation.z = f.armR.rotation.z = Math.PI - u;
    } else {
      xx = len / 2 - 0.1 + ((q - 0.88) / 0.12) * 0.4;
      yy = 0;
      pose(f, t * 9, 0.6);
    }
    f.root.position.set(xx, yy, 0);
    fade(f.root, q, 0.03, 0.05);
  });
  return g;
}

/** Tyre run: two staggered rows of tyres; Recruits high-knee through them (local +x). */
function tyreRun(k: Kit, p: P, x: number, z: number, rot: number, len: number, seed: number, runners = 1, color = TYRE) {
  const g = grp(k, x, 0, z, rot, p);
  const geo = new THREE.TorusGeometry(0.095, 0.042, 5, 10).rotateX(Math.PI / 2);
  const n = Math.floor(len / 0.24);
  for (let i = 0; i < n; i++) for (const sz of [-1, 1]) {
    const m = new THREE.Mesh(geo, mat(i % 4 === 3 && sz > 0 ? '#d8342c' : color));
    m.position.set(-len / 2 + 0.12 + i * 0.24 + (sz > 0 ? 0.12 : 0), 0.045, sz * 0.12);
    k.add(m, g);
  }
  for (let i = 0; i < runners; i++) {
    const f = place(k, g, fig(seed + i), 0, 0);
    k.anims.push((t) => {
      const q = fr(t, 5.5, seed + (i * 5.5) / runners);
      const xx = -len / 2 - 0.1 + (len + 0.1) * q;
      f.root.position.set(xx, Math.abs(Math.sin(t * 12)) * 0.05, 0.1 * Math.sin((xx * Math.PI) / 0.24));
      pose(f, t * 12, 0.9);
      fade(f.root, q, 0.06, 0.06);
    });
  }
  return g;
}

/** A Recruit ferrying sandbags between two piles. */
function sandbagCarry(k: Kit, p: P, x0: number, z0: number, x1: number, z1: number, seed: number, period = 10) {
  const f = place(k, p, fig(seed), x0, z0);
  const bag = k.box(0.26, 0.1, 0.15, BAG, 0.0, 0.56, 0.07, f.root);
  bag.rotation.y = 0.2;
  k.anims.push((t) => {
    const q = fr(t, period, seed);
    const fwd = q < 0.5;
    const u = smooth(fwd ? q * 2 : 2 - q * 2);
    f.root.position.set(x0 + (x1 - x0) * u, 0, z0 + (z1 - z0) * u);
    f.root.rotation.y = fwd ? face(x1 - x0, z1 - z0) : face(x0 - x1, z0 - z1);
    const turning = Math.min(q, Math.abs(q - 0.5), 1 - q) < 0.04;
    pose(f, turning ? 0 : t * 8, fwd ? 0.35 : 0.55);
    bag.visible = fwd;
    if (fwd) f.armR.rotation.set(-0.3, 0, Math.PI - 0.5);
  });
}

/** Instructor: paces between two points, stops to point at the drill, walks back and blows the whistle. */
function instructor(k: Kit, p: P, x0: number, z0: number, x1: number, z1: number, look: number, seed: number, period = 11, y = 0) {
  const f = place(k, p, fig(seed, 'instructor'), x0, z0, 0, y);
  k.box(0.03, 0.025, 0.025, HAZ, 0, -0.21, 0.0, f.armL); // whistle
  k.anims.push((t) => {
    const q = fr(t, period, seed);
    rest(f);
    let u = 0;
    if (q < 0.3) u = smooth(q / 0.3);
    else if (q < 0.5) u = 1;
    else if (q < 0.8) u = 1 - smooth((q - 0.5) / 0.3);
    f.root.position.set(x0 + (x1 - x0) * u, y, z0 + (z1 - z0) * u);
    if (q < 0.3 || (q >= 0.5 && q < 0.8)) {
      pose(f, t * 8, 0.45);
      f.root.rotation.y = q < 0.3 ? face(x1 - x0, z1 - z0) : face(x0 - x1, z0 - z1);
    } else if (q < 0.5) {
      f.root.rotation.y = look + Math.sin(t * 0.8) * 0.3;
      f.armR.rotation.z = 1.5 + Math.sin(t * 3) * 0.15; // pointing at the drill
    } else {
      f.root.rotation.y = look;
      f.armL.rotation.set(0.6, 0, 2.5); // whistle to the lips
      f.armR.rotation.set(-0.3, 0, 0.3 + Math.abs(Math.sin(t * 6)) * 0.4);
    }
  });
  return f;
}

/** A trainee standing and watching (shifts weight, nods, occasionally raises a hand). */
function watcher(k: Kit, p: P, x: number, z: number, rot: number, seed: number, role: Role = 'recruit', y = 0) {
  const f = place(k, p, fig(seed, role), x, z, rot, y);
  k.anims.push((t) => {
    f.root.rotation.y = rot + Math.sin(t * 0.6 + seed) * 0.25;
    f.root.rotation.z = Math.sin(t * 0.9 + seed) * 0.05;
    const hand = fr(t, 9, seed * 2.3) < 0.14;
    f.armR.rotation.z = hand ? 2.9 : Math.sin(t * 0.9 + seed) * 0.08;
  });
  return f;
}

/** Sand-table lesson: terrain model with seated (or standing) Recruits and an instructor pointing with a stick. */
function sandTable(k: Kit, p: P, x: number, z: number, rot: number, seed: number, raised = false) {
  const g = grp(k, x, 0, z, rot, p);
  const th = raised ? 0.3 : 0.05;
  if (raised) for (const sx of [-0.36, 0.36]) for (const sz of [-0.2, 0.2]) k.box(0.04, th, 0.04, LOG, sx, 0, sz, g);
  k.box(0.88, 0.05, 0.54, raised ? LOG : LOG_D, 0, th, 0, g);
  k.box(0.82, 0.03, 0.48, SAND, 0, th + 0.03, 0, g);
  const ty = th + 0.06;
  for (const [bx, bz, s] of [[-0.22, -0.1, 1.1], [0.05, 0.12, 0.8], [0.25, -0.08, 0.9]]) {
    const hill = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09 * s, 0), mat('#7aa04a'));
    hill.position.set(bx, ty, bz);
    hill.scale.set(1, 0.5, 1);
    k.add(hill, g);
  }
  const river = k.box(0.7, 0.008, 0.045, '#4f9fd0', 0, ty - 0.005, 0.0, g);
  river.rotation.y = 0.35;
  for (const [fx, fz, c] of [[-0.3, 0.15, '#d8342c'], [0.3, 0.16, '#2f5a8a'], [-0.05, -0.17, '#d8342c']] as [number, number, string][]) {
    k.box(0.008, 0.08, 0.008, C.dark, fx, ty, fz, g);
    k.box(0.04, 0.025, 0.006, c, fx + 0.02, ty + 0.055, fz, g);
  }
  // Trainees around the long sides
  const seats: [number, number][] = [[-0.25, 0.44], [0.12, 0.44], [-0.25, -0.44], [0.12, -0.44]];
  seats.forEach(([sx, sz], i) => {
    const r = face(0 - sx * 0.2, -sz);
    if (raised) watcher(k, g, sx, sz * 0.85, r, seed + i);
    else {
      const f = place(k, g, fig(seed + i), sx, sz, r, -0.19);
      k.anims.push((t) => {
        f.legL.rotation.z = f.legR.rotation.z = Math.PI / 2;
        f.root.rotation.z = Math.sin(t * 0.9 + i * 1.7) * 0.06;
        const hand = fr(t, 8, seed + i * 2.1) < 0.14;
        f.armR.rotation.z = hand ? 2.9 : 0.25;
        f.armL.rotation.z = 0.25;
      });
    }
  });
  // Instructor at the end with a pointer stick
  const ins = place(k, g, fig(seed + 7, 'instructor'), 0.62, 0, Math.PI);
  k.box(0.015, 0.32, 0.015, LOG_D, 0, -0.5, 0, ins.armR);
  k.anims.push((t) => {
    ins.root.rotation.y = Math.PI + Math.sin(t * 0.5 + seed) * 0.35;
    ins.armR.rotation.z = 0.95 + Math.sin(t * 1.1 + seed) * 0.25;
    ins.armR.rotation.x = Math.sin(t * 0.7) * 0.3;
    ins.armL.rotation.z = 0.2 + Math.max(0, Math.sin(t * 0.6)) * 0.6;
  });
  return g;
}

/** Pad-work pair: one Recruit punches focus pads held by a partner (no weapons). */
function punchPads(k: Kit, p: P, x: number, z: number, rot: number, seed: number) {
  const g = grp(k, x, 0, z, rot, p);
  floor(k, 0.75, 0.4, '#2f5a8a', 0, 0, 0, 0.02, g);
  const a = place(k, g, fig(seed), -0.2, 0);
  const b = place(k, g, fig(seed + 1), 0.22, 0, Math.PI);
  for (const arm of [b.armL, b.armR]) k.box(0.07, 0.11, 0.09, '#d8342c', 0.02, -0.25, 0, arm);
  k.anims.push((t) => {
    const s = Math.sin(t * 6 + seed);
    const l = Math.max(0, s), r = Math.max(0, -s);
    a.armL.rotation.z = 0.7 + l * 0.9;
    a.armR.rotation.z = 0.7 + r * 0.9;
    a.legL.rotation.z = 0.25;
    a.legR.rotation.z = -0.15;
    a.root.position.y = Math.abs(Math.sin(t * 3)) * 0.015;
    b.armL.rotation.z = b.armR.rotation.z = 1.3;
    b.root.position.x = 0.22 + (l + r) * 0.02;
  });
}

// ------------------------------------------------------------------ modern stations

/** Motion simulator pod: a tub on a gimbal that tilts, a seated trainee in a visor and a glowing screen. */
function simPod(k: Kit, p: P, x: number, z: number, rot: number, seed: number) {
  const g = grp(k, x, 0, z, rot, p);
  cyl(k, 0.22, 0.1, C.dark, 0, 0, 0, g, 10);
  cyl(k, 0.05, 0.2, C.metal, 0, 0.1, 0, g, 6);
  const gim = grp(k, 0, 0.32, 0, 0, g);
  k.box(0.56, 0.14, 0.42, C.white, 0, 0, 0, gim);
  k.box(0.57, 0.03, 0.43, TEAL, 0, 0.1, 0, gim);
  k.box(0.07, 0.36, 0.42, C.white, -0.25, 0.1, 0, gim);
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.22, 10, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: C.white, side: THREE.DoubleSide, flatShading: true }));
  shell.position.set(-0.14, 0.2, 0);
  k.add(shell, gim);
  const scr = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.28), glow('#5fe0d2', 1.2));
  scr.position.set(0.26, 0.3, 0);
  k.add(scr, gim);
  k.box(0.03, 0.2, 0.03, C.metal, 0.25, 0.07, 0, gim);
  const f = place(k, gim, fig(seed, 'vr'), -0.12, 0, 0, -0.12);
  k.anims.push((t) => {
    gim.rotation.x = Math.sin(t * 1.6 + seed) * 0.2;
    gim.rotation.z = Math.sin(t * 1.1 + seed * 2) * 0.16;
    f.legL.rotation.z = f.legR.rotation.z = Math.PI / 2;
    f.armL.rotation.z = 1.2 + Math.sin(t * 5 + seed) * 0.08;
    f.armR.rotation.z = 1.2 - Math.sin(t * 4 + seed) * 0.08;
    (scr.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.9 + Math.sin(t * 7 + seed) * 0.4;
  });
}

/** VR ring: a trainee in a visor walking in place inside a glowing safety ring, reaching and turning. */
function vrRing(k: Kit, p: P, x: number, z: number, seed: number) {
  const g = grp(k, x, 0, z, 0, p);
  cyl(k, 0.3, 0.04, '#2f3438', 0, 0, 0, g, 12);
  cyl(k, 0.31, 0.012, TEAL, 0, 0.035, 0, g, 12);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    k.box(0.025, 0.36, 0.025, C.metal, Math.cos(a) * 0.28, 0.04, Math.sin(a) * 0.28, g);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.018, 4, 18).rotateX(Math.PI / 2), glow(TEAL, 1));
  ring.position.y = 0.4;
  k.add(ring, g);
  const f = place(k, g, fig(seed, 'vr'), 0, 0, 0, 0.04);
  k.anims.push((t) => {
    f.root.rotation.y = t * 0.4 + seed + Math.sin(t * 0.9) * 0.6;
    pose(f, t * 7, 0.3);
    f.armL.rotation.z = 1.3 + Math.sin(t * 2 + seed) * 0.4;
    f.armR.rotation.z = 1.0 + Math.sin(t * 1.6 + seed) * 0.5;
    (ring.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.7 + Math.sin(t * 3 + seed) * 0.4;
  });
}

/** Holographic sand-table: glowing disc with a slowly turning wireframe terrain and bobbing unit markers. */
function holoTable(k: Kit, p: P, x: number, z: number, r: number, seed: number, trainees = 3, gold = false) {
  const g = grp(k, x, 0, z, 0, p);
  cyl(k, 0.16, 0.3, C.white, 0, 0, 0, g, 8);
  cyl(k, r, 0.06, gold ? GOLD : '#2f3438', 0, 0.3, 0, g, 16);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, 0.012, 16), glow(TEAL, 1.2));
  disc.position.y = 0.366;
  k.add(disc, g);
  const holo = new THREE.Mesh(new THREE.IcosahedronGeometry(r * 0.72, 1), new THREE.MeshBasicMaterial({ color: '#7ff5e6', wireframe: true, transparent: true, opacity: 0.8 }));
  holo.position.y = 0.5;
  holo.scale.set(1, 0.32, 1);
  g.add(holo);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r * 0.88, 0.3, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#7ff5e6', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
  beam.position.y = 0.52;
  g.add(beam);
  const marks: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), glow(i % 2 ? '#ff5a4a' : '#5fb0ff', 1.4));
    g.add(m);
    marks.push(m);
  }
  k.anims.push((t) => {
    holo.rotation.y = t * 0.35 + seed;
    marks.forEach((m, i) => {
      const a = t * 0.35 + seed + i * 1.6;
      m.position.set(Math.cos(a) * r * 0.45, 0.6 + Math.sin(t * 2 + i) * 0.04, Math.sin(a) * r * 0.45);
      m.rotation.y = t * 2;
    });
  });
  for (let i = 0; i < trainees; i++) {
    const a = 0.6 + (i / trainees) * Math.PI * 1.4;
    watcher(k, g, Math.cos(a) * (r + 0.17), Math.sin(a) * (r + 0.17), face(-Math.cos(a), -Math.sin(a)), seed + i, i === 0 ? 'instructor' : 'recruit');
  }
  return g;
}

/** Quadcopter that orbits a point, rotors spinning. */
function drone(k: Kit, p: P, cx: number, cy: number, cz: number, rad: number, seed: number, speed = 0.9) {
  const d = grp(k, cx, cy, cz, 0, p);
  k.box(0.13, 0.045, 0.13, '#2a2f33', 0, 0, 0, d);
  k.box(0.04, 0.02, 0.04, '#ff3b30', 0.06, 0.04, 0, d);
  const rotors: THREE.Mesh[] = [];
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const arm = k.box(0.12, 0.015, 0.02, '#2a2f33', dx * 0.06, 0.02, dz * 0.06, d);
    arm.rotation.y = dx * dz > 0 ? -Math.PI / 4 : Math.PI / 4;
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.006, 0.018), mat('#c9ced2'));
    r.position.set(dx * 0.1, 0.045, dz * 0.1);
    k.add(r, d);
    rotors.push(r);
  }
  k.anims.push((t) => {
    const a = t * speed + seed;
    d.position.set(cx + Math.cos(a) * rad, cy + Math.sin(a * 2) * 0.08, cz + Math.sin(a) * rad * 0.7);
    d.rotation.set(Math.sin(a) * 0.15, -a, 0.12);
    rotors.forEach((r, i) => (r.rotation.y = t * 30 + i));
  });
}

/** Abseiler: rope from the roof edge; a trainee leans out from the wall (local +x) and descends in hops. */
function abseil(k: Kit, p: P, x: number, z: number, rot: number, top: number, seed: number) {
  const g = grp(k, x, 0, z, rot, p);
  k.box(0.3, 0.05, 0.06, C.dark, 0.13, top, 0, g); // davit arm
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, top, 4), mat(ROPE));
  rope.position.set(0.25, top / 2, 0);
  k.add(rope, g);
  const f = place(k, g, fig(seed), 0.03, 0, Math.PI);
  const y0 = top - 0.45;
  k.anims.push((t) => {
    const q = fr(t, 7, seed);
    rest(f);
    let yy = 0, xx = 0.03, lean = 0;
    if (q < 0.82) {
      const s = (q / 0.82) * 5;
      const hop = s % 1;
      yy = y0 * (1 - (Math.floor(s) + smooth(hop)) / 5);
      xx = 0.03 + Math.sin(hop * Math.PI) * 0.16;
      lean = 1.0 * clamp01(yy / 0.35);
      f.legL.rotation.z = 0.4 * Math.sin(hop * Math.PI);
      f.legR.rotation.z = 0.3 * Math.sin(hop * Math.PI);
      f.armL.rotation.z = 2.3 - lean * 0.6;
      f.armR.rotation.z = -0.4;
    } else {
      const u = (q - 0.82) / 0.18;
      xx = 0.03 + u * 0.6;
      pose(f, t * 8, 0.5);
      f.root.rotation.set(0, 0, 0);
    }
    f.root.position.set(xx, yy, 0);
    if (q < 0.82) f.root.rotation.set(0, Math.PI, lean);
    else f.root.rotation.set(0, 0, 0);
    fade(f.root, q, 0.04, 0.06);
  });
}

/** Fast-roper: slides down a rope from `top` (local) and runs clear (local +x). */
function fastRope(k: Kit, p: P, x: number, z: number, top: number, seed: number) {
  const g = grp(k, x, 0, z, 0, p);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, top, 5), mat('#2a2b2d'));
  rope.position.set(0, top / 2, 0);
  k.add(rope, g);
  const f = place(k, g, fig(seed), -0.07, 0);
  k.anims.push((t) => {
    const q = fr(t, 5, seed);
    rest(f);
    f.root.rotation.set(0, 0, 0);
    let xx = -0.07, yy = 0;
    if (q < 0.45) {
      const u = clamp01((q - 0.08) / 0.37);
      yy = (top - 0.68) * (1 - u * u);
      f.armL.rotation.z = Math.PI - 0.25;
      f.armR.rotation.z = Math.PI - 0.1;
      f.legL.rotation.z = 0.4;
      f.legR.rotation.z = 0.1;
    } else if (q < 0.75) {
      xx = -0.07 + ((q - 0.45) / 0.3) * 0.75;
      pose(f, t * 11, 0.7);
    } else xx = 0.7;
    f.root.position.set(xx, yy, 0);
    f.root.scale.setScalar(q < 0.75 ? Math.max(0.01, Math.min(1, q / 0.06, (0.75 - q) / 0.06)) : 0.01);
  });
}

/** Rope-climb frame of two posts and a beam along local x, with ropes. */
function ropeFrame(k: Kit, p: P, x: number, z: number, rot: number, w: number, h: number, color: string, seed: number, ropes = 2, round = false) {
  const g = grp(k, x, 0, z, rot, p);
  for (const s of [-1, 1]) {
    if (round) cyl(k, 0.045, h, color, (s * w) / 2, 0, 0, g, 6);
    else k.box(0.07, h, 0.07, color, (s * w) / 2, 0, 0, g);
    strut(k, V((s * w) / 2, h * 0.55, 0), V((s * w) / 2, 0, 0.45), 0.022, color, g);
    strut(k, V((s * w) / 2, h * 0.55, 0), V((s * w) / 2, 0, -0.45), 0.022, color, g);
  }
  k.box(w + 0.16, 0.07, 0.07, color, 0, h - 0.04, 0, g);
  for (let i = 0; i < ropes; i++) {
    const rx = ropes === 1 ? 0 : -w / 2 + 0.18 + ((w - 0.36) * i) / (ropes - 1);
    ropeClimb(k, g, rx, 0, h - 0.05, seed + i * 3.1, i !== 1 || seed % 2 === 0);
  }
  return g;
}

// ------------------------------------------------------------------ structures

/** Open-sided shed: posts along front and back, roof over. Returns the eaves height. */
function shedPosts(k: Kit, x: number, z: number, w: number, d: number, h: number, y: number, n: number, color: string, size = 0.08, trim: string | null = null) {
  for (let i = 0; i < n; i++) {
    const px = x - w / 2 + 0.06 + ((w - 0.12) * i) / (n - 1);
    for (const s of [-1, 1]) {
      k.box(size, h, size, color, px, y, z + s * (d / 2 - 0.06));
      if (trim) k.box(size + 0.03, 0.12, size + 0.03, trim, px, y, z + s * (d / 2 - 0.06));
    }
  }
  return y + h;
}

/** Concrete drill hall: portal columns, cream back and end walls, open front, red roof with a ventilated ridge monitor. */
function drillHall(k: Kit, p: P, x: number, z: number, w: number, d: number, eh: number, rh: number, y: number, roof: string = C.roof, barrel = false) {
  floor(k, w - 0.08, d - 0.08, '#c4bfb3', x, y, z);
  floor(k, w - 0.5, d - 0.5, MAT_G, x, y + 0.02, z + 0.05, 0.015);
  const n = Math.max(4, Math.round(w / 0.6) + 1);
  shedPosts(k, x, z, w, d, eh, y, n, CONCRETE, 0.15);
  k.box(w - 0.1, eh - 0.05, 0.08, C.wall, x, y, z - d / 2 + 0.06);
  k.box(w - 0.1, 0.16, 0.1, C.trim, x, y, z - d / 2 + 0.06);
  k.box(w - 0.4, 0.22, 0.02, DARK_GLASS, x, y + eh - 0.42, z - d / 2 + 0.11);
  for (const s of [-1, 1]) {
    k.box(0.08, eh - 0.05, d - 0.1, C.wall, x + s * (w / 2 - 0.06), y, z);
    k.box(0.1, 0.16, d - 0.1, C.trim, x + s * (w / 2 - 0.06), y, z);
    k.windowRow(s > 0 ? 'right' : 'left', x + s * (w / 2 - 0.06), z, 0.08, d - 0.1, 2, y + eh * 0.5, { ww: 0.34, wh: 0.4, louvre: true });
  }
  k.box(w, 0.18, 0.16, CONCRETE, x, y + eh - 0.18, z + d / 2 - 0.06);
  if (barrel) {
    // Curved barrel-vault roof with ribs and half-moon end walls
    const r = d / 2 + 0.2, sy = rh / r;
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w + 0.3, 18, 1, true, 0, Math.PI).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: roof, side: THREE.DoubleSide, flatShading: true, roughness: 0.8 }));
    shell.scale.set(1, sy, 1);
    shell.position.set(x, y + eh, z);
    k.add(shell);
    for (let i = 0; i <= 5; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(r + 0.01, 0.025, 4, 18, Math.PI).rotateY(Math.PI / 2), mat(C.trim));
      rib.scale.set(1, sy, 1);
      rib.position.set(x - (w + 0.3) / 2 + ((w + 0.3) * i) / 5, y + eh, z);
      k.add(rib);
    }
    for (const sgn of [-1, 1]) {
      const end = new THREE.Mesh(new THREE.CircleGeometry(r - 0.2, 14, 0, Math.PI).rotateY(Math.PI / 2), new THREE.MeshStandardMaterial({ color: C.wall, side: THREE.DoubleSide, flatShading: true }));
      end.scale.set(1, sy, 1);
      end.position.set(x + sgn * (w / 2 - 0.02), y + eh, z);
      k.add(end);
    }
    k.box(w + 0.32, 0.06, 0.08, C.trim, x, y + eh, z + r - 0.04);
    k.box(w + 0.32, 0.06, 0.08, C.trim, x, y + eh, z - r + 0.04);
    void p;
    return y + eh;
  }
  k.gableRoof(w, d, rh, x, y + eh, z, roof, 0.2, C.wall);
  // Ridge monitor with louvres
  const my = y + eh + rh - 0.1;
  k.box(w * 0.62, 0.2, 0.32, C.white, x, my, z);
  for (let i = 0; i < 3; i++) k.box(w * 0.62 + 0.01, 0.02, 0.33, C.trim, x, my + 0.05 + i * 0.05, z);
  k.gableRoof(w * 0.62, 0.32, 0.14, x, my + 0.2, z, C.roofDark, 0.08, C.white);
  void p;
  return y + eh;
}

/** White modern block: ribbon glazing, teal floor bands, green roof with a white parapet. Returns its top. */
function whiteBlock(k: Kit, x: number, z: number, w: number, d: number, floors: number, y: number, fins = true) {
  const h = floors * STOREY;
  k.box(w, h, d, C.white, x, y, z);
  for (let f = 0; f < floors; f++) {
    const fy = y + f * STOREY;
    k.box(w - 0.2, 0.4, 0.03, DARK_GLASS, x, fy + 0.3, z + d / 2 + 0.005);
    k.box(0.03, 0.4, d - 0.2, DARK_GLASS, x + w / 2 + 0.005, fy + 0.3, z);
    if (f > 0) k.box(w + 0.04, 0.06, d + 0.04, TEAL, x, fy - 0.03, z);
  }
  k.box(w + 0.04, 0.12, d + 0.04, '#9aa3a6', x, y, z);
  if (fins) k.fins(w - 0.1, h - 0.15, x, y + 0.1, z + d / 2 + 0.07, Math.round(w / 0.22));
  k.box(w + 0.1, 0.08, d + 0.1, C.white, x, y + h, z);
  k.box(w - 0.06, 0.05, d - 0.06, C.roofGreen, x, y + h + 0.04, z);
  for (const [px, pz, pw, pd] of [[0, d / 2, w + 0.1, 0.05], [0, -d / 2, w + 0.1, 0.05], [w / 2, 0, 0.05, d], [-w / 2, 0, 0.05, d]]) k.box(pw, 0.14, pd, C.white, x + px, y + h + 0.08, z + pz);
  return y + h + 0.08;
}

/** Hardened concrete block with slit windows, an olive armour skirt and a hazard band. Returns its top. */
function bunkerBlock(k: Kit, x: number, z: number, w: number, d: number, h: number, y: number, gold = false) {
  k.box(w, h, d, CONCRETE, x, y, z);
  k.box(w + 0.06, 0.32, d + 0.06, ARMOUR, x, y, z);
  for (let i = 0; i < Math.floor(w / 0.18); i++) k.box(0.09, 0.05, 0.02, i % 2 ? '#1f2326' : HAZ, x - w / 2 + 0.09 + i * 0.18, y + 0.32, z + d / 2 + 0.03);
  const floors = Math.max(1, Math.floor(h / STOREY));
  for (let f = 0; f < floors; f++) {
    const fy = y + f * STOREY + 0.5;
    const nw = Math.max(2, Math.floor(w / 0.32));
    for (let i = 0; i < nw; i++) k.box(0.18, 0.07, 0.02, '#1f2326', x - w / 2 + 0.2 + (i * (w - 0.4)) / (nw - 1), fy, z + d / 2 + 0.005);
    for (let i = 0; i < Math.max(2, Math.floor(d / 0.32)); i++) k.box(0.02, 0.07, 0.18, '#1f2326', x + w / 2 + 0.005, fy, z - d / 2 + 0.2 + (i * (d - 0.4)) / Math.max(1, Math.floor(d / 0.32) - 1));
  }
  k.box(w + 0.1, 0.1, d + 0.1, gold ? GOLD : '#9aa3a6', x, y + h, z);
  return y + h + 0.1;
}

/** Secure-band perimeter: low wall with mesh along back and sides, and two panning CCTV cameras. */
function secureFence(k: Kit, y: number) {
  const run = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    k.box(along ? len : 0.08, 0.14, along ? 0.08 : len, CONCRETE, cx, y, cz);
    const n = Math.max(2, Math.round(len / 0.5));
    for (let i = 0; i <= n; i++) {
      const t = -len / 2 + (len / n) * i;
      k.box(0.025, 0.36, 0.025, C.metal, along ? cx + t : cx, y + 0.14, along ? cz : cz + t);
    }
    k.box(along ? len : 0.015, 0.015, along ? 0.015 : len, C.metal, cx, y + 0.48, cz);
  };
  run(-1.88, -1.4, 1.88, -1.4);
  run(-1.88, -1.4, -1.88, 0.2);
  run(1.88, -1.4, 1.88, -0.4);
  for (const [x, z] of [[-1.85, 1.3], [1.85, 1.3]]) {
    cyl(k, 0.025, 1.05, C.metal, x, y, z, k.group, 5);
    const cam = grp(k, x, y + 1.05, z);
    k.box(0.16, 0.07, 0.07, '#f4f4f0', 0.05, 0, 0, cam);
    k.box(0.03, 0.04, 0.03, C.dark, 0.14, 0.01, 0, cam);
    k.anims.push((t) => (cam.rotation.y = -Math.PI / 2 + Math.sin(t * 0.4 + x) * 0.9));
  }
}

/** Three-course sandbag wall with a solid fill core. */
function sangar(k: Kit, x: number, z: number, len: number, y: number, rotY = 0) {
  const g = grp(k, x, y, z, rotY);
  k.box(len - 0.06, 0.28, 0.12, '#b8a372', 0, 0, 0, g);
  k.sandbags(x, z, len, rotY, y, 3);
}

/** Jersey barrier (cover in the urban-ops yard). */
function jersey(k: Kit, x: number, z: number, y: number, len = 0.5, rotY = 0) {
  const g = grp(k, x, y, z, rotY);
  k.box(len, 0.25, 0.2, '#cfcac0', 0, 0, 0, g);
  k.box(len, 0.12, 0.12, '#d8d4cb', 0, 0.25, 0, g);
  k.box(len * 0.5, 0.05, 0.13, '#d8342c', 0, 0.3, 0, g);
}

/** Squad "stacking" at a doorway: three crouched trainees edge forward in single file, enter and vanish (local +x toward the door). */
function stackEntry(k: Kit, p: P, x: number, z: number, rot: number, seed: number) {
  const g = grp(k, x, 0, z, rot, p);
  for (let i = 0; i < 3; i++) {
    const f = place(k, g, fig(seed + i), 0, 0);
    k.anims.push((t) => {
      const q = fr(t, 6, seed + i * 0.6);
      const u = smooth(clamp01(q / 0.8));
      f.root.position.set(-0.9 + u * 0.9, -0.06, 0);
      f.legL.rotation.z = 0.7 + Math.sin(t * 9 + i) * 0.25;
      f.legR.rotation.z = -0.2 - Math.sin(t * 9 + i) * 0.25;
      f.root.rotation.set(0, 0, -0.35);
      f.armL.rotation.z = f.armR.rotation.z = 1.2;
      f.armL.rotation.x = 0.3;
      f.root.scale.setScalar(q < 0.82 ? Math.max(0.01, Math.min(1, q / 0.06, (0.82 - q) / 0.05)) : 0.01);
    });
  }
}

/** Ladder against a wall (local +x outward) with a trainee climbing it into an upper window. */
function ladderClimb(k: Kit, p: P, x: number, z: number, rot: number, h: number, seed: number) {
  const g = grp(k, x, 0, z, rot, p);
  for (const s of [-1, 1]) {
    const rail = k.box(0.03, h + 0.1, 0.03, '#c9a46a', 0.18, 0, s * 0.12, g);
    rail.rotation.z = 0.16;
  }
  for (let i = 1; i < Math.floor(h / 0.15); i++) k.box(0.025, 0.02, 0.24, '#c9a46a', 0.18 - i * 0.15 * 0.16, i * 0.15, 0, g);
  const f = place(k, g, fig(seed), 0.45, 0, Math.PI);
  k.anims.push((t) => {
    const q = fr(t, 6, seed);
    rest(f);
    let xx = 0.75, yy = 0;
    if (q < 0.15) {
      xx = 0.75 - (q / 0.15) * 0.42;
      pose(f, t * 9, 0.6);
    } else if (q < 0.75) {
      const s = ((q - 0.15) / 0.6) * 6;
      const u = (Math.floor(s) + smooth(s % 1)) / 6;
      yy = u * (h - 0.35);
      xx = 0.33 - u * 0.16;
      f.armL.rotation.z = 2.6 + Math.sin(s * Math.PI * 2) * 0.3;
      f.armR.rotation.z = 2.6 - Math.sin(s * Math.PI * 2) * 0.3;
      f.legL.rotation.z = 0.5 + Math.sin(s * Math.PI * 2) * 0.4;
      f.legR.rotation.z = 0.5 - Math.sin(s * Math.PI * 2) * 0.4;
    } else {
      yy = h - 0.35;
      xx = 0.17 - ((q - 0.75) / 0.25) * 0.3;
      f.armL.rotation.z = f.armR.rotation.z = 2.0;
    }
    f.root.position.set(xx, yy, 0);
    f.root.scale.setScalar(Math.max(0.01, Math.min(1, q / 0.05, (0.88 - q) / 0.06)));
  });
}

/** Scramble net slung from a platform (height h at local z0) down to the ground at z1, with a climber going up. */
function scrambleNet(k: Kit, p: P, x: number, z0: number, z1: number, h: number, w: number, seed: number) {
  const g = grp(k, x, 0, 0, 0, p);
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const lx = -w / 2 + (w * i) / n;
    strut(k, V(lx, h, z0), V(lx, 0.02, z1), 0.012, NET, g, 4);
  }
  const m = 7;
  for (let j = 0; j <= m; j++) {
    const u = j / m;
    k.box(w, 0.018, 0.018, NET, 0, h * (1 - u), z0 + (z1 - z0) * u, g);
  }
  k.box(w + 0.1, 0.05, 0.05, LOG_D, 0, 0.0, z1, g);
  const lean = Math.atan2(Math.abs(z1 - z0), h);
  const f = place(k, g, fig(seed), 0, z1);
  k.anims.push((t) => {
    const q = fr(t, 7, seed);
    rest(f);
    const s = clamp01(q / 0.85) * 7;
    const u = (Math.floor(s) + smooth(s % 1)) / 7;
    f.root.position.set(0.05, u * (h - 0.05), z1 + (z0 - z1) * u + 0.1);
    f.root.rotation.set(0, Math.PI / 2, -lean * 0.8);
    const a = s * Math.PI * 2;
    f.armL.rotation.z = 2.6 + Math.sin(a) * 0.35;
    f.armR.rotation.z = 2.6 - Math.sin(a) * 0.35;
    f.legL.rotation.z = 0.6 + Math.sin(a) * 0.4;
    f.legR.rotation.z = 0.6 - Math.sin(a) * 0.4;
    fade(f.root, q, 0.05, 0.12);
  });
}

// ------------------------------------------------------------------ field (1–3)

function field(k: Kit, level: number, y: number) {
  floor(k, 3.74, 2.74, DIRT, 0, y, 0);
  const g = y + 0.02;
  const S = grp(k, 0, g, 0);
  if (level === 1) {
    // Basha drill shed: olive tarp slung over timber poles; sand model lesson underneath
    const sx = -0.85, sz = -0.72, sw = 2.0, sd = 1.1, eh = 0.62;
    shedPosts(k, sx, sz, sw, sd, eh, g, 3, LOG, 0.06);
    k.box(sw + 0.2, 0.05, 0.05, LOG_D, sx, g + eh + 0.42, sz);
    k.gableRoof(sw, sd, 0.45, sx, g + eh, sz, TARP, 0.14, TARP_D, false);
    for (const s of [-1, 1]) strut(k, V(sx + s * (sw / 2 + 0.14), g + eh, sz + 0.69), V(sx + s * (sw / 2 + 0.05), g, sz + 0.95), 0.008, '#d8d0b8');
    sandTable(k, S, sx, sz + 0.05, 0, 1);
    // Rope-climb tripod of lashed logs
    const tx = 1.3, tz = -0.7, ah = 1.75;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.5;
      strut(k, V(tx + Math.cos(a) * 0.5, g, tz + Math.sin(a) * 0.45), V(tx, g + ah, tz), 0.035, LOG);
    }
    cyl(k, 0.06, 0.1, ROPE, tx, g + ah - 0.12, tz, k.group, 6);
    ropeClimb(k, S, tx, tz, ah - 0.12, 2);
    crawlLane(k, S, -0.75, 0.78, 1.9, 0, 3, 2);
    pushups(k, S, 0.45, 0.3, 0, 5);
    pushups(k, S, 0.45, 0.62, 0, 6);
    instructor(k, S, 1.3, 0.3, 1.65, 1.0, Math.PI, 7);
    k.fieldFlag(1.75, 1.15, g);
    k.sandbags(1.0, 1.22, 0.8, 0, g, 2);
    k.crates(0.45, -1.15, g, 2);
    k.drum(1.75, -1.2, '#3f7d4a', g);
    return;
  }
  if (level === 2) {
    // Atap drill shed: bigger timber shed with a thatched roof, raised sand table, goal-post rope frame, tyre run
    const sx = -0.7, sz = -0.66, sw = 2.4, sd = 1.3, eh = 0.8;
    shedPosts(k, sx, sz, sw, sd, eh, g, 4, LOG, 0.07);
    k.box(sw, 0.05, 0.05, LOG_D, sx, g + 0.42, sz - sd / 2 + 0.06);
    for (let i = 0; i < 3; i++) k.box(sw, 0.03, 0.03, LOG_D, sx, g + eh - 0.05, sz - sd / 2 + 0.06 + i * ((sd - 0.12) / 2));
    k.gableRoof(sw, sd, 0.52, sx, g + eh, sz, ATAP, 0.17, C.wood, false);
    k.box(sw + 0.4, 0.06, 0.07, '#8a6a3a', sx, g + eh + 0.49, sz);
    sandTable(k, S, sx - 0.15, sz + 0.05, 0, 2, true);
    ropeFrame(k, S, 1.42, -0.85, 0, 0.75, 1.75, LOG, 4, 2, true);
    tyreRun(k, S, -0.65, 0.98, 0, 2.0, 4, 2);
    jacks(k, S, 0.7, 0.42, -Math.PI / 4, 5);
    jacks(k, S, 1.0, 0.25, -Math.PI / 4, 6);
    instructor(k, S, 1.2, 0.75, 1.7, 1.05, Math.PI * 0.85, 7);
    k.fieldFlag(1.78, 0.2, g);
    k.sandbags(-0.6, 0.45, 1.6, 0, g, 2);
    k.drum(0.65, -1.2, '#2f6fa8', g);
    k.crates(-1.75, 0.35, g, 1);
    return;
  }
  // 3: zinc training shed: open timber shed with a zinc roof, timber rope tower, scaling wall, sandbag carry
  const sx = -0.62, sz = -0.68, sw = 2.5, sd = 1.4, eh = 0.9;
  shedPosts(k, sx, sz, sw, sd, eh, g, 5, LOG, 0.08);
  k.box(sw - 0.1, 0.42, 0.04, C.wood, sx, g, sz - sd / 2 + 0.06);
  for (let i = 1; i < 4; i++) k.box(sw - 0.09, 0.012, 0.05, '#8a6040', sx, g + i * 0.1, sz - sd / 2 + 0.06);
  k.box(0.04, 0.42, sd - 0.1, C.wood, sx - sw / 2 + 0.06, g, sz);
  k.gableRoof(sw, sd, 0.52, sx, g + eh, sz, C.zinc, 0.17, C.wood);
  sandTable(k, S, sx - 0.1, sz + 0.1, 0, 3);
  // Timber rope tower: four posts, a mid platform, a zinc cap and an outrigger beam with a rope
  const tx = 1.42, tz = -0.92;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.08, 2.0, 0.08, LOG, tx + dx * 0.3, g, tz + dz * 0.3);
  for (const hy of [0.6, 1.95]) for (const s of [-1, 1]) {
    k.box(0.68, 0.05, 0.05, LOG_D, tx, g + hy, tz + s * 0.3);
    k.box(0.05, 0.05, 0.68, LOG_D, tx + s * 0.3, g + hy, tz);
  }
  for (let i = 0; i < 6; i++) k.box(0.72, 0.05, 0.1, i % 2 ? '#8a6040' : '#9a7048', tx, g + 1.22, tz - 0.3 + i * 0.12);
  for (const s of [-1, 1]) k.box(0.72, 0.04, 0.04, LOG_D, tx, g + 1.45, tz + s * 0.35);
  for (let i = 1; i < 6; i++) k.box(0.3, 0.03, 0.03, LOG_D, tx, g + i * 0.2, tz + 0.32);
  for (const s of [-1, 1]) strut(k, V(tx + s * 0.3, g + 1.95, tz), V(tx, g + 2.25, tz), 0.03, LOG_D);
  k.box(0.05, 0.05, 0.66, LOG_D, tx, g + 2.22, tz);
  k.flagpole(tx + 0.3, tz + 0.3, 0.5, g + 2.0);
  k.box(0.06, 0.06, 0.9, LOG_D, tx - 0.15, g + 1.86, tz + 0.65);
  ropeClimb(k, S, tx - 0.15, tz + 1.0, 1.84, 4);
  scalingWall(k, S, 0.62, 0.82, 0, 0.55, C.wood, 5, LOG_D, 0.75);
  tyreRun(k, S, -1.0, 1.08, 0, 1.4, 6, 1);
  sandbagCarry(k, S, -1.55, 0.5, -0.2, 0.5, 7);
  k.sandbags(-1.72, 0.5, 0.3, Math.PI / 2, g, 3);
  k.sandbags(-0.02, 0.5, 0.3, Math.PI / 2, g, 3);
  instructor(k, S, 1.25, 0.35, 1.7, 1.1, Math.PI, 8);
  k.fieldFlag(1.78, 1.2, g);
  k.drum(0.25, -1.25, '#3f7d4a', g);
}

// ------------------------------------------------------------------ camp (4–6)

/** Cream-columned open shed with half-walls, green mats and a red roof. */
function campShed(k: Kit, sx: number, sz: number, sw: number, sd: number, eh: number, y: number, roof: 'hip' | 'twin', label = true) {
  floor(k, sw - 0.1, sd - 0.1, MAT_G, sx, y, sz);
  const n = Math.max(4, Math.round(sw / 0.65) + 1);
  shedPosts(k, sx, sz, sw, sd, eh, y, n, C.wall, 0.12, C.trim);
  k.box(sw - 0.1, 0.48, 0.08, C.wall, sx, y, sz - sd / 2 + 0.06);
  k.box(sw - 0.08, 0.05, 0.1, C.trim, sx, y + 0.48, sz - sd / 2 + 0.06);
  for (const s of [-1, 1]) {
    k.box(0.08, 0.48, sd - 0.1, C.wall, sx + s * (sw / 2 - 0.06), y, sz);
    k.box(0.1, 0.05, sd - 0.08, C.trim, sx + s * (sw / 2 - 0.06), y + 0.48, sz);
  }
  k.box(sw, 0.14, 0.1, C.wall, sx, y + eh - 0.14, sz + sd / 2 - 0.06);
  if (roof === 'hip') k.hipRoof(sw, sd, 0.5, sx, y + eh, sz, C.roof, 0.18);
  else {
    k.gableRoof(sw, sd / 2, 0.42, sx, y + eh, sz - sd / 4, C.roof, 0.16);
    k.gableRoof(sw, sd / 2, 0.42, sx, y + eh, sz + sd / 4, C.roof, 0.16);
    k.box(sw + 0.3, 0.07, 0.12, C.trim, sx, y + eh, sz);
  }
  if (label) board(k, 'TRAINING SHED', 1.0, 0.18, sx, y + eh - 0.16, sz + sd / 2 + 0.0, C.trim, '#ffffff');
}

function camp(k: Kit, level: number, y: number) {
  const S = grp(k, 0, y, 0);
  if (level === 4) {
    // Training shed: first permanent shed, cream columns, red hip roof, green mats; green scaling wall, steel rope frame
    const sx = -0.6, sz = -0.7, sw = 2.6, sd = 1.35, eh = 1.0;
    campShed(k, sx, sz, sw, sd, eh, y, 'hip');
    pushups(k, S, sx - 0.9, sz + 0.05, 0, 1);
    pushups(k, S, sx - 0.9, sz - 0.3, 0, 2);
    jacks(k, S, sx + 0.2, sz - 0.1, Math.PI / 2 - 0.3, 3);
    jacks(k, S, sx + 0.6, sz - 0.1, Math.PI / 2 - 0.3, 4);
    watcher(k, S, sx + 0.4, sz - 0.45, -Math.PI / 2, 5, 'instructor');
    floor(k, 2.0, 0.78, SAND, -0.8, y, 0.86);
    crawlLane(k, S, -0.8, 0.86, 1.85, 0, 6, 2, null);
    scalingWall(k, S, 0.75, 0.8, 0, 0.62, C.trim, 8, C.white, 0.7);
    ropeFrame(k, S, 1.42, -0.85, 0, 0.75, 1.8, C.trim, 9, 2);
    instructor(k, S, 1.35, 0.35, 1.75, 1.15, Math.PI, 10);
    k.waterPoint(1.72, 0.0, y);
    k.lamp(-1.8, 0.35, y, 1.2);
    return;
  }
  if (level === 5) {
    // Store annex: L-shape with a cream store wing; monkey bars arrive in the yard
    const sx = -0.25, sz = -0.7, sw = 2.3, sd = 1.35, eh = 1.05;
    campShed(k, sx, sz, sw, sd, eh, y, 'hip');
    const ax = -1.42, az = 0.75, aw = 0.9, ad = 1.1;
    const h = k.block(aw, ad, 1, ax, y, az);
    k.hipRoof(aw, ad, 0.42, ax, y + h, az, C.roof, 0.15);
    k.door('right', ax, az, aw, ad, 0.15, y, 0.3, 0.6);
    k.window('front', ax, az, aw, ad, 0, y + 0.42, 0.4, 0.3, true);
    board(k, 'STORE', 0.4, 0.12, ax, y + 0.75, az + ad / 2 + 0.02, C.trim);
    sandTable(k, S, sx - 0.45, sz, 0, 1, true);
    pushups(k, S, sx + 0.45, sz + 0.1, 0, 3);
    pushups(k, S, sx + 0.45, sz - 0.25, 0, 4);
    monkeyBars(k, S, 0.25, 0.86, 0, 1.4, 0.92, C.trim, 5);
    scalingWall(k, S, 1.52, 0.55, -Math.PI / 2, 0.64, C.trim, 6, C.white, 0.7);
    ropeFrame(k, S, 1.5, -0.85, 0, 0.62, 1.9, C.trim, 7, 2);
    instructor(k, S, -0.75, 0.5, -0.75, 1.15, 0, 9);
    k.lamp(-0.4, 1.25, y, 1.2);
    k.aircon(ax + aw / 2 + 0.08, y + 0.6, az - 0.3, Math.PI / 2);
    return;
  }
  // 6: twin-bay training shed: double red gables, enclosed store bay, tall green rope gantry with three ropes
  const sx = -0.45, sz = -0.6, sw = 2.8, sd = 1.6, eh = 1.3;
  campShed(k, sx, sz, sw, sd, eh, y, 'twin');
  const bx = sx - sw / 2 + 0.45;
  k.box(0.85, eh - 0.15, 0.08, C.wall, bx, y, sz + 0.1);
  k.box(0.08, eh - 0.15, sd / 2 + 0.1, C.wall, bx + 0.42, y, sz - sd / 4 + 0.05);
  k.door('front', bx, sz + 0.1 - 0.04, 0.85, 0.08, 0, y, 0.3, 0.6);
  punchPads(k, S, sx - 0.1, sz + 0.25, 0, 1);
  jacks(k, S, sx + 0.65, sz + 0.3, Math.PI / 2 - 0.3, 3);
  jacks(k, S, sx + 0.95, sz + 0.1, Math.PI / 2 - 0.3, 4);
  pushups(k, S, sx + 0.3, sz - 0.4, 0, 5);
  watcher(k, S, sx + 1.15, sz - 0.4, Math.PI, 6, 'instructor');
  // Rope gantry
  const gx = 1.52, gz0 = -1.25, gz1 = 0.15, gh = 2.05;
  for (const z of [gz0, gz1]) for (const s of [-1, 1]) k.box(0.08, gh, 0.08, C.trim, gx + s * 0.3, y, z);
  for (const s of [-1, 1]) k.box(0.07, 0.08, gz1 - gz0 + 0.1, C.trim, gx + s * 0.3, y + gh - 0.08, (gz0 + gz1) / 2);
  for (const z of [gz0, -0.55, gz1]) k.box(0.68, 0.07, 0.07, HAZ, gx, y + gh - 0.15, z);
  for (const [i, z] of [-0.95, -0.55, -0.15].entries()) ropeClimb(k, S, gx, z, gh - 0.16, 7 + i * 2.3, i !== 1, Math.PI / 2);
  floor(k, 2.4, 0.78, SAND, -0.6, y, 0.92);
  crawlLane(k, S, -1.0, 0.92, 1.6, 0, 10, 2, null);
  scalingWall(k, S, 0.55, 0.9, 0, 0.66, C.trim, 12, C.white, 0.6);
  instructor(k, S, 1.15, 0.6, 1.75, 1.2, Math.PI, 13);
  k.flagpole(-1.78, 1.2, 1.7, y);
}

// ------------------------------------------------------------------ base (7–10)

/** Concrete climbing tower: solid store at the base, open frame above, platform and a roof cap. Returns the top. */
function ropeTower(k: Kit, S: P, tx: number, tz: number, w: number, h: number, y: number, roof: string, seed: number, gold = false, bands = false) {
  k.box(w, 0.9, w, CONCRETE, tx, y, tz);
  if (bands) for (let i = 0; i < 6; i++) for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.12, 0.2, 0.12, i % 2 ? C.white : '#d8342c', tx + dx * (w / 2 - 0.05), y + 0.9 + 0.1 + i * ((h - 1.2) / 6), tz + dz * (w / 2 - 0.05));
  k.box(w + 0.02, 0.14, w + 0.02, C.trim, tx, y, tz);
  k.door('front', tx, tz, w, w, 0, y, 0.28, 0.55);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.1, h - 0.9, 0.1, CONCRETE, tx + dx * (w / 2 - 0.05), y + 0.9, tz + dz * (w / 2 - 0.05));
  k.box(w + 0.14, 0.07, w + 0.14, '#bdb8ad', tx, y + 1.7, tz);
  for (const s of [-1, 1]) {
    k.box(w + 0.14, 0.04, 0.03, HAZ, tx, y + 1.95, tz + s * (w / 2 + 0.06));
    k.box(0.03, 0.04, w + 0.14, HAZ, tx + s * (w / 2 + 0.06), y + 1.95, tz);
  }
  k.box(w + 0.06, 0.12, w + 0.06, CONCRETE, tx, y + h - 0.12, tz);
  if (gold) k.box(w + 0.1, 0.06, w + 0.1, GOLD, tx, y + h, tz);
  k.hipRoof(w, w, 0.45, tx, y + h + (gold ? 0.06 : 0), tz, roof, 0.12);
  ropeClimb(k, S, tx, tz, h - 0.14, seed);
  return y + h + 0.45;
}

function base(k: Kit, level: number, y: number) {
  const S = grp(k, 0, y, 0);
  floor(k, 3.74, 1.2, RUBBER, 0, y, 0.77);
  for (const z of [0.4, 1.14]) floor(k, 3.6, 0.025, C.white, 0, y + 0.02, z, 0.004);
  if (level === 7) {
    // Drill hall: concrete-framed hall with a ridge monitor; jumping jacks drilled from a dais; rope frame and yard drills
    const hx = -0.35, hz = -0.62, hw = 3.0, hd = 1.5;
    drillHall(k, S, hx, hz, hw, hd, 1.5, 0.62, y);
    k.box(0.6, 0.14, 0.3, CONCRETE, hx, y, hz - 0.5);
    instructor(k, S, hx - 0.2, hz - 0.5, hx + 0.2, hz - 0.5, Math.PI / 2, 1, 8, 0.14);
    for (let i = 0; i < 4; i++) jacks(k, S, hx - 1.0 + i * 0.45, hz + 0.25, Math.PI / 2, 2 + i);
    pushups(k, S, hx + 0.9, hz - 0.3, Math.PI, 7);
    ropeFrame(k, S, 1.62, -0.75, Math.PI / 2, 0.95, 2.1, C.trim, 8, 2);
    tyreRun(k, S, -0.95, 0.95, 0, 1.6, 9, 2);
    scalingWall(k, S, 0.65, 0.8, 0, 0.7, C.trim, 11, HAZ, 0.7);
    instructor(k, S, 1.35, 0.45, 1.75, 1.15, Math.PI, 12);
    k.flagpole(1.8, 1.25, 2.0, y);
    k.lamp(-1.82, 0.25, y, 1.3);
    return;
  }
  if (level === 8) {
    // + concrete rope tower with a scramble net down to the yard
    // Green barrel-vault hall and a tall red/white banded rope tower rising well above it
    const hx = -0.58, hz = -0.62, hw = 2.5, hd = 1.5;
    drillHall(k, S, hx, hz, hw, hd, 1.5, 0.62, y, C.roofGreen, true);
    k.box(0.6, 0.14, 0.3, CONCRETE, hx, y, hz - 0.5);
    instructor(k, S, hx - 0.2, hz - 0.5, hx + 0.2, hz - 0.5, Math.PI / 2, 1, 8, 0.14);
    for (let i = 0; i < 4; i++) jacks(k, S, hx - 0.95 + i * 0.45, hz + 0.25, Math.PI / 2, 2 + i);
    const tx = 1.35, tz = -0.88;
    ropeTower(k, S, tx, tz, 1.0, 2.6, y, C.roof, 7, false, true);
    scrambleNet(k, S, tx, tz + 0.56, 0.45, 1.72, 0.8, 8);
    tyreRun(k, S, -1.0, 0.95, 0, 1.6, 9, 2);
    scalingWall(k, S, 0.55, 0.85, 0, 0.7, C.trim, 11, HAZ, 0.6);
    instructor(k, S, 0.95, 1.2, 1.6, 1.2, Math.PI / 2, 12);
    k.flagpole(1.82, 0.3, 2.0, y);
    k.lamp(-1.82, 0.25, y, 1.3);
    return;
  }
  if (level === 9) {
    // Two-storey cream classroom block with a flat roof and a big red/white abseil frame
    const cx = -0.65, cz = -0.78, cw = 2.4, cd = 1.15;
    const h = k.block(cw, cd, 2, cx, y, cz);
    k.flatRoof(cw, cd, cx, y + h, cz, 0.16);
    k.windowRow('front', cx, cz, cw, cd, 5, y + STOREY + 0.42, { louvre: true });
    k.windowRow('front', cx, cz, cw, cd, 5, y + 0.42, { skip: [2] });
    k.door('front', cx, cz, cw, cd, 0, y);
    k.windowRow('left', cx, cz, cw, cd, 2, y + STOREY + 0.42);
    board(k, 'CLASSROOMS', 0.9, 0.16, cx, y + STOREY - 0.08, cz + cd / 2 + 0.03, C.trim);
    k.waterTank(cx - 0.8, y + h, cz - 0.2);
    k.porch(cx, cz + cd / 2 + 0.22, cw - 0.2, 0.42, 0.85, y, 5);
    for (let i = 0; i < 3; i++) watcher(k, S, cx - 0.7 + i * 0.5, cz + cd / 2 + 0.2, Math.PI / 2 - 0.3, 20 + i);
    // Abseil frame: red/white banded posts, white face board with red stripes, platform on top
    const ax = 1.36, az = -0.85, aw = 0.95, ah = 2.85;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) for (let i = 0; i < 7; i++) k.box(0.09, ah / 7, 0.09, i % 2 ? C.white : '#d8342c', ax + dx * (aw / 2 - 0.05), y + (i * ah) / 7, az + dz * (aw / 2 - 0.05));
    k.box(aw - 0.1, ah - 0.3, 0.05, C.white, ax, y + 0.25, az + aw / 2 - 0.05);
    for (let i = 0; i < 4; i++) k.box(aw - 0.1, 0.12, 0.06, '#d8342c', ax, y + 0.55 + i * 0.6, az + aw / 2 - 0.05);
    k.box(aw + 0.15, 0.08, aw + 0.15, '#9aa3a6', ax, y + ah, az);
    for (const sgn of [-1, 1]) {
      k.box(aw + 0.15, 0.04, 0.03, HAZ, ax, y + ah + 0.25, az + sgn * (aw / 2 + 0.06));
      k.box(0.03, 0.04, aw + 0.15, HAZ, ax + sgn * (aw / 2 + 0.06), y + ah + 0.25, az);
    }
    for (let i = 1; i < 12; i++) k.box(0.3, 0.025, 0.025, C.metal, ax + aw / 2 + 0.02, y + i * 0.24, az - 0.25);
    watcher(k, S, ax + 0.2, az - 0.15, Math.PI / 2, 25, 'instructor', ah + 0.08);
    abseil(k, S, ax - 0.2, az + aw / 2 - 0.02, -Math.PI / 2, ah + 0.05, 26);
    abseil(k, S, ax + 0.2, az + aw / 2 - 0.02, -Math.PI / 2, ah + 0.05, 29.5);
    sandTable(k, S, -1.25, 0.95, 0, 9);
    // Green-roofed lesson shelter over the sand table
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.06, 0.95, 0.06, C.white, -1.25 + dx * 0.55, y, 0.92 + dz * 0.36);
    k.box(1.25, 0.07, 0.86, C.roofGreen, -1.25, y + 0.95, 0.92);
    k.box(1.27, 0.03, 0.88, C.white, -1.25, y + 0.93, 0.92);
    monkeyBars(k, S, 0.05, 1.0, 0, 1.2, 0.92, C.trim, 10);
    pushups(k, S, 0.85, 0.45, 0, 11);
    instructor(k, S, 1.15, 0.75, 1.7, 1.2, Math.PI, 12);
    k.flagpole(-1.82, 0.25, 2.0, y);
    return;
  }
  // 10: Training Wing (release cap): taller hall with a name fascia, gold-banded rope tower with a pyramid roof and a flag,
  // classroom wing, yard of stations
  const hx = -0.52, hz = -0.68, hw = 2.66, hd = 1.42;
  drillHall(k, S, hx, hz, hw, hd, 1.85, 0.7, y);
  board(k, 'TRAINING WING', 1.4, 0.24, hx, y + 1.85 - 0.3, hz + hd / 2 + 0.03, C.trim, GOLD);
  for (let i = 0; i < 4; i++) jacks(k, S, hx - 0.95 + i * 0.45, hz + 0.22, Math.PI / 2, 2 + i);
  for (let i = 0; i < 3; i++) pushups(k, S, hx - 0.85 + i * 0.5, hz - 0.2, 0, 20 + i);
  const tx = 1.4, tz = -0.95;
  const top = ropeTower(k, S, tx, tz, 0.82, 2.6, y, C.roof, 7, true);
  k.flagpole(tx, tz, 0.6, top - 0.02);
  scrambleNet(k, S, tx, tz + 0.47, 0.45, 1.72, 0.68, 8);
  const wx = -1.4, wz = 0.82, ww = 0.92, wd = 1.04;
  floor(k, ww, wd, '#c4bfb3', wx, y, wz);
  k.box(ww, STOREY, 0.08, C.wall, wx, y, wz - wd / 2 + 0.04);
  k.box(0.08, STOREY, wd, C.wall, wx - ww / 2 + 0.04, y, wz);
  for (const [cx, cz] of [[ww / 2 - 0.05, wd / 2 - 0.05], [-ww / 2 + 0.05, wd / 2 - 0.05], [ww / 2 - 0.05, -wd / 2 + 0.05]]) k.box(0.1, STOREY, 0.1, C.wall, wx + cx, y, wz + cz);
  const uh = k.block(ww, wd, 1, wx, y + STOREY, wz);
  k.windowRow('front', wx, wz, ww, wd, 2, y + STOREY + 0.42, { louvre: true });
  k.windowRow('right', wx, wz, ww, wd, 2, y + STOREY + 0.42, { louvre: true });
  k.box(ww + 0.08, 0.06, wd + 0.08, GOLD, wx, y + STOREY + uh - 0.02, wz);
  k.hipRoof(ww, wd, 0.4, wx, y + STOREY + uh + 0.04, wz, C.roofGreen, 0.15);
  sandTable(k, S, wx + 0.05, wz, Math.PI / 2, 9);
  monkeyBars(k, S, 0.1, 0.98, 0, 1.2, 0.92, C.trim, 10);
  tyreRun(k, S, 0.25, 0.5, 0, 1.0, 13, 1);
  instructor(k, S, 1.15, 0.7, 1.72, 1.22, Math.PI, 12);
  k.flagpole(-0.75, 1.25, 2.2, y);
  k.lamp(1.85, 0.35, y, 1.3);
}

// ------------------------------------------------------------------ command (11–15)

/** Glass-fronted sim hall with a green roof: open-plan pods behind a transparent curtain wall. Returns its top. */
function simHall(k: Kit, x: number, z: number, w: number, d: number, h: number, y: number) {
  floor(k, w - 0.06, d - 0.06, '#e9e6de', x, y, z);
  k.box(w, h, 0.08, C.white, x, y, z - d / 2 + 0.04);
  k.box(0.08, h, d, C.white, x + w / 2 - 0.04, y, z);
  k.box(0.08, h, d, C.white, x - w / 2 + 0.04, y, z);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w - 0.16, h - 0.1, 0.03), GLASS_T);
  glass.position.set(x, y + h / 2, z + d / 2 - 0.03);
  k.add(glass);
  const n = Math.max(3, Math.round(w / 0.4));
  for (let i = 0; i <= n; i++) k.box(0.035, h, 0.05, C.white, x - w / 2 + 0.04 + ((w - 0.08) * i) / n, y, z + d / 2 - 0.03);
  k.box(w + 0.04, 0.05, 0.06, TEAL, x, y + h * 0.55, z + d / 2 - 0.02);
  k.box(w + 0.14, 0.1, d + 0.14, C.white, x, y + h, z);
  k.box(w, 0.05, d, C.roofGreen, x, y + h + 0.08, z);
  return y + h + 0.1;
}

function command(k: Kit, level: number, y: number) {
  const S = grp(k, 0, y, 0);
  floor(k, 3.74, 1.18, TEAL_MAT, 0, y, 0.76);
  for (const x of [-1.25, 0, 1.25]) floor(k, 0.025, 1.1, C.white, x, y + 0.02, 0.76, 0.004);
  const ax = -1.15, az = -0.66, aw = 1.4, ad = 1.32;
  const blockTop = whiteBlock(k, ax, az, aw, ad, 3, y);
  k.door('front', ax, az, aw, ad, 0.3, y, 0.36, 0.62, DARK_GLASS);
  board(k, 'TRAINING CENTRE', 1.05, 0.17, ax, y + STOREY * 3 - 0.24, az + ad / 2 + 0.14, TEAL, '#ffffff');
  k.aircon(ax - aw / 2 - 0.1, y + 0.4, az - 0.3, -Math.PI / 2);
  const wide = level < 14;
  const bw = wide ? 2.15 : 1.42, bx = -0.38 + bw / 2, bz = -0.62, bd = 1.45, bh = 1.45;
  const hallTop = simHall(k, bx, bz, bw, bd, bh, y);
  const pods = wide ? 3 : 2;
  for (let i = 0; i < pods; i++) simPod(k, S, bx - bw / 2 + 0.38 + i * ((bw - 0.76) / Math.max(1, pods - 1)), bz - 0.05, 0.5, 1 + i);
  watcher(k, S, bx + bw / 2 - 0.3, bz - 0.5, Math.PI * 0.75, 4, 'instructor');
  // Yard drills (signature): push-ups and jacks led by an instructor, low crawl under a teal net
  crawlLane(k, S, -0.95, 1.05, 1.7, 0, 10, 2, null, '#1f6f68');
  for (let i = 0; i < 2; i++) jacks(k, S, -1.45 + i * 0.5, 0.45, Math.PI / 2, 12 + i);
  pushups(k, S, -0.45, 0.42, 0, 15);
  // Shade sail over the PT spot
  for (const [cx, cz] of [[-1.8, 0.25], [-0.25, 0.25], [-1.8, 0.66], [-0.25, 0.66]]) k.box(0.05, cz < 0.5 ? 1.08 : 1.18, 0.05, C.white, cx, y, cz);
  const sail = k.box(1.65, 0.04, 0.5, C.white, -1.02, y + 1.12, 0.46);
  sail.rotation.x = -0.2;
  k.box(1.67, 0.02, 0.06, TEAL, -1.02, y + 1.08, 0.24);
  if (level === 11) {
    // Sim training centre: white block, glass sim hall with motion pods, white rope frame and scaling wall in the yard
    scalingWall(k, S, 0.85, 0.82, 0, 0.7, C.white, 16, TEAL, 0.65);
    ropeFrame(k, S, 1.55, 0.72, Math.PI / 2, 0.8, 1.9, C.white, 17, 2);
    instructor(k, S, 0.15, 0.4, 0.15, 1.2, 0, 18);
    k.flagpole(-1.82, 1.25, 2.0, y);
    return;
  }
  // Hexagonal holo sand-table pavilion (12+)
  const px = 1.32, pz = 0.78;
  const hexGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 1.0, 6, 1, true), new THREE.MeshStandardMaterial({ color: '#a8d8e6', transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false, flatShading: true }));
  hexGlass.position.set(px, y + 0.5, pz);
  k.add(hexGlass);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.box(0.05, 1.0, 0.05, C.white, px + Math.sin(a) * 0.52, y, pz + Math.cos(a) * 0.52);
  }
  cyl(k, 0.6, 0.08, C.white, px, y + 1.0, pz, k.group, 6);
  cyl(k, 0.62, 0.42, level === 15 ? '#8fd0c8' : C.roofGreen, px, y + 1.08, pz, k.group, 6, 0.08);
  holoTable(k, S, px, pz, 0.26, 20, 3);
  if (level === 12) {
    // Holo sand-table pavilion; scaling wall moves beside it; roof garden on the block
    scalingWall(k, S, 0.35, 0.82, 0, 0.7, C.white, 16, TEAL, 0.55);
    instructor(k, S, 0.65, 0.35, 0.65, 0.95, Math.PI, 18);
    for (let i = 0; i < 4; i++) k.box(0.22, 0.14, 0.22, '#4fae3a', ax - 0.45 + i * 0.3, blockTop - 0.04, az + 0.3 * ((i % 2) * 2 - 1));
    k.antenna(ax + 0.5, blockTop, az - 0.4, 0.9);
    k.flagpole(-1.82, 1.25, 2.0, y);
    return;
  }
  // VR training deck on the sim hall roof (13+): glass balustrade, VR rings, white canopy
  const deckY = hallTop + 0.03;
  const bal = new THREE.Mesh(new THREE.BoxGeometry(bw - 0.05, 0.22, 0.02), GLASS_T);
  bal.position.set(bx, deckY + 0.11, bz + bd / 2 - 0.02);
  k.add(bal);
  k.box(bw - 0.05, 0.025, 0.04, C.white, bx, deckY + 0.22, bz + bd / 2 - 0.02);
  const rings = wide ? 3 : 2;
  const DS = grp(k, 0, deckY, 0);
  for (let i = 0; i < rings; i++) vrRing(k, DS, bx - bw / 2 + 0.38 + i * ((bw - 0.76) / Math.max(1, rings - 1)), bz + 0.1, 30 + i);
  const ch = 0.95;
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.05, ch, 0.05, C.white, bx + cx * (bw / 2 - 0.1), deckY, bz + cz * (bd / 2 - 0.12));
  k.box(bw + 0.1, 0.07, bd - 0.05, C.white, bx, deckY + ch, bz);
  k.box(bw + 0.12, 0.03, bd - 0.03, TEAL, bx, deckY + ch - 0.02, bz);
  if (level === 13) {
    scalingWall(k, S, 0.35, 0.82, 0, 0.7, C.white, 16, TEAL, 0.55);
    instructor(k, S, 0.65, 0.35, 0.65, 0.95, Math.PI, 18);
    k.flagpole(-1.82, 1.25, 2.0, y);
    return;
  }
  // Abseil tower (14+): white tower with teal stripes; trainees abseil down its front
  const tx = 1.54, tz = -1.0, tw = 0.66, td = 0.72, th = 3.05;
  k.box(tw, th, td, C.white, tx, y, tz);
  for (const s of [-1, 1]) k.box(0.06, th, 0.02, TEAL, tx + s * 0.22, y, tz + td / 2 + 0.005);
  k.box(tw + 0.08, 0.12, td + 0.08, '#9aa3a6', tx, y, tz);
  k.box(tw + 0.12, 0.1, td + 0.12, C.white, tx, y + th, tz);
  for (const s of [-1, 1]) k.box(0.03, 0.18, td + 0.1, C.metal, tx + s * (tw / 2 + 0.04), y + th + 0.1, tz);
  k.box(tw + 0.1, 0.03, 0.03, C.metal, tx, y + th + 0.27, tz + td / 2 + 0.04);
  k.blinker(tx, y + th + 0.1, tz - 0.1, '#ff3b30', 0.04);
  abseil(k, S, tx - 0.13, tz + td / 2, -Math.PI / 2, th + 0.1, 40);
  abseil(k, S, tx + 0.15, tz + td / 2, -Math.PI / 2, th + 0.1, 43.5);
  if (level === 14) {
    scalingWall(k, S, 0.35, 0.82, 0, 0.7, C.white, 16, TEAL, 0.55);
    instructor(k, S, 0.65, 0.3, 0.75, 0.0, Math.PI / 2, 18);
    k.flagpole(-1.82, 1.25, 2.0, y);
    return;
  }
  // 15: training campus: a great white rope arch over the yard with climbers; three flags
  const R = 1.05, ac = -0.55, legH = 0.85, az2 = 0.78;
  const arch = new THREE.Mesh(new THREE.TorusGeometry(R, 0.06, 6, 20, Math.PI), mat(C.white));
  arch.position.set(ac, y + legH, az2);
  k.add(arch);
  for (const s of [-1, 1]) {
    k.box(0.12, legH, 0.12, C.white, ac + s * R, y, az2);
    k.box(0.18, 0.12, 0.18, TEAL, ac + s * R, y, az2);
  }
  for (const [i, dx] of [-0.45, 0, 0.45].entries()) ropeClimb(k, S, ac + dx, az2, legH + Math.sqrt(R * R - dx * dx) - 0.06, 50 + i * 2.7, i !== 1, Math.PI / 2);
  instructor(k, S, 0.5, 0.35, 0.75, 1.15, Math.PI, 18);
  for (const x of [-1.82, -1.6, -1.38]) k.flagpole(x, 1.27, 2.0, y);
}

// ------------------------------------------------------------------ secure (16–20)

function secure(k: Kit, level: number, y: number) {
  const S = grp(k, 0, y, 0);
  floor(k, 3.74, 2.74, ASPH, 0, y, 0);
  for (const z of [0.25, 1.28]) floor(k, 3.6, 0.03, HAZ, 0, y + 0.02, z, 0.004);
  secureFence(k, y);
  if (level === 16) {
    // Urban ops village: tactical block with abseilers, two concrete shell houses, ladder entry, squad stacking at a door
    const ax = -1.15, az = -0.68, aw = 1.4, ad = 1.3, ah = 3.0;
    const top = bunkerBlock(k, ax, az, aw, ad, ah, y);
    abseil(k, S, ax - 0.3, az + ad / 2, -Math.PI / 2, ah, 1);
    abseil(k, S, ax + 0.3, az + ad / 2, -Math.PI / 2, ah, 4.5);
    k.antenna(ax + 0.5, top, az - 0.4, 0.9);
    k.radarDome(ax - 0.4, top, az - 0.3, 0.16);
    // House 1: two-storey shell with dark openings
    const h1x = 0.3, h1z = -0.8, h1w = 1.05, h1d = 1.1, h1h = 1.9;
    k.box(h1w, h1h, h1d, '#c9c4b8', h1x, y, h1z);
    for (const f of [0, 1]) for (const dx of [-0.28, 0.28]) k.box(0.24, 0.32, 0.02, '#1f2326', h1x + dx, y + 0.35 + f * STOREY, h1z + h1d / 2 + 0.005);
    k.box(0.28, 0.55, 0.02, '#1f2326', h1x + 0.0, y, h1z + h1d / 2 + 0.006);
    k.box(h1w + 0.06, 0.12, h1d + 0.06, '#9aa3a6', h1x, y + h1h, h1z);
    ladderClimb(k, S, h1x - 0.28, h1z + h1d / 2, -Math.PI / 2, STOREY + 0.4, 7);
    stackEntry(k, S, h1x, h1z + h1d / 2 + 0.22, Math.PI / 2, 9);
    // House 2: one storey with a flat roof and an instructor watching from above
    const h2x = 1.38, h2z = -0.8, h2w = 0.95, h2d = 1.1, h2h = 1.2;
    k.box(h2w, h2h, h2d, '#bdb8ad', h2x, y, h2z);
    k.box(0.22, 0.3, 0.02, '#1f2326', h2x, y + 0.4, h2z + h2d / 2 + 0.005);
    k.box(h2w + 0.06, 0.1, h2d + 0.06, '#9aa3a6', h2x, y + h2h, h2z);
    instructor(k, S, h2x - 0.2, h2z + 0.1, h2x + 0.25, h2z + 0.1, -Math.PI / 2, 12, 9, h2h + 0.1);
    // Yard: barbed-wire low crawl, jersey cover, sandbag carry
    floor(k, 1.8, 0.62, SAND, -0.85, y, 0.88);
    crawlLane(k, S, -0.85, 0.88, 1.6, 0, 14, 2, null, C.metal, false, true);
    jersey(k, -1.25, 0.36, y, 0.6);
    jersey(k, -0.45, 0.36, y, 0.6);
    // Breach wall: a concrete facade with a doorway and window for entry drills
    const wx = 1.2, wz = 0.62;
    k.box(0.94, 1.0, 0.14, '#c9c4b8', wx, y, wz);
    k.box(0.26, 0.6, 0.02, '#1f2326', wx - 0.2, y, wz + 0.07);
    k.box(0.22, 0.2, 0.02, '#1f2326', wx + 0.22, y + 0.5, wz + 0.07);
    k.box(0.98, 0.05, 0.16, '#9aa3a6', wx, y + 1.0, wz);
    sangar(k, 1.4, -0.05, 0.8, y);
    sangar(k, 0.62, 1.2, 0.5, y);
    sandbagCarry(k, S, 0.75, 1.0, 1.75, 1.0, 16);
    return;
  }
  const gold = level === 20;
  if (level < 20) {
    // 17–19: wide earth-bermed drill bunker across the back with sliding blast doors, and a low grass mound at front left
    const bx = 0, bz = -0.62, bw = 3.2, bd = 1.5, bh = 1.85;
    k.box(bw, bh, bd, CONCRETE, bx, y, bz);
    k.box(bw + 0.04, 0.3, bd + 0.04, ARMOUR, bx, y, bz);
    if (level === 18) {
      k.box(bw + 0.3, 0.12, bd + 0.3, GRASS, bx, y + bh, bz);
      k.box(bw + 0.34, 0.05, bd + 0.34, CONCRETE, bx, y + bh - 0.05, bz);
    } else k.hipRoof(bw, bd, 1.0, bx, y + bh, bz, GRASS, 0.25);
    for (const sgn of [-1, 1]) {
      const berm = k.box(0.42, bh * 0.92, bd + 0.2, GRASS, bx + sgn * (bw / 2 + 0.02), y, bz);
      berm.rotation.z = sgn * 0.42;
    }
    const ow = 1.5, oh = 1.05;
    const fz = bz + bd / 2;
    k.box(ow, oh, 0.03, '#2a2f33', bx - 0.35, y, fz + 0.005);
    k.box(ow + 0.3, 0.16, 0.12, CONCRETE, bx - 0.35, y + oh, fz + 0.04);
    for (let i = 0; i < 3; i++) jacks(k, S, bx - 0.8 + i * 0.45, fz - 0.28, Math.PI / 2, 1 + i);
    for (const sgn of [-1, 1]) {
      const door = grp(k, bx - 0.35 + sgn * ow * 0.25, y, fz + 0.09);
      k.box(ow * 0.5, oh - 0.02, 0.06, '#6b7176', 0, 0, 0, door);
      for (let i = 0; i < 5; i++) {
        const st = k.box(0.12, 0.04, 0.065, i % 2 ? HAZ : '#1f2326', 0, 0.08 + i * 0.19, 0, door);
        st.rotation.z = 0.6;
      }
      k.anims.push((t) => {
        const q = fr(t, 12);
        const open = q < 0.1 ? smooth(q / 0.1) : q < 0.7 ? 1 : q < 0.8 ? 1 - smooth((q - 0.7) / 0.1) : 0;
        door.position.x = bx - 0.35 + sgn * (ow * 0.25 + open * ow * 0.5);
      });
    }
    k.blinker(bx - 0.35 - ow / 2 - 0.12, y + oh, fz + 0.06, '#ff8a1f', 0.04, 1.0);
    board(k, 'DRILL BUNKER', 0.8, 0.16, bx + 1.05, y + 0.7, fz + 0.03, '#2a2f33', HAZ);
    // Sensor mast and radar on the berm
    const top = y + bh + (level === 18 ? 0.12 : 1.0);
    cyl(k, 0.03, 0.9, C.metal, bx + 1.2, y + bh, bz - 0.4, k.group, 5);
    const radar = grp(k, bx + 1.2, y + bh + 0.9, bz - 0.4);
    k.box(0.4, 0.06, 0.06, '#f4f4f0', 0, 0, 0, radar);
    k.anims.push((t) => (radar.rotation.y = t * 1.5));
    k.blinker(bx + 1.2, y + bh + 0.96, bz - 0.4, '#ff3b30', 0.04);
    void top;
    // Grass mound with a crawl tunnel mouth at front left
    const mx = -1.38, mz = 0.82;
    k.box(0.95, 0.18, 1.0, CONCRETE, mx, y, mz);
    k.hipRoof(0.95, 1.0, 0.5, mx, y + 0.18, mz, GRASS, 0.08);
    k.box(0.04, 0.26, 0.3, '#1f2326', mx + 0.48, y, mz);
    pushups(k, S, mx + 0.62, mz + 0.35, 0, 70);
    if (level === 18) {
      // Bright teal/white drone cage on the flat berm roof, drones flying inside
      const cy0 = y + bh + 0.12, ch = 1.05, cw = bw - 0.2, cd = bd - 0.1;
      const netMat = new THREE.MeshStandardMaterial({ color: '#e8fbf8', transparent: true, opacity: 0.32, flatShading: true, depthWrite: false });
      for (const [pw, pd, px, pz] of [[cw, 0.02, 0, cd / 2], [cw, 0.02, 0, -cd / 2], [0.02, cd, cw / 2, 0], [0.02, cd, -cw / 2, 0]]) {
        const pn = new THREE.Mesh(new THREE.BoxGeometry(pw, ch, pd), netMat);
        pn.position.set(bx + px, cy0 + ch / 2, bz + pz);
        k.add(pn);
      }
      const roofNet = new THREE.Mesh(new THREE.BoxGeometry(cw, 0.02, cd), netMat);
      roofNet.position.set(bx, cy0 + ch, bz);
      k.add(roofNet);
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-0.5, 1], [0.5, 1], [-0.5, -1], [0.5, -1]]) k.box(0.06, ch, 0.06, C.white, bx + (dx * cw) / 2, cy0, bz + (dz * cd) / 2);
      for (const sgn of [-1, 1]) {
        k.box(cw + 0.06, 0.07, 0.07, TEAL, bx, cy0 + ch - 0.03, bz + (sgn * cd) / 2);
        k.box(0.07, 0.07, cd + 0.06, TEAL, bx + (sgn * cw) / 2, cy0 + ch - 0.03, bz);
        k.box(cw + 0.06, 0.05, 0.05, TEAL, bx, cy0 + 0.02, bz + (sgn * cd) / 2);
      }
      for (let i = 0; i < 3; i++) k.box(0.05, 0.05, cd, C.white, bx - cw / 2 + (cw * (i + 1)) / 4, cy0 + ch - 0.02, bz);
      const CS = grp(k, 0, 0, 0);
      drone(k, CS, bx - 0.7, cy0 + 0.45, bz, 0.5, 1, 1.1);
      drone(k, CS, bx + 0.6, cy0 + 0.65, bz, 0.5, 3, -0.9);
      drone(k, CS, bx, cy0 + 0.35, bz + 0.1, 0.35, 5, 1.6);
      for (const [i, ox] of [0.35, 0.75].entries()) {
        const f = place(k, S, fig(60 + i, 'op'), ox, 0.5, face(-0.3, -1));
        k.box(0.08, 0.03, 0.12, '#2a2f33', 0.12, -0.2, 0.1, f.armL);
        k.anims.push((t) => {
          f.armL.rotation.set(-0.25, 0, 1.0 + Math.sin(t * 2 + i) * 0.05);
          f.armR.rotation.set(0.25, 0, 1.0 - Math.sin(t * 2.3 + i) * 0.05);
          f.root.rotation.y = face(-0.3, -1) + Math.sin(t * 0.7 + i) * 0.25;
        });
      }
      crawlLane(k, S, 0.35, 1.1, 1.3, 0, 30, 2, SAND, C.metal, true);
      sangar(k, 1.6, 0.45, 0.45, y, Math.PI / 2);
      instructor(k, S, 1.25, 0.4, 1.25, 1.2, Math.PI, 33);
      return;
    }
    if (level === 17) {
      floor(k, 2.4, 0.7, SAND, 0.55, y, 0.9);
      crawlLane(k, S, 0.35, 0.95, 1.5, 0, 30, 2, null, C.metal, true);
      scalingWall(k, S, 1.55, 0.6, -Math.PI / 2, 0.72, CONCRETE, 32, HAZ, 0.55);
      sangar(k, -0.55, 0.45, 0.5, y);
      instructor(k, S, -0.35, 1.25, 1.2, 1.25, Math.PI / 2, 33);
      return;
    }
  } else {
    // 20: Training Citadel: three-storey cream citadel with gold floor bands and merlons, a gold-domed glass crown
    const cx = 0, cz = -0.68, cw = 3.5, cd = 1.42, ch = 2.45;
    k.box(cw, ch, cd, C.wall, cx, y, cz);
    k.box(cw + 0.04, 0.2, cd + 0.04, C.trim, cx, y, cz);
    for (let f = 1; f < 3; f++) k.box(cw + 0.06, 0.08, cd + 0.06, GOLD, cx, y + f * 0.82, cz);
    for (let f = 0; f < 3; f++) for (let i = 0; i < 7; i++) {
      if (f === 0 && i === 3) continue;
      k.box(0.24, 0.36, 0.02, DARK_GLASS, cx - cw / 2 + 0.3 + i * ((cw - 0.6) / 6), y + 0.3 + f * 0.82, cz + cd / 2 + 0.005);
    }
    for (let i = 0; i < 3; i++) k.box(0.02, 0.36, 0.24, DARK_GLASS, cx + cw / 2 + 0.005, y + 0.3 + i * 0.82, cz);
    // Gold entrance arch
    k.box(0.6, 0.72, 0.12, GOLD, cx, y, cz + cd / 2 + 0.03);
    k.box(0.42, 0.6, 0.02, '#86b7cc', cx, y, cz + cd / 2 + 0.1);
    k.box(cw + 0.12, 0.1, cd + 0.12, GOLD, cx, y + ch, cz);
    for (let i = 0; i < 12; i++) k.box(0.14, 0.14, 0.14, C.wall, cx - cw / 2 + 0.1 + i * ((cw - 0.2) / 11), y + ch + 0.1, cz + cd / 2);
    // Glass drum crown with a gold dome and spire
    cyl(k, 0.5, 0.32, '#86b7cc', cx - 0.6, y + ch + 0.1, cz - 0.1, k.group, 12);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      k.box(0.05, 0.32, 0.05, GOLD, cx - 0.6 + Math.cos(a) * 0.5, y + ch + 0.1, cz - 0.1 + Math.sin(a) * 0.5);
    }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(GOLD));
    dome.scale.y = 0.5;
    dome.position.set(cx - 0.6, y + ch + 0.42, cz - 0.1);
    k.add(dome);
    cyl(k, 0.03, 0.6, GOLD, cx - 0.6, y + ch + 0.66, cz - 0.1, k.group, 6, 0.005);
    abseil(k, S, cx + 0.9, cz + cd / 2, -Math.PI / 2, ch + 0.1, 20);
    abseil(k, S, cx + 1.4, cz + cd / 2, -Math.PI / 2, ch + 0.1, 23.5);
    const CS = grp(k, 0, 0, 0);
    drone(k, CS, cx + 0.8, y + ch + 0.6, cz, 0.45, 5, 1.2);
    k.flagpole(cx + 1.5, cz - 0.4, 0.9, y + ch + 0.1);
    // Gold holo sand-table pavilion at front left
    const tx2 = -1.38, tz2 = 0.8;
    holoTable(k, S, tx2, tz2 - 0.05, 0.22, 70, 2, true);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      k.box(0.05, 0.95, 0.05, GOLD, tx2 + Math.sin(a) * 0.45, y, tz2 + Math.cos(a) * 0.45);
    }
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.08, 6), mat(C.wall));
    ring.position.set(tx2, y + 0.99, tz2);
    k.add(ring);
    cyl(k, 0.52, 0.42, GOLD, tx2, y + 1.03, tz2, k.group, 6, 0.05);
  }
  // 19–20: yellow helipad pad with a fast-rope gantry and a big front-facing helicopter mock-up
  const gx = 0.75, gz = 0.82, gh = 1.45;
  floor(k, 2.0, 1.04, HAZ, gx + 0.05, y, gz, 0.03);
  floor(k, 1.8, 0.86, '#2a2b2d', gx + 0.05, y + 0.03, gz, 0.004);
  const hMark = board(k, 'H', 0.34, 0.3, gx - 0.75, y, gz, '#2a2b2d', HAZ);
  hMark.rotation.x = -Math.PI / 2;
  hMark.position.y = y + 0.05;
  const frameC = gold ? GOLD : '#4a4f54';
  for (const sgn of [-1, 1]) for (const dz of [-0.36, 0.36]) k.box(0.09, gh, 0.09, frameC, gx + sgn * 0.7, y, gz + dz);
  for (const sgn of [-1, 1]) k.box(0.08, 0.09, 0.8, HAZ, gx + sgn * 0.7, y + gh - 0.09, gz);
  for (const dz of [-0.36, 0.36]) k.box(1.48, 0.09, 0.08, frameC, gx, y + gh - 0.09, gz + dz);
  const H = grp(k, gx, y + gh, gz, Math.PI / 4);
  const body = gold ? C.wall : '#8a9a52';
  k.box(1.25, 0.55, 0.6, body, 0, 0, 0, H);
  k.box(1.26, 0.08, 0.61, gold ? GOLD : HAZ, 0, 0.14, 0, H);
  k.box(0.36, 0.42, 0.56, '#86b7cc', 0.78, 0.06, 0, H);
  k.box(0.9, 0.16, 0.16, body, -1.05, 0.28, 0, H);
  k.box(0.1, 0.42, 0.05, body, -1.45, 0.3, 0, H);
  k.box(0.5, 0.36, 0.01, '#1f2326', -0.05, 0.04, 0.305, H);
  k.box(0.5, 0.36, 0.01, '#1f2326', -0.05, 0.04, -0.305, H);
  cyl(k, 0.05, 0.14, C.dark, 0, 0.55, 0, H, 6);
  const rotor = grp(k, 0, 0.7, 0, 0, H);
  for (const a of [0, Math.PI / 2]) {
    const b = k.box(2.0, 0.025, 0.09, '#2a2f33', 0, 0, 0, rotor);
    b.rotation.y = a;
  }
  const tailRotor = grp(k, -1.45, 0.45, 0.05, 0, H);
  k.box(0.02, 0.36, 0.05, '#2a2f33', 0, -0.18, 0, tailRotor);
  k.anims.push((t) => {
    rotor.rotation.y = t * 1.4;
    tailRotor.rotation.z = t * 6;
  });
  fastRope(k, S, gx + 0.18, gz + 0.22, gh + 0.05, 40);
  fastRope(k, S, gx - 0.22, gz - 0.2, gh + 0.05, 42.5);
  instructor(k, S, -0.25, 0.4, -0.25, 1.2, 0, 33);
  if (level === 19) {
    sangar(k, 1.65, 0.1, 0.4, y, Math.PI / 2);
    return;
  }
  for (const x of [1.82, 1.6]) k.flagpole(x, -0.2, 2.0, y);
}

// ------------------------------------------------------------------ build

export function buildTrainingShed(level: number): Kit {
  const k = new Kit();
  const y = k.pad(4, 3);
  if (level <= 3) field(k, level, y);
  else if (level <= 6) camp(k, level, y);
  else if (level <= 10) base(k, level, y);
  else if (level <= 15) command(k, level, y);
  else secure(k, level, y);
  return k;
}

export const TRAINING_SHED: BuildingDef = {
  id: 'trainingshed',
  name: 'Training Shed',
  role: 'Turns Recruits into trained squads: sets squad capacity, training speed and which troop types can be trained.',
  footprint: [4, 3],
  unlockHq: 7,
  levels: TRAINING_SHED_LEVELS,
  designedLevels: 20,
  build: buildTrainingShed,
};
