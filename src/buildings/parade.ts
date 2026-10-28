import * as THREE from 'three';
import { C, Kit, STOREY } from './kit';
import { CONCRETE, DARK_GLASS, GOLD, perimeter } from './common';
import { DAY, HOUR, type BuildingDef, type LevelStats } from './types';

/*
 * Parade Square: fall-in events and Cohesion. Boosts Morale camp-wide and
 * enables "Fall-in" ceremonies. Signature at every level: the painted parade
 * ground, a rostrum (saluting dais) and flagpoles, with a squad of Recruits
 * marching in step around it. Footprint 6×6; mostly flat (stands cap ~2 storeys).
 */

const TITLES = [
  'Rope Square', 'Laterite Square', 'Drill Square', 'Parade Square', 'Square · Spectator Stand', 'Square · Bandstand',
  'Asphalt Parade Ground', 'Ceremonial Gate', 'Grandstand Square', 'Parade Ground', 'Shell Rostrum', 'Garden Parade',
  'Floodlit Parade', 'Amphitheatre Square', 'Grand Parade', 'Secure Square', 'Smart Grid Square', 'Berm Amphitheatre',
  'Solar Stands', 'Parade Citadel',
];
const SUPPLIES = [4_500, 9_000, 15_000, 24_000, 36_000, 52_000, 75_000, 105_000, 145_000, 200_000, 270_000, 360_000, 470_000, 610_000, 790_000, 1_010_000, 1_280_000, 1_600_000, 1_980_000, 2_420_000];
const REPUTATION = [150, 250, 400, 600, 850, 1_150, 1_500, 1_900, 2_350, 2_850, 3_500, 4_400, 5_500, 6_800, 8_300, 10_000, 12_000, 14_300, 16_900, 19_800];
const TIME = [1 * HOUR, 2 * HOUR, 3 * HOUR, 5 * HOUR, 7 * HOUR, 10 * HOUR, 14 * HOUR, 18 * HOUR, 22 * HOUR, 1.25 * DAY, 1.5 * DAY, 2 * DAY, 2.5 * DAY, 3 * DAY, 3.5 * DAY, 4 * DAY, 4.5 * DAY, 5 * DAY, 5.5 * DAY, 6 * DAY];

export const PARADE_LEVELS: LevelStats[] = TITLES.map((title, i) => {
  const level = i + 1;
  const cohesion = 3 + i * 2;
  const capacity = 12 + i * 8;
  return {
    level, title,
    supplies: SUPPLIES[i],
    reputation: REPUTATION[i],
    buildTime: TIME[i],
    hp: Math.round((450 * Math.pow(1.2, i)) / 10) * 10,
    stats: { cohesion, fallInCapacity: capacity },
    unlocks: [`+${cohesion} Cohesion (camp-wide Morale)`, `Fall-in for ${capacity} Recruits`],
  };
});

// ------------------------------------------------------------------ palette & helpers

const OLIVE = '#5b6b3a';
const OLIVE_DARK = '#46542c';
const SKIN = ['#e0ac7e', '#c68b5f', '#a8714b', '#f0c39a'];
const LATERITE = '#c9774a';
const ASPHALT = '#5c6166';
const PAINT = '#f4f1e8';
const M = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8, ...o });

/** Square bounds (tile-edge coords, local). Front edge shrinks inside the secure perimeter. */
interface Sq { x0: number; x1: number; z0: number; z1: number }

/** Painted parade surface with a border, row markings and markers for each file. */
function ground(k: Kit, sq: Sq, y: number, surface: string, line = PAINT, rows = 4) {
  const w = sq.x1 - sq.x0, d = sq.z1 - sq.z0, cx = (sq.x0 + sq.x1) / 2, cz = (sq.z0 + sq.z1) / 2;
  k.box(w, 0.02, d, surface, cx, y, cz);
  // Border
  for (const z of [sq.z0 + 0.06, sq.z1 - 0.06]) k.box(w - 0.1, 0.006, 0.04, line, cx, y + 0.02, z);
  for (const x of [sq.x0 + 0.06, sq.x1 - 0.06]) k.box(0.04, 0.006, d - 0.1, line, x, y + 0.02, cz);
  // Rank lines (where the squads fall in) and file markers
  for (let r = 1; r <= rows; r++) {
    const z = sq.z0 + (d / (rows + 1)) * r;
    k.box(w - 0.8, 0.006, 0.025, line, cx, y + 0.02, z);
    for (let f = 0; f < 7; f++) k.box(0.06, 0.007, 0.06, '#ffc93c', cx - (w - 0.8) / 2 + ((w - 0.8) / 6) * f, y + 0.022, z);
  }
}

interface Figure { root: THREE.Group; legL: THREE.Object3D; legR: THREE.Object3D; armL: THREE.Object3D; armR: THREE.Object3D }

/** A ~0.6-tall low-poly Recruit in olive uniform, facing +x, with pivoting limbs. */
function figure(seed: number, uniform = OLIVE, cap = OLIVE_DARK): Figure {
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
    add(limb(0.065, 0.22, 0.065), OLIVE_DARK, 0, 0, 0, l);
    add(new THREE.BoxGeometry(0.09, 0.045, 0.07), '#2a2b2d', 0.012, -0.24, 0, l);
    root.add(l);
  }
  add(new THREE.BoxGeometry(0.12, 0.2, 0.17), uniform, 0, 0.36, 0);
  add(new THREE.BoxGeometry(0.125, 0.03, 0.175), '#2a2b2d', 0, 0.27, 0); // belt
  add(new THREE.IcosahedronGeometry(0.062, 0), SKIN[seed % SKIN.length], 0, 0.52, 0);
  const capM = add(new THREE.CylinderGeometry(0.07, 0.07, 0.035, 8), cap, -0.005, 0.57, 0);
  capM.rotation.z = 0.15;
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

/** Pose a figure for a marching step (all in step when given the same phase). */
function stride(f: Figure, phase: number, amp = 0.55) {
  const s = Math.sin(phase);
  f.legL.rotation.z = s * amp;
  f.legR.rotation.z = -s * amp;
  f.armL.rotation.z = -s * amp * 0.9;
  f.armR.rotation.z = s * amp * 0.9;
  f.root.position.y += Math.abs(Math.cos(phase)) * 0.02;
}

/** Point at distance s along a rectangular loop (clockwise seen from above), with heading. */
function loopPoint(cx: number, cz: number, hx: number, hz: number, s: number) {
  const P = 4 * (hx + hz);
  let d = ((s % P) + P) % P;
  const seg = [2 * hx, 2 * hz, 2 * hx, 2 * hz];
  const legs: [number, number, number, number][] = [
    [cx - hx, cz + hz, 1, 0], [cx + hx, cz + hz, 0, -1], [cx + hx, cz - hz, -1, 0], [cx - hx, cz - hz, 0, 1],
  ];
  for (let i = 0; i < 4; i++) {
    if (d <= seg[i]) {
      const [x0, z0, dx, dz] = legs[i];
      return { x: x0 + dx * d, z: z0 + dz * d, dx, dz };
    }
    d -= seg[i];
  }
  return { x: cx - hx, z: cz - hz, dx: 0, dz: 1 };
}

/**
 * The hero animation: a squad marching in step around the square in a column
 * of `cols` files. Each Recruit follows the loop at its own distance so the
 * column wheels cleanly at the corners.
 */
function squad(k: Kit, y: number, cx: number, cz: number, hx: number, hz: number, rows: number, cols: number, speed = 0.45, offset = 0, uniform = OLIVE) {
  const figs: { f: Figure; row: number; col: number }[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const f = figure(r * 3 + c + Math.round(offset * 7), uniform);
    k.add(f.root);
    figs.push({ f, row: r, col: c });
  }
  // Squad leader with a slightly different cap
  const lead = figure(9, uniform, '#2f5a3a');
  k.add(lead.root);
  k.anims.push((t) => {
    const s0 = t * speed + offset;
    const phase = t * speed * 15;
    const place = (f: Figure, s: number, lateral: number) => {
      const p = loopPoint(cx, cz, hx, hz, s);
      // Perpendicular to travel, pointing inward for positive lateral
      const px = -p.dz, pz = p.dx;
      f.root.position.set(p.x + px * lateral, y, p.z + pz * lateral);
      f.root.rotation.y = Math.atan2(-p.dz, p.dx);
    };
    place(lead, s0 + 0.45, 0);
    stride(lead, phase);
    for (const { f, row, col } of figs) {
      place(f, s0 - row * 0.32, (col - (cols - 1) / 2) * 0.24);
      stride(f, phase);
    }
  });
}

/** Drill instructor pacing back and forth, pausing to point at the squad. */
function instructor(k: Kit, x0: number, x1: number, z: number, y: number) {
  const f = figure(2, '#6b7a44', '#7a2f2a');
  k.add(f.root);
  k.anims.push((t) => {
    const c = (t % 10) / 10;
    const walking = c < 0.35 || (c > 0.5 && c < 0.85);
    const u = c < 0.35 ? c / 0.35 : c < 0.5 ? 1 : c < 0.85 ? 1 - (c - 0.5) / 0.35 : 0;
    f.root.position.set(x0 + (x1 - x0) * u, y, z);
    f.root.rotation.y = c < 0.5 ? 0 : Math.PI;
    if (walking) stride(f, t * 7, 0.4);
    else {
      f.legL.rotation.z = f.legR.rotation.z = 0;
      f.root.rotation.y = -Math.PI / 2; // face the square
      f.armR.rotation.z = 1.4 + Math.sin(t * 6) * 0.15; // pointing / calling the drill
      f.armL.rotation.z = 0;
    }
  });
}

/** A standing figure (band member, guard of honour) that idles or plays. */
function stander(k: Kit, x: number, z: number, y: number, rotY: number, seed: number, act: 'drum' | 'salute' | 'idle' = 'idle') {
  const f = figure(seed);
  f.root.position.set(x, y, z);
  f.root.rotation.y = rotY;
  k.add(f.root);
  if (act === 'drum') {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.08, 10), M('#e94f37'));
    drum.position.set(0.1, 0.32, 0);
    f.root.add(drum);
  }
  k.anims.push((t) => {
    if (act === 'drum') {
      f.armL.rotation.z = 0.9 + Math.max(0, Math.sin(t * 9 + seed)) * 0.6;
      f.armR.rotation.z = 0.9 + Math.max(0, Math.sin(t * 9 + seed + Math.PI)) * 0.6;
    } else if (act === 'salute') {
      const up = Math.sin(t * 0.5 + seed) > 0.2;
      f.armR.rotation.z = up ? 2.4 : 0;
      f.armR.rotation.x = up ? -0.6 : 0;
    } else {
      f.root.rotation.y = rotY + Math.sin(t * 0.4 + seed) * 0.25;
    }
  });
}

/** Rostrum: raised saluting dais with steps and a rail; optional roof style. */
function rostrum(k: Kit, x: number, z: number, y: number, w: number, d: number, h: number, mat: string, roof: 'none' | 'zinc' | 'green' | 'red' | 'shell' | 'glass' = 'none') {
  k.box(w, h, d, mat, x, y, z);
  k.box(w + 0.04, 0.04, d + 0.04, mat === C.wood ? '#8a5a3b' : C.white, x, y + h, z);
  k.stairs(x, z + d / 2 + 0.18, 0.5, 0.36, h);
  for (const s of [-1, 1]) k.box(0.03, 0.3, d, C.metal, x + s * (w / 2 - 0.03), y + h, z);
  k.box(w, 0.03, 0.03, C.metal, x, y + h + 0.28, z - d / 2 + 0.03);
  // Lectern
  k.box(0.18, 0.32, 0.14, mat === C.wood ? '#7a5a3b' : C.trim, x, y + h, z + d / 2 - 0.2);
  const top = y + h + 1.0;
  if (roof === 'none') return y + h;
  for (const s of [-1, 1]) for (const zz of [z - d / 2 + 0.05, z + d / 2 - 0.05]) k.box(0.06, 1.0, 0.06, roof === 'zinc' ? '#7a5a3b' : C.white, x + s * (w / 2 - 0.05), y + h, zz);
  if (roof === 'zinc') {
    const r = k.box(w + 0.3, 0.04, d + 0.3, C.zinc, x, top, z);
    r.rotation.x = -0.12;
  } else if (roof === 'green') k.hipRoof(w, d, 0.3, x, top, z, C.roofGreen, 0.15);
  else if (roof === 'red') k.hipRoof(w, d, 0.4, x, top, z, C.roof, 0.18);
  else if (roof === 'shell') {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(w * 0.62, 14, 6, Math.PI / 2, Math.PI, 0, Math.PI / 2), M('#f7f5ef', { side: THREE.DoubleSide }));
    shell.position.set(x, y + h, z - d / 2 + 0.05);
    shell.scale.set(1, 1.05, 1.3);
    shell.castShadow = true;
    k.add(shell);
  } else {
    k.box(w + 0.2, 0.08, d + 0.2, C.white, x, top, z);
    k.box(w + 0.22, 0.04, d + 0.22, GOLD, x, top - 0.03, z);
  }
  return top;
}

/** Tiered spectator stand facing +z (rows step up toward the back). Returns its top height. */
function stand(k: Kit, x: number, z: number, w: number, rows: number, y: number, roof: 'none' | 'green' | 'red' | 'canopy' | 'solar' = 'green', seat = '#2bb3a3', rotY = 0) {
  const g = new Kit();
  const step = 0.24, rise = 0.17;
  for (let r = 0; r < rows; r++) {
    g.box(w, rise * (r + 1), step, CONCRETE, 0, 0, -r * step);
    g.box(w - 0.08, 0.05, step * 0.55, r % 2 ? seat : '#f4f1e8', 0, rise * (r + 1), -r * step + 0.02);
  }
  const back = -(rows - 1) * step - step / 2;
  const top = rise * rows + 0.85;
  if (roof !== 'none') {
    for (const s of [-1, 1]) g.box(0.06, top, 0.06, C.white, s * (w / 2 - 0.05), 0, back + 0.04);
    if (roof === 'canopy') {
      const c = g.box(w + 0.1, 0.06, rows * step + 0.5, '#f7f5ef', 0, top, back + (rows * step) / 2 + 0.1);
      c.rotation.x = 0.12;
    } else if (roof === 'solar') {
      const c = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.05, rows * step + 0.5), M('#284a73', { roughness: 0.4 }));
      c.position.set(0, top + 0.05, back + (rows * step) / 2 + 0.1);
      c.rotation.x = -0.15;
      c.castShadow = true;
      g.group.add(c);
      g.box(w + 0.14, 0.03, 0.05, C.white, 0, top + 0.12, back + rows * step + 0.32);
    } else {
      const roofCol = roof === 'red' ? C.roof : C.roofGreen;
      const c = g.box(w + 0.1, 0.06, rows * step + 0.5, roofCol, 0, top, back + (rows * step) / 2 + 0.1);
      c.rotation.x = 0.14;
      g.box(w + 0.12, 0.04, 0.05, C.trim, 0, top - 0.06, back + rows * step + 0.33);
    }
    g.box(w, top, 0.06, C.wall, 0, 0, back - 0.02);
  }
  g.group.position.set(x, y, z);
  g.group.rotation.y = rotY;
  k.add(g.group);
  for (const a of g.anims) k.anims.push(a);
  return top;
}

/** Spectators seated on a stand, bobbing and occasionally waving. */
function crowd(k: Kit, x: number, z: number, w: number, rows: number, y: number, rotY = 0, every = 2) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  k.add(g);
  const cols = ['#e94f37', '#2f6fa8', '#ffc93c', '#ffffff', OLIVE, '#2bb3a3'];
  let n = 0;
  for (let r = 0; r < rows; r++) for (let i = 0; i < Math.floor(w / 0.22); i++) {
    if ((i + r) % every) continue;
    const p = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.09), M(cols[(i + r * 2) % cols.length]));
    body.position.y = 0.08;
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 0), M(SKIN[(i + r) % SKIN.length]));
    head.position.y = 0.21;
    p.add(body, head);
    p.position.set(-w / 2 + 0.15 + i * 0.22, 0.17 * (r + 1) + 0.03, -r * 0.24 - 0.04);
    g.add(p);
    const seed = n++;
    k.anims.push((t) => {
      const cheer = Math.sin(t * 0.6 + seed * 0.7) > 0.85;
      p.position.y = 0.17 * (r + 1) + 0.03 + (cheer ? Math.abs(Math.sin(t * 8 + seed)) * 0.05 : 0);
    });
  }
}

/** Flag on its own pole that is ceremonially raised, held, then lowered. */
function raisedFlag(k: Kit, x: number, z: number, y: number, h = 2.2, color = '#2f5a3a') {
  k.box(0.3, 0.1, 0.3, CONCRETE, x, y, z);
  k.cyl(0.025, h, C.white, x, y + 0.1, z, 6);
  k.cyl(0.04, 0.05, GOLD, x, y + 0.1 + h, z, 6);
  const flag = new THREE.Group();
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.01).translate(0.23, 0.07, 0), M(color));
  const bot = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.01).translate(0.23, -0.07, 0), M('#f7f5ef'));
  flag.add(top, bot);
  k.add(flag);
  k.anims.push((t) => {
    const c = (t % 24) / 24;
    const u = c < 0.25 ? c / 0.25 : c < 0.75 ? 1 : 1 - (c - 0.75) / 0.25;
    flag.position.set(x + 0.03, y + 0.45 + u * (h - 0.4), z);
    flag.rotation.y = Math.sin(t * 2.2) * 0.25;
    flag.rotation.x = Math.sin(t * 3.1) * 0.08;
  });
}

/** Bunting: a line of little pennants strung between two points, swaying. */
function bunting(k: Kit, x0: number, z0: number, x1: number, z1: number, h: number, y: number) {
  const cols = ['#e94f37', '#ffc93c', '#2bb3a3', '#f7f5ef', '#2f6fa8'];
  const n = Math.max(4, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.25));
  const ang = -Math.atan2(z1 - z0, x1 - x0);
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const sag = Math.sin(t * Math.PI) * 0.18;
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 3).rotateX(Math.PI), M(cols[i % cols.length]));
    p.geometry.translate(0, -0.06, 0);
    p.position.set(x0 + (x1 - x0) * t, y + h - sag, z0 + (z1 - z0) * t);
    p.rotation.y = ang;
    k.add(p);
    k.anims.push((tt) => (p.rotation.x = Math.sin(tt * 2.5 + i * 0.8) * 0.4));
  }
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push(new THREE.Vector3(x0 + (x1 - x0) * t, y + h - Math.sin(t * Math.PI) * 0.18, z0 + (z1 - z0) * t));
  }
  k.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#33383d' })));
}

/** Memorial obelisk on a stepped plinth. */
function obelisk(k: Kit, x: number, z: number, y: number, h = 1.6, tip = GOLD) {
  k.box(0.6, 0.12, 0.6, CONCRETE, x, y, z);
  k.box(0.44, 0.12, 0.44, CONCRETE, x, y + 0.12, z);
  k.cyl(0.13, h, '#ece6d6', x, y + 0.24, z, 4, 0.08).rotation.y = Math.PI / 4;
  const pyr = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.18, 4), M(tip));
  pyr.rotation.y = Math.PI / 4;
  pyr.position.set(x, y + 0.24 + h + 0.09, z);
  k.add(pyr);
  k.planter(x, z + 0.42, 0.4, y);
}

/** Bandstand: octagonal pavilion with a drummer and a brass player. */
function bandstand(k: Kit, x: number, z: number, y: number, r = 0.55, roof: string = C.roof) {
  k.cyl(r, 0.2, CONCRETE, x, y, z, 8);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    k.box(0.05, 0.85, 0.05, C.white, x + Math.cos(a) * (r - 0.06), y + 0.2, z + Math.sin(a) * (r - 0.06));
  }
  k.cyl(r + 0.12, 0.35, roof, x, y + 1.05, z, 8, 0.05);
  k.cyl(r + 0.1, 0.05, C.white, x, y + 1.02, z, 8);
  stander(k, x - 0.15, z, y + 0.2, Math.PI / 4, 4, 'drum');
  stander(k, x + 0.18, z - 0.1, y + 0.2, Math.PI / 3, 7, 'drum');
}

/** Stadium floodlight mast with blinking aircraft light. */
function lightMast(k: Kit, x: number, z: number, y: number, h = 2.6) {
  k.cyl(0.04, h, C.metal, x, y, z, 6);
  k.box(0.5, 0.3, 0.08, '#33383d', x, y + h, z);
  for (let i = 0; i < 3; i++) k.box(0.12, 0.1, 0.02, '#fff6c8', x - 0.15 + i * 0.15, y + h + 0.1, z + 0.05);
  k.blinker(x, y + h + 0.32, z, '#ff3b30', 0.03, 1.6);
}

/** Scoreboard / event board with blinking lights. */
function scoreboard(k: Kit, x: number, z: number, y: number, w = 0.9) {
  for (const s of [-1, 1]) k.box(0.06, 1.3, 0.06, C.metal, x + s * (w / 2 - 0.05), y, z);
  k.box(w, 0.5, 0.06, '#2a2f33', x, y + 1.1, z);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) k.blinker(x - w / 2 + 0.15 + i * ((w - 0.3) / 4), y + 1.22 + j * 0.2, z + 0.04, j ? '#ffc93c' : '#3fd16b', 0.025, 0.9 + i * 0.17 + j * 0.3);
}

/** Lawn strip with pop-up sprinklers. */
function lawn(k: Kit, x: number, z: number, w: number, d: number, y: number, sprinklers = 2) {
  k.box(w, 0.04, d, '#6cbf45', x, y, z);
  for (let i = 0; i < sprinklers; i++) {
    const sx = x - w / 2 + (w / (sprinklers + 1)) * (i + 1);
    k.cyl(0.03, 0.06, '#5c6166', sx, y + 0.04, z, 6);
    k.emitters.push({ pos: new THREE.Vector3(sx, y + 0.15, z), kind: 'spray' });
  }
}

/** Colonnade: a row of white columns with an entablature, along x. */
function colonnade(k: Kit, x: number, z: number, w: number, y: number, h = 1.3, n = 7, gold = false) {
  for (let i = 0; i < n; i++) k.cyl(0.07, h, C.white, x - w / 2 + (w / (n - 1)) * i, y, z, 8);
  k.box(w + 0.2, 0.16, 0.3, C.white, x, y + h, z);
  if (gold) k.box(w + 0.22, 0.05, 0.32, GOLD, x, y + h + 0.16, z);
  k.box(w + 0.1, 0.1, 0.3, C.roof, x, y + h + (gold ? 0.21 : 0.16), z);
}

/** LED screen that cycles colours. */
function ledScreen(k: Kit, x: number, z: number, y: number, w = 1.2, h = 0.7) {
  for (const s of [-1, 1]) k.box(0.08, 1.2, 0.08, C.metal, x + s * (w / 2 - 0.1), y, z);
  k.box(w + 0.08, h + 0.08, 0.08, '#2a2f33', x, y + 1.2, z);
  const scr = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), new THREE.MeshStandardMaterial({ color: '#2bb3a3', emissive: '#2bb3a3', emissiveIntensity: 0.8 }));
  scr.position.set(x, y + 1.24 + h / 2, z + 0.05);
  k.add(scr);
  const cols = ['#2bb3a3', '#ffc93c', '#e94f37', '#3fd16b'].map((c) => new THREE.Color(c));
  k.anims.push((t) => {
    const c = cols[Math.floor(t / 2.5) % cols.length];
    const m = scr.material as THREE.MeshStandardMaterial;
    m.color.copy(c);
    m.emissive.copy(c);
  });
}

// ------------------------------------------------------------------ levels

/** Common square for the main bands. */
const SQ: Sq = { x0: -2.15, x1: 2.55, z0: -0.85, z1: 2.55 };
const SQ_SECURE: Sq = { x0: -2.15, x1: 2.45, z0: -0.85, z1: 1.85 };

function sqCenter(sq: Sq) {
  return { cx: (sq.x0 + sq.x1) / 2, cz: (sq.z0 + sq.z1) / 2, hx: (sq.x1 - sq.x0) / 2 - 0.55, hz: (sq.z1 - sq.z0) / 2 - 0.5 };
}

function field(k: Kit, level: number, y: number) {
  if (level === 1) {
    // Rope Square: a cleared grass patch roped off on pegs, tree-stump rostrum, bamboo flagpole
    const sq: Sq = { x0: -1.6, x1: 2.2, z0: -0.6, z1: 2.3 };
    k.box(3.8, 0.02, 2.9, '#8fbf5a', 0.3, y, 0.85);
    const pegs: [number, number][] = [];
    for (let i = 0; i <= 6; i++) pegs.push([sq.x0 + ((sq.x1 - sq.x0) / 6) * i, sq.z0], [sq.x0 + ((sq.x1 - sq.x0) / 6) * i, sq.z1]);
    for (let i = 1; i < 5; i++) pegs.push([sq.x0, sq.z0 + ((sq.z1 - sq.z0) / 5) * i], [sq.x1, sq.z0 + ((sq.z1 - sq.z0) / 5) * i]);
    for (const [px, pz] of pegs) k.box(0.04, 0.22, 0.04, C.wood, px, y, pz);
    for (const z of [sq.z0, sq.z1]) k.box(sq.x1 - sq.x0, 0.01, 0.01, '#d8c79a', 0.3, y + 0.18, z);
    for (const x of [sq.x0, sq.x1]) k.box(0.01, 0.01, sq.z1 - sq.z0, '#d8c79a', x, y + 0.18, (sq.z0 + sq.z1) / 2);
    k.cyl(0.3, 0.32, '#8a5a3b', -0.5, y, -1.4, 9); // tree-stump rostrum
    k.cyl(0.31, 0.02, '#c9a77c', -0.5, y + 0.32, -1.4, 9);
    k.fieldFlag(-2.2, -1.3, y);
    k.crates(1.9, -1.7, y, 3);
    k.drum(2.4, -1.2, '#2f6fa8', y);
    squad(k, y, 0.3, 0.85, 1.25, 0.85, 2, 2, 0.4);
    stander(k, -0.5, -1.4, y + 0.34, -Math.PI / 2, 5, 'idle');
    return;
  }
  if (level === 2) {
    // Laterite Square: orange dirt square edged with whitewashed stones, timber dais, two flagpoles
    const sq: Sq = { x0: -1.9, x1: 2.4, z0: -0.7, z1: 2.4 };
    k.box(sq.x1 - sq.x0, 0.025, sq.z1 - sq.z0, LATERITE, 0.25, y, 0.85);
    const n = 15;
    for (let i = 0; i <= n; i++) for (const z of [sq.z0, sq.z1]) k.box(0.12, 0.08, 0.1, PAINT, sq.x0 + ((sq.x1 - sq.x0) / n) * i, y, z);
    for (let i = 1; i < 11; i++) for (const x of [sq.x0, sq.x1]) k.box(0.1, 0.08, 0.12, PAINT, x, y, sq.z0 + ((sq.z1 - sq.z0) / 11) * i);
    rostrum(k, 0.2, -1.55, y, 1.1, 0.7, 0.32, C.wood);
    k.flagpole(-1.6, -1.6, 1.8, y);
    k.flagpole(1.9, -1.6, 1.8, y);
    k.waterPoint(-2.4, 1.6, y);
    squad(k, y, 0.25, 0.85, 1.45, 0.95, 2, 3, 0.42);
    stander(k, 0.2, -1.55, y + 0.36, -Math.PI / 2, 6, 'salute');
    return;
  }
  // 3: Drill Square: whitewashed rank lines on laterite, timber rostrum under a zinc lean-to, benches
  ground(k, { x0: -2.0, x1: 2.5, z0: -0.75, z1: 2.5 }, y, LATERITE, PAINT, 3);
  rostrum(k, 0.2, -1.6, y, 1.3, 0.8, 0.36, C.wood, 'zinc');
  k.flagpole(-1.7, -1.7, 2.0, y);
  k.flagpole(2.1, -1.7, 2.0, y);
  k.bench(-2.45, 0.4, 1.4, y, Math.PI / 2);
  k.bench(-2.45, 1.9, 1.0, y, Math.PI / 2);
  k.noticeboard(1.5, -1.9, 0, y);
  squad(k, y, 0.25, 0.88, 1.6, 1.0, 3, 3, 0.45);
  instructor(k, -1.2, 1.6, -0.55, y);
}

function camp(k: Kit, level: number, y: number) {
  const { cx, cz, hx, hz } = sqCenter(SQ);
  ground(k, SQ, y, '#cfcac0', '#ffc93c', 4);
  k.flagpole(-1.7, -1.75, 2.2, y);
  k.flagpole(2.3, -1.75, 2.2, y);
  if (level === 4) {
    // Parade Square: concrete square with yellow ranks, concrete rostrum with green canopy, lamps
    rostrum(k, 0.3, -1.55, y, 1.4, 0.85, 0.4, CONCRETE, 'green');
    raisedFlag(k, 1.4, -1.6, y, 2.2);
    for (const x of [-2.6, 2.75]) k.lamp(x, -0.6, y, 1.4);
    k.bench(-2.55, 1.0, 1.6, y, Math.PI / 2);
    squad(k, y, cx, cz, hx, hz, 3, 3, 0.45);
    instructor(k, -1.4, 1.8, -0.6, y);
    return;
  }
  if (level === 5) {
    // + a covered spectator stand on the left side
    rostrum(k, 0.4, -1.55, y, 1.4, 0.85, 0.4, CONCRETE, 'green');
    raisedFlag(k, 1.5, -1.6, y, 2.2);
    stand(k, -2.5, 0.85, 2.6, 3, y, 'green', '#2bb3a3', Math.PI / 2);
    crowd(k, -2.5, 0.85, 2.6, 3, y, Math.PI / 2, 2);
    k.lamp(2.75, -0.6, y, 1.4);
    squad(k, y, cx + 0.1, cz, hx - 0.1, hz, 3, 3, 0.45);
    instructor(k, -1.0, 1.8, -0.6, y);
    return;
  }
  // 6: + bandstand at the back-left and bunting strung between flagpoles
  rostrum(k, 0.6, -1.55, y, 1.4, 0.85, 0.4, CONCRETE, 'red');
  raisedFlag(k, 1.7, -1.6, y, 2.3);
  stand(k, -2.5, 1.15, 2.2, 3, y, 'green', '#2bb3a3', Math.PI / 2);
  crowd(k, -2.5, 1.15, 2.2, 3, y, Math.PI / 2, 2);
  bandstand(k, -1.8, -1.75, y, 0.55);
  bunting(k, -1.7, -1.75, 2.3, -1.75, 2.0, y);
  k.lamp(2.75, -0.6, y, 1.4);
  squad(k, y, cx + 0.1, cz, hx - 0.1, hz, 3, 4, 0.45);
}

function base(k: Kit, level: number, y: number) {
  const { cx, cz, hx, hz } = sqCenter(SQ);
  ground(k, SQ, y, ASPHALT, PAINT, 4);
  if (level === 7) {
    // Asphalt parade ground: two covered stands, roofed rostrum, ceremonial flag raising
    rostrum(k, 0.3, -1.6, y, 1.6, 0.9, 0.45, CONCRETE, 'red');
    raisedFlag(k, 1.65, -1.65, y, 2.5);
    k.flagpole(-1.4, -1.75, 2.2, y);
    stand(k, -2.5, 1.15, 2.4, 3, y, 'red', '#e94f37', Math.PI / 2);
    crowd(k, -2.5, 1.15, 2.4, 3, y, Math.PI / 2, 2);
    stand(k, -2.25, -1.7, 0.95, 3, y, 'red', '#e94f37');
    for (const x of [2.75]) k.lamp(x, -0.5, y, 1.5);
    squad(k, y, cx + 0.1, cz, hx - 0.1, hz, 3, 4, 0.45);
    instructor(k, -1.2, 1.8, -0.55, y);
    return;
  }
  if (level === 8) {
    // Ceremonial gate: a gateway arch on the right edge and a colonnade along the back
    rostrum(k, 0.3, -1.6, y, 1.6, 0.9, 0.45, CONCRETE, 'red');
    raisedFlag(k, 1.65, -1.65, y, 2.5);
    colonnade(k, 0.3, -2.45, 4.6, y, 1.3, 9);
    stand(k, -2.5, 1.15, 2.4, 3, y, 'red', '#e94f37', Math.PI / 2);
    crowd(k, -2.5, 1.15, 2.4, 3, y, Math.PI / 2, 2);
    const g = new Kit();
    g.arch(0, 0, 1.4, 'PARADE', 0);
    g.group.position.set(2.72, y, 1.1);
    g.group.rotation.y = Math.PI / 2;
    k.add(g.group);
    squad(k, y, cx, cz, hx - 0.15, hz, 3, 4, 0.45);
    instructor(k, -1.2, 1.6, -0.55, y);
    return;
  }
  if (level === 9) {
    // Grandstand square: a two-tier grandstand along the back with a cantilever roof and scoreboard
    stand(k, -0.8, -1.35, 2.6, 4, y, 'red', '#2bb3a3');
    crowd(k, -0.8, -1.35, 2.6, 4, y, 0, 2);
    rostrum(k, 1.55, -1.5, y, 1.2, 0.9, 0.5, CONCRETE, 'red');
    raisedFlag(k, 2.6, -1.65, y, 2.5);
    stand(k, -2.5, 1.2, 2.2, 3, y, 'red', '#e94f37', Math.PI / 2);
    crowd(k, -2.5, 1.2, 2.2, 3, y, Math.PI / 2, 3);
    scoreboard(k, 2.6, 2.7, y, 0.9);
    squad(k, y, cx, cz, hx - 0.1, hz, 3, 4, 0.45);
    instructor(k, -1.0, 1.4, -0.55, y);
    return;
  }
  // 10: Parade Ground (release cap): grandstand, VIP box, colonnade, arch, obelisk, two squads
  stand(k, -0.9, -1.35, 2.4, 4, y, 'red', '#2bb3a3');
  crowd(k, -0.9, -1.35, 2.4, 4, y, 0, 2);
  rostrum(k, 1.5, -1.5, y, 1.3, 0.95, 0.5, CONCRETE, 'red');
  k.box(1.3, 0.5, 0.06, C.white, 1.5, y + 0.5, -1.97);
  raisedFlag(k, 2.65, -1.65, y, 2.6);
  stand(k, -2.5, 1.25, 2.2, 3, y, 'red', '#e94f37', Math.PI / 2);
  crowd(k, -2.5, 1.25, 2.2, 3, y, Math.PI / 2, 2);
  const g = new Kit();
  g.arch(0, 0, 1.3, 'PARADE GROUND', 0);
  g.group.position.set(2.72, y, 1.3);
  g.group.rotation.y = Math.PI / 2;
  k.add(g.group);
  obelisk(k, 2.5, -0.35, y, 1.3);
  squad(k, y, cx, cz, hx - 0.15, hz, 3, 4, 0.45);
  squad(k, y, cx, cz, hx - 0.15, hz, 2, 4, 0.45, 2 * (hx + hz));
}

function command(k: Kit, level: number, y: number) {
  const { cx, cz, hx, hz } = sqCenter(SQ);
  if (level === 11) {
    // Shell rostrum: white acoustic shell over the dais, modern stands with white canopies
    ground(k, SQ, y, '#bfc3c4', PAINT, 4);
    rostrum(k, 1.1, -1.5, y, 1.6, 1.0, 0.5, CONCRETE, 'shell');
    raisedFlag(k, 2.6, -1.65, y, 2.6);
    stand(k, -1.0, -1.35, 2.2, 4, y, 'canopy', '#2f6fa8');
    crowd(k, -1.0, -1.35, 2.2, 4, y, 0, 2);
    stand(k, -2.5, 1.25, 2.2, 4, y, 'canopy', '#2f6fa8', Math.PI / 2);
    crowd(k, -2.5, 1.25, 2.2, 4, y, Math.PI / 2, 2);
    ledScreen(k, 2.6, 2.6, y, 0.8, 0.5);
    squad(k, y, cx, cz, hx - 0.15, hz, 3, 4, 0.45);
    squad(k, y, cx, cz, hx - 0.15, hz, 2, 4, 0.45, 2 * (hx + hz));
    return;
  }
  if (level === 12) {
    // Garden parade: lawn borders with sprinklers, planted terraces, green-roofed stands
    ground(k, { x0: -1.95, x1: 2.35, z0: -0.7, z1: 2.25 }, y, '#bfc3c4', PAINT, 4);
    lawn(k, 0.2, 2.6, 4.6, 0.5, y, 3);
    lawn(k, 2.65, 0.8, 0.5, 2.9, y, 2);
    rostrum(k, 1.1, -1.5, y, 1.6, 1.0, 0.55, CONCRETE, 'green');
    raisedFlag(k, 2.6, -1.7, y, 2.6);
    stand(k, -1.0, -1.35, 2.2, 5, y, 'green', '#3fd16b');
    crowd(k, -1.0, -1.35, 2.2, 5, y, 0, 2);
    stand(k, -2.5, 1.0, 2.2, 4, y, 'green', '#3fd16b', Math.PI / 2);
    crowd(k, -2.5, 1.0, 2.2, 4, y, Math.PI / 2, 2);
    k.hedge(-2.55, 2.5, 0.5, 0.5, y);
    squad(k, y, 0.2, 0.78, 1.55, 0.95, 3, 4, 0.45);
    squad(k, y, 0.2, 0.78, 1.55, 0.95, 2, 4, 0.45, 5);
    return;
  }
  if (level === 13) {
    // Floodlit parade: four light masts, big LED screen, red-roofed two-tier stands
    ground(k, SQ, y, ASPHALT, '#ffc93c', 5);
    rostrum(k, 1.1, -1.5, y, 1.6, 1.0, 0.55, CONCRETE, 'red');
    raisedFlag(k, 2.6, -1.7, y, 2.6);
    stand(k, -1.0, -1.35, 2.4, 5, y, 'red', '#e94f37');
    crowd(k, -1.0, -1.35, 2.4, 5, y, 0, 2);
    stand(k, -2.5, 1.15, 2.4, 4, y, 'red', '#e94f37', Math.PI / 2);
    crowd(k, -2.5, 1.15, 2.4, 4, y, Math.PI / 2, 2);
    for (const [x, z] of [[-2.7, -2.7], [2.75, -0.6], [2.75, 2.75], [-2.75, 2.75]]) lightMast(k, x, z, y, 2.8);
    ledScreen(k, 2.55, 1.2, y, 1.0, 0.55);
    squad(k, y, cx, cz, hx - 0.2, hz, 3, 4, 0.45);
    squad(k, y, cx, cz, hx - 0.2, hz, 3, 4, 0.45, 2 * (hx + hz));
    return;
  }
  if (level === 14) {
    // Amphitheatre square: stands curved around the back-left corner in a quarter-ring
    ground(k, SQ, y, '#bfc3c4', PAINT, 4);
    const arc = (rIn: number, rOut: number, hgt: number, col: string) => {
      const sh = new THREE.Shape();
      // Quarter ring in the -y quadrant, which maps to +z once laid flat
      sh.absarc(0, 0, rOut, -Math.PI / 2, 0, false);
      sh.lineTo(rIn, 0);
      sh.absarc(0, 0, rIn, 0, -Math.PI / 2, true);
      sh.lineTo(0, -rOut);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: hgt, bevelEnabled: false, curveSegments: 10 });
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, M(col));
      m.position.set(-2.85, y, -2.85);
      m.castShadow = m.receiveShadow = true;
      k.add(m);
    };
    for (let r = 0; r < 6; r++) {
      arc(1.3 + (5 - r) * 0.26, 1.3 + (6 - r) * 0.26, 0.18 * (r + 1), CONCRETE);
      arc(1.3 + (5 - r) * 0.26 + 0.04, 1.3 + (5 - r) * 0.26 + 0.14, 0.18 * (r + 1) + 0.04, r % 2 ? '#8a5cb8' : '#f4f1e8');
    }
    // Curved canopy over the top rows
    const can = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 0.06, 18, 1, false, 0, Math.PI / 2), M(C.roof));
    can.position.set(-2.85, y + 2.0, -2.85);
    can.castShadow = true;
    k.add(can);
    for (const a of [0.15, 0.78, 1.42]) k.cyl(0.05, 2.0, C.white, -2.85 + Math.sin(a) * 2.95, y, -2.85 + Math.cos(a) * 2.95, 6);
    crowd(k, -1.25, -1.9, 1.6, 3, y + 0.6, Math.PI / 4, 2);
    rostrum(k, 1.5, -1.55, y, 1.4, 0.95, 0.55, CONCRETE, 'green');
    raisedFlag(k, 2.6, -1.75, y, 2.6);
    bunting(k, 2.75, -0.5, 2.75, 2.7, 1.2, y);
    k.lamp(2.75, -0.5, y, 1.3);
    k.lamp(2.75, 2.7, y, 1.3);
    squad(k, y, 0.4, 1.0, 1.3, 0.85, 3, 4, 0.45);
    squad(k, y, 0.4, 1.0, 1.3, 0.85, 2, 4, 0.45, 4.3);
    return;
  }
  // 15: Grand Parade: gold-trimmed U of colonnades, reviewing pavilion, memorial obelisk
  ground(k, SQ, y, '#d9d2c3', GOLD, 4);
  colonnade(k, 0.3, -2.5, 4.8, y, 1.9, 9, true);
  rostrum(k, 0.3, -1.55, y, 1.8, 1.0, 0.55, '#ece6d6', 'glass');
  raisedFlag(k, 1.6, -1.75, y, 2.8);
  k.flagpole(-1.0, -1.75, 2.6, y);
  const side = new Kit();
  colonnade(side, 0, 0, 3.2, 0, 1.9, 6, true);
  side.group.position.set(-2.6, y, 1.0);
  side.group.rotation.y = Math.PI / 2;
  k.add(side.group);
  stand(k, -1.95, 1.0, 2.6, 4, y, 'green', '#d9b24a', Math.PI / 2);
  crowd(k, -1.95, 1.0, 2.6, 4, y, Math.PI / 2, 2);
  obelisk(k, 2.5, -1.9, y, 1.8);
  const g = new Kit();
  g.arch(0, 0, 1.5, 'GRAND PARADE', 0);
  g.group.position.set(2.72, y, 1.2);
  g.group.rotation.y = Math.PI / 2;
  k.add(g.group);
  for (const z of [-0.4, 2.7]) k.lamp(2.75, z, y, 1.4);
  squad(k, y, cx + 0.2, cz, hx - 0.35, hz, 3, 4, 0.45);
  squad(k, y, cx + 0.2, cz, hx - 0.35, hz, 3, 4, 0.45, 2 * (hx - 0.35 + hz));
  stander(k, 0.0, -1.55, y + 0.55, -Math.PI / 2, 3, 'salute');
}

function secure(k: Kit, level: number, y: number) {
  perimeter(k, y, 2.72, 2.72, false);
  const sq = SQ_SECURE;
  const { cx, cz, hx, hz } = sqCenter(sq);
  if (level === 16) {
    // Secure square: concrete stands under steel canopies, guarded dais with blast screen
    ground(k, sq, y, '#9aa0a3', '#ffc93c', 4);
    stand(k, -0.9, -1.3, 2.5, 5, y, 'canopy', '#5c6166');
    crowd(k, -0.9, -1.3, 2.5, 5, y, 0, 2);
    stand(k, -2.3, 0.9, 2.0, 4, y, 'canopy', '#5c6166', Math.PI / 2);
    crowd(k, -2.3, 0.9, 2.0, 4, y, Math.PI / 2, 2);
    rostrum(k, 1.5, -1.5, y, 1.4, 1.0, 0.55, CONCRETE, 'glass');
    k.box(1.5, 0.9, 0.12, DARK_GLASS, 1.5, y + 0.55, -2.05);
    raisedFlag(k, 2.4, -2.2, y, 2.6, '#33383d');
    squad(k, y, cx, cz, hx - 0.1, hz, 3, 4, 0.45);
    squad(k, y, cx, cz, hx - 0.1, hz, 2, 4, 0.45, 2 * (hx + hz));
    return;
  }
  if (level === 17) {
    // Smart grid square: LED grid floor tiles light up under the squads; glass review box
    ground(k, sq, y, '#4a4f54', '#7cff8a', 3);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 4; j++) {
      const tile = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.012, 0.42), new THREE.MeshStandardMaterial({ color: '#2bb3a3', emissive: '#2bb3a3', emissiveIntensity: 0.1 }));
      tile.position.set(sq.x0 + 0.5 + i * 0.52, y + 0.026, sq.z0 + 0.5 + j * 0.55);
      k.add(tile);
      k.anims.push((t) => ((tile.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.1 + Math.max(0, Math.sin(t * 2 - i * 0.6 - j * 0.9)) * 0.9));
    }
    stand(k, -0.9, -1.3, 2.5, 5, y, 'canopy', '#2bb3a3');
    crowd(k, -0.9, -1.3, 2.5, 5, y, 0, 2);
    stand(k, -2.3, 0.85, 2.2, 5, y, 'canopy', '#2bb3a3', Math.PI / 2);
    crowd(k, -2.3, 0.85, 2.2, 5, y, Math.PI / 2, 2);
    k.glassBox(1.4, 1.6, 1.0, 1.55, y, -1.55);
    k.box(1.6, 0.1, 1.2, C.white, 1.55, y + 1.6, -1.55);
    raisedFlag(k, 2.45, -2.25, y, 2.7, '#33383d');
    ledScreen(k, 2.45, 0.6, y, 0.7, 0.45);
    squad(k, y, cx, cz, hx - 0.1, hz, 3, 4, 0.45);
    squad(k, y, cx, cz, hx - 0.1, hz, 3, 4, 0.45, 2 * (hx + hz));
    return;
  }
  if (level === 18) {
    // Berm amphitheatre: grassy terraced berms as seating, glass reviewing pavilion on a green roof
    ground(k, sq, y, '#9aa0a3', PAINT, 4);
    const berm = (x: number, z: number, w: number, rotY: number) => {
      const g = new Kit();
      for (let r = 0; r < 6; r++) {
        g.box(w, 0.2 * (r + 1), 0.24, r % 2 ? '#6cbf45' : '#5fae34', 0, 0, -r * 0.24);
        g.box(w - 0.1, 0.03, 0.08, CONCRETE, 0, 0.2 * (r + 1), -r * 0.24 + 0.06);
      }
      g.group.position.set(x, y, z);
      g.group.rotation.y = rotY;
      k.add(g.group);
    };
    berm(-0.9, -1.25, 2.6, 0);
    berm(-2.3, 0.85, 2.2, Math.PI / 2);
    crowd(k, -0.9, -1.25, 2.6, 6, y + 0.03, 0, 3);
    crowd(k, -2.3, 0.85, 2.2, 6, y + 0.03, Math.PI / 2, 3);
    k.box(1.5, 0.8, 1.1, CONCRETE, 1.55, y, -1.55);
    k.box(1.5, 0.06, 1.1, '#6cbf45', 1.55, y + 0.8, -1.55);
    k.glassBox(1.2, 1.0, 0.8, 1.55, y + 0.86, -1.6);
    k.box(1.4, 0.08, 1.0, C.roofGreen, 1.55, y + 1.86, -1.6);
    k.stairs(1.55, -0.78, 0.5, 0.4, 0.8);
    raisedFlag(k, 2.45, -2.25, y, 2.8, '#2f5a3a');
    squad(k, y, cx, cz, hx - 0.1, hz, 3, 4, 0.45);
    squad(k, y, cx, cz, hx - 0.1, hz, 3, 4, 0.45, 2 * (hx + hz));
    return;
  }
  if (level === 19) {
    // Solar stands: stands roofed with solar canopies, scoreboard, light masts
    ground(k, sq, y, '#9aa0a3', '#ffc93c', 4);
    stand(k, -0.9, -1.3, 2.5, 6, y, 'solar', '#2f6fa8');
    crowd(k, -0.9, -1.3, 2.5, 6, y, 0, 2);
    stand(k, -2.3, 0.85, 2.2, 5, y, 'solar', '#2f6fa8', Math.PI / 2);
    crowd(k, -2.3, 0.85, 2.2, 5, y, Math.PI / 2, 2);
    rostrum(k, 1.55, -1.5, y, 1.4, 1.0, 0.6, CONCRETE, 'glass');
    raisedFlag(k, 2.45, -2.25, y, 2.8, '#2f5a3a');
    scoreboard(k, 2.4, 0.3, y, 0.8);
    for (const [x, z] of [[2.5, 1.7], [-2.5, -2.5]]) lightMast(k, x, z, y, 2.8);
    squad(k, y, cx, cz, hx - 0.1, hz, 3, 4, 0.45);
    squad(k, y, cx, cz, hx - 0.1, hz, 3, 4, 0.45, 2 * (hx + hz));
    return;
  }
  // 20: Parade citadel: gold-trimmed colonnaded ring of stands with glass corner pavilions, obelisk
  ground(k, sq, y, '#d9d2c3', GOLD, 4);
  stand(k, -0.9, -1.3, 2.5, 6, y, 'canopy', '#d9b24a');
  crowd(k, -0.9, -1.3, 2.5, 6, y, 0, 2);
  stand(k, -2.3, 0.85, 2.2, 6, y, 'canopy', '#d9b24a', Math.PI / 2);
  crowd(k, -2.3, 0.85, 2.2, 6, y, Math.PI / 2, 2);
  k.glassBox(0.9, 1.9, 0.9, -2.3, y, -1.9);
  k.box(1.0, 0.1, 1.0, GOLD, -2.3, y + 1.9, -1.9);
  rostrum(k, 1.5, -1.5, y, 1.5, 1.0, 0.6, '#ece6d6', 'glass');
  colonnade(k, 1.5, -2.25, 1.6, y, 1.6, 4, true);
  raisedFlag(k, 2.45, -2.3, y, 2.9, '#2f5a3a');
  obelisk(k, 2.3, 1.2, y, 1.9);
  squad(k, y, cx, cz, hx - 0.15, hz, 3, 4, 0.45);
  squad(k, y, cx, cz, hx - 0.15, hz, 3, 4, 0.45, 2 * (hx + hz));
  stander(k, 1.3, -1.5, y + 0.6, -Math.PI / 2, 8, 'salute');
}

export function buildParade(level: number): Kit {
  const k = new Kit();
  const y = k.pad(6, 6);
  if (level <= 3) field(k, level, y);
  else if (level <= 6) camp(k, level, y);
  else if (level <= 10) base(k, level, y);
  else if (level <= 15) command(k, level, y);
  else secure(k, level, y);
  return k;
}

export const PARADE_SQUARE: BuildingDef = {
  id: 'parade',
  name: 'Parade Square',
  role: 'Fall-in ceremonies and Cohesion. Boosts Morale across the whole camp.',
  footprint: [6, 6],
  unlockHq: 5,
  levels: PARADE_LEVELS,
  designedLevels: 20,
  build: buildParade,
};

void STOREY;
