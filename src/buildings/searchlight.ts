import * as THREE from 'three';
import { C, Kit, mat } from './kit';
import { CONCRETE, DARK_GLASS, GOLD } from './common';
import type { Turret } from './turret';
import { DAY, HOUR, type BuildingDef, type LevelStats } from './types';

/*
 * Searchlight: a support defence. It never shoots; it locks its beam onto a
 * raider, lighting it up, slowing it and making nearby defences more accurate.
 * Signature at every level: a big searchlight drum (later LED arrays, twin
 * drums and a laser dazzler) on a yoke, throwing a visible beam that sweeps the
 * sky and ground while idle and holds steady on a locked target; a generator
 * that shakes, spins its fan and puffs exhaust; and an operator on watch.
 * Every "shot" (rate 0.5) is a lock pulse: the lens flares and the beam brightens.
 * Footprint 2×2; bulk climbs from ~1 storey to ~3.3 storeys.
 */

const TITLES = [
  'Tripod Lamp', 'Lamp Stage', 'Lamp Truck', 'Lamp Pillar', 'Roof-Deck Lamp', 'Lamp Tower', 'Concrete Light Tower',
  'Twin-Lamp Tower', 'Lamp Bastion', 'Grand Searchlight', 'LED Mast', 'Light Gantry', 'Array Pavilion', 'Twin Array Towers',
  'Lumen Crown', 'Armoured Lamp Bunker', 'Shutter Battery', 'Dazzler Berm', 'Twin-Drum Sensor Tower', 'Citadel Lantern',
];
const SUPPLIES = [35_000, 47_000, 62_000, 82_000, 110_000, 145_000, 195_000, 260_000, 345_000, 460_000, 610_000, 810_000, 1_080_000, 1_430_000, 1_900_000, 2_530_000, 3_370_000, 4_480_000, 5_950_000, 7_900_000];
const REPUTATION = [2_200, 2_500, 2_850, 3_250, 3_700, 4_200, 4_800, 5_450, 6_200, 7_050, 8_000, 9_100, 10_300, 11_700, 13_300, 15_100, 17_100, 19_400, 22_000, 25_000];
const TIME = [3 * HOUR, 4 * HOUR, 6 * HOUR, 8 * HOUR, 11 * HOUR, 14 * HOUR, 18 * HOUR, 22 * HOUR, 1.25 * DAY, 1.5 * DAY, 2 * DAY, 2.5 * DAY, 3 * DAY, 3.5 * DAY, 4 * DAY, 4.5 * DAY, 5 * DAY, 5.75 * DAY, 6.25 * DAY, 7 * DAY];

export const SEARCHLIGHT_LEVELS: LevelStats[] = TITLES.map((title, i) => {
  const level = i + 1;
  const range = 8 + Math.round((i * 4 * 2) / 19) / 2;
  const accuracyBoost = +(5 + 1.5 * i).toFixed(1);
  const slow = 10 + Math.round((i * 20) / 19);
  return {
    level, title,
    supplies: SUPPLIES[i],
    reputation: REPUTATION[i],
    buildTime: TIME[i],
    hp: Math.round((800 * Math.pow(1.2, i)) / 10) * 10,
    stats: { range, accuracyBoost, boostRadius: 4, slow },
    unlocks: [
      `Locks on to raiders ${range} tiles out`,
      `+${accuracyBoost}% accuracy for defences within 4 tiles`,
      `Slows raiders in the beam by ${slow}%`,
    ],
  };
});

// ------------------------------------------------------------------ palette

const OLIVE = '#5b6b3a';
const OLIVE_D = '#46542c';
const BERET = '#2a3326';
const SKIN = ['#e0ac7e', '#c68b5f', '#a8714b', '#f0c39a'];
const STEEL = '#5c6166';
const GUN = '#4a4f54';
const ARMOUR = '#6b7268';
const HAZ = '#f2c230';
const MUSTARD = '#d9a521';
const TEAL = '#2bb3a3';
const GLASS = '#86b7cc';
const GRASS = '#5fae34';
const WARM = '#fff2b8';
const COOL = '#e6f6ff';
const M = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8, ...o });
const glow = (c: string, i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, flatShading: true });
const smooth = (u: number) => u * u * (3 - 2 * u);
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * Light effects (beams, halos, lasers) are see-through glow, not mass. Giving
 * their geometry an empty bounding box keeps them out of the bulk/coverage
 * metrics and the showcase label height (rendering uses the bounding sphere).
 */
function noMass(g: THREE.BufferGeometry) {
  g.boundingBox = new THREE.Box3(V(0, 0, 0), V(0, 0, 0));
  return g;
}

// ------------------------------------------------------------------ small parts

/** Thin box strut from a to b (local coordinates of parent). */
function strut(k: Kit, a: THREE.Vector3, b: THREE.Vector3, t: number, color: string, parent: THREE.Object3D = k.group) {
  const d = b.clone().sub(a);
  const m = new THREE.Mesh(new THREE.BoxGeometry(t, t, d.length()), mat(color));
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V(0, 0, 1), d.normalize());
  return k.add(m, parent);
}

/** A cable run through a list of points. */
function cable(k: Kit, pts: [number, number, number][], color = '#2a2b2d', t = 0.022) {
  for (let i = 0; i < pts.length - 1; i++) strut(k, V(...pts[i]), V(...pts[i + 1]), t, color);
}

/** Flat coil of spare cable on the ground. */
function coil(k: Kit, x: number, z: number, y: number, r = 0.12) {
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.TorusGeometry(r - i * 0.012, 0.014, 4, 12).rotateX(Math.PI / 2), mat('#2a2b2d'));
    c.position.set(x + i * 0.01, y + 0.015 + i * 0.022, z);
    k.add(c);
  }
}

function jerrycan(k: Kit, x: number, z: number, y: number, color = '#b8382c', rotY = 0) {
  const b = k.box(0.1, 0.15, 0.06, color, x, y, z);
  b.rotation.y = rotY;
  k.box(0.05, 0.02, 0.02, C.dark, x, y + 0.15, z).rotation.y = rotY;
}

function signMat(text: string, bg: string, fg: string, font = 40) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 96);
  g.strokeStyle = fg;
  g.lineWidth = 6;
  g.strokeRect(6, 6, 244, 84);
  g.fillStyle = fg;
  g.font = `900 ${font}px Nunito, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const lines = text.split('\n');
  lines.forEach((l, i) => g.fillText(l, 128, 50 + (i - (lines.length - 1) / 2) * font * 0.95));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 });
}

/** Sign board with lettering on its front (+z before rotY). */
function sign(k: Kit, text: string, x: number, y: number, z: number, w = 0.3, rotY = 0, bg = HAZ, fg = '#2a2b2d', font = 34) {
  const h = w * 0.375;
  const side = M(bg);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), [side, side, side, side, signMat(text, bg, fg, font), side]);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = rotY;
  return k.add(m);
}

/** Sign on its own post. */
function postSign(k: Kit, text: string, x: number, z: number, y: number, rotY = 0, bg = HAZ, fg = '#2a2b2d', h = 0.42) {
  k.box(0.03, h, 0.03, C.wood, x, y, z);
  sign(k, text, x + Math.sin(rotY) * 0.02, y + h - 0.12, z + Math.cos(rotY) * 0.02, 0.3, rotY, bg, fg);
}

/** Railing round a rectangular deck; `open` leaves a gap on one side for a ladder or stair. */
function railing(k: Kit, x: number, z: number, y: number, w: number, d: number, color: string = C.trim, h = 0.22, open: 'front' | 'left' | null = null) {
  const sides: [number, number, number, number, string][] = [
    [x, z + d / 2, w, 0, 'front'], [x, z - d / 2, w, 0, 'back'], [x - w / 2, z, 0, d, 'left'], [x + w / 2, z, 0, d, 'right'],
  ];
  for (const [cx, cz, sw, sd, name] of sides) {
    const len = sw || sd;
    const n = Math.max(2, Math.round(len / 0.28));
    for (let i = 0; i <= n; i++) {
      const u = -len / 2 + (len / n) * i;
      if (name === open && Math.abs(u) < len * 0.3) continue;
      k.box(0.025, h, 0.025, color, sw ? cx + u : cx, y, sd ? cz + u : cz);
    }
    for (const yy of [h - 0.02, h * 0.5]) {
      if (name === open) {
        for (const s of [-1, 1]) k.box(sw ? len * 0.2 : 0.02, 0.02, sd ? len * 0.2 : 0.02, color, sw ? cx + s * len * 0.4 : cx, y + yy, sd ? cz + s * len * 0.4 : cz);
      } else k.box(sw ? len : 0.02, 0.02, sd ? len : 0.02, color, cx, y + yy, cz);
    }
  }
}

/** Round railing (posts and a ring rail) for tower galleries. */
function ringRail(k: Kit, x: number, z: number, y: number, r: number, color: string = C.trim, h = 0.22) {
  const n = Math.round(r * 18);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    k.box(0.025, h, 0.025, color, x + Math.cos(a) * r, y, z + Math.sin(a) * r);
  }
  for (const yy of [h, h * 0.5]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 4, 24).rotateX(Math.PI / 2), mat(color));
    ring.position.set(x, y + yy, z);
    k.add(ring);
  }
}

function ladder(k: Kit, x: number, z: number, y: number, h: number, rotY = 0, color: string = C.metal, lean = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.set(lean, rotY, 0);
  for (const s of [-0.07, 0.07]) k.box(0.025, h, 0.025, color, s, 0, 0, g);
  for (let i = 1; i < h / 0.1; i++) k.box(0.14, 0.015, 0.015, color, 0, i * 0.1, 0, g);
  return k.add(g);
}

/** Wall-mounted extractor/cooling fan facing local +z, turned by rotY. */
function fan(k: Kit, x: number, y: number, z: number, r = 0.1, rotY = 0, speed = 10, frame = '#c9ced2') {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  k.box(r * 2.3, r * 2.3, 0.03, frame, 0, -r * 1.15, 0, g);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.014, 4, 14), mat(C.dark));
  ring.position.z = 0.02;
  g.add(ring);
  const blades = new THREE.Group();
  blades.position.z = 0.025;
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(r * 0.9, 0.035, 0.008).translate(r * 0.45, 0, 0), mat('#3a3f44'));
    b.rotation.z = (i / 3) * Math.PI * 2;
    blades.add(b);
  }
  g.add(blades);
  k.add(g);
  const off = x * 3 + z;
  k.anims.push((t) => (blades.rotation.z = t * speed + off));
  return g;
}

/** Roof fan laid flat (horizontal), spinning about Y. */
function roofFan(k: Kit, x: number, y: number, z: number, r = 0.12, speed = 9) {
  k.cyl(r + 0.03, 0.06, '#c9ced2', x, y, z, 12);
  const blades = new THREE.Group();
  blades.position.set(x, y + 0.065, z);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(r * 0.95, 0.008, 0.04).translate(r * 0.47, 0, 0), mat('#3a3f44'));
    b.rotation.y = (i / 4) * Math.PI * 2;
    blades.add(b);
  }
  k.add(blades);
  k.box(0.015, 0.012, r * 2.1, C.dark, x, y + 0.075, z);
  k.anims.push((t) => (blades.rotation.y = t * speed + x));
}

/** Rotating amber beacon. */
function beacon(k: Kit, x: number, y: number, z: number, color = '#ff9a1f', s = 1) {
  k.cyl(0.05 * s, 0.03, C.dark, x, y, z, 8);
  const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * s, 0.045 * s, 0.07 * s, 8), M(color, { emissive: color, emissiveIntensity: 0.6, transparent: true, opacity: 0.85 }));
  dome.position.set(x, y + 0.03 + 0.035 * s, z);
  k.add(dome);
  const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.04 * s, 0.012), glow('#fff2c0', 1.5));
  mirror.position.copy(dome.position);
  k.add(mirror);
  k.anims.push((t) => (mirror.rotation.y = t * 5 + x));
}

/** Cable reel on an A-frame stand; the drum winds back and forth as the cable pays out. */
function reel(k: Kit, x: number, z: number, y: number, r = 0.14, rotY = 0, color = '#c9822b') {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  for (const s of [-1, 1]) {
    strut(k, V(-0.1, 0, s * 0.11), V(0, r + 0.08, s * 0.11), 0.025, C.metal, g);
    strut(k, V(0.1, 0, s * 0.11), V(0, r + 0.08, s * 0.11), 0.025, C.metal, g);
  }
  const drum = new THREE.Group();
  drum.position.y = r + 0.08;
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.02, 12).rotateX(Math.PI / 2), mat(color));
    f.position.z = s * 0.085;
    drum.add(f);
  }
  drum.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r * 0.7, 0.15, 10).rotateX(Math.PI / 2), mat('#2a2b2d')));
  const spoke = new THREE.Mesh(new THREE.BoxGeometry(r * 1.8, 0.025, 0.2), mat('#8a5a3b'));
  drum.add(spoke);
  g.add(drum);
  k.add(g);
  k.anims.push((t) => (drum.rotation.z = Math.sin(t * 0.35 + x) * 3));
  return g;
}

/** Hurricane lantern hanging from (x, y, z), swaying in the breeze. */
function lantern(k: Kit, x: number, y: number, z: number, seed = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  k.box(0.01, 0.1, 0.01, '#33383d', 0, -0.1, 0, g);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.09, 6), glow('#ffcf6a', 0.8));
  body.position.y = -0.16;
  const lid = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.045, 6), M('#4a4f54'));
  lid.position.y = -0.1;
  g.add(body, lid);
  k.add(g);
  k.anims.push((t) => {
    g.rotation.z = Math.sin(t * 1.5 + seed) * 0.18;
    g.rotation.x = Math.sin(t * 1.1 + seed * 2) * 0.1;
  });
}

/** Flag on a short pole (plain camp colours) that also flutters by rotation so it reads at icon size. */
function pennant(k: Kit, x: number, z: number, y: number, h = 0.7, color = '#d8342c') {
  k.cyl(0.015, h, C.white, x, y, z, 5);
  const f = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.01).translate(0.11, 0, 0), M(color));
  f.position.set(x + 0.015, y + h - 0.08, z);
  k.add(f);
  k.anims.push((t) => {
    f.rotation.y = Math.sin(t * 2.3 + x) * 0.5;
    f.rotation.x = Math.sin(t * 4.1 + z) * 0.1;
  });
}

/** Pole camera that pans (secure band). */
function camera(k: Kit, x: number, z: number, y: number, h = 0.9, base = 0, color = '#f4f4f0') {
  k.cyl(0.022, h, C.metal, x, y, z, 5);
  const cam = new THREE.Group();
  cam.position.set(x, y + h, z);
  k.box(0.15, 0.07, 0.07, color, 0.05, 0, 0, cam);
  k.box(0.03, 0.045, 0.045, '#33383d', 0.135, 0.012, 0, cam);
  k.add(cam);
  k.anims.push((t) => (cam.rotation.y = base + Math.sin(t * 0.45 + x + z) * 0.9));
}

/** Electro-optical sensor ball on a mast: pans and nods. */
function sensorBall(k: Kit, x: number, z: number, y: number, h = 0.9, r = 0.09) {
  k.cyl(0.03, h, C.metal, x, y, z, 6);
  k.box(0.08, 0.08, 0.14, GUN, x, y + h, z);
  const g = new THREE.Group();
  g.position.set(x, y + h + 0.06 + r, z);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), M('#e8e6e0'));
  g.add(ball);
  const win = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.02, 10).rotateZ(Math.PI / 2), glow('#2f4a57', 0.4));
  win.position.x = r * 0.95;
  g.add(win);
  k.add(g);
  k.anims.push((t) => {
    g.rotation.y = Math.sin(t * 0.3 + x) * 1.6;
    g.rotation.z = Math.sin(t * 0.7) * 0.25;
  });
}

// ------------------------------------------------------------------ people

interface Figure { root: THREE.Group; legL: THREE.Object3D; legR: THREE.Object3D; armL: THREE.Object3D; armR: THREE.Object3D; bino: THREE.Mesh }

/** A ~0.6-tall low-poly figure facing +x with pivoting limbs. */
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
  const bino = add(new THREE.BoxGeometry(0.05, 0.035, 0.1), '#2a2b2d', 0.075, 0.52, 0);
  return { root, legL, legR, armL, armR, bino };
}

type Duty = 'bino' | 'crank' | 'point' | 'tablet';

/**
 * The lamp operator on watch: glances about, then (by duty) raises binoculars,
 * cranks the lamp's training handle, points out a target or checks a tablet.
 */
function operator(k: Kit, x: number, z: number, y: number, rotY: number, seed = 0, duty: Duty = 'bino', uniform = OLIVE, beret: string | null = BERET) {
  const f = figure(seed, uniform, beret);
  f.root.position.set(x, y, z);
  f.root.rotation.y = rotY;
  f.bino.visible = false;
  k.add(f.root);
  let tab: THREE.Mesh | null = null;
  if (duty === 'tablet') {
    tab = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.11), glow('#9fe8ff', 0.6));
    tab.position.set(0.13, 0.38, 0.0);
    f.root.add(tab);
  }
  k.anims.push((t) => {
    const p = (((t + seed * 2.3) % 8) + 8) % 8;
    f.armL.rotation.set(0, 0, 0);
    f.armR.rotation.set(0, 0, 0);
    f.root.rotation.y = rotY + Math.sin(t * 0.4 + seed) * 0.4;
    f.root.position.y = y + Math.sin(t * 1.3 + seed) * 0.004;
    if (duty === 'bino') {
      const up = p > 3 && p < 6.5;
      f.bino.visible = up;
      if (up) {
        f.armL.rotation.set(0.35, 0, 1.9);
        f.armR.rotation.set(-0.35, 0, 1.9);
      } else f.armR.rotation.z = Math.sin(t * 0.9) * 0.1;
    } else if (duty === 'crank') {
      f.armR.rotation.z = 0.9 + Math.sin(t * 3) * 0.35;
      f.armR.rotation.x = Math.cos(t * 3) * 0.2;
      f.armL.rotation.z = 0.6;
    } else if (duty === 'point') {
      if (p > 2 && p < 4.5) f.armR.rotation.set(-0.3, 0, 2.3);
      f.armL.rotation.z = Math.sin(t * 0.8) * 0.12;
    } else {
      f.armL.rotation.z = f.armR.rotation.z = 0.9;
      f.armL.rotation.x = 0.5;
      f.armR.rotation.x = -0.5;
      if (tab) tab.rotation.z = Math.sin(t * 1.7) * 0.1;
      if (p > 5) f.armR.rotation.z = 1.2 + Math.sin(t * 9) * 0.1;
    }
  });
  return f;
}

/** A sentry pacing between two points (patrolling a terrace or podium). */
function patrol(k: Kit, y: number, x0: number, z0: number, x1: number, z1: number, period = 9, seed = 1, uniform = OLIVE) {
  const f = figure(seed, uniform);
  f.bino.visible = false;
  k.add(f.root);
  const face = (dx: number, dz: number) => Math.atan2(-dz, dx);
  k.anims.push((t) => {
    const p = ((((t + seed * 3) % period) + period) % period) / period;
    const fwd = p < 0.5;
    const u = smooth(fwd ? p * 2 : 2 - p * 2);
    f.root.position.set(x0 + (x1 - x0) * u, y, z0 + (z1 - z0) * u);
    const s = Math.min(p, Math.abs(p - 0.5), 1 - p) < 0.04 ? 0 : Math.sin(t * 8);
    f.legL.rotation.z = s * 0.5;
    f.legR.rotation.z = -s * 0.5;
    f.armL.rotation.z = -s * 0.4;
    f.armR.rotation.z = s * 0.4;
    f.root.rotation.y = fwd ? face(x1 - x0, z1 - z0) : face(x0 - x1, z0 - z1);
  });
}

// ------------------------------------------------------------------ generator

type GenStyle = 'field' | 'camp' | 'base' | 'modern' | 'armour';

/**
 * Diesel generator on a skid: the body shakes, the radiator fan spins and the
 * exhaust puffs smoke. Built along local x (radiator at +x), turned by rotY.
 */
function generator(k: Kit, x: number, z: number, y: number, s = 1, style: GenStyle = 'field', rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  k.add(g);
  const col = { field: OLIVE, camp: MUSTARD, base: MUSTARD, modern: C.white, armour: ARMOUR }[style];
  const L = 0.5 * s, H = 0.27 * s, D = 0.3 * s;
  for (const sz of [-1, 1]) k.box(L + 0.06, 0.035, 0.04, C.dark, 0, 0, sz * (D / 2 - 0.03), g);
  if (style === 'field') {
    // Tubular carry frame
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.025, H + 0.1, 0.025, '#3a3f2a', sx * (L / 2 + 0.01), 0.03, sz * (D / 2 + 0.01), g);
    for (const sz of [-1, 1]) k.box(L + 0.04, 0.025, 0.025, '#3a3f2a', 0, H + 0.12, sz * (D / 2 + 0.01), g);
  }
  const body = new THREE.Group();
  body.position.y = 0.035;
  g.add(body);
  k.box(L * 0.6, H, D, col, -L * 0.18, 0, 0, body);
  k.box(L * 0.36, H * 0.92, D * 0.92, style === 'modern' ? '#d8dcdf' : '#3a3f44', L * 0.3, 0, 0, body);
  if (style === 'modern') k.box(L * 0.61, 0.04, D + 0.01, TEAL, -L * 0.18, H * 0.55, 0, body);
  if (style === 'camp' || style === 'base') for (let i = 0; i < 3; i++) k.box(L * 0.61, 0.02, D + 0.005, C.kerbB, -L * 0.18, H * 0.25 + i * H * 0.22, 0, body);
  // Fuel tank, control panel with a lit gauge
  k.box(L * 0.5, H * 0.25, D * 0.72, style === 'field' ? OLIVE_D : style === 'armour' ? GUN : '#e0e0dc', -L * 0.2, H, 0, body);
  k.box(0.08 * s, 0.08 * s, 0.015, '#2a2b2d', -L * 0.25, H * 0.4, D / 2 + 0.006, body);
  const gauge = new THREE.Mesh(new THREE.BoxGeometry(0.025 * s, 0.025 * s, 0.01), glow('#7cff8a', 1.2));
  gauge.position.set(-L * 0.25, H * 0.62, D / 2 + 0.015);
  body.add(gauge);
  // Radiator fan on the +x end
  const fanG = new THREE.Group();
  fanG.position.set(L * 0.48 + 0.006, H * 0.48, 0);
  body.add(fanG);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(H * 0.36, 0.012, 4, 12).rotateY(Math.PI / 2), mat(C.dark));
  fanG.add(ring);
  const blades = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.008, H * 0.32, 0.03).translate(0, H * 0.16, 0), mat('#c9ced2'));
    b.rotation.x = (i / 3) * Math.PI * 2;
    blades.add(b);
  }
  fanG.add(blades);
  // Exhaust stack with a rain cap
  const ex = -L * 0.38, ez = D * 0.22, eh = 0.2 * s;
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.018 * s, 0.018 * s, eh, 6), mat('#2a2b2d'));
  pipe.position.set(ex, H + eh / 2, ez);
  body.add(pipe);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.05 * s, 0.012, 0.05 * s), mat('#2a2b2d'));
  cap.position.set(ex, H + eh + 0.012, ez);
  body.add(cap);
  g.updateMatrixWorld(true);
  k.emitters.push({ pos: g.localToWorld(V(ex, 0.035 + H + eh + 0.04, ez)), kind: 'smoke' });
  const off = x * 7 + z * 3;
  k.anims.push((t) => {
    body.position.y = 0.035 + Math.abs(Math.sin(t * 37 + off)) * 0.008 * s;
    body.rotation.x = Math.sin(t * 29 + off) * 0.015;
    blades.rotation.x = t * 15;
    cap.rotation.z = Math.abs(Math.sin(t * 11 + off)) * 0.5;
  });
  return g;
}

// ------------------------------------------------------------------ the lamp head

type LampStyle = 'drum' | 'array' | 'armour' | 'louvre' | 'twin';

interface LampOpts {
  r: number;
  color: string;
  rim?: string;
  yoke?: string;
  style?: LampStyle;
  /** Height from the yaw pivot to the trunnion (pitch) axis. */
  armH?: number;
  rotY?: number;
  /** Laser dazzler pod fixed beside the drum. */
  dazzler?: boolean;
  /** LED panel "ears" on either side of the drum. */
  wings?: boolean;
  /** Hang the yoke below the pivot (lamps under a gantry). */
  hang?: boolean;
  lensColor?: string;
}

interface Lamp {
  yaw: THREE.Group;
  pitch: THREE.Group;
  muzzles: THREE.Object3D[];
  lens: THREE.MeshStandardMaterial[];
  r: number;
  style: LampStyle;
  /** Shutters / louvres: 0 closed … 1 open. */
  shutter?: (open: number) => void;
  laser?: THREE.Mesh;
  ledMats: THREE.MeshStandardMaterial[];
}

function lensDisc(r: number, m: THREE.Material) {
  return new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.02, 18).rotateZ(Math.PI / 2), m);
}

/** A grid of LED cells on a backing plate facing +x. Returns its glow material. */
function ledPanel(k: Kit, parent: THREE.Object3D, w: number, h: number, nx: number, ny: number, x: number, y: number, z: number, frame: string, color = COOL) {
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.08, h, w), mat(frame));
  back.position.set(x - 0.04, y, z);
  parent.add(back);
  const gm = glow(color, 1.3);
  const cw = (w / nx) * 0.74, ch = (h / ny) * 0.74;
  const geo = new THREE.BoxGeometry(0.02, ch, cw);
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const c = new THREE.Mesh(geo, gm);
    c.position.set(x + 0.005, y - h / 2 + (h / ny) * (j + 0.5), z - w / 2 + (w / nx) * (i + 0.5));
    parent.add(c);
  }
  // Cooling fins on the back
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.06, h * 0.9, 0.012), mat(GUN));
    f.position.set(x - 0.1, y, z - w / 3 + (w / 3) * i);
    parent.add(f);
  }
  void k;
  return gm;
}

/**
 * Searchlight head on a yaw/pitch rig, pointing along local +x.
 *  yaw   (at x, y, z): turntable and fork, turns about Y
 *  pitch (at the trunnions): drum, lens and accessories, turns about Z
 */
function lamp(k: Kit, x: number, y: number, z: number, o: LampOpts, parent: THREE.Object3D = k.group): Lamp {
  const r = o.r, style = o.style ?? 'drum';
  const rim = o.rim ?? C.dark, yokeCol = o.yoke ?? GUN;
  const armH = o.armH ?? r + 0.1;
  const yaw = new THREE.Group();
  yaw.position.set(x, y, z);
  yaw.rotation.y = o.rotY ?? 0;
  const pitch = new THREE.Group();
  const lens: THREE.MeshStandardMaterial[] = [];
  const muzzles: THREE.Object3D[] = [];
  const ledMats: THREE.MeshStandardMaterial[] = [];
  const dir = o.hang ? -1 : 1;
  pitch.position.y = dir * armH;
  yaw.add(pitch);
  const halfW = style === 'twin' ? r * 2.15 : style === 'array' ? r * 1.25 : r + (style === 'armour' ? 0.12 : 0.04);
  // Turntable and fork
  k.box(0.1 + r * 0.9, 0.05, 0.1 + r * 0.9, yokeCol, 0, o.hang ? -0.05 : 0, 0, yaw);
  k.box(0.14, 0.05, halfW * 2 + 0.12, yokeCol, 0, dir * (o.hang ? 0.05 : 0.05) - (o.hang ? 0.05 : 0), 0, yaw);
  for (const s of [-1, 1]) {
    const arm = k.box(0.08, armH + 0.04, 0.05, yokeCol, 0, o.hang ? -armH - 0.04 : 0.02, s * (halfW + 0.04), yaw);
    void arm;
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.16 + 0.02, r * 0.16 + 0.02, 0.05, 10).rotateX(Math.PI / 2), mat(rim));
    hub.position.set(0, 0, s * (halfW + 0.07));
    pitch.add(hub);
  }
  const lensCol = o.lensColor ?? '#fff6c8';
  const drum = (zc: number, rr: number) => {
    const fx = rr * 0.7, bx = -rr * 0.8;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr * 0.84, fx - bx, 18).rotateZ(-Math.PI / 2), mat(o.color));
    body.position.set((fx + bx) / 2, 0, zc);
    pitch.add(body);
    for (const u of [0.25, 0.5]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.98 - u * rr * 0.12 + 0.012, rr * 0.98 - u * rr * 0.12 + 0.012, 0.03, 18).rotateZ(Math.PI / 2), mat(rim));
      band.position.set(bx + (fx - bx) * u, 0, zc);
      pitch.add(band);
    }
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(rr * 0.97, rr * 0.11, 6, 18).rotateY(Math.PI / 2), mat(rim));
    bezel.position.set(fx, 0, zc);
    pitch.add(bezel);
    const lm = glow(lensCol, 1.4);
    lens.push(lm);
    const ld = lensDisc(rr * 0.9, lm);
    ld.position.set(fx + 0.004, 0, zc);
    pitch.add(ld);
    for (const [gy, gz] of [[rr * 1.8, 0.02], [0.02, rr * 1.8]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.015, gy, gz), mat(rim));
      bar.position.set(fx + 0.018, 0, zc);
      pitch.add(bar);
    }
    // Rear cap with cooling fins, top vent and carry handle
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.55, rr * 0.7, 0.08, 14).rotateZ(-Math.PI / 2), mat(rim));
    cap.position.set(bx - 0.04, 0, zc);
    pitch.add(cap);
    const vent = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.2, rr * 0.24, rr * 0.3, 8), mat(rim));
    vent.position.set(bx * 0.4, rr * 0.98, zc);
    pitch.add(vent);
    const ventCap = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.3, rr * 0.3, 0.025, 8), mat(rim));
    ventCap.position.set(bx * 0.4, rr * 1.16, zc);
    pitch.add(ventCap);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, rr * 0.9), mat(rim));
    handle.position.set(-rr * 1.02, -rr * 0.25, zc);
    pitch.add(handle);
    const m = new THREE.Object3D();
    m.position.set(fx + 0.03, 0, zc);
    pitch.add(m);
    muzzles.push(m);
  };
  if (style === 'twin') {
    drum(-r * 1.08, r);
    drum(r * 1.08, r);
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(r * 1.0, r * 0.5, r * 0.5), mat(rim));
    pitch.add(bridge);
  } else if (style === 'array') {
    // Big square LED array with a deep heatsink housing behind it
    const hw = r * 2.4, hh = r * 2.0;
    const house = new THREE.Mesh(new THREE.BoxGeometry(r * 1.2, hh + 0.04, hw + 0.04), mat(o.color));
    house.position.x = -r * 0.62;
    pitch.add(house);
    ledMats.push(ledPanel(k, pitch, hw, hh, 4, 3, 0.02, 0, 0, rim, COOL));
    for (const s of [-1, 1]) {
      const lip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, hw + 0.06), mat(rim));
      lip.position.set(0.02, s * (hh / 2 + 0.015), 0);
      pitch.add(lip);
    }
    const m = new THREE.Object3D();
    m.position.set(0.06, 0, 0);
    pitch.add(m);
    muzzles.push(m);
    lens.push(...ledMats);
  } else {
    drum(0, r);
  }
  let shutter: ((open: number) => void) | undefined;
  if (style === 'armour') {
    // Angular armour shell round the drum, with an iris of two plates over the lens
    const fx = r * 0.7;
    const shell = new THREE.Mesh(new THREE.BoxGeometry(r * 1.55, r * 2.3, r * 2.3), mat(ARMOUR));
    shell.position.set(-r * 0.1, 0, 0);
    pitch.add(shell);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(r * 0.6, 0.05, r * 2.4), mat(GUN));
    brow.position.set(fx + 0.02, r * 1.12, 0);
    brow.rotation.z = -0.25;
    pitch.add(brow);
    for (let i = 0; i < 3; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(r * 1.2, 0.03, 0.03), mat(GUN));
      rib.position.set(-r * 0.15, r * 1.16, -r * 0.6 + i * r * 0.6);
      pitch.add(rib);
    }
    const plates = [-1, 1].map((s) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.035, r * 1.0, r * 2.05), mat(GUN));
      p.position.set(fx + 0.07, s * r * 0.5, 0);
      pitch.add(p);
      return { p, s };
    });
    shutter = (open) => plates.forEach(({ p, s }) => (p.position.y = s * (r * 0.5 + open * r * 0.62)));
  } else if (style === 'louvre') {
    const fx = r * 0.7;
    const slats: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const sl = new THREE.Mesh(new THREE.BoxGeometry(0.012, r * 0.38, r * 1.9), mat(GUN));
      sl.position.set(fx + 0.06, -r * 0.76 + i * r * 0.38, 0);
      pitch.add(sl);
      slats.push(sl);
    }
    for (const s of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.1, r * 2.0, 0.03), mat(ARMOUR));
      cheek.position.set(fx + 0.05, 0, s * r * 0.98);
      pitch.add(cheek);
    }
    shutter = (open) => slats.forEach((sl) => (sl.rotation.z = open * 1.35));
  }
  if (o.wings) {
    for (const s of [-1, 1]) {
      const zc = s * (halfW + 0.2 + r * 0.35);
      ledMats.push(ledPanel(k, pitch, r * 0.7, r * 1.3, 2, 3, r * 0.55, 0, zc, rim, COOL));
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.22), mat(rim));
      arm.position.set(r * 0.3, 0, s * (halfW + 0.1));
      pitch.add(arm);
    }
    lens.push(...ledMats.slice(-2));
  }
  let laser: THREE.Mesh | undefined;
  if (o.dazzler) {
    const dz = 0, dy = r * 1.22 + 0.07;
    const pod = new THREE.Mesh(new THREE.BoxGeometry(r * 0.9, 0.11, 0.13), mat(GUN));
    pod.position.set(r * 0.05, dy, dz);
    pitch.add(pod);
    const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.06, 8).rotateZ(-Math.PI / 2), mat('#2a2b2d'));
    nose.position.set(r * 0.5 + 0.03, dy, dz);
    pitch.add(nose);
    const emit = new THREE.Mesh(lensDisc(0.024, glow('#7dff6a', 2)).geometry, glow('#7dff6a', 2));
    emit.position.set(r * 0.5 + 0.065, dy, dz);
    pitch.add(emit);
    const lm = new THREE.MeshBasicMaterial({ color: '#7dff6a', transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending });
    laser = new THREE.Mesh(noMass(new THREE.CylinderGeometry(0.012, 0.02, 1, 6, 1, true).rotateZ(Math.PI / 2).translate(0.5, 0, 0)), lm);
    laser.position.set(r * 0.5 + 0.07, dy, dz);
    laser.userData.laser = true;
  }
  k.add(yaw, parent);
  return { yaw, pitch, muzzles, lens, r, style, shutter, laser, ledMats };
}

type Idle = (t: number) => [number, number];

/** Figure-of-eight across the sky. */
const eight = (base: number, w = 0.3, amp = 1.0, p0 = 0.38, pa = 0.2): Idle => (t) => [base + Math.sin(t * w) * amp, p0 + Math.sin(t * w * 2) * pa];
/** Slow sweep along the ground in front. */
const ground = (base: number, w = 0.2, amp = 1.2, p0 = -0.22): Idle => (t) => [base + Math.sin(t * w) * amp, p0 + Math.sin(t * w * 3.1) * 0.06];
/** Full circle round the sky. */
const circle = (w = 0.22, p0 = 0.5, off = 0): Idle => (t) => [t * w + off, p0 + Math.sin(t * 0.6 + off) * 0.14];
/** Stepped search: hold, slew, hold (sector by sector). */
const sector = (base: number, steps = 4, span = 2.2, hold = 2.5, p0 = 0.15): Idle => (t) => {
  const per = hold + 1.2;
  const n = Math.floor(t / per), u = Math.min(1, (t % per) / 1.2);
  const at = (i: number) => base - span / 2 + (span / (steps - 1)) * Math.abs(((i % (2 * steps - 2)) + (2 * steps - 2)) % (2 * steps - 2) - (steps - 1));
  return [at(n) + (at(n + 1) - at(n)) * smooth(u), p0 + Math.sin(t * 0.5) * 0.08];
};

interface ArmOpts { idle: Idle; len?: number; spread?: number; color?: string; rate?: number; turnRate?: number }

/**
 * Register the lamp's combat rig and its light: a soft cone from each lens
 * that sweeps with the idle search, stretches to the target when locked and
 * flares on every lock pulse (the turret's "shot").
 */
function arm(k: Kit, L: Lamp, o: ArmOpts): Turret {
  const tur = k.turret({
    yaw: L.yaw, pitch: L.pitch, muzzles: L.muzzles, weapon: 'light', targets: 'both',
    rate: o.rate ?? 0.5, turnRate: o.turnRate ?? 2.4,
    idle: (t) => {
      const [a, b] = o.idle(t);
      L.yaw.rotation.y = a;
      L.pitch.rotation.z = b;
    },
  });
  let pulse = 0, last = 0, flick = 0;
  tur.onFire.push(() => (pulse = 1));
  const color = o.color ?? (L.style === 'array' ? COOL : WARM);
  const rL = L.style === 'array' ? L.r * 0.9 : L.r * 0.85;
  const beams: THREE.MeshBasicMaterial[] = [];
  const beamMeshes: THREE.Mesh[] = [];
  const halos: THREE.Mesh[] = [];
  for (const m of L.muzzles) {
    const geo = new THREE.CylinderGeometry(rL, rL + (o.spread ?? 0.55), 1, 20, 6, true).rotateZ(Math.PI / 2).translate(0.5, 0, 0);
    const pos = geo.getAttribute('position');
    const cols: number[] = [];
    for (let i = 0; i < pos.count; i++) {
      const f = Math.pow(1 - pos.getX(i), 1.6) * 0.95 + 0.04;
      cols.push(f, f, f);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const bm = new THREE.MeshBasicMaterial({ color, vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const beam = new THREE.Mesh(noMass(geo), bm);
    beam.scale.x = o.len ?? 3;
    beam.renderOrder = 5;
    m.add(beam);
    beams.push(bm);
    beamMeshes.push(beam);
    const hm = new THREE.MeshBasicMaterial({ color: '#fffbe6', transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending });
    const halo = new THREE.Mesh(noMass(new THREE.CircleGeometry(rL * 1.25, 18).rotateY(Math.PI / 2)), hm);
    halo.position.x = 0.005;
    m.add(halo);
    halos.push(halo);
  }
  if (L.laser) L.pitch.add(L.laser);
  const tmp = new THREE.Vector3();
  k.anims.push((t) => {
    const dt = Math.min(0.1, Math.max(0, t - last));
    last = t;
    pulse = Math.max(0, pulse - dt * 2.2);
    const lock = tur.target !== null;
    // Shutters: open when locked; while searching they blink a signal now and then
    let open = 1;
    if (L.shutter) {
      if (lock) open = 1 - Math.max(0, pulse - 0.8) * 4;
      else {
        const p = t % 7;
        open = p < 1.6 ? (Math.floor(p * 5) % 2 ? 0.15 : 1) : 1;
      }
      flick += (open - flick) * Math.min(1, dt * 14 || 1);
      L.shutter(lock ? open : flick);
    }
    const shine = L.shutter ? Math.max(0.1, flick) : 1;
    // Idle beams stay short, narrow and dim so they don't wash over neighbouring buildings;
    // the full bright beam is saved for a lock, which makes the lock read clearly.
    let len = (o.len ?? 3) * 0.6;
    if (lock && L.muzzles[0]) {
      L.muzzles[0].getWorldPosition(tmp);
      len = THREE.MathUtils.clamp(tmp.distanceTo(tur.target!) + 0.15, 0.6, 7);
    }
    L.muzzles.forEach((_, i) => {
      const girth = lock ? 1 : 0.7;
      beamMeshes[i].scale.set(len, girth, girth);
      beams[i].opacity = ((lock ? 0.42 : 0.17) + pulse * 0.45) * shine;
      halos[i].scale.setScalar(1 + pulse * 1.6);
      (halos[i].material as THREE.MeshBasicMaterial).opacity = (0.25 + pulse * 0.7) * shine;
    });
    for (const lm of L.lens) lm.emissiveIntensity = ((lock ? 2.0 : 1.3) + pulse * 4.5) * shine;
    L.ledMats.forEach((lm, i) => (lm.emissiveIntensity = (lock ? 1.8 : 1.0 + Math.sin(t * 3 + i) * 0.25) + pulse * 4));
    if (L.laser) {
      const lmat = L.laser.material as THREE.MeshBasicMaterial;
      lmat.opacity = lock ? 0.35 + pulse * 0.6 : (t % 5 < 0.25 ? 0.4 : 0);
      L.laser.scale.x = lock ? len + 0.1 : 2.5;
    }
  });
  return tur;
}

// ------------------------------------------------------------------ structures

/** Concrete plinth with painted yellow/black edge stripes. */
function stripedPlinth(k: Kit, x: number, z: number, y: number, w: number, d: number, h: number, base: string = CONCRETE) {
  k.box(w, h, d, base, x, y, z);
  const n = Math.max(2, Math.round(w / 0.12));
  for (let i = 0; i < n; i++) {
    const col = i % 2 ? C.kerbB : C.kerbY;
    k.box(w / n, 0.06, 0.01, col, x - w / 2 + (w / n) * (i + 0.5), y + h - 0.08, z + d / 2 + 0.003);
    k.box(0.01, 0.06, d / n, col, x + w / 2 + 0.003, y + h - 0.08, z - d / 2 + (d / n) * (i + 0.5));
    k.box(0.01, 0.06, d / n, col, x - w / 2 - 0.003, y + h - 0.08, z - d / 2 + (d / n) * (i + 0.5));
  }
}

/** Simple cream wall box with green dado and white cornice (smaller than k.block). */
function hut(k: Kit, x: number, z: number, y: number, w: number, d: number, h: number, wall: string = C.wall) {
  k.box(w, h, d, wall, x, y, z);
  k.box(w + 0.02, 0.1, d + 0.02, C.trim, x, y, z);
  k.box(w + 0.04, 0.05, d + 0.04, C.white, x, y + h - 0.05, z);
  return h;
}

/** Slit windows round a cylinder tower. */
function slits(k: Kit, x: number, z: number, y: number, r: number, n: number, h = 0.16, color: string = DARK_GLASS) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.4;
    const s = k.box(0.05, h, 0.04, color, x + Math.cos(a) * r, y, z + Math.sin(a) * r);
    s.rotation.y = -a;
  }
}

/** Glass cab with mullions and a roof slab. */
function glassCab(k: Kit, x: number, z: number, y: number, w: number, d: number, h: number, roof: string = C.roofGreen, mull: string = C.white) {
  const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(GLASS, { roughness: 0.3, metalness: 0.1 }));
  g.position.set(x, y + h / 2, z);
  k.add(g);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.04, h, 0.04, mull, x + sx * (w / 2), y, z + sz * (d / 2));
  for (let i = 1; i < 3; i++) {
    k.box(0.025, h, d + 0.01, mull, x - w / 2 + (w / 3) * i, y, z);
    k.box(w + 0.01, h, 0.025, mull, x, y, z - d / 2 + (d / 3) * i);
  }
  k.box(w + 0.12, 0.06, d + 0.12, roof, x, y + h, z);
  return y + h + 0.06;
}

/** White podium with a green roof edge (command band). */
function podium(k: Kit, x: number, z: number, y: number, w: number, d: number, h: number, wall: string = C.white, edge: string = C.roofGreen) {
  k.box(w, h, d, wall, x, y, z);
  k.box(w + 0.05, 0.05, d + 0.05, edge, x, y + h - 0.05, z);
  return y + h;
}

// ------------------------------------------------------------------ field (1–3)

function lv1(k: Kit, y: number) {
  // Tripod lamp: carbide/arc lamp on a timber tripod, portable generator, operator
  const ax = 0.12, az = -0.08, ay = y + 0.5;
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i * Math.PI * 2) / 3;
    strut(k, V(ax + Math.cos(a) * 0.42, y, az + Math.sin(a) * 0.42), V(ax, ay, az), 0.05, C.wood);
  }
  k.box(0.16, 0.05, 0.16, '#7a5a3b', ax, ay - 0.03, az);
  const L = lamp(k, ax, ay + 0.02, az, { r: 0.21, color: OLIVE, rim: '#3a3f2a', yoke: '#3a3f2a', armH: 0.24 });
  arm(k, L, { idle: eight(-Math.PI / 2, 0.3, 1.1, 0.3, 0.2), len: 2.4, spread: 0.45 });
  generator(k, -0.52, 0.48, y, 0.75, 'field', 0.35);
  cable(k, [[-0.33, y + 0.03, 0.4], [-0.05, y + 0.01, 0.25], [ax - 0.05, y + 0.01, az + 0.33], [ax - 0.02, y + 0.25, az + 0.15], [ax, ay, az + 0.04]]);
  coil(k, -0.55, -0.2, y);
  k.sandbags(-0.15, -0.76, 1.1, 0, y, 2);
  k.sandbags(-0.78, -0.3, 0.6, Math.PI / 2, y, 2);
  jerrycan(k, -0.78, 0.78, y, '#b8382c', 0.2);
  jerrycan(k, -0.64, 0.8, y, OLIVE, -0.1);
  k.box(0.22, 0.16, 0.14, '#7a5a3b', 0.62, y, -0.55);
  postSign(k, 'NO\nSMOKING', -0.85, 0.15, y, Math.PI / 2, '#f4f1e8', '#d8342c');
  operator(k, 0.6, 0.45, y, -Math.PI * 0.75, 1, 'bino');
  k.windsock(0.8, y, -0.82);
}

function lv2(k: Kit, y: number) {
  // Lamp stage: timber platform on stilts with a ladder; generator under a canvas lean-to
  const px = 0.2, pz = -0.15, pw = 0.95, ph = 0.48;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.07, ph, 0.07, '#6b4a30', px + sx * (pw / 2 - 0.05), y, pz + sz * (pw / 2 - 0.05));
  for (const sz of [-1, 1]) {
    strut(k, V(px - pw / 2 + 0.05, y + 0.05, pz + sz * (pw / 2 - 0.05)), V(px + pw / 2 - 0.05, y + ph - 0.05, pz + sz * (pw / 2 - 0.05)), 0.03, '#7a5a3b');
  }
  strut(k, V(px + pw / 2 - 0.05, y + 0.05, pz - pw / 2 + 0.05), V(px + pw / 2 - 0.05, y + ph - 0.05, pz + pw / 2 - 0.05), 0.03, '#7a5a3b');
  const dy = y + ph;
  k.box(pw + 0.06, 0.06, pw + 0.06, '#8a6040', px, dy, pz);
  for (let i = 0; i < 5; i++) k.box(0.01, 0.062, pw + 0.06, '#6b4a30', px - pw / 2 + (pw / 5) * (i + 0.5), dy, pz);
  railing(k, px, pz, dy + 0.06, pw, pw, '#6b4a30', 0.22, 'front');
  ladder(k, px, pz + pw / 2 + 0.12, y, ph + 0.28, 0, '#6b4a30', -0.25);
  const L = lamp(k, px + 0.08, dy + 0.08, pz - 0.08, { r: 0.24, color: OLIVE, rim: '#3a3f2a', yoke: '#3a3f2a', armH: 0.26 });
  k.box(0.26, 0.04, 0.26, '#3a3f2a', px + 0.08, dy + 0.04, pz - 0.08);
  arm(k, L, { idle: ground(-Math.PI / 2, 0.2, 1.3, -0.18), len: 2.6, spread: 0.5 });
  operator(k, px - 0.25, pz + 0.18, dy + 0.06, -Math.PI / 4, 2, 'crank');
  // Canvas lean-to over the generator
  const gx = -0.55, gz = 0.5;
  for (const sx of [-0.33, 0.33]) k.box(0.04, 0.58, 0.04, C.wood, gx + sx, y, gz + 0.32);
  const tarp = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.72), mat('#9a8c62'));
  tarp.geometry.translate(0, 0, -0.36);
  tarp.position.set(gx, y + 0.6, gz + 0.34);
  tarp.rotation.x = -0.45;
  k.add(tarp);
  k.anims.push((t) => (tarp.rotation.x = -0.45 + Math.sin(t * 2.2) * 0.04 + Math.sin(t * 5.3) * 0.015));
  for (const sx of [-0.36, 0.36]) strut(k, V(gx + sx, y + 0.6, gz + 0.34), V(gx + sx * 1.3, y, gz + 0.72), 0.01, '#d8d0b8');
  generator(k, gx, gz + 0.05, y, 0.85, 'field', 0);
  cable(k, [[gx + 0.25, y + 0.02, gz], [px - pw / 2 + 0.05, y + 0.02, gz - 0.25], [px - pw / 2 + 0.05, dy, pz + pw / 2 - 0.1]]);
  k.drum(-0.75, -0.6, '#3f7d4a', y);
  k.drum(-0.52, -0.72, '#2f6fa8', y);
  jerrycan(k, -0.85, -0.2, y, '#b8382c', 1.2);
  lantern(k, px + pw / 2, dy + 0.28, pz + pw / 2, 1);
  postSign(k, 'DANGER\nBRIGHT LIGHT', 0.75, 0.75, y, -0.3);
  k.crates(0.72, 0.5, y, 2);
}

function lv3(k: Kit, y: number) {
  // Lamp truck: olive 3-tonner with the searchlight on its bed, generator trailer alongside
  const tz = 0.2, wy = y;
  const truck = new THREE.Group();
  k.add(truck);
  const wheels: [number, number][] = [];
  for (const sx of [0.52, -0.28, -0.56]) for (const sz of [-0.3, 0.3]) wheels.push([sx, sz]);
  for (const [sx, sz] of wheels) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.1, 10).rotateX(Math.PI / 2), mat('#2a2b2d'));
    w.position.set(sx, wy + 0.13, tz + sz);
    k.add(w);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.11, 6).rotateX(Math.PI / 2), mat('#c9ced2'));
    hub.position.copy(w.position);
    k.add(hub);
  }
  k.box(1.6, 0.08, 0.5, '#3f4a2a', -0.05, wy + 0.16, tz);
  // Cab (shakes gently with the idling engine)
  const cab = new THREE.Group();
  cab.position.set(0.56, wy + 0.22, tz);
  k.add(cab);
  k.box(0.42, 0.42, 0.6, OLIVE, 0, 0, 0, cab);
  k.box(0.03, 0.2, 0.52, DARK_GLASS, 0.215, 0.2, 0, cab);
  k.box(0.3, 0.03, 0.58, OLIVE_D, -0.04, 0.42, 0, cab);
  k.box(0.32, 0.08, 0.5, '#7d7250', -0.05, 0.45, 0, cab); // rolled camo net
  for (const sz of [-0.2, 0.2]) k.box(0.02, 0.06, 0.08, '#fff2c0', 0.215, 0.06, sz, cab);
  k.box(0.04, 0.1, 0.6, '#33383d', 0.22, -0.04, 0, cab);
  k.anims.push((t) => (cab.position.y = wy + 0.22 + Math.abs(Math.sin(t * 31)) * 0.004));
  k.cyl(0.02, 0.5, '#2a2b2d', 0.32, wy + 0.2, tz - 0.32, 6);
  k.emitters.push({ pos: V(0.32, wy + 0.75, tz - 0.32), kind: 'smoke' });
  // Flatbed with drop sides and a raised lamp mount
  const bedY = wy + 0.24;
  k.box(1.08, 0.08, 0.62, '#4b5a3a', -0.27, bedY, tz);
  for (const sz of [-1, 1]) k.box(1.08, 0.1, 0.03, OLIVE, -0.27, bedY + 0.08, tz + sz * 0.3);
  k.box(0.03, 0.1, 0.62, OLIVE, -0.8, bedY + 0.08, tz);
  k.box(0.36, 0.28, 0.36, OLIVE_D, -0.4, bedY + 0.08, tz);
  for (let i = 0; i < 2; i++) jerrycan(k, -0.05 + i * 0.12, tz - 0.22, bedY + 0.08, i ? OLIVE : '#b8382c');
  const L = lamp(k, -0.4, bedY + 0.36, tz, { r: 0.27, color: OLIVE, rim: '#3a3f2a', yoke: '#3a3f2a', armH: 0.29 });
  arm(k, L, { idle: eight(-Math.PI / 2, 0.26, 1.2, 0.4, 0.22), len: 2.8 });
  operator(k, 0.02, tz + 0.12, bedY + 0.08, Math.PI, 3, 'bino');
  // Wheel chocks
  for (const sx of [0.52, -0.56]) k.box(0.1, 0.06, 0.05, HAZ, sx + 0.16, y, tz + 0.38);
  // Generator trailer
  const gz = -0.62, gx = -0.25;
  for (const sz of [-0.24, 0.24]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 10).rotateX(Math.PI / 2), mat('#2a2b2d'));
    w.position.set(gx, y + 0.1, gz + sz);
    k.add(w);
  }
  k.box(0.7, 0.05, 0.42, '#3f4a2a', gx, y + 0.16, gz);
  strut(k, V(gx + 0.35, y + 0.18, gz - 0.12), V(gx + 0.68, y + 0.08, gz), 0.03, '#3f4a2a');
  strut(k, V(gx + 0.35, y + 0.18, gz + 0.12), V(gx + 0.68, y + 0.08, gz), 0.03, '#3f4a2a');
  k.box(0.05, 0.08, 0.05, C.dark, gx + 0.68, y, gz);
  generator(k, gx - 0.02, gz, y + 0.21, 0.85, 'field', 0);
  cable(k, [[gx - 0.3, y + 0.25, gz + 0.12], [-0.62, y + 0.02, -0.1], [-0.7, bedY + 0.1, tz - 0.2]]);
  reel(k, 0.62, -0.62, y, 0.13, 0.4);
  postSign(k, 'DANGER\nBRIGHT LIGHT', -0.85, 0.75, y, 0.5);
  k.crates(0.55, 0.78, y, 3);
  // Tarp-covered stores and a battery box by the tailgate
  k.box(0.5, 0.24, 0.24, '#7d7250', -0.3, y, 0.8);
  k.box(0.52, 0.03, 0.26, '#6b6142', -0.3, y + 0.24, 0.8);
  k.box(0.22, 0.24, 0.2, '#3a3f2a', 0.12, y, 0.8);
  k.drum(-0.82, -0.25, '#3f7d4a', y);
  k.drum(-0.82, 0.0, '#2f6fa8', y);
  k.box(0.3, 0.26, 0.2, OLIVE_D, 0.75, y, -0.25);
  k.box(0.32, 0.03, 0.22, '#3a3f2a', 0.75, y + 0.26, -0.25);
}

// ------------------------------------------------------------------ camp (4–6)

function lv4(k: Kit, y: number) {
  // Lamp pillar: first permanent post. Cream pillar on a striped plinth; crew hut with a red hip roof
  const hx = -0.42, hz = -0.45, hw = 0.9, hd = 0.75, hh = 0.68;
  hut(k, hx, hz, y, hw, hd, hh);
  k.hipRoof(hw, hd, 0.3, hx, y + hh, hz, C.roof, 0.12);
  k.door('front', hx, hz, hw, hd, -0.2, y, 0.26, 0.5);
  k.window('front', hx, hz, hw, hd, 0.2, y + 0.3, 0.24, 0.22, true);
  fan(k, hx - hw / 2 - 0.02, y + 0.5, hz + 0.05, 0.08, -Math.PI / 2, 9);
  sign(k, 'DANGER', hx + hw / 2 + 0.012, y + 0.36, hz, 0.24, Math.PI / 2);
  // The lamp pillar
  const lx = 0.4, lz = 0.32;
  stripedPlinth(k, lx, lz, y, 0.62, 0.62, 0.14);
  k.cyl(0.18, 0.62, C.wall, lx, y + 0.14, lz, 12);
  k.cyl(0.19, 0.08, C.trim, lx, y + 0.14, lz, 12);
  k.cyl(0.19, 0.04, C.trim, lx, y + 0.5, lz, 12);
  k.cyl(0.24, 0.06, C.white, lx, y + 0.76, lz, 12);
  ladder(k, lx - 0.2, lz + 0.06, y + 0.14, 0.62, Math.PI / 2, C.trim);
  const L = lamp(k, lx, y + 0.82, lz, { r: 0.3, color: C.trim, rim: C.dark, armH: 0.32 });
  arm(k, L, { idle: eight(-Math.PI / 2, 0.28, 1.2, 0.36, 0.22), len: 3 });
  generator(k, -0.45, 0.5, y, 0.9, 'camp', 0);
  k.box(0.65, 0.04, 0.42, CONCRETE, -0.45, y, 0.5);
  cable(k, [[-0.2, y + 0.03, 0.5], [lx - 0.3, y + 0.03, lz + 0.1]], C.dark);
  reel(k, 0.62, -0.62, y, 0.14, 0.2, '#c9822b');
  k.drum(0.85, -0.2, '#2f6fa8', y);
  k.bin(0.05, -0.8, y);
  operator(k, 0.78, -0.05, y, -Math.PI * 0.6, 4, 'bino');
}

function lv5(k: Kit, y: number) {
  // Roof-deck lamp: flat-roofed cream lamp house with railings and a stair; generator lean-to
  const hx = 0.15, hz = -0.25, hw = 1.3, hd = 1.0, hh = 0.78;
  hut(k, hx, hz, y, hw, hd, hh);
  const ry = y + hh;
  k.flatRoof(hw, hd, hx, ry, hz, 0.06);
  railing(k, hx, hz, ry + 0.06, hw, hd, C.trim, 0.22, 'left');
  k.door('front', hx, hz, hw, hd, 0.35, y, 0.28, 0.52);
  k.windowRow('front', hx, hz, hw, hd, 2, y + 0.32, { ww: 0.26, wh: 0.22, louvre: true, skip: [1], span: 0.7 });
  k.window('right', hx, hz, hw, hd, 0, y + 0.32, 0.28, 0.22, true);
  k.aircon(hx + hw / 2 + 0.08, y + 0.15, hz - 0.2, Math.PI / 2);
  // External steel stair up the left side
  const sx = hx - hw / 2 - 0.13;
  const steps = 7;
  for (let i = 0; i < steps; i++) k.box(0.2, 0.025, 0.11, C.metal, sx, y + (hh / steps) * (i + 1) - 0.02, hz + hd / 2 - 0.06 - i * 0.12);
  strut(k, V(sx - 0.1, y, hz + hd / 2), V(sx - 0.1, ry + 0.05, hz + hd / 2 - steps * 0.12), 0.03, C.trim);
  strut(k, V(sx - 0.1, y + 0.3, hz + hd / 2), V(sx - 0.1, ry + 0.33, hz + hd / 2 - steps * 0.12), 0.02, C.trim);
  // Lamp on the roof
  const lx = hx + 0.2, lz = hz - 0.05;
  k.box(0.34, 0.1, 0.34, C.trim, lx, ry + 0.06, lz);
  const L = lamp(k, lx, ry + 0.16, lz, { r: 0.32, color: C.trim, rim: C.dark, armH: 0.34 });
  arm(k, L, { idle: sector(-Math.PI / 2, 4, 2.4, 2.2, 0.2), len: 3.1 });
  operator(k, hx - 0.38, hz - 0.15, ry + 0.06, -Math.PI / 4, 5, 'point');
  beacon(k, hx + hw / 2 - 0.08, ry + 0.06, hz - hd / 2 + 0.08);
  // Generator lean-to with a red-brown mono-pitch roof
  const gx = -0.55, gz = 0.62;
  for (const px of [-0.3, 0.3]) k.box(0.04, 0.48, 0.04, C.trim, gx + px, y, gz + 0.2);
  const roof = k.box(0.78, 0.04, 0.5, C.roof, gx, y + 0.5, gz);
  roof.rotation.x = 0.18;
  generator(k, gx, gz, y, 0.85, 'camp', 0);
  cable(k, [[gx + 0.22, y + 0.03, gz - 0.05], [hx - 0.2, y + 0.03, hz + hd / 2 + 0.02], [hx - 0.2, ry, hz + hd / 2 + 0.02]], C.dark);
  sign(k, 'DANGER\nBRIGHT LIGHT', hx - 0.2, y + 0.42, hz + hd / 2 + 0.012, 0.28);
  k.drum(0.75, 0.62, '#3f7d4a', y);
  jerrycan(k, 0.55, 0.72, y, '#b8382c');
  k.planter(0.3, 0.75, 0.32, y);
}

function lv6(k: Kit, y: number) {
  // Lamp tower: two-level cream tower with a railed lamp platform; open generator shed
  const tx = 0.22, tz = -0.18, tw = 0.8, th = 1.15;
  hut(k, tx, tz, y, tw, tw, th);
  k.box(tw + 0.04, 0.06, tw + 0.04, C.trim, tx, y + 0.56, tz);
  k.door('front', tx, tz, tw, tw, 0, y, 0.28, 0.5);
  k.window('front', tx, tz, tw, tw, 0, y + 0.82, 0.26, 0.2, true);
  k.window('right', tx, tz, tw, tw, 0, y + 0.82, 0.26, 0.2, true);
  k.window('right', tx, tz, tw, tw, 0, y + 0.3, 0.26, 0.2, true);
  fan(k, tx + tw / 2 + 0.02, y + 1.0, tz - 0.25, 0.07, Math.PI / 2, 9);
  const py = y + th;
  k.box(1.06, 0.08, 1.06, C.white, tx, py, tz);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const col = i % 2 ? C.kerbB : C.kerbY;
    k.box(1.06 / n, 0.04, 0.012, col, tx - 0.53 + (1.06 / n) * (i + 0.5), py + 0.02, tz + 0.534);
    k.box(0.012, 0.04, 1.06 / n, col, tx + 0.534, py + 0.02, tz - 0.53 + (1.06 / n) * (i + 0.5));
  }
  railing(k, tx, tz, py + 0.08, 1.04, 1.04, C.trim, 0.24);
  ladder(k, tx - tw / 2 - 0.05, tz + 0.1, y, th + 0.3, -Math.PI / 2, C.trim);
  const L = lamp(k, tx + 0.05, py + 0.12, tz, { r: 0.34, color: C.trim, rim: C.dark, armH: 0.36 });
  k.box(0.36, 0.04, 0.36, C.dark, tx + 0.05, py + 0.08, tz);
  arm(k, L, { idle: circle(0.2, 0.42), len: 3.3 });
  operator(k, tx - 0.32, tz + 0.3, py + 0.08, -Math.PI / 3, 6, 'bino');
  k.cyl(0.015, 0.45, C.metal, tx + 0.48, py + 0.08, tz - 0.48, 5);
  k.blinker(tx + 0.48, py + 0.53, tz - 0.48, '#ff3b30', 0.03);
  pennant(k, tx - 0.48, tz - 0.48, py + 0.08, 0.55, C.trim);
  // Open-fronted generator shed with a red-brown hip roof
  const gx = -0.52, gz = 0.5, gw = 0.72, gd = 0.62, gh = 0.5;
  k.box(gw, gh, 0.06, C.wall, gx, y, gz - gd / 2);
  for (const s of [-1, 1]) k.box(0.06, gh, gd, C.wall, gx + s * (gw / 2 - 0.03), y, gz);
  k.box(gw + 0.02, 0.08, gd + 0.02, C.trim, gx, y, gz);
  k.hipRoof(gw, gd, 0.24, gx, y + gh, gz, C.roof, 0.1);
  generator(k, gx, gz + 0.02, y + 0.02, 0.85, 'camp', 0);
  k.cyl(0.02, 0.2, '#2a2b2d', gx - 0.2, y + gh + 0.14, gz - 0.12, 6);
  k.emitters.push({ pos: V(gx - 0.2, y + gh + 0.38, gz - 0.12), kind: 'smoke' });
  cable(k, [[gx + gw / 2, y + 0.03, gz], [tx - tw / 2 - 0.01, y + 0.03, tz + 0.3], [tx - tw / 2 - 0.01, py, tz + 0.3]], C.dark);
  sign(k, 'DANGER\nHIGH VOLTAGE', gx - gw / 2 - 0.012, y + 0.18, gz, 0.26, -Math.PI / 2);
  reel(k, 0.75, 0.6, y, 0.12, -0.3);
  k.drum(0.45, 0.7, '#2f6fa8', y);
}

// ------------------------------------------------------------------ base (7–10)

function lv7(k: Kit, y: number) {
  // Concrete light tower: round tower with a gallery ring; generator bay with roller shutter
  const tx = 0.18, tz = -0.18, r = 0.4, th = 1.32;
  k.cyl(r + 0.1, 0.22, CONCRETE, tx, y, tz, 16, r);
  k.cyl(r, th, CONCRETE, tx, y + 0.2, tz, 16, r * 0.9);
  k.cyl(r + 0.01, 0.06, C.trim, tx, y + 0.2, tz, 16);
  k.cyl(r * 0.92, 0.05, C.trim, tx, y + 0.9, tz, 16);
  slits(k, tx, tz, y + 0.55, r - 0.02, 4);
  slits(k, tx, tz, y + 1.12, r * 0.9 - 0.02, 5);
  k.door('front', tx, tz, r * 2, r * 1.8, 0, y + 0.1, 0.24, 0.42);
  const gy = y + 0.2 + th;
  k.cyl(0.66, 0.08, CONCRETE, tx, gy, tz, 16);
  k.cyl(0.67, 0.03, HAZ, tx, gy + 0.05, tz, 16);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const b = strut(k, V(tx + Math.cos(a) * r * 0.85, gy - 0.25, tz + Math.sin(a) * r * 0.85), V(tx + Math.cos(a) * 0.6, gy, tz + Math.sin(a) * 0.6), 0.04, CONCRETE);
    void b;
  }
  ringRail(k, tx, tz, gy + 0.08, 0.62, C.trim, 0.22);
  // Conduit up the tower and a caged ladder
  k.box(0.05, th + 0.2, 0.05, '#c9822b', tx + r * 0.65, y, tz + r * 0.72);
  ladder(k, tx - r - 0.04, tz, y + 0.2, th, -Math.PI / 2, C.metal);
  k.box(0.38, 0.12, 0.38, STEEL, tx, gy + 0.08, tz);
  const L = lamp(k, tx, gy + 0.2, tz, { r: 0.38, color: STEEL, rim: '#2f3438', armH: 0.4 });
  arm(k, L, { idle: eight(-Math.PI / 2, 0.24, 1.3, 0.42, 0.24), len: 3.5 });
  operator(k, tx - 0.4, tz + 0.35, gy + 0.08, -Math.PI / 4, 7, 'tablet');
  // Generator bay
  const bx = -0.5, bz = 0.52, bw = 0.84, bd = 0.66, bh = 0.52;
  k.box(bw, bh, bd, CONCRETE, bx, y, bz);
  k.box(bw + 0.04, 0.05, bd + 0.04, C.trim, bx, y + bh, bz);
  k.box(0.6, 0.42, 0.04, '#2a2b2d', bx, y, bz + bd / 2 - 0.01);
  k.box(0.62, 0.12, 0.06, '#a7adb1', bx, y + 0.34, bz + bd / 2);
  for (let i = 0; i < 2; i++) k.box(0.62, 0.012, 0.065, '#8f969b', bx, y + 0.37 + i * 0.04, bz + bd / 2);
  generator(k, bx, bz + 0.12, y, 0.75, 'base', 0);
  for (const sx of [-0.25, 0.25]) {
    k.cyl(0.03, 0.3, '#3a3f44', bx + sx, y + bh, bz - 0.15, 6);
    k.emitters.push({ pos: V(bx + sx, y + bh + 0.34, bz - 0.15), kind: 'smoke' });
  }
  roofFan(k, bx, y + bh + 0.05, bz + 0.1, 0.11);
  sign(k, 'DANGER\nHIGH VOLTAGE', bx + bw / 2 + 0.012, y + 0.2, bz, 0.26, Math.PI / 2);
  cable(k, [[bx + bw / 2, y + 0.4, bz - 0.2], [tx - 0.1, y + 0.4, tz + r + 0.02]], C.dark, 0.03);
  k.cyl(0.015, 0.4, C.metal, tx + 0.55, gy + 0.08, tz - 0.3, 5);
  k.blinker(tx + 0.55, gy + 0.48, tz - 0.3, '#ff3b30', 0.03);
  k.drum(0.78, 0.55, '#2f6fa8', y);
  k.drum(0.62, 0.75, '#3f7d4a', y);
}

function lv8(k: Kit, y: number) {
  // Twin-lamp tower: square concrete tower with green bands, main lamp on top and a second on a cantilevered balcony
  const tx = 0.1, tz = -0.22, tw = 0.82, th = 1.58;
  k.box(tw, th, tw, CONCRETE, tx, y, tz);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.1, th, 0.1, '#c9c4b9', tx + sx * (tw / 2 - 0.03), y, tz + sz * (tw / 2 - 0.03));
  for (const hy of [0.05, 0.75, th - 0.06]) k.box(tw + 0.04, 0.06, tw + 0.04, C.trim, tx, y + hy, tz);
  k.door('front', tx, tz, tw, tw, 0, y + 0.1, 0.26, 0.48);
  for (const hy of [0.45, 1.15]) k.box(0.32, 0.12, 0.02, DARK_GLASS, tx, y + hy, tz + tw / 2 + 0.01);
  k.box(0.02, 0.12, 0.32, DARK_GLASS, tx + tw / 2 + 0.01, y + 1.15, tz);
  const ty = y + th;
  k.box(tw + 0.12, 0.08, tw + 0.12, CONCRETE, tx, ty, tz);
  railing(k, tx, tz, ty + 0.08, tw + 0.08, tw + 0.08, C.trim, 0.2);
  k.box(0.4, 0.1, 0.4, STEEL, tx, ty + 0.08, tz);
  const L = lamp(k, tx, ty + 0.18, tz, { r: 0.4, color: STEEL, rim: '#2f3438', armH: 0.42 });
  arm(k, L, { idle: eight(-Math.PI / 2, 0.24, 1.2, 0.36, 0.22), len: 3.6 });
  // Cantilevered steel balcony on the right with a second lamp
  const bx = tx + tw / 2 + 0.22, by = y + 0.9;
  k.box(0.46, 0.06, 0.6, '#8a9196', bx, by, tz);
  for (const s of [-0.22, 0.22]) strut(k, V(tx + tw / 2, by - 0.35, tz + s), V(bx + 0.2, by, tz + s), 0.04, C.trim);
  railing(k, bx + 0.02, tz, by + 0.06, 0.42, 0.58, C.trim, 0.18);
  const L2 = lamp(k, bx + 0.02, by + 0.06, tz, { r: 0.22, color: C.trim, rim: C.dark, armH: 0.26 });
  arm(k, L2, { idle: circle(0.3, 0.6, 1), len: 2.8 });
  operator(k, tx - 0.25, tz + 0.25, ty + 0.08, -Math.PI / 4, 8, 'bino');
  // Generator house with a radiator wall of twin fans
  const gx = -0.48, gz = 0.55, gw = 0.9, gd = 0.62, gh = 0.48;
  k.box(gw, gh, gd, CONCRETE, gx, y, gz);
  k.box(gw + 0.04, 0.05, gd + 0.04, C.trim, gx, y + gh, gz);
  fan(k, gx - 0.2, y + 0.38, gz + gd / 2 + 0.01, 0.1, 0, 12);
  fan(k, gx + 0.15, y + 0.38, gz + gd / 2 + 0.01, 0.1, 0, 11);
  generator(k, gx, gz, y + gh + 0.05, 0.7, 'base', 0);
  k.box(0.6, 0.05, 0.36, '#bdb8ad', gx, y + gh, gz);
  cable(k, [[gx + gw / 2, y + 0.3, gz - 0.1], [tx - 0.1, y + 0.3, tz + tw / 2 + 0.01]], C.dark, 0.03);
  sign(k, 'DANGER\nHIGH VOLTAGE', gx - gw / 2 - 0.012, y + 0.2, gz, 0.26, -Math.PI / 2);
  k.blinker(tx + tw / 2 + 0.02, ty + 0.08, tz - tw / 2 - 0.02, '#ff3b30', 0.03);
  reel(k, 0.7, 0.62, y, 0.13, -0.5, '#c9822b');
  // Day tank: horizontal diesel tank on cradles
  for (const dz of [-0.2, 0.2]) k.box(0.36, 0.14, 0.06, CONCRETE, -0.62, y, -0.55 + dz);
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.62, 12).rotateX(Math.PI / 2), mat('#e8e6e0'));
  tank.position.set(-0.62, y + 0.27, -0.55);
  k.add(tank);
  k.box(0.36, 0.03, 0.04, C.kerbY, -0.62, y + 0.43, -0.55);
  k.box(0.05, 0.12, 0.05, C.dark, -0.62, y + 0.43, -0.75);
}

function lv9(k: Kit, y: number) {
  // Lamp bastion: octagonal concrete bastion with two terrace lamps round a central lamp tower
  const R = 0.84, bh = 0.5;
  k.cyl(R, bh, CONCRETE, 0, y, 0, 8, R - 0.04);
  k.cyl(R + 0.01, 0.07, C.trim, 0, y, 0, 8);
  const ty = y + bh;
  k.cyl(R - 0.02, 0.05, '#bdb8ad', 0, ty, 0, 8);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const p = k.box(0.62, 0.1, 0.06, CONCRETE, Math.cos(a) * (R - 0.08), ty, Math.sin(a) * (R - 0.08));
    p.rotation.y = -a + Math.PI / 2;
  }
  // Vent louvres with fans in the bastion face
  fan(k, -0.42, y + 0.36, 0.73, 0.08, 0.35, 12);
  fan(k, 0.42, y + 0.36, 0.73, 0.08, -0.35, 11);
  // Front steps up to the terrace
  for (let i = 0; i < 4; i++) k.box(0.36, (i + 1) * 0.12, 0.1, '#c2bcae', 0, y, 0.97 - i * 0.1);
  // Central round tower
  const tr = 0.34, th = 1.18;
  k.cyl(tr, th, CONCRETE, 0, ty + 0.05, -0.05, 16, tr * 0.92);
  k.cyl(tr + 0.01, 0.05, C.trim, 0, ty + 0.05, -0.05, 16);
  slits(k, 0, -0.05, ty + 0.6, tr - 0.02, 4);
  const gy = ty + 0.05 + th;
  k.cyl(0.54, 0.08, CONCRETE, 0, gy, -0.05, 16);
  k.cyl(0.55, 0.03, C.trim, 0, gy + 0.05, -0.05, 16);
  ringRail(k, 0, -0.05, gy + 0.08, 0.5, C.trim, 0.2);
  ladder(k, -tr - 0.03, -0.05, ty + 0.05, th, -Math.PI / 2, C.metal);
  k.box(0.38, 0.1, 0.38, STEEL, 0, gy + 0.08, -0.05);
  const L = lamp(k, 0, gy + 0.18, -0.05, { r: 0.42, color: STEEL, rim: '#2f3438', armH: 0.44 });
  arm(k, L, { idle: eight(-Math.PI / 2, 0.22, 1.2, 0.4, 0.22), len: 3.8 });
  // Terrace lamps (left and right)
  const side: [number, number, Idle][] = [[-0.55, 0.28, ground(-Math.PI * 0.75, 0.25, 0.9)], [0.55, 0.28, circle(0.28, 0.65, 2)]];
  for (const [sx, sz, idle] of side) {
    k.cyl(0.13, 0.16, STEEL, sx, ty + 0.05, sz, 10);
    const Ls = lamp(k, sx, ty + 0.21, sz, { r: 0.2, color: C.trim, rim: C.dark, armH: 0.24 });
    arm(k, Ls, { idle, len: 2.6 });
  }
  generator(k, -0.4, -0.5, ty + 0.05, 0.62, 'base', 0.8);
  k.cyl(0.03, 0.32, '#3a3f44', 0.45, ty + 0.05, -0.5, 6);
  k.emitters.push({ pos: V(0.45, ty + 0.42, -0.5), kind: 'smoke' });
  patrol(k, ty + 0.05, -0.25, 0.42, 0.25, 0.42, 8, 9);
  sign(k, 'DANGER\nBRIGHT LIGHT', 0.24, y + 0.18, 0.79, 0.26, -0.39);
  k.blinker(0.4, gy + 0.08, -0.4, '#ff3b30', 0.03);
}

function lv10(k: Kit, y: number) {
  // Grand searchlight: stepped concrete keep on a podium, glazed cab under a giant drum, outrigger lamps, flags
  const py = y + 0.3;
  k.box(1.78, 0.3, 1.78, CONCRETE, 0, y, 0);
  k.box(1.8, 0.06, 1.8, C.trim, 0, py - 0.06, 0);
  // Keep: two stepped blocks
  const kx = 0, kz = -0.2;
  k.box(0.96, 0.62, 0.96, CONCRETE, kx, py, kz);
  k.box(1.0, 0.06, 1.0, C.trim, kx, py + 0.6, kz);
  k.box(0.76, 0.62, 0.76, CONCRETE, kx, py + 0.66, kz);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.1, 1.28, 0.1, '#c9c4b9', kx + sx * 0.44, py, kz + sz * 0.44);
  k.door('front', kx, kz, 0.96, 0.96, 0, py, 0.28, 0.5);
  k.box(0.4, 0.14, 0.02, DARK_GLASS, kx, py + 0.9, kz + 0.39);
  // Glazed operator cab
  const cy = glassCab(k, kx, kz, py + 1.28, 0.82, 0.82, 0.3, C.trim, C.trim);
  const L = lamp(k, kx, cy, kz, { r: 0.5, color: STEEL, rim: C.trim, armH: 0.5 });
  arm(k, L, { idle: eight(-Math.PI / 2, 0.2, 1.3, 0.4, 0.22), len: 4.2, spread: 0.7 });
  // Outrigger lamps on steel arms either side of the keep
  for (const s of [-1, 1]) {
    const ox = kx + s * 0.68, oy = py + 0.62;
    strut(k, V(kx + s * 0.38, oy + 0.3, kz), V(ox, oy, kz), 0.05, C.trim);
    k.box(0.36, 0.06, 0.36, '#8a9196', ox, oy - 0.06, kz);
    const Ls = lamp(k, ox, oy, kz, { r: 0.2, color: C.trim, rim: C.dark, armH: 0.24, rotY: s < 0 ? Math.PI : 0 });
    arm(k, Ls, { idle: s < 0 ? ground(-Math.PI * 0.8, 0.22, 0.8) : circle(0.26, 0.6, 1.5), len: 2.8 });
  }
  // Twin generators on the podium front corners
  generator(k, -0.58, 0.55, py, 0.62, 'base', 0);
  generator(k, 0.58, 0.55, py, 0.62, 'base', Math.PI);
  operator(k, -0.2, 0.55, py, -Math.PI / 2, 10, 'point');
  k.flagpole(-0.78, 0.78, 1.7, py);
  k.flagpole(0.78, 0.78, 1.7, py);
  k.blinker(kx + 0.4, cy, kz - 0.4, '#ff3b30', 0.035);
  k.blinker(kx - 0.4, cy, kz - 0.4, '#ff3b30', 0.035);
  sign(k, 'DANGER\nBRIGHT LIGHT', 0.3, py + 0.15, kz + 0.49, 0.26);
}

// ------------------------------------------------------------------ command (11–15)

function lv11(k: Kit, y: number) {
  // LED mast: white finned tower with a glass cab, drum with LED-array wings, teal accents
  const py = podium(k, 0, 0.1, y, 1.6, 1.4, 0.3);
  const tx = 0, tz = -0.15, tw = 0.66, th = 1.5;
  k.box(tw, th, tw, C.white, tx, py, tz);
  for (let i = 0; i < 5; i++) k.box(0.04, th - 0.1, 0.1, '#e8e6e0', tx - tw / 2 + 0.08 + i * 0.125, py + 0.05, tz + tw / 2 + 0.04);
  k.box(tw + 0.02, 0.05, tw + 0.02, TEAL, tx, py + 0.7, tz);
  k.box(0.04, th - 0.2, 0.3, DARK_GLASS, tx + tw / 2 + 0.01, py + 0.1, tz);
  const cy = glassCab(k, tx, tz, py + th, 0.9, 0.86, 0.32, C.roofGreen);
  k.box(0.92, 0.03, 0.88, TEAL, tx, cy - 0.06, tz);
  const L = lamp(k, tx, cy, tz, { r: 0.4, color: C.white, rim: TEAL, yoke: '#d8dcdf', armH: 0.42, wings: true });
  arm(k, L, { idle: eight(-Math.PI / 2, 0.24, 1.2, 0.36, 0.24), len: 4, color: '#f4fbff', spread: 0.8 });
  generator(k, 0.5, 0.55, py, 0.62, 'modern', Math.PI);
  roofFan(k, -0.55, py, 0.5, 0.12);
  roofFan(k, -0.55, py, 0.2, 0.12);
  operator(k, -0.1, 0.5, py, -Math.PI / 2, 11, 'tablet', '#4b6b3a');
  k.door('front', 0, 0.1, 1.6, 1.4, 0.45, y, 0.3, 0.2, DARK_GLASS);
  k.box(1.1, 0.12, 0.02, DARK_GLASS, -0.15, y + 0.1, 0.81);
  k.box(1.62, 0.03, 1.42, TEAL, 0, py - 0.08, 0.1);
  k.blinker(tx + 0.38, cy, tz - 0.38, '#ff3b30', 0.03);
}

function lv12(k: Kit, y: number) {
  // Light gantry: twin white pylons bridged by a gantry; a drum on top and LED arrays slung beneath
  const gz = -0.15;
  const base = podium(k, 0, 0, y, 1.82, 1.82, 0.24, '#e8e6e0');
  k.box(1.84, 0.03, 1.84, TEAL, 0, base - 0.1, 0);
  const py = podium(k, 0, gz, base, 1.0, 0.62, 0.3);
  glassCab(k, 0, gz, py, 0.8, 0.5, 0.3, C.roofGreen);
  const ph = 2.0;
  for (const s of [-1, 1]) {
    const px = s * 0.68;
    k.box(0.3, ph, 0.34, C.white, px, y, gz);
    k.box(0.32, 0.05, 0.36, TEAL, px, y + 0.5, gz);
    k.box(0.32, 0.05, 0.36, TEAL, px, y + 1.3, gz);
    k.box(0.02, ph - 0.4, 0.12, DARK_GLASS, px + s * 0.16, y + 0.2, gz);
    ladder(k, px, gz - 0.19, y, ph, Math.PI, C.metal);
  }
  const by = y + ph;
  k.box(1.7, 0.18, 0.3, C.white, 0, by, gz);
  k.box(1.72, 0.04, 0.32, TEAL, 0, by + 0.14, gz);
  railing(k, 0, gz, by + 0.18, 1.66, 0.28, '#c9ced2', 0.14);
  k.box(0.42, 0.08, 0.42, '#d8dcdf', 0, by + 0.18, gz);
  const L = lamp(k, 0, by + 0.26, gz, { r: 0.38, color: C.white, rim: TEAL, yoke: '#d8dcdf', armH: 0.4 });
  arm(k, L, { idle: eight(-Math.PI / 2, 0.22, 1.2, 0.42, 0.22), len: 4, color: '#f4fbff' });
  for (const s of [-1, 1]) {
    const Lh = lamp(k, s * 0.32, by - 0.02, gz + 0.06, { r: 0.13, color: C.white, rim: GUN, yoke: '#c9ced2', style: 'array', armH: 0.22, hang: true });
    arm(k, Lh, { idle: ground(-Math.PI / 2 + s * 0.5, 0.26, 0.9, -0.35), len: 2.6 });
  }
  generator(k, -0.52, 0.6, base, 0.7, 'modern', 0);
  roofFan(k, 0.55, base, 0.62, 0.13);
  operator(k, 0.2, 0.45, base, -Math.PI / 2, 12, 'point', '#4b6b3a');
  cable(k, [[-0.3, base + 0.03, 0.6], [-0.53, base + 0.03, gz + 0.18]], C.dark, 0.03);
  k.blinker(-0.68, by + 0.18, gz - 0.1, '#ff3b30', 0.03);
  k.blinker(0.68, by + 0.18, gz - 0.1, '#ff3b30', 0.03);
  sign(k, 'CAUTION\nBRIGHT LIGHT', 0.65, base + 0.3, gz + 0.18, 0.26);
}

function lv13(k: Kit, y: number) {
  // Array pavilion: glass pavilion with a roof garden; a slim column carries a giant LED array
  const pw = 1.56, pd = 1.3, ph = 0.62, px = 0, pz = 0.05;
  y = podium(k, 0, 0, y, 1.82, 1.82, 0.24, '#e8e6e0');
  k.box(1.84, 0.03, 1.84, TEAL, 0, y - 0.1, 0);
  k.box(pw, 0.08, pd, C.white, px, y, pz);
  const g = new THREE.Mesh(new THREE.BoxGeometry(pw - 0.1, ph, pd - 0.1), M(GLASS, { roughness: 0.3 }));
  g.position.set(px, y + 0.08 + ph / 2, pz);
  k.add(g);
  for (let i = 0; i <= 6; i++) k.box(0.05, ph, 0.12, C.white, px - pw / 2 + 0.06 + i * ((pw - 0.12) / 6), y + 0.08, pz + pd / 2 - 0.03);
  for (const s of [-1, 1]) for (let i = 0; i <= 4; i++) k.box(0.12, ph, 0.05, C.white, px + s * (pw / 2 - 0.03), y + 0.08, pz - pd / 2 + 0.06 + i * ((pd - 0.12) / 4));
  const ry = y + 0.08 + ph;
  k.box(pw + 0.1, 0.08, pd + 0.1, C.white, px, ry, pz);
  k.box(pw + 0.12, 0.03, pd + 0.12, TEAL, px, ry + 0.05, pz);
  k.hedge(px - 0.42, pz + 0.38, 0.55, 0.32, ry + 0.08);
  k.hedge(px + 0.45, pz + 0.38, 0.45, 0.32, ry + 0.08);
  k.box(1.4, 0.03, 1.1, C.roofGreen, px, ry + 0.08, pz);
  // Column and the giant array
  const cx = 0.05, cz = -0.2;
  k.cyl(0.2, 0.16, '#d8dcdf', cx, ry + 0.08, cz, 12);
  k.cyl(0.13, 0.99, C.white, cx, ry + 0.24, cz, 12, 0.1);
  k.cyl(0.15, 0.04, TEAL, cx, ry + 0.6, cz, 12);
  k.cyl(0.15, 0.04, TEAL, cx, ry + 0.9, cz, 12);
  const L = lamp(k, cx, ry + 1.21, cz, { r: 0.38, color: C.white, rim: GUN, yoke: '#d8dcdf', style: 'array', armH: 0.5 });
  arm(k, L, { idle: sector(-Math.PI / 2, 5, 2.6, 2, 0.25), len: 4, spread: 0.6 });
  // Plant, crew, details
  generator(k, -0.5, -0.55, ry + 0.08, 0.6, 'modern', 0.3);
  roofFan(k, 0.55, ry + 0.08, -0.4, 0.12);
  operator(k, 0.45, 0.82, y, -Math.PI / 2, 13, 'tablet', '#4b6b3a');
  k.door('front', px, pz, pw, pd, -0.3, y + 0.08, 0.3, 0.46, DARK_GLASS);
  beacon(k, cx + 0.35, ry + 0.08, cz + 0.1, TEAL);
  k.planter(-0.5, 0.8, 0.5, y);
}

function lv14(k: Kit, y: number) {
  // Twin array towers: two slim white towers joined by a glass skybridge; one drum, one LED array
  const py = podium(k, 0, 0, y, 1.8, 1.8, 0.24);
  const A: [number, number] = [-0.48, -0.42], B: [number, number] = [0.48, 0.32];
  const th = 1.93;
  for (const [x, z] of [A, B]) {
    k.box(0.58, th, 0.58, C.white, x, py, z);
    for (let i = 0; i < 4; i++) k.box(0.035, th - 0.1, 0.08, '#e8e6e0', x - 0.2 + i * 0.133, py + 0.05, z + 0.32);
    k.box(0.6, 0.04, 0.6, TEAL, x, py + 0.45, z);
    k.box(0.64, 0.07, 0.64, C.roofGreen, x, py + th, z);
    k.box(0.02, th - 0.3, 0.2, DARK_GLASS, x + 0.3, py + 0.15, z);
  }
  // Skybridge between them
  const bx = 0, bz = -0.05;
  const br = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.24, 0.24), M(GLASS, { roughness: 0.3 }));
  br.position.set(bx, py + 1.05, bz);
  br.rotation.y = -Math.atan2(B[1] - A[1], B[0] - A[0]);
  k.add(br);
  const brf = k.box(0.78, 0.04, 0.28, C.white, bx, py + 1.17, bz);
  brf.rotation.y = br.rotation.y;
  const brb = k.box(0.78, 0.04, 0.28, C.white, bx, py + 0.91, bz);
  brb.rotation.y = br.rotation.y;
  const top = py + th + 0.07;
  const La = lamp(k, A[0], top, A[1], { r: 0.4, color: C.white, rim: TEAL, yoke: '#d8dcdf', armH: 0.42 });
  arm(k, La, { idle: eight(-Math.PI * 0.6, 0.22, 1.2, 0.4, 0.22), len: 4, color: '#f4fbff' });
  const Lb = lamp(k, B[0], top, B[1], { r: 0.28, color: C.white, rim: GUN, yoke: '#d8dcdf', style: 'array', armH: 0.42 });
  arm(k, Lb, { idle: circle(0.26, 0.55, 1), len: 3.4 });
  generator(k, -0.45, 0.5, py, 0.65, 'modern', 0);
  roofFan(k, 0.5, py, -0.5, 0.12);
  roofFan(k, 0.2, py, -0.62, 0.1);
  operator(k, 0.0, 0.6, py, -Math.PI / 2, 14, 'point', '#4b6b3a');
  k.blinker(A[0] + 0.25, top, A[1] - 0.25, '#ff3b30', 0.03);
  k.blinker(B[0] + 0.25, top, B[1] - 0.25, '#ff3b30', 0.03);
  k.door('front', B[0], B[1], 0.58, 0.58, 0, py, 0.24, 0.42, DARK_GLASS);
  k.door('front', A[0], A[1], 0.58, 0.58, 0, py, 0.24, 0.42, DARK_GLASS);
}

function lv15(k: Kit, y: number) {
  // Lumen crown: finned white tower on a green-roofed podium; a teal halo turns under a crown of lamps
  const py = podium(k, 0, 0, y, 1.82, 1.82, 0.36);
  k.box(1.5, 0.04, 1.5, C.roofGreen, 0, py, 0);
  const tw = 0.74, th = 1.59, tz = -0.1;
  k.box(tw, th, tw, C.white, 0, py, tz);
  for (const [fx, fz, rot] of [[0, tz + tw / 2 + 0.05, 0], [tw / 2 + 0.05, tz, Math.PI / 2], [-tw / 2 - 0.05, tz, Math.PI / 2]] as [number, number, number][]) {
    for (let i = 0; i < 5; i++) {
      const u = -0.28 + i * 0.14;
      const f = k.box(0.04, th - 0.1, 0.1, '#e8e6e0', fx + (rot ? 0 : u), py + 0.05, fz + (rot ? u : 0));
      f.rotation.y = rot;
    }
  }
  const cy = py + th;
  k.box(1.1, 0.1, 1.1, C.white, 0, cy, tz);
  k.box(1.12, 0.04, 1.12, TEAL, 0, cy + 0.06, tz);
  // Turning teal halo ring
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.04, 6, 32).rotateX(Math.PI / 2), glow(TEAL, 0.6));
  halo.position.set(0, cy - 0.28, tz);
  k.add(halo);
  for (let i = 0; i < 6; i++) {
    const node = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), glow('#bff7ef', 1.2));
    node.position.set(Math.cos((i / 6) * Math.PI * 2) * 0.62, 0, Math.sin((i / 6) * Math.PI * 2) * 0.62);
    halo.add(node);
  }
  k.anims.push((t) => {
    halo.rotation.y = t * 0.6;
    halo.rotation.x = Math.sin(t * 0.5) * 0.06;
  });
  k.box(0.44, 0.1, 0.44, '#d8dcdf', 0, cy + 0.1, tz);
  const L = lamp(k, 0, cy + 0.2, tz, { r: 0.46, color: C.white, rim: TEAL, yoke: '#d8dcdf', armH: 0.48 });
  arm(k, L, { idle: eight(-Math.PI / 2, 0.2, 1.3, 0.42, 0.24), len: 4.4, color: '#f4fbff', spread: 0.75 });
  // Two crown spot arrays on the front corners
  for (const s of [-1, 1]) {
    const Ls = lamp(k, s * 0.46, cy + 0.1, tz + 0.42, { r: 0.12, color: C.white, rim: GUN, yoke: '#c9ced2', style: 'array', armH: 0.18, rotY: -Math.PI / 2 });
    arm(k, Ls, { idle: s < 0 ? ground(-Math.PI * 0.7, 0.3, 0.7, -0.3) : circle(0.3, 0.7, s), len: 2.6 });
  }
  generator(k, -0.55, 0.62, py, 0.6, 'modern', 0);
  generator(k, 0.55, 0.62, py, 0.6, 'modern', Math.PI);
  operator(k, 0, 0.62, py, -Math.PI / 2, 15, 'tablet', '#4b6b3a');
  k.flagpole(-0.82, -0.82, 1.7, py);
  k.flagpole(0.82, -0.82, 1.7, py);
  k.door('front', 0, tz, tw, tw, 0, py, 0.26, 0.46, DARK_GLASS);
  k.box(1.84, 0.04, 1.84, TEAL, 0, py - 0.1, 0);
}

// ------------------------------------------------------------------ secure (16–20)

/** Sloped armour skirt plates round a box. */
function skirt(k: Kit, x: number, z: number, y: number, w: number, d: number, h: number, color = CONCRETE) {
  for (const [sx, sz, len, rot] of [[0, d / 2, w, 0], [0, -d / 2, w, Math.PI], [w / 2, 0, d, Math.PI / 2], [-w / 2, 0, d, -Math.PI / 2]] as [number, number, number, number][]) {
    const g = new THREE.Group();
    g.position.set(x + sx, y, z + sz);
    g.rotation.y = rot;
    const p = k.box(len, h, 0.12, color, 0, 0, 0, g);
    p.rotation.x = -0.35;
    p.position.z = 0.02;
    k.add(g);
  }
}

function lv16(k: Kit, y: number) {
  // Armoured lamp bunker: low hardened bunker, stubby tower and an armoured lamp with an iris shutter
  const bw = 1.7, bd = 1.5, bh = 0.62, bz = 0.08;
  k.box(bw, bh, bd, CONCRETE, 0, y, bz);
  skirt(k, 0, bz, y, bw, bd, 0.4);
  k.box(bw + 0.02, 0.05, bd + 0.02, ARMOUR, 0, y + bh, bz);
  k.box(1.0, 0.07, 0.03, '#2a2b2d', -0.2, y + 0.42, bz + bd / 2 + 0.01);
  k.box(0.38, 0.4, 0.05, GUN, 0.5, y, bz + bd / 2 + 0.06);
  for (let i = 0; i < 3; i++) k.box(0.39, 0.02, 0.06, HAZ, 0.5, y + 0.08 + i * 0.12, bz + bd / 2 + 0.065);
  const ty = y + bh;
  const tw = 0.74, th = 1.25, tz = -0.1;
  k.box(tw, th, tw, CONCRETE, 0, ty, tz);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.14, th, 0.14, ARMOUR, sx * (tw / 2 - 0.02), ty, tz + sz * (tw / 2 - 0.02));
  k.box(0.3, 0.06, 0.02, '#2a2b2d', 0, ty + 0.9, tz + tw / 2 + 0.01);
  const cy = ty + th;
  k.box(tw + 0.1, 0.08, tw + 0.1, ARMOUR, 0, cy, tz);
  k.cyl(0.32, 0.1, GUN, 0, cy + 0.08, tz, 12);
  const L = lamp(k, 0, cy + 0.18, tz, { r: 0.42, color: STEEL, rim: GUN, yoke: GUN, style: 'armour', armH: 0.52 });
  arm(k, L, { idle: sector(-Math.PI / 2, 4, 2.4, 2.4, 0.2), len: 4.2 });
  sensorBall(k, 0.62, -0.5, ty, 0.62, 0.08);
  camera(k, -0.7, -0.45, ty, 0.6, Math.PI);
  generator(k, -0.5, 0.42, ty, 0.62, 'armour', 0);
  operator(k, 0.5, 0.42, ty, -Math.PI * 0.6, 16, 'tablet', '#4a5a3a');
  k.blinker(0.38, cy + 0.08, tz - 0.38, '#ff3b30', 0.03);
  sign(k, 'DANGER\nLASER LIGHT', -0.55, y + 0.12, bz + bd / 2 + 0.01, 0.28);
}

function lv17(k: Kit, y: number) {
  // Shutter battery: buttressed armour tower; louvred main lamp signals, two cowled side lamps
  k.box(1.78, 0.26, 1.78, CONCRETE, 0, y, 0);
  k.box(1.8, 0.04, 1.8, ARMOUR, 0, y + 0.22, 0);
  const py = y + 0.26;
  const tw = 0.8, th = 1.76, tz = -0.05;
  k.box(tw, th, tw, CONCRETE, 0, py, tz);
  for (let i = 0; i < 4; i++) k.box(tw + 0.03, 0.05, tw + 0.03, i % 2 ? ARMOUR : HAZ, 0, py + 0.3 + i * 0.36, tz);
  for (const s of [-1, 1]) {
    // Buttress with a cowled lamp on top
    const bx = s * 0.62;
    k.box(0.36, 0.86, 0.5, CONCRETE, bx, py, tz);
    const w = k.box(0.38, 0.4, 0.52, CONCRETE, bx - s * 0.04, py + 0.62, tz);
    w.rotation.z = s * 0.35;
    k.box(0.4, 0.06, 0.54, ARMOUR, bx, py + 0.86, tz);
    const Ls = lamp(k, bx, py + 0.92, tz, { r: 0.18, color: STEEL, rim: GUN, yoke: GUN, style: 'louvre', armH: 0.24, rotY: s < 0 ? Math.PI : 0 });
    arm(k, Ls, { idle: s < 0 ? ground(Math.PI * 1.25, 0.25, 0.9, -0.3) : circle(0.28, 0.6, 2), len: 3 });
  }
  k.box(0.3, 0.46, 0.04, GUN, 0, py, tz + tw / 2 + 0.01);
  for (let i = 0; i < 4; i++) k.box(0.3, 0.02, 0.05, HAZ, 0, py + 0.08 + i * 0.1, tz + tw / 2 + 0.012);
  const cy = py + th;
  k.box(tw + 0.1, 0.08, tw + 0.1, ARMOUR, 0, cy, tz);
  railing(k, 0, tz, cy + 0.08, tw + 0.06, tw + 0.06, GUN, 0.18);
  k.cyl(0.3, 0.08, GUN, 0, cy + 0.08, tz, 12);
  const L = lamp(k, 0, cy + 0.16, tz, { r: 0.44, color: STEEL, rim: GUN, yoke: GUN, style: 'louvre', armH: 0.5 });
  arm(k, L, { idle: eight(-Math.PI / 2, 0.22, 1.2, 0.38, 0.22), len: 4.3 });
  // Thermal camera mast, armoured generator and crew
  camera(k, 0.36, -0.42, cy + 0.08, 0.32, -Math.PI / 2, GUN);
  generator(k, -0.52, 0.62, py, 0.66, 'armour', 0);
  roofFan(k, 0.55, py, 0.62, 0.12);
  operator(k, 0.15, 0.62, py, -Math.PI / 2, 17, 'bino', '#4a5a3a');
  k.blinker(-0.36, cy + 0.08, tz - 0.4, '#ff3b30', 0.03);
}

function lv18(k: Kit, y: number) {
  // Dazzler berm: grassed earth berm with a blast door; concrete tower carries the drum and a laser dazzler
  const berm = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.92, 0.5, 8), mat(GRASS));
  berm.position.set(0, y + 0.25, 0);
  berm.rotation.y = Math.PI / 8;
  k.add(berm);
  k.box(1.86, 0.08, 1.86, '#8a7a55', 0, y - 0.02, 0);
  // Blast door portal in the berm
  k.box(0.56, 0.48, 0.3, CONCRETE, 0, y, 0.72);
  k.box(0.42, 0.38, 0.04, GUN, 0, y, 0.875);
  for (let i = 0; i < 4; i++) k.box(0.42, 0.025, 0.045, HAZ, 0, y + 0.05 + i * 0.09, 0.88);
  const ty = y + 0.5;
  const tr = 0.4, th = 1.53;
  k.cyl(tr + 0.06, th, CONCRETE, 0, ty, -0.05, 6, tr);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const p = k.box(0.08, th, 0.32, ARMOUR, Math.cos(a) * (tr + 0.04), ty, -0.05 + Math.sin(a) * (tr + 0.04));
    p.rotation.y = -a;
  }
  k.cyl(tr + 0.08, 0.05, HAZ, 0, ty + 0.85, -0.05, 6);
  const cy = ty + th;
  k.cyl(0.6, 0.1, ARMOUR, 0, cy, -0.05, 6);
  ringRail(k, 0, -0.05, cy + 0.1, 0.56, GUN, 0.18);
  k.cyl(0.3, 0.08, GUN, 0, cy + 0.1, -0.05, 12);
  const L = lamp(k, 0, cy + 0.18, -0.05, { r: 0.44, color: STEEL, rim: GUN, yoke: GUN, armH: 0.48, dazzler: true });
  arm(k, L, { idle: eight(-Math.PI / 2, 0.24, 1.2, 0.4, 0.22), len: 4.3 });
  const L2 = lamp(k, 0.62, y + 0.5, 0.35, { r: 0.16, color: STEEL, rim: GUN, yoke: GUN, style: 'armour', armH: 0.24 });
  k.cyl(0.14, 0.04, GUN, 0.62, y + 0.46, 0.35, 10);
  arm(k, L2, { idle: circle(0.3, 0.65, 1), len: 3 });
  sensorBall(k, -0.55, -0.5, y + 0.5, 0.9, 0.09);
  generator(k, -0.55, 0.32, y + 0.42, 0.55, 'armour', 0.4);
  operator(k, 0.78, -0.62, y, Math.PI * 0.75, 18, 'tablet', '#4a5a3a');
  camera(k, 0.8, 0.8, y, 0.75, -Math.PI / 4, GUN);
  k.blinker(0.4, cy + 0.1, -0.4, '#ff3b30', 0.03);
  sign(k, 'DANGER\nLASER LIGHT', 0.42, y + 0.15, 0.88, 0.22);
}

function lv19(k: Kit, y: number) {
  // Twin-drum sensor tower: hexagonal hardened tower with a ring of sensor pods; twin drums with a dazzler
  k.box(1.8, 0.24, 1.8, CONCRETE, 0, y, 0);
  k.box(1.82, 0.04, 1.82, ARMOUR, 0, y + 0.2, 0);
  const py = y + 0.24;
  skirt(k, 0, 0, y, 1.8, 1.8, 0.24);
  const tr = 0.46, th = 2.0, tz = -0.08;
  k.cyl(tr + 0.06, th, CONCRETE, 0, py, tz, 6, tr);
  for (const hy of [0.4, 0.95]) k.cyl(tr + 0.07, 0.05, hy > 0.5 ? HAZ : ARMOUR, 0, py + hy, tz, 6);
  slits(k, 0, tz, py + 0.6, tr + 0.02, 6, 0.12);
  // Sensor pod ring
  const cy = py + th;
  k.cyl(0.66, 0.1, ARMOUR, 0, cy, tz, 6);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const x = Math.cos(a) * 0.62, z = tz + Math.sin(a) * 0.62;
    k.box(0.1, 0.12, 0.1, '#e8e6e0', x, cy - 0.12, z);
    k.blinker(x, cy - 0.17, z, i % 2 ? '#7cff8a' : '#ff3b30', 0.022, 1.2 + i * 0.15);
  }
  k.cyl(0.36, 0.1, GUN, 0, cy + 0.1, tz, 12);
  const L = lamp(k, 0, cy + 0.2, tz, { r: 0.3, color: STEEL, rim: GUN, yoke: GUN, style: 'twin', armH: 0.42, dazzler: true });
  arm(k, L, { idle: eight(-Math.PI / 2, 0.22, 1.2, 0.4, 0.22), len: 4.3, spread: 0.5 });
  const L2 = lamp(k, 0.58, py, 0.55, { r: 0.18, color: STEEL, rim: GUN, yoke: GUN, style: 'armour', armH: 0.26 });
  arm(k, L2, { idle: circle(0.3, 0.6, 1), len: 3 });
  // Generator block with a bank of cooling fans
  const gx = -0.5, gz = 0.52;
  k.box(0.7, 0.3, 0.6, CONCRETE, gx, py, gz);
  for (const [fx, fz] of [[-0.15, -0.13], [0.15, -0.13], [-0.15, 0.13], [0.15, 0.13]]) roofFan(k, gx + fx, py + 0.3, gz + fz, 0.1, 10 + fx * 4);
  generator(k, 0.58, -0.6, py, 0.55, 'armour', Math.PI / 2);
  sensorBall(k, -0.6, -0.55, py, 0.8, 0.08);
  operator(k, 0.1, 0.62, py, -Math.PI / 2, 19, 'bino', '#4a5a3a');
}

function lv20(k: Kit, y: number) {
  // Citadel lantern: gold-banded citadel tower with a glass cab; gold-rimmed giant drum with LED wings and dazzler
  const py = y + 0.3;
  k.box(1.82, 0.3, 1.82, CONCRETE, 0, y, 0);
  k.box(1.84, 0.05, 1.84, GOLD, 0, py - 0.05, 0);
  skirt(k, 0, 0, y, 1.82, 1.82, 0.28);
  const tw = 0.86, th = 1.53, tz = -0.12;
  k.box(tw, th, tw, CONCRETE, 0, py, tz);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.13, th, 0.13, ARMOUR, sx * (tw / 2 - 0.02), py, tz + sz * (tw / 2 - 0.02));
  k.box(tw + 0.04, 0.05, tw + 0.04, GOLD, 0, py + 0.5, tz);
  for (let i = 0; i < 5; i++) k.box(0.02, th - 0.1, 0.02, GOLD, -0.24 + i * 0.12, py + 0.05, tz + tw / 2 + 0.015);
  k.box(0.32, 0.46, 0.04, GUN, 0, py, tz + tw / 2 + 0.01);
  const cy = glassCab(k, 0, tz, py + th, 0.9, 0.9, 0.3, ARMOUR, GOLD);
  k.box(0.98, 0.03, 0.98, GOLD, 0, cy - 0.03, tz);
  // Turning gold crown ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.035, 6, 32).rotateX(Math.PI / 2), M(GOLD, { metalness: 0.5, roughness: 0.35 }));
  ring.position.set(0, cy + 0.12, tz);
  k.add(ring);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 4), M(GOLD, { metalness: 0.5, roughness: 0.35 }));
    spike.position.set(Math.cos(a) * 0.6, 0.06, Math.sin(a) * 0.6);
    ring.add(spike);
  }
  k.anims.push((t) => (ring.rotation.y = -t * 0.4));
  k.cyl(0.32, 0.08, GUN, 0, cy, tz, 12);
  const L = lamp(k, 0, cy + 0.08, tz, { r: 0.46, color: STEEL, rim: GOLD, yoke: GUN, armH: 0.48, wings: true, dazzler: true });
  arm(k, L, { idle: eight(-Math.PI / 2, 0.2, 1.3, 0.42, 0.22), len: 4.6, spread: 0.75 });
  // Two armoured corner lamps on the podium
  for (const s of [-1, 1]) {
    k.box(0.32, 0.18, 0.32, ARMOUR, s * 0.62, py, 0.58);
    k.box(0.33, 0.03, 0.33, GOLD, s * 0.62, py + 0.15, 0.58);
    const Ls = lamp(k, s * 0.62, py + 0.18, 0.58, { r: 0.17, color: STEEL, rim: GOLD, yoke: GUN, style: 'armour', armH: 0.24 });
    arm(k, Ls, { idle: s < 0 ? ground(-Math.PI * 0.65, 0.28, 0.8, -0.3) : circle(0.3, 0.65, 2), len: 3 });
  }
  generator(k, -0.62, -0.62, py, 0.5, 'armour', 0);
  sensorBall(k, 0.62, -0.62, py, 0.6, 0.08);
  operator(k, 0, 0.68, py, -Math.PI / 2, 20, 'point', '#4a5a3a', '#7a1f2b');
  k.flagpole(-0.86, 0.1, 1.6, py);
  k.flagpole(0.86, 0.1, 1.6, py);
  k.blinker(0.42, cy, tz - 0.42, '#ff3b30', 0.03);
}

const LEVEL_BUILDERS = [lv1, lv2, lv3, lv4, lv5, lv6, lv7, lv8, lv9, lv10, lv11, lv12, lv13, lv14, lv15, lv16, lv17, lv18, lv19, lv20];

export function buildSearchlight(level: number): Kit {
  const k = new Kit();
  const y = k.pad(2, 2);
  LEVEL_BUILDERS[Math.max(0, Math.min(19, level - 1))](k, y);
  return k;
}

export const SEARCHLIGHT: BuildingDef = {
  id: 'searchlight',
  name: 'Searchlight',
  role: 'Support defence. Locks its beam onto a raider: reveals and slows it, and makes nearby defences more accurate.',
  footprint: [2, 2],
  unlockHq: 9,
  levels: SEARCHLIGHT_LEVELS,
  designedLevels: 20,
  build: buildSearchlight,
};
