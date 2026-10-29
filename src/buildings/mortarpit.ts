import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { C, Kit, mat } from './kit';
import { CONCRETE, DARK_GLASS, GOLD } from './common';
import { DAY, HOUR, type BuildingDef, type LevelStats } from './types';

/*
 * Mortar Pit: splash damage lobbed at ground raiders. Signature at every level:
 * a dug-in circular pit (sandbag ring → timber revetment → cream bay → concrete
 * ring → white ring → armoured casemate) with a short, steep mortar tube in the
 * centre, ready ammo and bomb racks, and a loader who drops a bomb down the
 * muzzle, ducks and covers his ears on a loop. Later levels add twin tubes, a
 * semi-automatic turret mortar, a turntable with a robot loader arm and a
 * hardened casemate with sliding magazine hatches. The tube is held at a fixed
 * steep elevation (`lob`); only the yaw tracks. Footprint 3×3; stays low
 * (bulk ≤ ~2.5 storeys) and grows by coverage and detail.
 */

const TITLES = [
  'Shell Scrape', 'Sandbag Pit', 'Revetted Pit', 'Mortar Bay', 'Fire-Post Bay', 'Twin-Tube Bay',
  'Concrete Pit', 'Heavy Mortar Pit', 'Fire-Direction Pit', 'Mortar Battery', 'Turret Mortar', 'Autoloader Turret',
  'Met-Station Turret', 'Turntable Mortar', 'Mortar Rotunda', 'Hardened Casemate', 'Armoured Casemate', 'Drone-Spotted Casemate',
  'Twin-Turret Casemate', 'Citadel Mortar',
];
const nice = (v: number) => {
  const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(v)) - 1));
  return Math.round(v / p) * p;
};
const SUPPLIES = TITLES.map((_, i) => nice(25_000 * Math.pow(1.33, i)));
const REPUTATION = TITLES.map((_, i) => nice(1_200 * Math.pow(1.16, i)));
const TIME = [3 * HOUR, 4 * HOUR, 5 * HOUR, 6 * HOUR, 8 * HOUR, 10 * HOUR, 12 * HOUR, 15 * HOUR, 18 * HOUR, 22 * HOUR, 1.25 * DAY, 1.5 * DAY, 2 * DAY, 2.5 * DAY, 3 * DAY, 3.5 * DAY, 4.25 * DAY, 5 * DAY, 6 * DAY, 7 * DAY];
const TUBES = [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4, 4, 4, 4];

export const MORTAR_PIT_LEVELS: LevelStats[] = TITLES.map((title, i) => {
  const level = i + 1;
  const damage = Math.round(20 * Math.pow(1.2, i));
  const range = Math.round((10 + (i * 2) / 19) * 10) / 10;
  const splash = Math.round((1.5 + Math.floor(i / 5) * 0.1) * 10) / 10;
  return {
    level, title,
    supplies: SUPPLIES[i],
    reputation: REPUTATION[i],
    buildTime: TIME[i],
    hp: Math.round((900 * Math.pow(1.2, i)) / 10) * 10,
    stats: { damage, splash, range, minRange: 3, reload: 4, tubes: TUBES[i] },
    unlocks: [`${damage} splash damage (${splash}-tile radius) every 4 s`, `Range ${range} tiles (3-tile dead zone)`, `${TUBES[i]} tube${TUBES[i] > 1 ? 's' : ''}`],
  };
});

// ------------------------------------------------------------------ palette

const LOB = 1.0;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const OLIVE = '#5b6b3a';
const OLIVE_D = '#46542c';
const SKIN = ['#e0ac7e', '#c68b5f', '#a8714b', '#f0c39a'];
const DIRT_D = '#8a6440';
const EARTH = '#b08a5c';
const GRASS = '#6fb24a';
const GRASS_D = '#5a9a3c';
const BAG = ['#cdb98a', '#c2ad7e', '#d8c699', '#b8a274'];
const TIMBER = '#8a6038';
const LOGC = '#7a5634';
const GUN = '#3f4a2c';
const GUN_D = '#2c3320';
const STEEL = '#5c6166';
const STEEL_D = '#41464b';
const HAZ = '#f2c230';
const TEAL = '#2bb3a3';
const ARMOUR = '#6a6f5e';
const ARMOUR_D = '#545947';
const RED = '#d8342c';
const glow = (c: string, i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, flatShading: true });
const sm = (u: number) => {
  const v = Math.min(1, Math.max(0, u));
  return v * v * (3 - 2 * v);
};
const cyc = (t: number, p: number, off = 0) => ((((t + off) % p) + p) % p) / p;
/** Heading that turns a part built along +x toward (dx, dz). */
const face = (dx: number, dz: number) => Math.atan2(-dz, dx);
/** Point on a circle by compass angle φ (0 = front/+z, π/2 = right/+x). */
const P = (phi: number, r: number): [number, number] => [r * Math.sin(phi), r * Math.cos(phi)];

function rng(seed: number) {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mesh(k: Kit, geo: THREE.BufferGeometry, color: string | THREE.Material, x = 0, y = 0, z = 0, parent?: THREE.Object3D) {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color) : color);
  m.position.set(x, y, z);
  return k.add(m, parent);
}

/** Cylinder between two points. */
function strut(k: Kit, parent: THREE.Object3D | undefined, a: THREE.Vector3, b: THREE.Vector3, r: number, color: string, sides = 5) {
  const d = V().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), sides), mat(color));
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
  return k.add(m, parent);
}

/** Lathe ring wall (optionally with a gap centred on compass angle `gapAt`). */
function ring(k: Kit, rIn: number, rOut: number, h: number, y: number, color: string, gap = 0, gapAt = 0, profile: 'wall' | 'berm' = 'wall', seg = 32, parent?: THREE.Object3D) {
  const pts = profile === 'berm'
    ? [new THREE.Vector2(rOut, 0), new THREE.Vector2(rOut - (rOut - rIn) * 0.45, h), new THREE.Vector2(rIn + (rOut - rIn) * 0.15, h), new THREE.Vector2(rIn, h * 0.5), new THREE.Vector2(rIn, 0)]
    : [new THREE.Vector2(rOut, 0), new THREE.Vector2(rOut, h), new THREE.Vector2(rIn, h), new THREE.Vector2(rIn, 0)];
  const geo = new THREE.LatheGeometry(pts, seg, gapAt + gap / 2, Math.PI * 2 - gap);
  const m = new THREE.Mesh(geo, mat(color, { side: THREE.DoubleSide }));
  m.position.y = y;
  return k.add(m, parent);
}

function disc(k: Kit, r: number, h: number, color: string, x: number, y: number, z: number, seg = 28, parent?: THREE.Object3D) {
  return mesh(k, new THREE.CylinderGeometry(r, r, h, seg).translate(0, h / 2, 0), color, x, y, z, parent);
}

// ------------------------------------------------------------------ sandbags (merged per colour)

class Bags {
  private readonly list: { m: THREE.Matrix4; c: number }[] = [];
  private readonly r: () => number;
  constructor(seed: number) {
    this.r = rng(seed);
  }
  add(x: number, y: number, z: number, ry: number, big = 1) {
    const r = this.r;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler((r() - 0.5) * 0.08, ry + (r() - 0.5) * 0.14, (r() - 0.5) * 0.07));
    const s = V((0.92 + r() * 0.16) * big, 0.88 + r() * 0.22, (0.94 + r() * 0.12) * big);
    this.list.push({ m: new THREE.Matrix4().compose(V(x, y + 0.05, z), q, s), c: Math.floor(r() * BAG.length) });
  }
  /** A ring of bags around the origin, skipping a gap centred on compass angle gapAt. */
  ring(r: number, layers: number, y: number, gap = 0, gapAt = 0, cx = 0, cz = 0) {
    for (let l = 0; l < layers; l++) {
      const rr = r - l * 0.02;
      const n = Math.max(6, Math.round((2 * Math.PI * rr) / 0.25));
      for (let i = 0; i < n; i++) {
        const phi = ((i + (l % 2) * 0.5) / n) * Math.PI * 2;
        const dphi = Math.atan2(Math.sin(phi - gapAt), Math.cos(phi - gapAt));
        if (gap && Math.abs(dphi) < gap / 2) continue;
        const [x, z] = P(phi, rr);
        this.add(cx + x, y + l * 0.095, cz + z, phi);
      }
    }
  }
  line(x: number, z: number, len: number, ry: number, y: number, layers = 2) {
    const n = Math.max(1, Math.round(len / 0.26));
    for (let l = 0; l < layers; l++) for (let i = 0; i < n - (l % 2); i++) {
      const t = -len / 2 + 0.13 + i * 0.26 + (l % 2) * 0.13;
      this.add(x + Math.cos(ry) * t, y + l * 0.095, z - Math.sin(ry) * t, ry);
    }
  }
  flush(k: Kit, parent?: THREE.Object3D) {
    const base = new RoundedBoxGeometry(0.26, 0.11, 0.16, 1, 0.035);
    BAG.forEach((c, ci) => {
      const geos = this.list.filter((b) => b.c === ci).map((b) => base.clone().applyMatrix4(b.m));
      if (geos.length) mesh(k, mergeGeometries(geos)!, c, 0, 0, 0, parent);
    });
  }
}

// ------------------------------------------------------------------ signs & stencils

const texCache = new Map<string, THREE.MeshStandardMaterial>();
function textMat(text: string, bg: string, fg: string, font = 40, w = 256, h = 64, border?: string) {
  const key = [text, bg, fg, font, w, h, border].join('|');
  let m = texCache.get(key);
  if (m) return m;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  if (border) {
    g.strokeStyle = border;
    g.lineWidth = 6;
    g.strokeRect(5, 5, w - 10, h - 10);
  }
  g.fillStyle = fg;
  g.font = `900 ${font}px Nunito, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 });
  texCache.set(key, m);
  return m;
}

/** Flat sign board with lettering on its front (+z) face, base at y. */
function board(k: Kit, text: string, w: number, h: number, x: number, y: number, z: number, bg: string, fg = '#ffffff', rotY = 0, parent?: THREE.Object3D) {
  const side = mat(bg);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), [side, side, side, side, textMat(text, bg, fg, 40, 256, Math.round((256 * h) / w), fg), side]);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = rotY;
  return k.add(m, parent);
}

function signPost(k: Kit, text: string, x: number, z: number, y: number, rotY = 0, bg = RED, w = 0.5, h = 0.18, postH = 0.42, post = TIMBER) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  for (const s of [-1, 1]) k.box(0.035, postH + h, 0.035, post, s * (w / 2 - 0.04), 0, -0.02, g);
  board(k, text, w, h, 0, postH, 0, bg, '#ffffff', 0, g);
  return k.add(g);
}

/** Ammo box with a stencil on the lid and front. */
function ammoBox(k: Kit, x: number, y: number, z: number, ry = 0, color = OLIVE, w = 0.3, h = 0.13, d = 0.18, text = 'HE', parent?: THREE.Object3D) {
  const side = mat(color);
  const st = textMat(text, color, '#f2e3a0', 34, 128, 64);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, st, side, st, side]);
  m.position.set(x, y + h / 2, z);
  m.rotation.y = ry;
  k.add(m, parent);
  // Rope handles and a darker lid seam
  const seam = new THREE.Mesh(new THREE.BoxGeometry(w + 0.006, 0.012, d + 0.006), mat('#2f3a22'));
  seam.position.set(0, h * 0.3, 0);
  m.add(seam);
  return m;
}

/** Timber crate stack (with stencils). */
function crateStack(k: Kit, x: number, y: number, z: number, ry: number, n: number, seed = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  const spots: [number, number, number][] = [[0, 0, 0], [0.32, 0, 0.02], [0.16, 0.14, 0.0], [-0.32, 0, -0.02], [-0.16, 0.14, 0.01], [0, 0.28, 0]];
  for (let i = 0; i < Math.min(n, spots.length); i++) {
    const [dx, dy, dz] = spots[i];
    ammoBox(k, dx, dy, dz, ((i + seed) % 3 - 1) * 0.06, (i + seed) % 3 === 2 ? '#7a6a3a' : OLIVE, 0.3, 0.14, 0.2, (i + seed) % 2 ? 'HE' : 'SMK', g);
  }
  return k.add(g);
}

// ------------------------------------------------------------------ bombs

let BOMB: { body: THREE.BufferGeometry; band: THREE.BufferGeometry } | null = null;
function bombGeos() {
  if (!BOMB) {
    const body = new THREE.SphereGeometry(0.034, 8, 6);
    body.scale(1, 1.9, 1);
    body.translate(0, 0.035, 0);
    const tail = new THREE.CylinderGeometry(0.012, 0.016, 0.07, 6).translate(0, -0.04, 0);
    const f1 = new THREE.BoxGeometry(0.06, 0.04, 0.006).translate(0, -0.06, 0);
    const f2 = new THREE.BoxGeometry(0.006, 0.04, 0.06).translate(0, -0.06, 0);
    BOMB = {
      body: mergeGeometries([body.toNonIndexed(), tail.toNonIndexed(), f1.toNonIndexed(), f2.toNonIndexed()])!,
      band: new THREE.CylinderGeometry(0.0355, 0.0355, 0.014, 8).translate(0, 0.05, 0),
    };
  }
  return BOMB;
}

/** A mortar bomb standing nose-up (≈0.18 long), origin at its middle. */
function bomb(k: Kit, parent?: THREE.Object3D, color = GUN, band = HAZ, s = 1) {
  const g = new THREE.Group();
  const b = bombGeos();
  g.add(new THREE.Mesh(b.body, mat(color)), new THREE.Mesh(b.band, mat(band)));
  g.scale.setScalar(s);
  return k.add(g, parent);
}

/** Timber A-frame rack of bombs standing nose-up. */
function bombRack(k: Kit, x: number, y: number, z: number, ry: number, n = 6, frame = TIMBER, parent?: THREE.Object3D) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  const w = n * 0.085 + 0.06;
  for (const s of [-1, 1]) {
    k.box(0.03, 0.26, 0.03, frame, s * w / 2, 0, -0.06, g);
    k.box(0.03, 0.26, 0.03, frame, s * w / 2, 0, 0.06, g);
  }
  k.box(w + 0.04, 0.025, 0.16, frame, 0, 0.04, 0, g);
  k.box(w + 0.04, 0.025, 0.16, frame, 0, 0.17, 0, g);
  for (let i = 0; i < n; i++) {
    const b = bomb(k, g);
    b.position.set(-w / 2 + 0.07 + i * 0.085, 0.14, 0);
  }
  return k.add(g, parent);
}

// ------------------------------------------------------------------ people

interface Look { shirt: string; pants: string; helmet: string | null; ears?: string; vest?: string; beret?: string }
const FIELD: Look = { shirt: OLIVE, pants: OLIVE_D, helmet: '#4f5c33', vest: '#6b6a3e' };
const CAMP: Look = { shirt: OLIVE, pants: OLIVE_D, helmet: '#4f5c33', ears: '#f2c230' };
const BASE: Look = { shirt: OLIVE, pants: OLIVE_D, helmet: '#47542e', ears: '#f2c230', vest: '#3e4a2a' };
const CMD: Look = { shirt: '#5f7448', pants: '#3f4d30', helmet: '#3f4a2c', ears: TEAL, vest: '#33402a' };
const SEC: Look = { shirt: '#4a5240', pants: '#33382d', helmet: '#2a2e2a', ears: '#e8e6e0', vest: '#2a2e2a' };
const OFFICER: Look = { shirt: OLIVE, pants: OLIVE_D, helmet: null, beret: '#2a3326' };

interface Crew { root: THREE.Group; torso: THREE.Group; legL: THREE.Group; legR: THREE.Group; armL: THREE.Group; armR: THREE.Group }

/** ~0.6-tall low-poly crewman facing +x; torso bends at the hips, arms pivot at the shoulders. */
function crew(k: Kit, seed: number, look: Look, parent?: THREE.Object3D): Crew {
  const root = new THREE.Group();
  const put = (geo: THREE.BufferGeometry, c: string, x: number, y: number, z: number, p: THREE.Object3D) => {
    const m = new THREE.Mesh(geo, mat(c));
    m.position.set(x, y, z);
    p.add(m);
    return m;
  };
  const limb = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d).translate(0, -h / 2, 0);
  const skin = SKIN[seed % SKIN.length];
  const legs = [-1, 1].map((s) => {
    const g = new THREE.Group();
    g.position.set(0, 0.26, s * 0.045);
    put(limb(0.065, 0.22, 0.065), look.pants, 0, 0, 0, g);
    put(new THREE.BoxGeometry(0.09, 0.045, 0.07), '#2a2b2d', 0.012, -0.24, 0, g);
    root.add(g);
    return g;
  });
  const torso = new THREE.Group();
  torso.position.y = 0.26;
  root.add(torso);
  put(new THREE.BoxGeometry(0.12, 0.2, 0.17), look.shirt, 0, 0.1, 0, torso);
  put(new THREE.BoxGeometry(0.125, 0.03, 0.175), '#2a2b2d', 0, 0.01, 0, torso);
  if (look.vest) put(new THREE.BoxGeometry(0.135, 0.11, 0.18), look.vest, 0, 0.12, 0, torso);
  put(new THREE.IcosahedronGeometry(0.062, 0), skin, 0, 0.26, 0, torso);
  if (look.helmet) {
    put(new THREE.SphereGeometry(0.074, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), look.helmet, 0, 0.27, 0, torso);
    put(new THREE.CylinderGeometry(0.084, 0.084, 0.012, 8), look.helmet, 0, 0.27, 0, torso);
  }
  if (look.beret) put(new THREE.CylinderGeometry(0.068, 0.07, 0.03, 8), look.beret, -0.005, 0.315, 0.01, torso).rotation.x = 0.2;
  if (look.ears) for (const s of [-1, 1]) put(new THREE.BoxGeometry(0.035, 0.045, 0.025), look.ears, 0, 0.255, s * 0.066, torso);
  const arms = [-1, 1].map((s) => {
    const g = new THREE.Group();
    g.position.set(0, 0.19, s * 0.105);
    put(limb(0.05, 0.18, 0.05), look.shirt, 0, 0, 0, g);
    put(new THREE.BoxGeometry(0.045, 0.04, 0.045), skin, 0, -0.19, 0, g);
    torso.add(g);
    return g;
  });
  k.add(root, parent);
  return { root, torso, legL: legs[0], legR: legs[1], armL: arms[0], armR: arms[1] };
}

/** Hand position (torso space) for an arm swung forward by θ. */
const hand = (th: number) => V(0.2 * Math.sin(th), 0.19 - 0.2 * Math.cos(th), 0);

function kneel(f: Crew, e: number, y: number) {
  f.root.position.y = y - 0.1 * e;
  f.legL.rotation.z = 0.9 * e;
  f.legR.rotation.z = -0.9 * e;
}

function walkPose(f: Crew, ph: number, amp = 0.5) {
  const s = Math.sin(ph);
  f.legL.rotation.z = s * amp;
  f.legR.rotation.z = -s * amp;
  f.armL.rotation.z = -s * amp * 0.7;
  f.armR.rotation.z = s * amp * 0.7;
}

interface Drop { parent: THREE.Object3D; from: THREE.Vector3; to: THREE.Vector3; rot: number }

/**
 * The loader: lifts a bomb over the muzzle (or into a feed tray), lets it go,
 * ducks with his hands over his ears, stands, turns for the next round.
 */
function loader(k: Kit, parent: THREE.Object3D, foot: THREE.Vector3, rotY: number, reach: number, look: Look, seed: number, drop: Drop | null, period = 4.4, offset = 0, turn = 1.2) {
  const f = crew(k, seed, look, parent);
  f.root.position.copy(foot);
  f.root.rotation.y = rotY;
  const hb = bomb(k, f.torso);
  const db = drop ? bomb(k, drop.parent) : null;
  if (db) {
    db.rotation.z = drop!.rot;
    db.visible = false;
  }
  const rest = 0.55;
  k.anims.push((t) => {
    const u = cyc(t, period, offset);
    let th = rest, lean = -0.08, duck = 0, tn = 0, hold = true;
    if (u < 0.26) {
      const e = sm(u / 0.26);
      th = rest + (reach - rest) * e;
      lean = -0.08 - 0.14 * e;
    } else if (u < 0.36) {
      th = reach;
      lean = -0.22;
      hold = u < 0.31;
    } else if (u < 0.45) {
      const e = sm((u - 0.36) / 0.09);
      duck = e;
      th = reach + (2.75 - reach) * e;
      lean = -0.22 - 0.3 * e;
      hold = false;
    } else if (u < 0.68) {
      duck = 1;
      th = 2.75 + Math.sin(t * 14) * 0.04;
      lean = -0.52;
      hold = false;
    } else if (u < 0.78) {
      const e = sm((u - 0.68) / 0.1);
      duck = 1 - e;
      th = 2.75 + (0.25 - 2.75) * e;
      lean = -0.52 + 0.44 * e;
      hold = false;
    } else if (u < 0.9) {
      const e = sm((u - 0.78) / 0.08);
      tn = e * turn;
      th = 0.25 + Math.max(0, (u - 0.84) / 0.06) * 0.3;
      lean = -0.08 - 0.25 * sm((u - 0.8) / 0.06) * (1 - sm((u - 0.86) / 0.04));
      hold = u > 0.86;
    } else {
      tn = (1 - sm((u - 0.9) / 0.1)) * turn;
      th = rest;
    }
    kneel(f, duck, foot.y);
    f.torso.rotation.z = lean;
    f.armL.rotation.z = th;
    f.armR.rotation.z = th;
    f.root.rotation.y = rotY + tn;
    hb.visible = hold;
    hb.position.copy(hand(th));
    hb.position.y -= 0.02;
    hb.rotation.z = -lean;
    if (db) {
      const v = u >= 0.31 && u < 0.4;
      db.visible = v;
      if (v) db.position.lerpVectors(drop!.from, drop!.to, Math.pow((u - 0.31) / 0.09, 2));
    }
  });
  return f;
}

/** A kneeling or standing spotter who raises binoculars, scans and points. */
function spotter(k: Kit, x: number, y: number, z: number, rotY: number, look: Look, seed: number, kneeling = true, parent?: THREE.Object3D) {
  const f = crew(k, seed, look, parent);
  f.root.position.set(x, y, z);
  f.root.rotation.y = rotY;
  kneel(f, kneeling ? 1 : 0, y);
  const bino = new THREE.Group();
  for (const s of [-1, 1]) mesh(k, new THREE.CylinderGeometry(0.018, 0.02, 0.06, 6).rotateZ(Math.PI / 2), '#2a2b2d', 0, 0, s * 0.025, bino);
  f.torso.add(bino);
  k.anims.push((t) => {
    const c = cyc(t, 9, seed * 2.3);
    const up = c < 0.6 ? sm(c / 0.08) : 1 - sm((c - 0.6) / 0.08);
    const th = 0.45 + up * 1.85;
    f.armL.rotation.z = th;
    f.armR.rotation.z = c > 0.74 && c < 0.92 ? 1.6 + Math.sin(t * 3) * 0.08 : th;
    bino.position.copy(hand(th)).add(V(0.02, 0.025, 0));
    bino.visible = up > 0.3;
    f.torso.rotation.y = Math.sin(t * 0.45 + seed) * 0.35;
  });
  return f;
}

/** A crewman carrying a bomb from A to B and walking back (fades in/out at a doorway A). */
function bearer(k: Kit, a: THREE.Vector3, b: THREE.Vector3, look: Look, seed: number, period = 9, offset = 0, hideAtA = true) {
  const f = crew(k, seed, look);
  const hb = bomb(k, f.torso);
  const out = face(b.x - a.x, b.z - a.z), back = face(a.x - b.x, a.z - b.z);
  k.anims.push((t) => {
    const u = cyc(t, period, offset);
    let p = 0, rot = out, walking = false, carry = true;
    if (u < 0.1) p = 0;
    else if (u < 0.42) (p = sm((u - 0.1) / 0.32)), (walking = true);
    else if (u < 0.55) (p = 1), (carry = u < 0.5);
    else if (u < 0.88) (p = 1 - sm((u - 0.55) / 0.33)), (walking = true), (rot = back), (carry = false);
    else (p = 0), (rot = back), (carry = false);
    f.root.position.lerpVectors(a, b, p);
    f.root.rotation.y = rot;
    if (walking) walkPose(f, t * 9, 0.45);
    else walkPose(f, 0);
    const th = carry ? (u >= 0.42 && u < 0.55 ? 1.0 + Math.sin(((u - 0.42) / 0.13) * Math.PI) * 0.3 : 0.75) : walking ? f.armL.rotation.z : 0;
    if (carry) {
      f.armL.rotation.z = th;
      f.armR.rotation.z = th;
      f.torso.rotation.z = u >= 0.42 ? -0.35 : -0.05;
    } else f.torso.rotation.z = 0;
    hb.visible = carry;
    hb.position.copy(hand(th));
    if (hideAtA) f.root.visible = u > 0.06 && u < 0.94;
  });
  return { fig: f, open: (t: number) => {
    const u = cyc(t, period, offset);
    return u < 0.16 ? 1 - sm((u - 0.1) / 0.06) * 0 : u > 0.84 ? 1 : u < 0.2 ? 1 - sm((u - 0.16) / 0.04) : u > 0.8 ? sm((u - 0.8) / 0.04) : 0;
  } };
}

// ------------------------------------------------------------------ weapons

interface Tube { g: THREE.Group; len: number; z: number; r: number }
interface Rig { yaw: THREE.Group; pitch: THREE.Group; tubes: Tube[]; px: number; py: number }

function newRig(k: Kit, x: number, y: number, z: number, px: number, py: number, parent?: THREE.Object3D): Rig {
  const yaw = new THREE.Group();
  yaw.position.set(x, y, z);
  const pitch = new THREE.Group();
  pitch.position.set(px, py, 0);
  pitch.rotation.z = LOB;
  yaw.add(pitch);
  k.add(yaw, parent);
  return { yaw, pitch, tubes: [], px, py };
}

/** A tube along +x from the pivot: breech cap, muzzle lip and a dark bore. */
function addTube(k: Kit, rig: Rig, len: number, r: number, z: number, color = GUN, lip = GUN_D, band?: string) {
  const g = new THREE.Group();
  g.position.z = z;
  rig.pitch.add(g);
  mesh(k, new THREE.CylinderGeometry(r, r * 1.12, len, 10).rotateZ(-Math.PI / 2).translate(len / 2, 0, 0), color, 0, 0, 0, g);
  mesh(k, new THREE.CylinderGeometry(r * 1.3, r * 1.3, 0.035, 10).rotateZ(-Math.PI / 2), lip, len - 0.02, 0, 0, g);
  mesh(k, new THREE.CylinderGeometry(r * 0.78, r * 0.78, 0.01, 10).rotateZ(-Math.PI / 2), '#111315', len + 0.002, 0, 0, g);
  mesh(k, new THREE.SphereGeometry(r * 1.25, 8, 6), lip, 0, 0, 0, g);
  if (band) mesh(k, new THREE.CylinderGeometry(r * 1.14, r * 1.14, 0.03, 10).rotateZ(-Math.PI / 2), band, len * 0.72, 0, 0, g);
  const m = new THREE.Object3D();
  m.position.x = len;
  g.add(m);
  const t: Tube = { g, len, z, r };
  rig.tubes.push(t);
  return t;
}

/** Muzzle mouth of a tube in yaw space. */
const mouth = (rig: Rig, t: Tube, extra = 0) => V(rig.px + (t.len + extra) * Math.cos(LOB), rig.py + (t.len + extra) * Math.sin(LOB), t.z);

function registerRig(k: Kit, rig: Rig, level: number, seed = 0, sweep = 0.8, base = 0.4) {
  const yaw = rig.yaw, pitch = rig.pitch;
  k.turret({
    yaw, pitch,
    muzzles: rig.tubes.map((t) => t.g.children[t.g.children.length - 1]),
    recoil: rig.tubes.map((t) => t.g),
    weapon: 'mortar', targets: 'ground', rate: 0.25, lob: LOB,
    turnRate: 0.9 + level * 0.06, kick: 0.05 + Math.min(0.04, rig.tubes[0].r * 0.4),
    idle: (t) => {
      yaw.rotation.y = base + Math.sin(t * 0.21 + seed) * sweep + Math.sin(t * 0.083 + seed * 2) * sweep * 0.6;
      pitch.rotation.z = LOB + Math.sin(t * 0.55 + seed) * 0.02;
    },
  });
}

/**
 * Field mortars (Lv 1–10): baseplate, tube(s) and bipod, all in the yaw group.
 * kind: light (1–3), medium (4–5), twin (6–7), heavy twin (8–10).
 */
type FieldKind = 'light' | 'sight' | 'medium' | 'twin' | 'heavy' | 'heavyPlus';
function fieldMortar(k: Kit, x: number, y: number, z: number, kind: FieldKind) {
  const heavy = kind === 'heavy' || kind === 'heavyPlus';
  const twin = kind === 'twin' || heavy;
  const len = kind === 'light' || kind === 'sight' ? 0.6 : heavy ? 0.88 : 0.74;
  const r = kind === 'light' || kind === 'sight' ? 0.045 : heavy ? 0.068 : 0.055;
  const px = heavy ? -0.32 : -0.24, py = heavy ? 0.09 : 0.055;
  const rig = newRig(k, x, y, z, px, py);
  const zs = twin ? [-(heavy ? 0.17 : 0.15), heavy ? 0.17 : 0.15] : [0];
  for (const tz of zs) addTube(k, rig, len, r, tz, GUN, GUN_D, kind === 'heavyPlus' ? HAZ : kind === 'light' ? undefined : '#2f3624');
  // Baseplate(s)
  if (heavy) {
    k.box(0.5, 0.05, 0.62, STEEL_D, px, 0, 0, rig.yaw);
    for (const s of [-1, 1]) k.box(0.44, 0.04, 0.03, STEEL, px, 0.05, s * 0.26, rig.yaw);
    for (const tz of zs) disc(k, 0.09, 0.05, STEEL, px, 0.04, tz, 10, rig.yaw);
  } else if (twin) {
    k.box(0.36, 0.035, 0.5, STEEL_D, px, 0, 0, rig.yaw);
    for (const tz of zs) disc(k, 0.075, 0.03, STEEL, px, 0.03, tz, 10, rig.yaw);
  } else {
    disc(k, kind === 'medium' ? 0.17 : 0.14, 0.03, STEEL_D, px, 0, 0, 12, rig.yaw);
    for (let i = 0; i < 4; i++) {
      const sp = k.box(0.025, 0.02, 0.26, STEEL, px, 0.025, 0, rig.yaw);
      sp.rotation.y = (i * Math.PI) / 4;
    }
  }
  // Bipod with a yoke round the tube(s), elevating spindle and cross-level bar
  const d = len * 0.56;
  const cx = px + d * Math.cos(LOB), cy = py + d * Math.sin(LOB);
  const spread = twin ? (heavy ? 0.42 : 0.36) : 0.16;
  const lr = heavy ? 0.022 : 0.014;
  for (const s of [-1, 1]) {
    strut(k, rig.yaw, V(cx + 0.12, 0.0, s * spread), V(cx, cy, s * (twin ? zs[1] + r + 0.03 : r + 0.03)), lr, STEEL_D);
    mesh(k, new THREE.BoxGeometry(0.06, 0.015, 0.05), STEEL_D, cx + 0.12, 0, s * spread, rig.yaw);
  }
  strut(k, rig.yaw, V(cx + 0.075, cy * 0.4, -spread * 0.62), V(cx + 0.075, cy * 0.4, spread * 0.62), lr * 0.8, STEEL);
  strut(k, rig.yaw, V(cx + 0.075, cy * 0.4, 0), V(cx, cy, 0), lr * 1.2, STEEL);
  for (const tz of zs) mesh(k, new THREE.CylinderGeometry(r * 1.45, r * 1.45, 0.05, 10).rotateZ(-Math.PI / 2), STEEL_D, d, 0, tz, rig.pitch);
  if (twin) mesh(k, new THREE.BoxGeometry(0.04, 0.04, zs[1] * 2 + 0.06), STEEL_D, d, 0, 0, rig.pitch);
  if (heavy) {
    // Recoil buffers either side of each tube
    for (const tz of zs) for (const s of [-1, 1]) mesh(k, new THREE.CylinderGeometry(0.014, 0.014, len * 0.42, 6).rotateZ(-Math.PI / 2), '#8a9196', d - 0.02, r + 0.02, tz + s * (r * 0.6), rig.pitch);
  }
  if (kind !== 'light') {
    // Sight unit on the left of the yoke
    const sz = -(twin ? zs[1] + r + 0.07 : r + 0.06);
    mesh(k, new THREE.BoxGeometry(0.07, 0.06, 0.04), '#2f3a22', cx + 0.02, cy + 0.04, sz, rig.yaw);
    mesh(k, new THREE.CylinderGeometry(0.014, 0.014, 0.05, 6), '#111315', cx + 0.02, cy + 0.09, sz, rig.yaw);
  }
  return rig;
}

/** Loader(s) for an open tube: placed beside the muzzle (outside each tube of a twin), with ready rounds. */
function tubeLoaders(k: Kit, rig: Rig, look: Look, seed: number, ready = true, period = 4.4) {
  const field = rig.tubes[0].r < 0.05;
  rig.tubes.forEach((t, i) => {
    const m = mouth(rig, t, 0.06);
    const s = t.z < 0 ? -1 : 1;
    const target = m.y + 0.07;
    // Reach up (arms as high as ~2.5 rad) before resorting to a loading step.
    let th = 2.5, feet = target - (0.45 - 0.2 * Math.cos(th));
    if (feet < 0.03) {
      th = Math.acos(Math.max(-1, Math.min(1, (0.45 - target) / 0.2)));
      feet = 0;
    }
    const lz = t.z + s * 0.2 * Math.sin(th);
    if (feet > 0.01) {
      // Loading step
      if (field) {
        // He stands on an ammo box
        ammoBox(k, m.x - 0.02, 0, lz + s * 0.03, 0, OLIVE, 0.3, feet, 0.22, 'HE', rig.yaw);
      } else {
        k.box(0.3, feet, 0.24, STEEL, m.x - 0.02, 0, lz + s * 0.03, rig.yaw);
        for (let i = 0; i < 3; i++) k.box(0.1, 0.02, 0.25, i % 2 ? C.kerbB : HAZ, m.x - 0.12 + i * 0.1, feet - 0.012, lz + s * 0.03, rig.yaw);
      }
    }
    loader(k, rig.yaw, V(m.x, feet, lz), s > 0 ? Math.PI / 2 : -Math.PI / 2, th, look, seed + i, { parent: t.g, from: V(t.len + 0.06, 0, 0), to: V(t.len - 0.24, 0, 0), rot: -Math.PI / 2 }, period, i * period * 0.5, s * 1.25);
    if (ready) {
      // Ready-round box behind him (he turns to it between shots)
      const bx = m.x - 0.26, bz = lz + s * 0.04;
      ammoBox(k, bx, feet, bz, 0, OLIVE, 0.16, 0.08, 0.2, '', rig.yaw);
      for (const dz of [-0.05, 0.0, 0.05]) {
        const b = bomb(k, rig.yaw, GUN, HAZ, 0.8);
        b.position.set(bx, feet + 0.13, bz + dz);
      }
    }
  });
}

// ------------------------------------------------------------------ small animated props

function pennant(k: Kit, x: number, z: number, y: number, h = 0.7, color = RED) {
  k.cyl(0.012, h, TIMBER, x, y, z, 4);
  const g = new THREE.Group();
  g.position.set(x, y + h - 0.02, z);
  const tri = new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, -0.12, 0), V(0.22, -0.06, 0)]);
  tri.computeVertexNormals();
  mesh(k, tri, mat(color, { side: THREE.DoubleSide }), 0.01, 0, 0, g);
  k.add(g);
  k.anims.push((t) => {
    g.rotation.y = 0.6 + Math.sin(t * 2.3 + x) * 0.45;
    g.rotation.x = Math.sin(t * 5.1 + z) * 0.12;
  });
}

/** Red range flag on a tall pole ("live firing"), waving. */
function rangeFlag(k: Kit, x: number, z: number, y: number, h = 1.6, color = RED, pole = '#c9a36a') {
  k.cyl(0.02, h, pole, x, y, z, 5);
  const g = new THREE.Group();
  g.position.set(x, y + h - 0.04, z);
  const segs = 3;
  let parent: THREE.Object3D = g;
  const parts: THREE.Object3D[] = [];
  for (let i = 0; i < segs; i++) {
    const s = new THREE.Group();
    s.position.x = i === 0 ? 0.01 : 0.13;
    mesh(k, new THREE.BoxGeometry(0.13, 0.24 - i * 0.03, 0.008).translate(0.065, -0.12 + i * 0.015, 0), color, 0, 0, 0, s);
    parent.add(s);
    parts.push(s);
    parent = s;
  }
  k.add(g);
  k.anims.push((t) => {
    g.rotation.y = 0.7 + Math.sin(t * 0.7 + x) * 0.5;
    parts.forEach((p, i) => (p.rotation.y = Math.sin(t * 5 - i * 1.1 + z) * 0.35));
  });
}

/** Hurricane lantern hanging from a post, swinging. */
function lantern(k: Kit, x: number, z: number, y: number, h = 0.62, seed = 0) {
  k.box(0.04, h, 0.04, TIMBER, x, y, z);
  k.box(0.16, 0.03, 0.03, TIMBER, x + 0.06, y + h - 0.03, z);
  const g = new THREE.Group();
  g.position.set(x + 0.12, y + h - 0.03, z);
  mesh(k, new THREE.BoxGeometry(0.005, 0.06, 0.005), '#33383d', 0, -0.03, 0, g);
  mesh(k, new THREE.CylinderGeometry(0.032, 0.036, 0.07, 6), new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffb347', emissiveIntensity: 0.9, flatShading: true }), 0, -0.1, 0, g);
  mesh(k, new THREE.CylinderGeometry(0.01, 0.04, 0.03, 6), '#7a1f1a', 0, -0.05, 0, g);
  k.add(g);
  k.anims.push((t) => {
    g.rotation.z = Math.sin(t * 2.1 + seed) * 0.25;
    g.rotation.x = Math.sin(t * 1.3 + seed) * 0.12;
  });
}

/** Breathing camouflage net draped over four poles. */
function camoNet(k: Kit, x: number, z: number, w: number, d: number, y: number, h: number, ry = 0, seed = 3, poles = true, pole = TIMBER) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  if (poles) for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.035, h, 0.035, pole, sx * (w / 2 - 0.05), 0, sz * (d / 2 - 0.05), g);
  const r = rng(seed);
  const geo = new THREE.PlaneGeometry(w + 0.2, d + 0.2, 6, 5).rotateX(-Math.PI / 2);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) / (w / 2 + 0.1), v = pos.getZ(i) / (d / 2 + 0.1);
    const edge = Math.max(Math.abs(u), Math.abs(v));
    pos.setY(i, -0.09 * Math.cos(u * Math.PI * 0.5) * Math.cos(v * Math.PI * 0.5) - (edge > 0.95 ? 0.1 : 0) + (r() - 0.5) * 0.04);
  }
  geo.computeVertexNormals();
  const net = new THREE.Group();
  net.position.y = h + 0.02;
  mesh(k, geo, mat('#56663a', { side: THREE.DoubleSide }), 0, 0, 0, net);
  const cols = ['#6b7a3e', '#8a7a4a', '#46552c', '#7c8c46'];
  for (let i = 0; i < 26; i++) {
    const s = mesh(k, new THREE.BoxGeometry(0.1 + r() * 0.08, 0.012, 0.08 + r() * 0.06), cols[i % 4], (r() - 0.5) * w, 0.005 - r() * 0.05, (r() - 0.5) * d, net);
    s.rotation.set((r() - 0.5) * 0.4, r() * 3, (r() - 0.5) * 0.4);
  }
  g.add(net);
  k.add(g);
  k.anims.push((t) => {
    net.scale.y = 1 + Math.sin(t * 1.1 + seed) * 0.35;
    net.position.y = h + 0.02 + Math.sin(t * 1.1 + seed) * 0.012;
    net.rotation.z = Math.sin(t * 0.8 + seed) * 0.015;
  });
  return g;
}

/** Red/white aiming stakes planted out front. */
function aimingStakes(k: Kit, x: number, z: number, y: number, n = 2, dx = 0.2, dz = 0.12) {
  for (let i = 0; i < n; i++) for (let j = 0; j < 4; j++) k.box(0.025, 0.1, 0.025, j % 2 ? '#ffffff' : RED, x + i * dx, y + j * 0.1, z + i * dz);
}

function fieldPhone(k: Kit, x: number, z: number, y: number, ry = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  k.box(0.14, 0.09, 0.1, '#4b5a3a', 0, 0, 0, g);
  k.box(0.1, 0.03, 0.035, '#2a2b2d', 0, 0.09, 0, g);
  k.box(0.02, 0.05, 0.02, '#2a2b2d', 0.08, 0.03, 0.03, g);
  return k.add(g);
}

function jerrycan(k: Kit, x: number, z: number, y: number, ry = 0, color = '#4b5a3a') {
  const m = k.box(0.08, 0.16, 0.13, color, x, y, z);
  m.rotation.y = ry;
  k.box(0.02, 0.03, 0.05, C.dark, x, y + 0.16, z - 0.03);
}

/** Spinning-cup anemometer with a wind vane on a mast. */
function metMast(k: Kit, x: number, z: number, y: number, h: number) {
  k.cyl(0.025, h, C.white, x, y, z, 6);
  for (let i = 1; i < 4; i++) k.box(0.12, 0.012, 0.012, C.white, x, y + (h * i) / 4, z);
  const cups = new THREE.Group();
  cups.position.set(x, y + h + 0.04, z);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const arm = mesh(k, new THREE.BoxGeometry(0.16, 0.01, 0.01), C.metal, Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08, cups);
    arm.rotation.y = -a;
    mesh(k, new THREE.SphereGeometry(0.03, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(Math.PI / 2), C.white, Math.cos(a) * 0.16, 0, Math.sin(a) * 0.16, cups);
  }
  k.add(cups);
  const vane = new THREE.Group();
  vane.position.set(x, y + h - 0.12, z);
  mesh(k, new THREE.BoxGeometry(0.26, 0.012, 0.012), C.metal, 0, 0, 0, vane);
  mesh(k, new THREE.BoxGeometry(0.08, 0.07, 0.006), RED, -0.12, 0, 0, vane);
  mesh(k, new THREE.ConeGeometry(0.02, 0.05, 5).rotateZ(-Math.PI / 2), C.metal, 0.14, 0, 0, vane);
  k.add(vane);
  k.anims.push((t) => {
    cups.rotation.y = t * 7;
    vane.rotation.y = 0.8 + Math.sin(t * 0.5) * 0.4 + Math.sin(t * 2.3) * 0.08;
  });
}

/** Gently bobbing tethered weather balloon. */
function balloon(k: Kit, x: number, z: number, y: number, h: number) {
  k.box(0.14, 0.08, 0.14, C.white, x, y, z);
  const g = new THREE.Group();
  g.position.set(x, y + 0.08, z);
  const line = mesh(k, new THREE.BoxGeometry(0.006, 1, 0.006).translate(0, 0.5, 0), '#e8e6e0', 0, 0, 0, g);
  line.scale.y = h;
  const b = mesh(k, new THREE.IcosahedronGeometry(0.15, 1), '#f7f5ef', 0, h + 0.12, 0, g);
  b.scale.y = 1.15;
  mesh(k, new THREE.BoxGeometry(0.05, 0.05, 0.05), '#ff8a3d', 0, h - 0.05, 0, g);
  k.add(g);
  k.anims.push((t) => {
    g.rotation.z = Math.sin(t * 0.6) * 0.08;
    g.rotation.x = Math.sin(t * 0.43 + 1) * 0.06;
  });
}

/** Red siren-style warning beacon that spins (amber at the secure band). */
function beacon(k: Kit, x: number, y: number, z: number, color = '#ff9a1f') {
  k.cyl(0.05, 0.04, C.dark, x, y, z, 8);
  const dome = mesh(k, new THREE.CylinderGeometry(0.04, 0.045, 0.07, 8), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, transparent: true, opacity: 0.85, flatShading: true }), x, y + 0.075, z);
  const vane = mesh(k, new THREE.BoxGeometry(0.06, 0.05, 0.012), glow('#fff2c0', 1.2), x, y + 0.075, z);
  k.anims.push((t) => {
    vane.rotation.y = t * 6;
    ((dome as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + Math.max(0, Math.sin(t * 6)) * 1.2;
  });
}

/** Pulsing status lamp with its own material. */
function pulse(k: Kit, w: number, h: number, d: number, color: string, x: number, y: number, z: number, speed = 2, parent?: THREE.Object3D) {
  const m = mesh(k, new THREE.BoxGeometry(w, h, d), glow(color, 0.8), x, y, z, parent);
  const off = x * 3 + z;
  k.anims.push((t) => ((m.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.35 + (Math.sin(t * speed + off) * 0.5 + 0.5) * 1.1));
  return m;
}

/** Panning CCTV camera on a pole. */
function cctv(k: Kit, x: number, z: number, y: number, h = 1.0, base = 0) {
  k.cyl(0.022, h, '#4a4f54', x, y, z, 5);
  const cam = new THREE.Group();
  cam.position.set(x, y + h, z);
  k.box(0.15, 0.07, 0.07, '#f4f4f0', 0.05, 0, 0, cam);
  k.box(0.03, 0.045, 0.045, '#33383d', 0.135, 0.012, 0, cam);
  k.add(cam);
  k.anims.push((t) => (cam.rotation.y = base + Math.sin(t * 0.45 + x + z) * 0.8));
}

/** Simple sub-kit placed and turned as a unit (its animations are merged in). */
function sub(k: Kit, x: number, y: number, z: number, ry: number, fn: (s: Kit) => void) {
  const s = new Kit();
  fn(s);
  s.group.position.set(x, y, z);
  s.group.rotation.y = ry;
  k.add(s.group);
  k.anims.push(...s.anims);
  return s;
}

// ------------------------------------------------------------------ turret mortars (Lv 11–13)

function turretMortar(k: Kit, x: number, y: number, z: number, level: number, look: Look, seed: number) {
  const body = C.white;
  const rig = newRig(k, x, y, z, 0.12, 0.34);
  const Y = rig.yaw;
  // Static turret ring in the floor
  disc(k, 0.5, 0.06, '#9aa0a4', x, y, z, 24);
  disc(k, 0.44, 0.065, '#6b7075', x, y, z, 24);
  // Hull
  disc(k, 0.43, 0.08, '#c9ced2', 0, 0, 0, 24, Y);
  k.box(0.66, 0.3, 0.58, body, -0.06, 0.08, 0, Y);
  const glacis = k.box(0.24, 0.05, 0.58, body, 0.3, 0.26, 0, Y);
  glacis.rotation.z = -0.75;
  k.box(0.67, 0.04, 0.59, TEAL, -0.06, 0.2, 0, Y);
  k.box(0.5, 0.06, 0.48, '#e2e5e7', -0.12, 0.38, 0, Y);
  // Commander's cupola and periscope on the roof
  disc(k, 0.08, 0.07, '#d5d9dc', -0.2, 0.44, -0.12, 8, Y);
  k.box(0.06, 0.04, 0.05, DARK_GLASS, -0.15, 0.48, -0.12, Y);
  // Rear feed hatch with a tray
  k.box(0.04, 0.14, 0.26, '#4a4f54', -0.4, 0.18, 0, Y);
  k.box(0.14, 0.02, 0.12, '#8a9196', -0.44, 0.24, 0, Y);
  // Mantlet + twin stubby tubes in the pitch group
  k.box(0.16, 0.16, 0.42, '#d5d9dc', -0.04, -0.08, 0, rig.pitch);
  for (const tz of [-0.12, 0.12]) addTube(k, rig, 0.52, 0.048, tz, '#4a4f54', '#33383d', TEAL);
  for (const tz of [-0.12, 0.12]) mesh(k, new THREE.CylinderGeometry(0.07, 0.07, 0.12, 10).rotateZ(-Math.PI / 2), '#e2e5e7', 0.12, 0, tz, rig.pitch);
  if (level >= 12) {
    // Ammo bustle with a moving conveyor of bombs feeding the hatch
    k.box(0.3, 0.06, 0.4, '#c9ced2', -0.6, 0.14, 0, Y);
    k.box(0.3, 0.02, 0.06, '#33383d', -0.6, 0.2, 0, Y);
    const belt: THREE.Object3D[] = [];
    for (let i = 0; i < 4; i++) {
      const b = bomb(k, Y, GUN, TEAL, 0.85);
      b.rotation.z = -Math.PI / 2;
      belt.push(b);
    }
    k.anims.push((t) => belt.forEach((b, i) => {
      const u = ((t * 0.18 + i / 4) % 1);
      b.position.set(-0.74 + u * 0.3, 0.25, 0);
      b.visible = u < 0.95;
    }));
    for (const s of [-1, 1]) k.box(0.3, 0.05, 0.02, '#8a9196', -0.6, 0.2, s * 0.05, Y);
  }
  if (level >= 13) {
    // Armour skirts and a sensor box on the turret roof
    for (const s of [-1, 1]) k.box(0.6, 0.14, 0.03, '#d5d9dc', -0.06, 0.1, s * 0.31, Y);
    k.box(0.12, 0.08, 0.1, '#4a4f54', -0.3, 0.44, 0.13, Y);
    k.box(0.02, 0.05, 0.06, DARK_GLASS, -0.235, 0.45, 0.13, Y);
  }
  // Loader at the rear hatch feeding the tray (or the conveyor)
  const feedX = level >= 12 ? -0.74 : -0.46;
  loader(k, Y, V(feedX - 0.13, 0, 0.0), 0, 0.62, look, seed, { parent: Y, from: V(feedX + 0.02, 0.27, 0), to: V(feedX + 0.16, 0.25, 0), rot: -Math.PI / 2 }, 4.4, 0, 1.3);
  // Ready rack behind him on the turret floor
  for (const dz of [-0.2, 0.2]) {
    ammoBox(k, feedX - 0.12, 0.08, dz * 1.15, 0, '#4a5240', 0.14, 0.08, 0.12, '', Y);
  }
  registerRig(k, rig, level, seed);
  return rig;
}

// ------------------------------------------------------------------ turntable mortars (Lv 14–20)

/** Two-link arm solve: shoulder and elbow angles to reach planar (d, h). */
function ik(l1: number, l2: number, d: number, h: number): [number, number] {
  const D = Math.min(l1 + l2 - 1e-3, Math.max(Math.abs(l1 - l2) + 1e-3, Math.hypot(d, h)));
  const a2 = Math.acos(Math.max(-1, Math.min(1, (D * D - l1 * l1 - l2 * l2) / (2 * l1 * l2))));
  const a1 = Math.atan2(h, d) + Math.atan2(l2 * Math.sin(a2), l1 + l2 * Math.cos(a2));
  return [a1, a2];
}

interface TableOpts { tubes: number; deck: string; rim: string; armour?: string; accent: string; scale?: number; seed: number; crewLook: Look; gold?: boolean }

/**
 * Turntable mortar: the whole deck traverses (it is the yaw group), carrying the
 * tubes on a pedestal, a bomb carousel and a robot loader arm that lifts bombs
 * from the carousel and drops them down each muzzle in turn; a crewman restocks
 * the carousel.
 */
function turntable(k: Kit, x: number, y: number, z: number, level: number, o: TableOpts) {
  const rig = newRig(k, x, y, z, -0.2, 0.32);
  const Y = rig.yaw;
  if (o.scale) Y.scale.setScalar(o.scale);
  // Static base ring + rails
  const s = o.scale ?? 1;
  disc(k, 0.88 * s, 0.04, '#6b7075', x, y, z, 32);
  // Deck
  disc(k, 0.84, 0.07, o.deck, 0, 0.0, 0, 32, Y);
  ring(k, 0.78, 0.86, 0.085, 0.0, o.rim, 0, 0, 'wall', 32, Y);
  for (let i = 0; i < 16; i++) {
    const [dx, dz] = P((i / 16) * Math.PI * 2, 0.82);
    const m = k.box(0.12, 0.09, 0.05, i % 2 ? C.kerbB : HAZ, dx, 0.0, dz, Y);
    m.rotation.y = (i / 16) * Math.PI * 2;
  }
  // Pedestal and cradle
  k.box(0.34, 0.24, 0.5, o.armour ?? '#c9ced2', -0.2, 0.07, 0, Y);
  if (o.armour) {
    // Low armoured hood round the breeches
    for (const sd of [-1, 1]) {
      const p = k.box(0.5, 0.26, 0.04, o.armour, -0.12, 0.08, sd * (o.tubes > 2 ? 0.4 : 0.28), Y);
      p.rotation.x = sd * 0.12;
    }
    k.box(0.06, 0.3, o.tubes > 2 ? 0.8 : 0.56, o.armour, -0.4, 0.07, 0, Y);
    for (let i = 0; i < 6; i++) k.box(0.02, 0.02, 0.02, '#8a8f80', -0.36 + (i % 3) * 0.18, 0.28, (i < 3 ? -1 : 1) * (o.tubes > 2 ? 0.42 : 0.3), Y);
  }
  const zs = o.tubes > 2 ? [-0.3, -0.1, 0.1, 0.3] : [-0.14, 0.14];
  for (const tz of zs) addTube(k, rig, 0.74, 0.05, tz, o.gold ? '#3a3f44' : '#4a4f54', o.gold ? GOLD : '#33383d', o.accent);
  for (const tz of zs) mesh(k, new THREE.CylinderGeometry(0.075, 0.075, 0.1, 10).rotateZ(-Math.PI / 2), '#8a9196', 0.36, 0, tz, rig.pitch);
  mesh(k, new THREE.BoxGeometry(0.06, 0.06, zs[zs.length - 1] * 2 + 0.12), '#5c6166', 0.36, 0, 0, rig.pitch);
  // Hydraulic struts from deck to cradle
  const cp = mouth(rig, { g: rig.pitch as THREE.Group, len: 0.36, z: 0, r: 0 });
  for (const sd of [-1, 1]) strut(k, Y, V(cp.x + 0.18, 0.07, sd * (zs[zs.length - 1] + 0.08)), V(cp.x, cp.y, sd * (zs[zs.length - 1] + 0.08)), 0.025, '#8a9196', 6);
  // Bomb carousel (steps round one slot per load)
  const car = new THREE.Group();
  car.position.set(-0.42, 0.07, 0.5);
  disc(k, 0.17, 0.04, '#5c6166', 0, 0, 0, 12, car);
  disc(k, 0.04, 0.24, '#8a9196', 0, 0, 0, 6, car);
  disc(k, 0.17, 0.02, '#5c6166', 0, 0.2, 0, 12, car);
  for (let i = 0; i < 8; i++) {
    const [dx, dz] = P((i / 8) * Math.PI * 2, 0.12);
    bomb(k, car, GUN, o.accent, 0.9).position.set(dx, 0.13, dz);
  }
  Y.add(car);
  // Robot loader arm
  const shoulder = V(0.12, 0.38, 0.5);
  k.box(0.16, 0.06, 0.16, '#33383d', shoulder.x, 0.07, shoulder.z, Y);
  disc(k, 0.05, shoulder.y - 0.13, o.accent === GOLD ? GOLD : '#e8e6e0', shoulder.x, 0.13, shoulder.z, 8, Y);
  const base = new THREE.Group();
  base.position.copy(shoulder);
  Y.add(base);
  const L1 = 0.42, L2 = 0.4;
  const upper = new THREE.Group();
  base.add(upper);
  const armCol = o.gold ? GOLD : '#f2c230';
  mesh(k, new THREE.BoxGeometry(L1, 0.06, 0.06).translate(L1 / 2, 0, 0), armCol, 0, 0, 0, upper);
  mesh(k, new THREE.SphereGeometry(0.05, 8, 6), '#33383d', 0, 0, 0, upper);
  const elbow = new THREE.Group();
  elbow.position.x = L1;
  upper.add(elbow);
  mesh(k, new THREE.BoxGeometry(L2, 0.045, 0.045).translate(L2 / 2, 0, 0), armCol, 0, 0, 0, elbow);
  mesh(k, new THREE.SphereGeometry(0.04, 8, 6), '#33383d', 0, 0, 0, elbow);
  const wrist = new THREE.Group();
  wrist.position.x = L2;
  elbow.add(wrist);
  mesh(k, new THREE.BoxGeometry(0.05, 0.05, 0.05), '#33383d', 0, -0.02, 0, wrist);
  for (const sd of [-1, 1]) mesh(k, new THREE.BoxGeometry(0.012, 0.07, 0.02), '#8a9196', sd * 0.03, -0.07, 0, wrist);
  const gb = bomb(k, wrist, GUN, o.accent, 1);
  gb.position.y = -0.13;
  const drops = rig.tubes.map((t) => {
    const b = bomb(k, t.g);
    b.rotation.z = -Math.PI / 2;
    b.visible = false;
    return b;
  });
  const pick = V(-0.42 + 0.12, 0.07 + 0.13 + 0.13, 0.5);
  const restP = V(0.25, 0.75, 0.55);
  const PER = 4.4;
  k.anims.push((t) => {
    const n = Math.floor((t + 100) / PER);
    const u = cyc(t, PER);
    const ti = n % rig.tubes.length;
    const tube = rig.tubes[ti];
    const dropP = mouth(rig, tube, 0.06).add(V(0, 0.13, 0));
    const above = dropP.clone().add(V(-0.05, 0.12, 0));
    let p: THREE.Vector3, hold = false;
    const lerp = (a: THREE.Vector3, b: THREE.Vector3, e: number, bump = 0) => a.clone().lerp(b, sm(e)).add(V(0, Math.sin(sm(e) * Math.PI) * bump, 0));
    if (u < 0.18) p = lerp(restP, pick, u / 0.18, 0.05);
    else if (u < 0.26) (p = pick.clone().add(V(0, Math.sin(((u - 0.18) / 0.08) * Math.PI) * 0.03, 0))), (hold = u > 0.22);
    else if (u < 0.48) (p = lerp(pick, above, (u - 0.26) / 0.22, 0.12)), (hold = true);
    else if (u < 0.54) (p = lerp(above, dropP, (u - 0.48) / 0.06)), (hold = true);
    else if (u < 0.6) (p = dropP), (hold = u < 0.56);
    else if (u < 0.84) p = lerp(dropP, restP, (u - 0.6) / 0.24, 0.08);
    else p = restP;
    const dx = p.x - shoulder.x, dz = p.z - shoulder.z;
    base.rotation.y = Math.atan2(-dz, dx);
    const [a1, a2] = ik(L1, L2, Math.hypot(dx, dz), p.y - shoulder.y);
    upper.rotation.z = a1;
    elbow.rotation.z = -a2;
    wrist.rotation.z = -(a1 - a2);
    gb.visible = hold;
    drops.forEach((b, i) => {
      const v = i === ti && u >= 0.56 && u < 0.64;
      b.visible = v;
      if (v) b.position.set(tube.len + 0.06 - Math.pow((u - 0.56) / 0.08, 2) * 0.3, 0, 0);
    });
    car.rotation.y = (n + sm((u - 0.84) / 0.12)) * ((Math.PI * 2) / 8);
  });
  // Crewman restocking the carousel from a crate
  ammoBox(k, -0.66, 0.07, 0.22, 0.3, '#4a5240', 0.2, 0.1, 0.14, 'HE', Y);
  loader(k, Y, V(-0.62, 0.07, 0.38), face(0.2, 0.12) , 1.25, o.crewLook, o.seed + 5, { parent: car, from: V(0, 0.32, 0.1), to: V(0, 0.15, 0.12), rot: 0 }, 6.6, 1.3, -1.6);
  registerRig(k, rig, level, o.seed);
  return rig;
}

// ------------------------------------------------------------------ hardened magazine (Lv 16–20)

/** Concrete magazine with twin roof hatches that slide apart for an ammo lift. */
function magazine(k: Kit, x: number, z: number, y: number, w: number, d: number, h: number, ry: number, col: string, hatch: string, period = 7, offset = 0, gold = false) {
  return sub(k, x, y, z, ry, (s) => {
    s.box(w, h, d, col, 0, 0, 0);
    s.box(w + 0.04, 0.05, d + 0.04, gold ? GOLD : '#9a968d', 0, h, 0);
    // Hatch well frame
    s.box(0.5, 0.04, 0.44, '#2a2e2a', 0, h + 0.03, 0);
    for (const sz of [-1, 1]) s.box(0.62, 0.03, 0.04, HAZ, 0, h + 0.05, sz * 0.24);
    const leaves = [-1, 1].map((sd) => {
      const l = s.box(0.25, 0.04, 0.44, hatch, sd * 0.125, h + 0.06, 0);
      for (let i = 0; i < 3; i++) s.box(0.24, 0.012, 0.02, '#8a8f80', 0, 0.04, -0.14 + i * 0.14, l);
      return l;
    });
    // Lift platform with a pallet of bombs
    const lift = new THREE.Group();
    s.box(0.36, 0.03, 0.32, '#8a9196', 0, 0, 0, lift);
    for (let i = 0; i < 6; i++) bomb(s, lift, GUN, HAZ, 0.9).position.set(-0.1 + (i % 3) * 0.1, 0.11, i < 3 ? -0.06 : 0.06);
    s.add(lift);
    // Door on the front and a warning plate
    s.box(0.3, 0.44, 0.03, '#4a4f54', 0, 0, d / 2 + 0.005);
    for (let i = 0; i < 5; i++) s.box(0.06, 0.06, 0.035, i % 2 ? C.kerbB : HAZ, -0.12 + i * 0.06, 0.44, d / 2 + 0.01);
    board(s, 'AMMO', 0.26, 0.09, 0, h - 0.2, d / 2 + 0.02, '#d8342c', '#ffffff', 0);
    s.anims.push((t) => {
      const u = cyc(t, period, offset);
      const open = u < 0.12 ? sm(u / 0.12) : u < 0.62 ? 1 : u < 0.74 ? 1 - sm((u - 0.62) / 0.12) : 0;
      const up = u < 0.14 ? 0 : u < 0.28 ? sm((u - 0.14) / 0.14) : u < 0.48 ? 1 : u < 0.6 ? 1 - sm((u - 0.48) / 0.12) : 0;
      leaves[0].position.x = -0.125 - open * 0.24;
      leaves[1].position.x = 0.125 + open * 0.24;
      lift.position.y = h - 0.3 + up * 0.36;
      lift.visible = up > 0.02;
    });
  });
}

// ------------------------------------------------------------------ FIELD (1–3)

function field(k: Kit, level: number, y: number) {
  const bags = new Bags(level * 11);
  if (level === 1) {
    // Shell scrape: a shallow earth bowl with a low ring of sandbags
    ring(k, 0.9, 1.32, 0.09, y, EARTH, 0.8, 0.45, 'berm');
    disc(k, 0.98, 0.012, DIRT_D, 0, y, 0);
    bags.ring(1.0, 2, y + 0.04, 0.8, 0.45);
    bags.flush(k);
    const rig = fieldMortar(k, 0.05, y + 0.012, 0.0, 'light');
    tubeLoaders(k, rig, FIELD, 1);
    registerRig(k, rig, level, 1);
    spotter(k, -0.55, y, 0.42, face(0.5, 1), FIELD, 2);
    // Groundsheet with bombs and an opened ammo box
    k.box(0.42, 0.01, 0.3, '#56663a', 0.4, y + 0.012, -0.55);
    for (let i = 0; i < 3; i++) {
      const b = bomb(k);
      b.rotation.z = Math.PI / 2;
      b.position.set(0.32 + i * 0.0, y + 0.05, -0.64 + i * 0.09);
    }
    ammoBox(k, -0.45, y + 0.012, -0.55, 0.4);
    const lid = k.box(0.3, 0.02, 0.18, OLIVE, -0.62, y + 0.012, -0.36);
    lid.rotation.y = 0.9;
    aimingStakes(k, 0.95, 1.18, y, 2, 0.18, 0.05);
    pennant(k, -1.2, -1.15, y, 0.75);
    jerrycan(k, -0.9, -0.7, y + 0.05, 0.4);
    // Spade stuck in the spoil
    const sp = k.box(0.025, 0.36, 0.025, TIMBER, 1.15, y + 0.05, -0.3);
    sp.rotation.z = 0.3;
    k.box(0.09, 0.1, 0.015, STEEL, 1.08, y + 0.02, -0.3).rotation.z = 0.3;
    return;
  }
  if (level === 2) {
    // Sandbag pit: full three-layer ring with a narrow entry, camo net over the stores
    ring(k, 1.05, 1.42, 0.12, y, EARTH, 0.6, 0.35, 'berm');
    disc(k, 1.06, 0.012, DIRT_D, 0, y, 0);
    bags.ring(1.12, 3, y + 0.03, 0.55, 0.35);
    bags.line(0.45, 1.36, 0.4, 0.35, y + 0.02, 2);
    bags.flush(k);
    const rig = fieldMortar(k, 0.12, y + 0.012, 0.12, 'light');
    tubeLoaders(k, rig, FIELD, 3, false);
    // No.2 kneeling with the next bomb ready, beside an ammo stack
    registerRig(k, rig, level, 2);
    camoNet(k, -0.45, -0.62, 1.0, 0.62, y, 0.62, 0.15, 4);
    crateStack(k, -0.5, y + 0.012, -0.68, 0.15, 5, 1);
    fieldPhone(k, -0.05, -0.75, y + 0.012, 0.3);
    bearer(k, V(-0.2, y + 0.012, -0.42), V(-0.05, y + 0.012, -0.2), FIELD, 4, 8, 1.5, false);
    spotter(k, -0.78, y + 0.012, 0.3, face(0.4, 1), FIELD, 5);
    aimingStakes(k, 1.05, 1.15, y, 3, 0.15, 0.04);
    pennant(k, 1.25, -1.22, y, 0.8);
    jerrycan(k, 0.75, -0.55, y + 0.012, 0.6);
    jerrycan(k, 0.86, -0.5, y + 0.012, 0.3, '#3f4d30');
    return;
  }
  // 3: Revetted pit: timber-revetted ring capped with sandbags, duckboards, zinc ammo bay
  ring(k, 1.22, 1.46, 0.14, y, EARTH, 0.55, 0.3, 'berm');
  disc(k, 1.14, 0.012, DIRT_D, 0, y, 0);
  // Duckboard floor
  for (let i = 0; i < 7; i++) k.box(0.1, 0.02, 1.2, TIMBER, -0.45 + i * 0.15, y + 0.012, 0.15);
  for (const dz of [-0.35, 0.65]) k.box(0.98, 0.022, 0.05, LOGC, 0, y + 0.03, dz);
  // Vertical timber revetment (merged planks)
  const planks: THREE.BufferGeometry[] = [];
  const n = 40;
  for (let i = 0; i < n; i++) {
    const phi = (i / n) * Math.PI * 2;
    if (Math.abs(Math.atan2(Math.sin(phi - 0.3), Math.cos(phi - 0.3))) < 0.25) continue;
    const [px, pz] = P(phi, 1.16);
    const g = new THREE.BoxGeometry(0.17, 0.32 + (i % 3) * 0.02, 0.04).translate(0, 0.16, 0);
    g.applyMatrix4(new THREE.Matrix4().makeRotationY(phi).setPosition(px, y, pz));
    planks.push(g);
  }
  mesh(k, mergeGeometries(planks)!, TIMBER);
  for (let i = 0; i < 12; i++) {
    const phi = (i / 12) * Math.PI * 2 + 0.26;
    const [px, pz] = P(phi, 1.12);
    k.cyl(0.03, 0.42, LOGC, px, y, pz, 5);
  }
  bags.ring(1.2, 2, y + 0.33, 0.55, 0.3);
  bags.flush(k);
  // Timber steps at the entry
  for (let i = 0; i < 3; i++) {
    const [sx, sz] = P(0.3, 1.25 + i * 0.1);
    const st = k.box(0.42, 0.24 - i * 0.08, 0.1, TIMBER, sx, y, sz);
    st.rotation.y = 0.3;
  }
  // Zinc lean-to ammo bay at the back
  sub(k, -0.45, y, -0.72, 0.2, (s) => {
    for (const sx of [-0.42, 0.42]) {
      s.box(0.04, 0.62, 0.04, TIMBER, sx, 0, 0.18);
      s.box(0.04, 0.5, 0.04, TIMBER, sx, 0, -0.2);
    }
    const roof = s.box(0.98, 0.03, 0.52, C.zinc, 0, 0.56, 0);
    roof.rotation.x = 0.22;
    crateStack(s, 0, 0.012, -0.05, 0, 6, 2);
  });
  const rig = fieldMortar(k, 0.2, y + 0.03, 0.18, 'sight');
  tubeLoaders(k, rig, FIELD, 6, false);
  registerRig(k, rig, level, 3);
  bearer(k, V(-0.1, y + 0.03, -0.4), V(0.0, y + 0.03, -0.15), FIELD, 7, 8, 2.5, false);
  spotter(k, -0.85, y + 0.03, 0.2, face(0.3, 1), FIELD, 8, false);
  rangeFlag(k, 1.28, -1.28, y, 1.7);
  lantern(k, 0.95, -0.6, y + 0.03, 0.6, 1);
  aimingStakes(k, -1.3, 1.25, y, 2, 0.16, -0.05);
  signPost(k, 'DANGER', -1.0, 1.35, y, 0.3, RED, 0.42, 0.14, 0.3);
}

// ------------------------------------------------------------------ CAMP (4–6)

/** Cream rendered ring wall with a green dado and white coping. */
function campRing(k: Kit, rIn: number, rOut: number, h: number, y: number, gap: number, gapAt: number, coping: string = C.white) {
  ring(k, rIn, rOut, h, y, C.wall, gap, gapAt);
  ring(k, rOut, rOut + 0.015, 0.1, y, C.trim, gap, gapAt);
  ring(k, rIn - 0.02, rOut + 0.03, 0.05, y + h, coping, gap + 0.02, gapAt);
  // End piers at the opening
  for (const sd of [-1, 1]) {
    const phi = gapAt + sd * (gap / 2 + 0.03);
    const [px, pz] = P(phi, (rIn + rOut) / 2);
    const p = k.box(0.1, h + 0.1, rOut - rIn + 0.08, C.wall, px, y, pz);
    p.rotation.y = phi;
    const cap = k.box(0.14, 0.05, rOut - rIn + 0.12, C.trim, px, y + h + 0.1, pz);
    cap.rotation.y = phi;
  }
}

/** Yellow/black painted kerb ring round the weapon plinth. */
function plinth(k: Kit, r: number, y: number, h = 0.06) {
  disc(k, r, h, '#c9c3b5', 0, y, 0, 24);
  const n = 14;
  for (let i = 0; i < n; i++) {
    const [px, pz] = P(((i + 0.5) / n) * Math.PI * 2, r - 0.02);
    const m = k.box(0.2, h + 0.01, 0.05, i % 2 ? C.kerbB : C.kerbY, px, y, pz);
    m.rotation.y = ((i + 0.5) / n) * Math.PI * 2;
  }
  return y + h;
}

/** Small red-roofed ammo hut whose door swings open for the bearer. */
function ammoHut(k: Kit, x: number, z: number, y: number, ry: number, open: (t: number) => number, w = 0.6, d = 0.52) {
  sub(k, x, y, z, ry, (s) => {
    s.block(w, d, 0.68, 0, 0, 0);
    s.hipRoof(w, d, 0.28, 0, 0.646, 0, C.roof, 0.1);
    const hinge = new THREE.Group();
    hinge.position.set(-0.12, 0, d / 2 + 0.02);
    s.box(0.24, 0.46, 0.035, C.trim, 0.12, 0, 0, hinge);
    s.box(0.03, 0.03, 0.04, '#d8c26a', 0.2, 0.22, 0.01, hinge);
    s.add(hinge);
    s.box(0.32, 0.03, 0.06, C.white, 0, 0.48, d / 2 + 0.02);
    board(s, 'AMMO', 0.24, 0.08, 0, 0.52, d / 2 + 0.025, RED);
    s.anims.push((t) => (hinge.rotation.y = -open(t) * 1.6));
  });
}

function camp(k: Kit, level: number, y: number) {
  const fl = y;
  if (level === 4) {
    // Mortar bay: cream ring with an opening toward the ammo hut
    campRing(k, 1.06, 1.22, 0.44, fl, 0.62, 2.36);
    disc(k, 1.06, 0.012, '#cfc9bb', 0, fl, 0);
    const py = plinth(k, 0.46, fl + 0.012);
    const rig = fieldMortar(k, 0.0, py, 0.0, 'medium');
    tubeLoaders(k, rig, CAMP, 9);
    registerRig(k, rig, level, 4, 0.8, 0.6);
    const b = bearer(k, V(0.98, fl, -0.98), V(0.55, fl + 0.012, -0.5), CAMP, 10, 9);
    ammoHut(k, 1.08, -1.08, fl, -Math.PI / 4, b.open);
    bombRack(k, 0.38, fl + 0.012, -0.72, 0.35, 6);
    bombRack(k, -0.62, fl + 0.012, -0.62, -0.75, 5);
    signPost(k, 'MORTAR BAY', -0.9, 1.3, fl, 0.6, C.trim, 0.6, 0.16, 0.36, C.white);
    k.lamp(1.25, 1.25, fl, 1.1);
    aimingStakes(k, 0.95, 0.95, fl, 2, -0.18, 0.12);
    crateStack(k, -1.2, fl, -1.12, 0.78, 3, 0);
    return;
  }
  if (level === 5) {
    // Fire-post bay: as Lv 4 plus a raised gabled fire-control post and its flag signaller
    campRing(k, 1.08, 1.25, 0.46, fl, 0.62, 2.36, C.trim);
    disc(k, 1.08, 0.012, '#cfc9bb', 0, fl, 0);
    const py = plinth(k, 0.48, fl + 0.012);
    const rig = fieldMortar(k, 0.0, py, 0.05, 'medium');
    tubeLoaders(k, rig, CAMP, 11);
    registerRig(k, rig, level, 5, 0.7, 0.5);
    const b = bearer(k, V(0.98, fl, -0.98), V(0.55, fl + 0.012, -0.5), CAMP, 12, 9, 3);
    ammoHut(k, 1.08, -1.08, fl, -Math.PI / 4, b.open);
    bombRack(k, 0.38, fl + 0.012, -0.72, 0.35, 6);
    bombRack(k, 0.7, fl + 0.012, -0.2, 1.2, 5);
    // Fire-control post (back-left corner), raised on a plinth with steps
    sub(k, -1.0, fl, -1.0, Math.PI / 4, (s) => {
      s.box(0.66, 0.26, 0.6, C.concrete, 0, 0, 0);
      s.box(0.68, 0.04, 0.62, C.trim, 0, 0.26, 0);
      for (const sx of [-1, 1]) s.box(0.04, 0.22, 0.6, C.wall, sx * 0.31, 0.3, 0);
      s.box(0.66, 0.22, 0.04, C.wall, 0, 0.3, -0.28);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.box(0.05, 0.6, 0.05, C.trim, sx * 0.3, 0.3, sz * 0.27);
      s.gableRoof(0.66, 0.6, 0.26, 0, 0.9, 0, C.roof, 0.08);
      s.stairs(0.38, 0.4, 0.22, 0.22, 0.26, true);
      board(s, 'FIRE CONTROL', 0.5, 0.09, 0, 0.92 - 0.12, 0.33, C.trim, '#ffffff');
      // Fire controller: raises the flag while loading, drops it as the bomb goes in
      const f = crew(s, 13, OFFICER);
      f.root.position.set(0.05, 0.3, 0.05);
      f.root.rotation.y = -Math.PI / 2 + 0.3;
      const flag = new THREE.Group();
      s.box(0.012, 0.3, 0.012, '#d8c26a', 0, 0, 0, flag);
      s.box(0.14, 0.1, 0.006, RED, 0.07, 0.2, 0, flag);
      f.armR.add(flag);
      flag.position.y = -0.2;
      s.anims.push((t) => {
        const u = cyc(t, 4.4, 0);
        const up = u < 0.25 ? sm(u / 0.1) : u < 0.33 ? 1 - sm((u - 0.31) / 0.02) : 0;
        f.armR.rotation.z = 0.2 + up * 2.6;
        f.armR.rotation.x = -0.2;
        f.torso.rotation.y = Math.sin(t * 0.5) * 0.2;
      });
      fieldPhone(s, -0.2, -0.15, 0.52, 0.2);
    });
    // Telephone pole carrying the line to the post
    k.cyl(0.03, 1.5, TIMBER, -1.3, fl, 0.6, 5);
    k.box(0.3, 0.03, 0.03, TIMBER, -1.3, fl + 1.38, 0.6);
    strut(k, undefined, V(-1.3, fl + 1.4, 0.6), V(-1.0, fl + 1.0, -0.85), 0.006, '#2a2b2d', 3);
    signPost(k, 'MORTAR BAY', 0.2, 1.36, fl, 0, C.trim, 0.6, 0.16, 0.36, C.white);
    k.lamp(1.25, 1.25, fl, 1.1);
    k.lamp(-1.25, -0.2, fl, 1.1);
    aimingStakes(k, 0.98, 0.9, fl, 3, -0.15, 0.12);
    return;
  }
  // 6: Twin-tube bay with a curved red-tile veranda over the back of the ring
  campRing(k, 1.14, 1.32, 0.5, fl, 0.6, 0.35, C.white);
  disc(k, 1.14, 0.012, '#cfc9bb', 0, fl, 0);
  const py = plinth(k, 0.56, fl + 0.012);
  const rig = fieldMortar(k, 0.05, py, 0.1, 'twin');
  tubeLoaders(k, rig, CAMP, 14, true, 4.8);
  registerRig(k, rig, level, 6, 0.7, 0.3);
  // Crescent veranda on green posts
  const a0 = 1.55, a1 = 4.75, segs = 9;
  for (let i = 0; i < segs; i++) {
    const a = a0 + ((i + 0.5) / segs) * (a1 - a0);
    const [px, pz] = P(a, 1.05);
    const plate = k.box(0.42, 0.04, 0.62, C.roof, px, fl + 0.98, pz);
    plate.rotation.set(0, a, 0);
    plate.rotateX(0.32);
    const [ex, ez] = P(a, 0.78);
    const eave = k.box(0.42, 0.035, 0.05, C.trim, ex, fl + 0.88, ez);
    eave.rotation.y = a;
  }
  for (let i = 0; i <= 4; i++) {
    const a = a0 + 0.12 + (i / 4) * (a1 - a0 - 0.24);
    const [px, pz] = P(a, 0.86);
    k.box(0.06, 0.9, 0.06, C.trim, px, fl, pz);
  }
  // Steel bomb lockers under the veranda
  for (let i = 0; i < 4; i++) {
    const a = 2.6 + i * 0.42;
    const [px, pz] = P(a, 0.98);
    const l = k.box(0.28, 0.4, 0.16, '#4b6b3a', px, fl + 0.012, pz);
    l.rotation.y = a;
    const [hx, hz] = P(a, 0.89);
    const hd = k.box(0.03, 0.06, 0.012, '#d8c26a', hx, fl + 0.22, hz);
    hd.rotation.y = a;
  }
  bombRack(k, 0.88, fl + 0.012, -0.32, 1.45, 6);
  // Alarm bell on a bracket, its striker swinging
  const [bx, bz] = P(2.0, 1.42);
  k.box(0.05, 0.9, 0.05, C.trim, bx, fl, bz);
  k.box(0.22, 0.04, 0.04, C.trim, bx - 0.08, fl + 0.88, bz);
  const bell = new THREE.Group();
  bell.position.set(bx - 0.16, fl + 0.86, bz);
  mesh(k, new THREE.CylinderGeometry(0.035, 0.07, 0.1, 10).translate(0, -0.05, 0), '#d8b24a', 0, 0, 0, bell);
  mesh(k, new THREE.SphereGeometry(0.018, 6, 4), '#7a5a2a', 0, -0.11, 0, bell);
  k.add(bell);
  k.anims.push((t) => (bell.rotation.z = Math.sin(t * 7) * 0.22 * (cyc(t, 6) < 0.3 ? 1 : 0.15)));
  // Kerbed ramp at the entry, sign, lamps
  for (let i = 0; i < 4; i++) {
    const [rx, rz] = P(0.35, 1.38 + i * 0.0);
    void rx;
    void rz;
  }
  const [ex, ez] = P(0.35, 1.3);
  const ramp = k.box(0.62, 0.05, 0.3, '#c9c3b5', ex, fl, ez);
  ramp.rotation.y = 0.35;
  signPost(k, 'MORTAR BAY 2', -1.15, 1.2, fl, 0.7, C.trim, 0.56, 0.15, 0.36, C.white);
  k.lamp(1.3, 0.95, fl, 1.2);
  spotter(k, 0.62, fl + 0.012, -0.85, face(0.6, 1), OFFICER, 15, false);
}

// ------------------------------------------------------------------ BASE (7–10)

/** Concrete ring with merlons (aiming slots) round the top. */
function concreteRing(k: Kit, rIn: number, rOut: number, h: number, y: number, gap: number, gapAt: number, merlons = 0, mh = 0.16) {
  ring(k, rIn, rOut, h, y, CONCRETE, gap, gapAt);
  ring(k, rIn - 0.015, rOut + 0.015, 0.045, y + h, '#bdb8ad', gap, gapAt);
  for (let i = 0; i < merlons; i++) {
    const phi = ((i + 0.5) / merlons) * Math.PI * 2;
    const dphi = Math.atan2(Math.sin(phi - gapAt), Math.cos(phi - gapAt));
    if (Math.abs(dphi) < gap / 2 + 0.15) continue;
    const [px, pz] = P(phi, (rIn + rOut) / 2);
    const m = k.box(0.26, mh, rOut - rIn, CONCRETE, px, y + h + 0.04, pz);
    m.rotation.y = phi;
  }
  for (const sd of [-1, 1]) {
    const phi = gapAt + sd * (gap / 2 + 0.04);
    const [px, pz] = P(phi, (rIn + rOut) / 2);
    const p = k.box(0.12, h + 0.12, rOut - rIn + 0.06, CONCRETE, px, y, pz);
    p.rotation.y = phi;
    for (let j = 0; j < 4; j++) {
      const s = k.box(0.125, 0.07, rOut - rIn + 0.065, j % 2 ? C.kerbB : HAZ, px, y + 0.06 + j * 0.14, pz);
      s.rotation.y = phi;
    }
  }
}

/** Grassed earth berm hugging the outside of the pit. */
function berm(k: Kit, rIn: number, rOut: number, h: number, y: number, gap: number, gapAt: number) {
  ring(k, rIn, rOut, h, y, GRASS_D, gap, gapAt, 'berm', 36);
}

/** Grass-roofed concrete ready-ammo bunker with a sliding steel blast door. */
function readyBunker(k: Kit, x: number, z: number, y: number, ry: number, w = 0.9, d = 0.55, h = 0.5, period = 8) {
  sub(k, x, y, z, ry, (s) => {
    s.box(w, h, d, CONCRETE, 0, 0, 0);
    s.box(w + 0.1, 0.08, d + 0.1, '#bdb8ad', 0, h, 0);
    const mound = mesh(s, new THREE.SphereGeometry(0.5, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), GRASS, 0, h + 0.06, 0);
    mound.scale.set(w * 0.95, 0.32, d * 1.6);
    s.box(0.42, 0.42, 0.02, '#2a2e2a', 0, 0.04, d / 2 + 0.005);
    const door = s.box(0.42, 0.42, 0.04, '#5c6166', 0, 0.04, d / 2 + 0.03);
    for (let i = 0; i < 3; i++) s.box(0.4, 0.02, 0.045, '#8a9196', 0, 0.1 + i * 0.12, 0, door).position.set(0, -0.12 + i * 0.12, 0.002);
    s.box(0.56, 0.03, 0.03, '#33383d', 0, 0.47, d / 2 + 0.035);
    for (let i = 0; i < 5; i++) s.box(0.1, 0.04, 0.012, i % 2 ? C.kerbB : HAZ, -0.2 + i * 0.1, 0.5, d / 2 + 0.01);
    s.anims.push((t) => {
      const u = cyc(t, period, 0.5);
      door.position.x = (u < 0.15 ? sm(u / 0.15) : u < 0.55 ? 1 : 1 - sm((u - 0.55) / 0.15)) * 0.4;
    });
  });
}

/** Tripod stereo rangefinder with a slowly traversing bar. */
function rangefinder(k: Kit, x: number, z: number, y: number, seed = 0) {
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    strut(k, undefined, V(x + Math.cos(a) * 0.14, y, z + Math.sin(a) * 0.14), V(x, y + 0.42, z), 0.012, STEEL_D);
  }
  const head = new THREE.Group();
  head.position.set(x, y + 0.44, z);
  mesh(k, new THREE.CylinderGeometry(0.03, 0.03, 0.62, 8).rotateZ(Math.PI / 2), '#4b5a3a', 0, 0, 0, head);
  for (const s of [-1, 1]) mesh(k, new THREE.CylinderGeometry(0.04, 0.04, 0.05, 8), '#2f3a22', s * 0.31, 0, 0, head);
  mesh(k, new THREE.BoxGeometry(0.08, 0.07, 0.08), '#2f3a22', 0, 0.02, 0.03, head);
  k.add(head);
  k.anims.push((t) => (head.rotation.y = 0.8 + Math.sin(t * 0.3 + seed) * 0.7));
}

/** Davit hoist: post and jib that swings in over the pit and lowers a crate on a chain. */
function davit(k: Kit, x: number, z: number, y: number, h: number, jib: number, inward: number, period = 10) {
  k.cyl(0.05, h, '#d8b24a', x, y, z, 8);
  k.box(0.2, 0.06, 0.2, STEEL_D, x, y, z);
  const arm = new THREE.Group();
  arm.position.set(x, y + h, z);
  k.box(jib + 0.08, 0.06, 0.06, HAZ, jib / 2 - 0.04, 0, 0, arm);
  strut(k, arm, V(0, -0.28, 0), V(jib * 0.6, 0, 0), 0.015, HAZ);
  for (let i = 0; i < 4; i++) k.box(0.05, 0.065, 0.065, C.kerbB, 0.05 + i * (jib / 4), 0, 0, arm);
  const chain = mesh(k, new THREE.BoxGeometry(0.012, 1, 0.012).translate(0, -0.5, 0), '#33383d', jib - 0.02, -0.02, 0, arm);
  const hook = new THREE.Group();
  hook.position.set(jib - 0.02, 0, 0);
  ammoBox(k, 0, -0.14, 0, 0, OLIVE, 0.2, 0.12, 0.14, 'HE', hook);
  for (const s of [-1, 1]) strut(k, hook, V(s * 0.08, -0.02, 0), V(0, 0.08, 0), 0.005, '#33383d', 3);
  arm.add(hook);
  k.add(arm);
  k.anims.push((t) => {
    const u = cyc(t, period);
    const swing = u < 0.2 ? sm(u / 0.2) : u < 0.65 ? 1 : 1 - sm((u - 0.65) / 0.2);
    const drop = u < 0.25 ? 0 : u < 0.4 ? sm((u - 0.25) / 0.15) : u < 0.55 ? 1 : u < 0.68 ? 1 - sm((u - 0.55) / 0.13) : 0;
    arm.rotation.y = inward - 1.3 + swing * 1.3;
    const L = 0.2 + drop * (h - 0.42);
    chain.scale.y = L;
    hook.position.y = -L - 0.02;
    hook.rotation.y = Math.sin(t * 1.7) * 0.2;
    hook.visible = !(u > 0.47 && u < 0.53) || true;
  });
}

/** Concrete crew shelter with a sandbag parapet on the roof and a dark doorway facing the pit. */
function shelter(k: Kit, x: number, z: number, y: number, ry: number, w: number, d: number, h: number, seed: number) {
  sub(k, x, y, z, ry, (s) => {
    s.box(w, h, d, CONCRETE, 0, 0, 0);
    s.box(w + 0.08, 0.06, d + 0.08, '#bdb8ad', 0, h, 0);
    s.box(0.3, 0.5, 0.02, '#1d2326', 0, 0, d / 2 + 0.005);
    s.box(0.36, 0.05, 0.05, C.trim, 0, 0.5, d / 2 + 0.02);
    s.box(w - 0.16, 0.05, 0.02, '#1d2326', 0, h - 0.22, -d / 2 - 0.005);
    board(s, 'CREW', 0.22, 0.08, 0.3, 0.3, d / 2 + 0.02, C.trim);
    const b = new Bags(seed);
    b.line(0, -d / 2 + 0.1, w - 0.05, 0, h + 0.06, 2);
    b.line(-w / 2 + 0.1, 0, d - 0.25, Math.PI / 2, h + 0.06, 2);
    b.line(w / 2 - 0.1, 0, d - 0.25, Math.PI / 2, h + 0.06, 2);
    b.flush(s);
    s.antenna(w / 2 - 0.1, h + 0.06, d / 2 - 0.12, 0.6);
  });
}

/** Concrete fire-direction bunker with slit windows and a rotating periscope. */
function fdcBunker(k: Kit, x: number, z: number, y: number, ry: number, w = 0.9, d = 0.66, h = 0.66) {
  sub(k, x, y, z, ry, (s) => {
    s.box(w, h, d, CONCRETE, 0, 0, 0);
    s.box(w + 0.12, 0.1, d + 0.12, '#bdb8ad', 0, h, 0);
    s.box(w - 0.2, 0.06, 0.02, '#1d2326', 0, h - 0.2, d / 2 + 0.005);
    s.box(0.02, 0.06, d - 0.25, '#1d2326', w / 2 + 0.005, h - 0.2, 0);
    s.box(0.28, 0.44, 0.03, '#4a4f54', -w / 2 + 0.22, 0, d / 2 + 0.005);
    for (const sx of [-1, 1]) {
      const wing = s.box(0.3, h * 0.7, 0.08, CONCRETE, sx * (w / 2 + 0.1), 0, d / 2 + 0.04);
      wing.rotation.y = sx * 0.6;
    }
    const peri = new THREE.Group();
    peri.position.set(0.15, h + 0.1, -0.05);
    s.cyl(0.035, 0.22, '#4a4f54', 0.15, h + 0.1, -0.05, 6);
    s.box(0.08, 0.07, 0.07, '#4a4f54', 0.02, 0.22, 0, peri);
    s.box(0.012, 0.045, 0.05, DARK_GLASS, 0.065, 0.23, 0, peri);
    s.add(peri);
    s.anims.push((t) => (peri.rotation.y = Math.sin(t * 0.35) * 1.4));
    board(s, 'FDC', 0.24, 0.1, 0.2, 0.3, d / 2 + 0.02, C.trim);
    s.antenna(-w / 2 + 0.12, h + 0.1, -d / 2 + 0.12, 0.9);
  });
}

/** Narrow-gauge ammo rail with a trolley that rolls in and out. */
function ammoRail(k: Kit, x0: number, z0: number, x1: number, z1: number, y: number, period = 9) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ry = face(x1 - x0, z1 - z0);
  sub(k, (x0 + x1) / 2, y, (z0 + z1) / 2, ry, (s) => {
    for (const sd of [-1, 1]) s.box(len, 0.025, 0.02, '#8a9196', 0, 0.02, sd * 0.09);
    for (let i = 0; i < Math.round(len / 0.14); i++) s.box(0.05, 0.02, 0.26, TIMBER, -len / 2 + 0.07 + i * 0.14, 0, 0);
    const tr = new THREE.Group();
    s.box(0.34, 0.08, 0.22, '#4b6b3a', 0, 0.05, 0, tr);
    for (let i = 0; i < 6; i++) {
      const b = bomb(s, tr, GUN, HAZ, 0.9);
      b.rotation.z = Math.PI / 2;
      b.position.set(0, 0.16 + (i >= 3 ? 0.05 : 0), -0.07 + (i % 3) * 0.07);
    }
    const wheels: THREE.Mesh[] = [];
    for (const wx of [-0.1, 0.1]) for (const sd of [-1, 1]) {
      const w = mesh(s, new THREE.CylinderGeometry(0.04, 0.04, 0.02, 8).rotateX(Math.PI / 2), '#33383d', wx, 0.04, sd * 0.09, tr) as THREE.Mesh;
      wheels.push(w);
    }
    s.add(tr);
    s.anims.push((t) => {
      const u = cyc(t, period);
      const p = u < 0.35 ? sm(u / 0.35) : u < 0.55 ? 1 : u < 0.9 ? 1 - sm((u - 0.55) / 0.35) : 0;
      tr.position.x = -len / 2 + 0.2 + p * (len - 0.4);
      wheels.forEach((w) => (w.rotation.z = -tr.position.x / 0.04));
    });
  });
}

function base(k: Kit, level: number, y: number) {
  const fl = y;
  if (level === 7) {
    // Concrete pit: thick ring with merlons, ready bunker cut into the back
    concreteRing(k, 1.1, 1.34, 0.5, fl, 0.55, 0.4, 9, 0.14);
    disc(k, 1.1, 0.014, '#c2bdb2', 0, fl, 0);
    for (let i = 0; i < 4; i++) k.box(0.2, 0.006, 0.05, '#5c6166', -0.9 + i * 0.0, fl + 0.015, 0.4 + i * 0.07);
    const py = plinth(k, 0.6, fl + 0.014);
    const rig = fieldMortar(k, 0.05, py, 0.1, 'twin');
    tubeLoaders(k, rig, BASE, 16, true, 4.6);
    registerRig(k, rig, level, 7, 0.7, 0.3);
    readyBunker(k, 0.15, -1.12, fl, -0.12);
    shelter(k, -1.0, -1.0, fl, Math.PI / 4, 0.66, 0.52, 1.0, 71);
    rangefinder(k, -0.8, 0.45, fl + 0.014, 1);
    spotter(k, -0.9, fl + 0.014, 0.18, face(0.5, 1), BASE, 17, false);
    bombRack(k, 0.82, fl + 0.014, -0.45, 1.2, 6, '#4b6b3a');
    bombRack(k, 0.5, fl + 0.014, -0.82, 0.55, 6, '#4b6b3a');
    k.lamp(1.3, 1.3, fl, 1.15);
    k.lamp(-1.32, -1.2, fl, 1.15);
    signPost(k, 'NO SMOKING', 1.25, 0.35, fl, Math.PI / 2 - 0.3, RED, 0.48, 0.14, 0.32, C.metal);
    return;
  }
  if (level === 8) {
    // Heavy mortar pit: heavy twin tubes, concrete ring inside a grassed berm, davit hoist
    berm(k, 1.2, 1.5, 0.42, fl, 0.6, 0.4);
    concreteRing(k, 1.06, 1.22, 0.56, fl, 0.55, 0.4, 0);
    disc(k, 1.06, 0.014, '#c2bdb2', 0, fl, 0);
    const py = plinth(k, 0.66, fl + 0.014);
    const rig = fieldMortar(k, 0.02, py, 0.06, 'heavy');
    tubeLoaders(k, rig, BASE, 18, true, 4.6);
    registerRig(k, rig, level, 8, 0.7, 0.3);
    davit(k, 0.95, -0.95, fl + 0.3, 1.2, 0.6, face(-1, 1));
    shelter(k, -1.0, -1.0, fl, Math.PI / 4, 0.7, 0.56, 1.06, 72);
    k.box(0.34, 0.3, 0.34, CONCRETE, 0.95, fl, -0.95);
    for (let i = 0; i < 3; i++) {
      const a = 3.4 + i * 0.45;
      const [px, pz] = P(a, 0.92);
      const l = k.box(0.28, 0.44, 0.17, '#4b6b3a', px, fl + 0.014, pz);
      l.rotation.y = a;
    }
    bombRack(k, 0.82, fl + 0.014, -0.18, 1.5, 6, '#4b6b3a');
    // Concrete steps down through the berm
    for (let i = 0; i < 3; i++) {
      const [sx, sz] = P(0.4, 1.28 + i * 0.08);
      const st = k.box(0.5, 0.3 - i * 0.09, 0.1, '#c2bcae', sx, fl, sz);
      st.rotation.y = 0.4;
    }
    k.lamp(-1.1, 1.05, fl + 0.2, 1.1);
    k.lamp(1.2, 0.4, fl + 0.3, 1.0);
    spotter(k, -0.75, fl + 0.014, -0.6, face(0.5, 1), BASE, 19, true);
    return;
  }
  if (level === 9) {
    // Fire-direction pit: + FDC bunker with a rotating periscope, blast wings, hoist
    berm(k, 1.22, 1.5, 0.46, fl, 0.6, 0.4);
    concreteRing(k, 1.06, 1.24, 0.58, fl, 0.55, 0.4, 8, 0.12);
    disc(k, 1.06, 0.014, '#c2bdb2', 0, fl, 0);
    const py = plinth(k, 0.66, fl + 0.014);
    const rig = fieldMortar(k, 0.1, py, 0.12, 'heavy');
    tubeLoaders(k, rig, BASE, 20, true, 4.6);
    registerRig(k, rig, level, 9, 0.7, 0.3);
    fdcBunker(k, -0.92, -0.92, fl + 0.18, Math.PI / 4, 0.86, 0.6, 1.07);
    davit(k, 1.0, -0.9, fl + 0.32, 1.2, 0.58, face(-1, 1), 11);
    k.box(0.34, 0.32, 0.34, CONCRETE, 1.0, fl, -0.9);
    bombRack(k, 0.86, fl + 0.014, -0.05, 1.5, 6, '#4b6b3a');
    bombRack(k, 0.35, fl + 0.014, -0.86, 0.35, 6, '#4b6b3a');
    for (let i = 0; i < 3; i++) {
      const [sx, sz] = P(0.4, 1.28 + i * 0.08);
      const st = k.box(0.5, 0.3 - i * 0.09, 0.1, '#c2bcae', sx, fl, sz);
      st.rotation.y = 0.4;
    }
    k.lamp(-1.2, 0.95, fl + 0.2, 1.1);
    k.lamp(1.25, 0.45, fl + 0.3, 1.0);
    k.blinker(-0.52, fl + 0.8, -1.22, '#ff3b30', 0.03);
    return;
  }
  // 10: Mortar battery: grand double ring, gateway, magazine with an ammo rail into the pit
  berm(k, 1.22, 1.5, 0.5, fl, 0.7, 0.0);
  concreteRing(k, 1.04, 1.24, 0.62, fl, 0.62, 0.0, 10, 0.16);
  disc(k, 1.04, 0.014, '#c2bdb2', 0, fl, 0);
  ring(k, 0.84, 0.88, 0.006, fl + 0.014, HAZ);
  const py = plinth(k, 0.64, fl + 0.014);
  const rig = fieldMortar(k, 0.08, py, -0.05, 'heavyPlus');
  tubeLoaders(k, rig, BASE, 21, true, 4.6);
  registerRig(k, rig, level, 10, 0.75, 0.6);
  // Gateway arch over the entry
  for (const sx of [-1, 1]) {
    k.box(0.16, 1.05, 0.34, CONCRETE, sx * 0.42, fl, 1.32);
    k.box(0.2, 0.05, 0.38, C.trim, sx * 0.42, fl + 1.05, 1.32);
  }
  k.box(1.04, 0.22, 0.36, CONCRETE, 0, fl + 1.05, 1.32);
  board(k, 'MORTAR BATTERY', 0.86, 0.15, 0, fl + 1.08, 1.505, C.trim, '#ffffff');
  for (let i = 0; i < 8; i++) k.box(0.13, 0.05, 0.37, i % 2 ? C.kerbB : HAZ, -0.455 + i * 0.13, fl + 1.27, 1.32);
  // Magazine + rail
  fdcBunker(k, -1.0, -0.95, fl + 0.2, Math.PI / 4, 0.84, 0.58, 1.12);
  readyBunker(k, 0.98, -0.98, fl + 0.22, -Math.PI / 4, 0.78, 0.5, 0.48, 9);
  ammoRail(k, 0.82, -0.82, 0.42, -0.42, fl + 0.014, 9);
  bombRack(k, 0.88, fl + 0.014, 0.2, 1.75, 6, '#4b6b3a');
  bombRack(k, -0.85, fl + 0.014, 0.25, -1.6, 6, '#4b6b3a');
  k.flagpole(-1.3, 0.75, 2.0, fl + 0.2);
  k.lamp(1.25, 1.25, fl + 0.1, 1.2);
  k.lamp(-1.25, 1.25, fl + 0.1, 1.2);
  rangeFlag(k, 1.32, 0.2, fl + 0.3, 1.5);
  spotter(k, 0.75, fl + 0.014, 0.52, face(0.2, 1), OFFICER, 22, false);
}

// ------------------------------------------------------------------ COMMAND (11–15)

/** White ring with a teal band and a teal-lit coping. */
function whiteRing(k: Kit, rIn: number, rOut: number, h: number, y: number, gap: number, gapAt: number) {
  ring(k, rIn, rOut, h, y, C.white, gap, gapAt);
  ring(k, rOut, rOut + 0.012, 0.06, y + h * 0.45, TEAL, gap, gapAt);
  ring(k, rIn - 0.02, rOut + 0.02, 0.04, y + h, '#d9dcdc', gap, gapAt);
  for (const sd of [-1, 1]) {
    const phi = gapAt + sd * (gap / 2 + 0.04);
    const [px, pz] = P(phi, (rIn + rOut) / 2);
    const p = k.box(0.12, h + 0.14, rOut - rIn + 0.06, C.white, px, y, pz);
    p.rotation.y = phi;
    const [lx, lz] = P(phi, rOut + 0.04);
    pulse(k, 0.05, 0.05, 0.05, TEAL, lx, y + h + 0.08, lz, 2.4);
  }
}

/** Glass control kiosk with fins and a green roof (screens pulse inside). */
function kiosk(k: Kit, x: number, z: number, y: number, ry: number, w: number, d: number, h: number, storeys = 1) {
  sub(k, x, y, z, ry, (s) => {
    s.box(w, 0.12, d, C.white, 0, 0, 0);
    s.glassBox(w - 0.06, h, d - 0.06, 0, 0.12, 0);
    if (storeys > 1) {
      s.box(w + 0.04, 0.08, d + 0.04, C.white, 0, 0.12 + h, 0);
      s.box(w, h * 0.8, d, C.white, 0, 0.2 + h, 0);
      s.box(w - 0.2, 0.18, 0.02, DARK_GLASS, 0, 0.32 + h, d / 2 + 0.005);
      s.fins(w - 0.1, h * 0.8, 0, 0.2 + h, d / 2 + 0.06, 6);
    }
    const top = 0.12 + h + (storeys > 1 ? 0.08 + h * 0.8 : 0);
    s.box(w + 0.16, 0.07, d + 0.16, C.roofGreen, 0, top, 0);
    s.box(w + 0.18, 0.03, d + 0.18, C.white, 0, top - 0.02, 0);
    pulse(s, w * 0.5, 0.14, 0.02, '#5fe0d0', 0, 0.3, -d / 2 + 0.06, 1.7);
    s.aircon(w / 2 + 0.05, 0.14, -0.05, Math.PI / 2);
  });
}

function command(k: Kit, level: number, y: number) {
  const fl = y;
  if (level === 11) {
    whiteRing(k, 1.06, 1.24, 0.5, fl, 0.6, 0.4);
    disc(k, 1.06, 0.014, '#dcdedd', 0, fl, 0);
    ring(k, 0.6, 0.66, 0.006, fl + 0.014, TEAL);
    turretMortar(k, 0.05, fl + 0.014, 0.0, level, CMD, 23);
    kiosk(k, -1.0, -1.0, fl, Math.PI / 4, 0.62, 0.5, 0.68, 2);
    bombRack(k, 0.75, fl + 0.014, -0.6, 0.9, 6, C.metal);
    k.flagpole(1.25, -1.25, 1.9, fl);
    k.lamp(1.3, 1.25, fl, 1.2);
    signPost(k, 'MORTAR 11', -1.15, 1.25, fl, 0.6, TEAL, 0.5, 0.15, 0.34, C.white);
    return;
  }
  if (level === 12) {
    whiteRing(k, 1.08, 1.26, 0.52, fl, 0.6, 0.4);
    disc(k, 1.08, 0.014, '#dcdedd', 0, fl, 0);
    ring(k, 0.86, 0.9, 0.006, fl + 0.014, TEAL);
    turretMortar(k, 0.12, fl + 0.014, 0.08, level, CMD, 24);
    kiosk(k, -0.98, -0.98, fl, Math.PI / 4, 0.7, 0.52, 0.7, 2);
    // Magazine pavilion: green canopy on white posts over bomb racks
    sub(k, 1.02, fl, -1.02, -Math.PI / 4, (s) => {
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) s.box(0.05, 0.62, 0.05, C.white, sx * 0.28, 0, sz * 0.18);
      s.box(0.72, 0.06, 0.5, C.roofGreen, 0, 0.62, 0);
      s.box(0.74, 0.025, 0.52, C.white, 0, 0.6, 0);
      bombRack(s, 0, 0.0, 0, 0, 6, C.metal);
    });
    k.flagpole(1.3, 0.3, 1.9, fl);
    k.lamp(1.3, 1.25, fl, 1.2);
    signPost(k, 'AUTOLOADER', -1.15, 1.25, fl, 0.6, TEAL, 0.52, 0.15, 0.34, C.white);
    return;
  }
  if (level === 13) {
    whiteRing(k, 1.08, 1.28, 0.56, fl, 0.6, 0.4);
    disc(k, 1.08, 0.014, '#dcdedd', 0, fl, 0);
    ring(k, 0.86, 0.9, 0.006, fl + 0.014, TEAL);
    turretMortar(k, 0.12, fl + 0.014, 0.08, level, CMD, 25);
    sub(k, -0.98, fl, -0.98, Math.PI / 4, (s) => {
      // Two-storey control block with a roof garden
      s.box(0.78, 0.12, 0.56, C.white, 0, 0, 0);
      s.glassBox(0.72, 0.64, 0.5, 0, 0.12, 0);
      s.box(0.82, 0.08, 0.6, C.white, 0, 0.76, 0);
      s.box(0.78, 0.56, 0.56, C.white, 0, 0.84, 0);
      s.box(0.6, 0.2, 0.02, DARK_GLASS, 0, 1.02, 0.285);
      s.fins(0.66, 0.56, 0, 0.84, 0.32, 6);
      s.box(0.84, 0.06, 0.62, C.roofGreen, 0, 1.4, 0);
      for (let i = 0; i < 4; i++) s.hedge(-0.25 + i * 0.17, 0, 0.12, 0.4, 1.46);
      pulse(s, 0.4, 0.14, 0.02, '#5fe0d0', 0, 0.3, -0.22, 1.7);
    });
    metMast(k, 1.25, -1.25, fl, 1.3);
    balloon(k, 1.25, 0.6, fl, 1.25);
    sub(k, 1.0, fl, -0.55, -1.2, (s) => bombRack(s, 0, 0.0, 0, 0, 6, C.metal));
    k.lamp(1.3, 1.25, fl, 1.2);
    signPost(k, 'MET STATION', -1.12, 1.25, fl, 0.6, TEAL, 0.56, 0.15, 0.34, C.white);
    return;
  }
  if (level === 14) {
    whiteRing(k, 1.1, 1.3, 0.5, fl, 0.6, 0.4);
    disc(k, 1.1, 0.014, '#dcdedd', 0, fl, 0);
    turntable(k, 0.05, fl + 0.05, 0.05, level, { tubes: 2, deck: '#e2e5e7', rim: TEAL, accent: TEAL, seed: 26, crewLook: CMD });
    kiosk(k, -1.02, -1.02, fl, Math.PI / 4, 0.62, 0.48, 0.74, 2);
    metMast(k, 1.25, -1.25, fl, 1.2);
    k.flagpole(1.3, 0.35, 1.9, fl);
    k.lamp(1.3, 1.25, fl, 1.2);
    signPost(k, 'TURNTABLE', -1.15, 1.25, fl, 0.6, TEAL, 0.5, 0.15, 0.34, C.white);
    return;
  }
  // 15: Mortar rotunda: white colonnade with a green ring roof round the turntable
  whiteRing(k, 1.1, 1.3, 0.42, fl, 0.6, 0.4);
  disc(k, 1.1, 0.014, '#dcdedd', 0, fl, 0);
  turntable(k, 0.0, fl + 0.05, 0.0, level, { tubes: 2, deck: '#e2e5e7', rim: TEAL, accent: TEAL, seed: 27, crewLook: CMD });
  const cols = 12;
  for (let i = 0; i < cols; i++) {
    const phi = (i / cols) * Math.PI * 2 + 0.13;
    const [px, pz] = P(phi, 1.2);
    k.cyl(0.05, 1.03, C.white, px, fl + 0.42, pz, 8);
  }
  ring(k, 1.0, 1.4, 0.08, fl + 1.45, C.roofGreen, 0, 0, 'wall', 36);
  ring(k, 0.98, 1.42, 0.04, fl + 1.41, C.white, 0, 0, 'wall', 36);
  ring(k, 1.0, 1.02, 0.12, fl + 1.53, TEAL, 0, 0, 'wall', 36);
  for (let i = 0; i < 6; i++) {
    const [lx, lz] = P((i / 6) * Math.PI * 2, 1.0);
    pulse(k, 0.06, 0.04, 0.06, '#5fe0d0', lx, fl + 1.37, lz, 1.5);
  }
  // Crest plinth and twin flags at the entry
  k.box(0.3, 0.28, 0.12, C.white, -0.6, fl, 1.32);
  const crest = mesh(k, new THREE.CylinderGeometry(0.1, 0.1, 0.03, 12).rotateX(Math.PI / 2), TEAL, -0.6, fl + 0.4, 1.33);
  k.anims.push((t) => (crest.rotation.y = t * 0.8));
  k.flagpole(1.0, 1.3, 2.0, fl);
  k.flagpole(-1.3, 0.75, 2.0, fl);
}

// ------------------------------------------------------------------ SECURE (16–20)

function casemateDrum(k: Kit, rIn: number, rOut: number, h: number, y: number, gap: number, gapAt: number, col: string, top: string) {
  ring(k, rIn, rOut, h, y, col, gap, gapAt, 'wall', 36);
  ring(k, rIn - 0.02, rOut + 0.02, 0.06, y + h, top, gap, gapAt, 'wall', 36);
  ring(k, rIn - 0.01, rIn + 0.05, 0.05, y + h + 0.05, HAZ, gap, gapAt, 'wall', 36);
  for (const sd of [-1, 1]) {
    const phi = gapAt + sd * (gap / 2 + 0.04);
    const [px, pz] = P(phi, (rIn + rOut) / 2);
    const p = k.box(0.14, h + 0.1, rOut - rIn + 0.06, col, px, y, pz);
    p.rotation.y = phi;
  }
}

function riveted(k: Kit, r: number, h: number, y: number, n: number, gap: number, gapAt: number, col = ARMOUR) {
  for (let i = 0; i < n; i++) {
    const phi = ((i + 0.5) / n) * Math.PI * 2;
    const dphi = Math.atan2(Math.sin(phi - gapAt), Math.cos(phi - gapAt));
    if (Math.abs(dphi) < gap / 2 + 0.12) continue;
    const [px, pz] = P(phi, r);
    const pl = k.box(((2 * Math.PI * r) / n) * 0.92, h, 0.04, i % 2 ? col : ARMOUR_D, px, y, pz);
    pl.rotation.y = phi;
    for (const dy of [0.06, h - 0.06]) for (const dx of [-1, 1]) {
      const [rx, rz] = P(phi + dx * 0.09 / r, r + 0.025);
      k.box(0.02, 0.02, 0.02, '#8a8f80', rx, y + dy, rz);
    }
  }
}

/** Hovering tethered spotter drone with spinning rotors. */
function drone(k: Kit, x: number, z: number, y: number, h: number, gold = false) {
  const g = new THREE.Group();
  g.position.set(x, y + h, z);
  k.box(0.2, 0.06, 0.2, '#2a2e2a', 0, 0, 0, g);
  k.box(0.08, 0.05, 0.08, gold ? GOLD : '#4a4f54', 0, -0.05, 0, g);
  mesh(k, new THREE.SphereGeometry(0.03, 6, 4), DARK_GLASS, 0.03, -0.07, 0, g);
  const props: THREE.Object3D[] = [];
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const a = k.box(0.18, 0.02, 0.025, '#2a2e2a', dx * 0.09, 0.02, dz * 0.09, g);
    a.rotation.y = Math.atan2(dz, dx) * -1;
    disc(k, 0.025, 0.03, '#33383d', dx * 0.15, 0.02, dz * 0.15, 6, g);
    const p = mesh(k, new THREE.BoxGeometry(0.18, 0.006, 0.025), '#9aa3a6', dx * 0.15, 0.06, dz * 0.15, g);
    props.push(p);
  }
  const led = mesh(k, new THREE.BoxGeometry(0.03, 0.02, 0.03), glow('#3fd16b', 1), -0.1, 0.03, 0, g);
  k.add(g);
  const tether = mesh(k, new THREE.BoxGeometry(0.006, 1, 0.006).translate(0, 0.5, 0), '#e8e6e0', x, y, z);
  k.anims.push((t) => {
    g.position.set(x + Math.sin(t * 0.5) * 0.12, y + h + Math.sin(t * 1.3) * 0.05, z + Math.cos(t * 0.37) * 0.1);
    g.rotation.y = t * 0.3;
    g.rotation.z = Math.sin(t * 0.5) * 0.06;
    props.forEach((p, i) => (p.rotation.y = t * 40 + i));
    tether.scale.y = g.position.y - y;
    tether.position.set(x, y, z);
    tether.rotation.z = -(g.position.x - x) / h;
    tether.rotation.x = (g.position.z - z) / h;
    ((led as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(t * 5) > 0 ? 1.5 : 0.2;
  });
}

/** Electro-optical sensor ball on a mast, slewing. */
function sensorBall(k: Kit, x: number, z: number, y: number, h: number, gold = false) {
  k.cyl(0.04, h, '#4a4f54', x, y, z, 6);
  const head = new THREE.Group();
  head.position.set(x, y + h + 0.1, z);
  mesh(k, new THREE.SphereGeometry(0.1, 10, 8), gold ? GOLD : '#e8e6e0', 0, 0, 0, head);
  mesh(k, new THREE.CylinderGeometry(0.045, 0.045, 0.03, 8).rotateZ(Math.PI / 2), DARK_GLASS, 0.09, 0.0, -0.03, head);
  mesh(k, new THREE.CylinderGeometry(0.03, 0.03, 0.03, 8).rotateZ(Math.PI / 2), '#ff3b30', 0.09, 0.0, 0.04, head);
  k.box(0.14, 0.05, 0.14, '#4a4f54', x, y + h, z);
  k.add(head);
  k.anims.push((t) => {
    head.rotation.y = Math.sin(t * 0.4) * 1.6;
    head.rotation.z = Math.sin(t * 0.7) * 0.2 - 0.1;
  });
}

/** Acoustic sensor mast: a cluster of horns that turns slowly. */
function acousticMast(k: Kit, x: number, z: number, y: number, h: number) {
  k.cyl(0.03, h, '#4a4f54', x, y, z, 6);
  const head = new THREE.Group();
  head.position.set(x, y + h, z);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const horn = mesh(k, new THREE.CylinderGeometry(0.05, 0.015, 0.14, 8).rotateZ(-Math.PI / 2), '#d5d9dc', Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08, head);
    horn.rotation.y = -a;
  }
  disc(k, 0.04, 0.06, '#33383d', 0, -0.03, 0, 6, head);
  k.add(head);
  k.anims.push((t) => (head.rotation.y = t * 0.6 + x));
}

/** T-wall blast barrier section. */
function tWall(k: Kit, x: number, z: number, y: number, ry: number, h = 0.8, gold = false) {
  sub(k, x, y, z, ry, (s) => {
    s.box(0.5, 0.12, 0.3, CONCRETE, 0, 0, 0);
    s.box(0.5, h, 0.1, CONCRETE, 0, 0.12, 0);
    s.box(0.52, 0.04, 0.12, gold ? GOLD : HAZ, 0, 0.12 + h - 0.04, 0);
  });
}

function secure(k: Kit, level: number, y: number) {
  const fl = y;
  const gold = level === 20;
  if (level === 16) {
    // Hardened casemate: thick concrete drum, grass glacis, armoured turntable, magazine hatches
    berm(k, 1.3, 1.5, 0.4, fl, 0.55, 0.4);
    casemateDrum(k, 1.0, 1.34, 0.66, fl, 0.5, 0.4, CONCRETE, '#9a968d');
    disc(k, 1.0, 0.014, '#a9a59c', 0, fl, 0);
    turntable(k, 0.05, fl + 0.05, 0.05, level, { tubes: 2, deck: '#6b7075', rim: HAZ, armour: ARMOUR, accent: HAZ, seed: 28, crewLook: SEC });
    magazine(k, -1.0, -1.0, fl, 0.78, 0.7, 1.32, Math.PI / 4, CONCRETE, ARMOUR, 7);
    cctv(k, 1.25, -1.25, fl, 1.2, Math.PI * 0.75);
    beacon(k, 0.95, fl + 0.72, -0.95);
    k.lamp(1.3, 1.25, fl + 0.2, 1.1);
    signPost(k, 'DANGER', -1.2, 1.2, fl, 0.7, RED, 0.42, 0.14, 0.34, '#4a4f54');
    return;
  }
  if (level === 17) {
    // Armoured casemate: riveted armour skin, quad tubes, acoustic sensor masts
    berm(k, 1.3, 1.5, 0.42, fl, 0.55, 0.4);
    casemateDrum(k, 1.0, 1.32, 0.7, fl, 0.5, 0.4, CONCRETE, '#7f7b72');
    riveted(k, 1.35, 0.56, fl + 0.06, 18, 0.5, 0.4);
    disc(k, 1.0, 0.014, '#a9a59c', 0, fl, 0);
    turntable(k, 0.05, fl + 0.05, 0.05, level, { tubes: 4, deck: '#5c6166', rim: HAZ, armour: ARMOUR, accent: HAZ, seed: 29, crewLook: SEC });
    magazine(k, -1.0, -1.0, fl, 0.8, 0.72, 1.38, Math.PI / 4, ARMOUR_D, ARMOUR, 7);
    acousticMast(k, 1.22, -1.22, fl, 1.4);
    acousticMast(k, -1.3, 0.75, fl, 1.2);
    beacon(k, 0.95, fl + 0.77, -0.95);
    beacon(k, -0.8, fl + 0.77, 0.95);
    cctv(k, 1.3, 0.9, fl, 1.1, Math.PI);
    return;
  }
  if (level === 18) {
    // Drone-spotted casemate: + T-wall corners, drone pad on the magazine, tethered drone overhead
    casemateDrum(k, 0.98, 1.3, 0.74, fl, 0.5, 0.4, CONCRETE, '#7f7b72');
    riveted(k, 1.33, 0.6, fl + 0.06, 18, 0.5, 0.4);
    disc(k, 0.98, 0.014, '#a9a59c', 0, fl, 0);
    turntable(k, 0.05, fl + 0.05, 0.05, level, { tubes: 4, deck: '#5c6166', rim: HAZ, armour: ARMOUR, accent: HAZ, seed: 30, crewLook: SEC });
    magazine(k, -1.0, -1.0, fl, 0.82, 0.74, 1.44, Math.PI / 4, ARMOUR_D, ARMOUR, 7);
    sub(k, 1.0, fl, -1.0, -Math.PI / 4, (s) => {
      s.box(0.7, 0.9, 0.62, CONCRETE, 0, 0, 0);
      s.box(0.72, 0.05, 0.64, '#7f7b72', 0, 0.9, 0);
      s.helipad(0, 0.95, 0, 0.5);
      s.box(0.3, 0.42, 0.03, '#4a4f54', 0, 0, 0.315);
    });
    drone(k, 1.0, -1.0, fl + 1.0, 1.0);
    for (const [tx, tz, ry] of [[1.3, 1.0, Math.PI / 2], [-1.3, 0.95, Math.PI / 2], [-0.95, 1.32, 0]] as [number, number, number][]) tWall(k, tx, tz, fl, ry, 0.8);
    acousticMast(k, -1.32, -0.15, fl, 1.4);
    beacon(k, 0.85, fl + 0.82, 0.62);
    cctv(k, 1.32, -0.25, fl, 1.2, Math.PI);
    return;
  }
  // 19–20: twin turntables inside a stadium-shaped casemate
  const col = CONCRETE, top = gold ? GOLD : '#7f7b72';
  sub(k, 0, fl, 0, 0, (s) => {
    // Stadium wall: two half-rings joined by straight walls
    for (const sd of [-1, 1]) {
      const g = new THREE.LatheGeometry([new THREE.Vector2(1.42, 0), new THREE.Vector2(1.42, 0.78), new THREE.Vector2(1.14, 0.78), new THREE.Vector2(1.14, 0)], 18, sd > 0 ? Math.PI : 0, Math.PI);
      const m = new THREE.Mesh(g, mat(col, { side: THREE.DoubleSide }));
      m.scale.set(0.98, 1, 0.98);
      s.add(m);
      const c = new THREE.Mesh(new THREE.LatheGeometry([new THREE.Vector2(1.45, 0), new THREE.Vector2(1.45, 0.07), new THREE.Vector2(1.12, 0.07), new THREE.Vector2(1.12, 0)], 18, sd > 0 ? Math.PI : 0, Math.PI), mat(top, { side: THREE.DoubleSide }));
      c.position.y = 0.78;
      c.scale.set(0.98, 1, 0.98);
      s.add(c);
    }
  });
  disc(k, 1.12, 0.014, '#a9a59c', 0, fl, 0);
  riveted(k, 1.43, 0.62, fl + 0.08, 22, 0.55, 0.0);
  // Entry cut in the front with blast doors
  k.box(0.5, 0.86, 0.36, '#4a4f54', 0, fl, 1.26);
  for (const sd of [-1, 1]) k.box(0.16, 0.96, 0.4, col, sd * 0.33, fl, 1.26);
  k.box(0.82, 0.12, 0.42, gold ? GOLD : HAZ, 0, fl + 0.86, 1.26);
  const doors = [-1, 1].map((sd) => k.box(0.24, 0.8, 0.04, '#5c6166', sd * 0.12, fl, 1.45));
  k.anims.push((t) => {
    const u = cyc(t, 10);
    const o = u < 0.1 ? sm(u / 0.1) : u < 0.4 ? 1 : u < 0.5 ? 1 - sm((u - 0.4) / 0.1) : 0;
    doors.forEach((d, i) => (d.position.x = (i ? 1 : -1) * (0.12 + o * 0.2)));
  });
  for (const sd of [-1, 1]) {
    turntable(k, sd * 0.56, fl + 0.05, -0.05, level, { tubes: 2, deck: '#5c6166', rim: gold ? GOLD : HAZ, armour: ARMOUR, accent: gold ? GOLD : HAZ, seed: 31 + sd, crewLook: SEC, scale: 0.64, gold });
  }
  // Central magazine spine between the turntables
  magazine(k, 0, -1.0, fl, 1.0, 0.62, gold ? 1.66 : 1.56, 0, ARMOUR_D, gold ? GOLD : ARMOUR, 7, 0, gold);
  drone(k, 0, -1.0, fl + (gold ? 1.84 : 1.74), 0.9, gold);
  sensorBall(k, 1.2, -1.2, fl + 0.4, 1.0, gold);
  if (!gold) {
    acousticMast(k, -1.2, -1.2, fl + 0.4, 1.0);
    beacon(k, 1.15, fl + 0.86, 0.3);
    beacon(k, -1.15, fl + 0.86, 0.3);
    cctv(k, -1.38, 1.2, fl, 1.1, 0);
    return;
  }
  // 20: citadel: gold-capped bastions at the corners, gold crest over the entry, flags
  for (const [bx, bz] of [[-1.18, 1.18], [-1.22, -1.22]] as [number, number][]) {
    const bs = k.box(0.42, 1.0, 0.42, CONCRETE, bx, fl, bz);
    bs.rotation.y = Math.PI / 4;
    const cap = k.box(0.48, 0.08, 0.48, GOLD, bx, fl + 1.0, bz);
    cap.rotation.y = Math.PI / 4;
    pulse(k, 0.06, 0.06, 0.06, '#ffe48a', bx, fl + 1.08, bz, 2);
  }
  const crest = mesh(k, new THREE.CylinderGeometry(0.15, 0.15, 0.04, 16).rotateX(Math.PI / 2), GOLD, 0, fl + 1.12, 1.46);
  mesh(k, new THREE.CylinderGeometry(0.1, 0.1, 0.045, 16).rotateX(Math.PI / 2), '#2f5a3a', 0, fl + 1.12, 1.47);
  void crest;
  beacon(k, -1.22, fl + 1.08, -1.22, '#ffd23f');
  k.flagpole(-1.18, 1.18, 1.4, fl + 1.08);
}

// ------------------------------------------------------------------ build

function build(level: number): Kit {
  const k = new Kit();
  const y = k.pad(3, 3);
  if (level <= 3) field(k, level, y);
  else if (level <= 6) camp(k, level, y);
  else if (level <= 10) base(k, level, y);
  else if (level <= 15) command(k, level, y);
  else secure(k, level, y);
  return k;
}

export const MORTAR_PIT: BuildingDef = {
  id: 'mortarpit',
  name: 'Mortar Pit',
  role: 'Defence: lobs splash-damage bombs at ground raiders from a dug-in pit (3-tile dead zone).',
  footprint: [3, 3],
  unlockHq: 8,
  levels: MORTAR_PIT_LEVELS,
  designedLevels: 20,
  build,
};
