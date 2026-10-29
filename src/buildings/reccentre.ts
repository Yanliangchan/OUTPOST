import * as THREE from 'three';
import { C, Kit, STOREY } from './kit';
import { CONCRETE, DARK_GLASS, perimeter } from './common';
import { DAY, HOUR, MIN, type BuildingDef, type LevelStats } from './types';

/*
 * Rec Centre: Recruits relax and play here; lifts Morale.
 * Signature at every level: sport and leisure kit (hoops, nets, tables, gym gear)
 * with a ball or player in motion. Footprint 4×4; height cap ~3.5 storeys.
 */

const TITLES = [
  'Fitness Corner', 'Half-Court', 'Games Shed', 'Takraw Court', 'Gym Hut', 'Covered Court',
  'Rec Hall', 'Sports Pavilion', 'Gym & Pool', 'Rec Centre Complex', 'Climbing Wall Hall', 'Rooftop Futsal',
  'Aquatic Centre', 'E-Sports Arena', 'Stadium Bowl', 'Obstacle Course', 'Sky Track', 'Bowling Lanes',
  'Wave Pool Hall', 'Arena Citadel',
];
const SUPPLIES = [300, 900, 2_100, 4_800, 10_000, 19_000, 34_000, 58_000, 95_000, 150_000, 230_000, 345_000, 485_000, 655_000, 870_000, 1_130_000, 1_430_000, 1_770_000, 2_150_000, 2_580_000];
const REPUTATION = [0, 20, 60, 120, 260, 460, 800, 1_200, 1_800, 2_500, 3_400, 4_500, 5_800, 7_300, 9_000, 10_800, 13_000, 15_500, 18_300, 21_300];
const TIME = [2 * MIN, 8 * MIN, 25 * MIN, 1 * HOUR, 2 * HOUR, 4 * HOUR, 6 * HOUR, 10 * HOUR, 16 * HOUR, 1 * DAY, 1.5 * DAY, 2 * DAY, 2.5 * DAY, 3 * DAY, 3.5 * DAY, 4 * DAY, 4.5 * DAY, 5 * DAY, 5.5 * DAY, 6 * DAY];

export const REC_LEVELS: LevelStats[] = TITLES.map((title, i) => {
  const level = i + 1;
  const morale = 2 + Math.floor(i * 0.6);
  const capacity = 6 + i * 3;
  return {
    level, title,
    supplies: SUPPLIES[i],
    reputation: REPUTATION[i],
    buildTime: TIME[i],
    hp: Math.round((280 * Math.pow(1.2, i)) / 10) * 10,
    stats: { morale, capacity },
    unlocks: [`+${morale} Morale`, `${capacity} Recruits at a time`],
  };
});

// ------------------------------------------------------------------ signature props

const COURT = '#2f8f6a';
const COURT_B = '#c9643a';
const LINE = '#f4f1e8';
const BALL = '#ff8a1f';
const SEAT = ['#e94f37', '#2bb3a3', '#ffc93c', '#2f6fa8'];
const M = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.75, ...o });

/** Painted court slab with boundary and centre lines. */
function court(k: Kit, w: number, d: number, x: number, z: number, y: number, color = COURT) {
  k.box(w, 0.025, d, color, x, y, z);
  const t = 0.025;
  k.box(w - 0.1, 0.005, t, LINE, x, y + 0.025, z - d / 2 + 0.06);
  k.box(w - 0.1, 0.005, t, LINE, x, y + 0.025, z + d / 2 - 0.06);
  k.box(t, 0.005, d - 0.1, LINE, x - w / 2 + 0.06, y + 0.025, z);
  k.box(t, 0.005, d - 0.1, LINE, x + w / 2 - 0.06, y + 0.025, z);
  k.box(w - 0.1, 0.005, t, LINE, x, y + 0.025, z);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.min(w, d) * 0.12, 0.012, 4, 20), M(LINE));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, y + 0.03, z);
  k.add(ring);
}

/** Basketball hoop on a pole; facing +z rotated by rotY. Returns the rim world point. */
function hoop(k: Kit, x: number, z: number, y: number, rotY = 0, h = 1.05) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  k.box(0.06, h, 0.06, '#33383d', 0, 0, 0, g);
  k.box(0.04, 0.04, 0.22, '#33383d', 0, h - 0.12, 0.1, g);
  k.box(0.38, 0.26, 0.03, '#ffffff', 0, h - 0.2, 0.22, g);
  k.box(0.14, 0.1, 0.035, '#e94f37', 0, h - 0.16, 0.225, g);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.01, 4, 12), M('#ff6a13'));
  rim.rotation.x = Math.PI / 2;
  rim.position.set(0, h - 0.18, 0.31);
  g.add(rim);
  const net = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.05, 0.1, 8, 1, true), M('#ffffff', { transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  net.position.set(0, h - 0.23, 0.31);
  g.add(net);
  k.add(g);
  g.updateMatrixWorld(true);
  return new THREE.Vector3(0, h - 0.18, 0.31).applyMatrix4(g.matrixWorld);
}

/** A ball that arcs from a point into the hoop, then bounces back out (shooting practice). */
function shootingBall(k: Kit, from: THREE.Vector3, to: THREE.Vector3, seed = 0, color = BALL) {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), M(color));
  ball.castShadow = true;
  k.add(ball);
  const ground = from.y;
  k.anims.push((t) => {
    const c = ((t + seed) % 3.2) / 3.2;
    if (c < 0.2) {
      // dribble at the shooter's spot
      const b = Math.abs(Math.sin(c * Math.PI * 10)) * 0.25;
      ball.position.set(from.x, ground + 0.06 + b, from.z);
    } else if (c < 0.55) {
      const p = (c - 0.2) / 0.35;
      ball.position.lerpVectors(from, to, p);
      ball.position.y = THREE.MathUtils.lerp(ground + 0.3, to.y, p) + Math.sin(p * Math.PI) * 0.6;
    } else if (c < 0.62) {
      const p = (c - 0.55) / 0.07;
      ball.position.set(to.x, to.y - p * (to.y - ground - 0.06), to.z);
    } else {
      const p = (c - 0.62) / 0.38;
      ball.position.lerpVectors(to, from, p);
      ball.position.y = ground + 0.06 + Math.abs(Math.sin(p * Math.PI * 3)) * 0.3 * (1 - p);
    }
    ball.rotation.x = t * 8;
  });
}

/** Net across a court (badminton/takraw/volleyball) along x; swaying gently. */
function net(k: Kit, w: number, x: number, z: number, y: number, h = 0.55, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  for (const s of [-1, 1]) k.box(0.04, h, 0.04, '#5c6166', (s * w) / 2, 0, 0, g);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.22, 10, 2), M('#ffffff', { transparent: true, opacity: 0.55, side: THREE.DoubleSide, wireframe: false }));
  mesh.position.set(0, h - 0.13, 0);
  g.add(mesh);
  k.box(w, 0.02, 0.02, '#ffffff', 0, h - 0.02, 0, g);
  k.add(g);
  k.anims.push((t) => (mesh.rotation.x = Math.sin(t * 1.3 + x) * 0.08));
}

/** Shuttle / takraw ball volleying back and forth over a net along z. */
function rally(k: Kit, x: number, z: number, y: number, span = 0.8, peak = 0.7, color = '#ffffff', size = 0.035, seed = 0, alongX = false) {
  const b = new THREE.Mesh(new THREE.SphereGeometry(size, 6, 4), M(color));
  b.castShadow = true;
  k.add(b);
  k.anims.push((t) => {
    const c = ((t + seed) % 2.4) / 2.4;
    const p = c < 0.5 ? c * 2 : 2 - c * 2;
    const off = (p - 0.5) * span;
    b.position.set(alongX ? x + off : x, y + 0.25 + Math.sin(p * Math.PI) * peak, alongX ? z : z + off);
  });
}

/** Little resting/playing figure in PT kit (simple capsule). */
function player(k: Kit, x: number, z: number, y: number, shirt = '#ff8a3d', bob = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.14, 2, 6), M(shirt));
  body.position.y = 0.17;
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.055, 0), M('#d9a27a'));
  head.position.y = 0.34;
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.06), M('#2f3b4a'));
  legs.position.y = 0.05;
  g.add(body, head, legs);
  g.traverse((o) => (o.castShadow = true));
  k.add(g);
  if (bob) k.anims.push((t) => (g.position.y = y + Math.abs(Math.sin(t * bob + x * 3)) * 0.06));
  return g;
}

/** Table-tennis table with a ball pinging across it. */
function pingPong(k: Kit, x: number, z: number, y: number, seed = 0) {
  k.box(0.7, 0.03, 0.4, '#2f6fa8', x, y + 0.3, z);
  k.box(0.01, 0.06, 0.42, '#ffffff', x, y + 0.33, z);
  for (const [dx, dz] of [[-0.3, -0.16], [0.3, -0.16], [-0.3, 0.16], [0.3, 0.16]]) k.box(0.03, 0.3, 0.03, '#33383d', x + dx, y, z + dz);
  rally(k, x, z, y + 0.08, 0.6, 0.12, '#ffffff', 0.018, seed, true);
}

/** Carrom board on a stand. */
function carrom(k: Kit, x: number, z: number, y: number) {
  k.box(0.04, 0.28, 0.04, '#7a5a3b', x, y, z);
  k.box(0.36, 0.03, 0.36, '#7a5a3b', x, y + 0.28, z);
  k.box(0.3, 0.032, 0.3, '#e8d2a0', x, y + 0.282, z);
  for (let i = 0; i < 5; i++) k.cyl(0.018, 0.01, i % 2 ? '#2a2b2d' : '#f4f1e8', x - 0.08 + i * 0.04, y + 0.31, z + (i % 3 - 1) * 0.04, 8);
}

/** Pull-up / parallel bars and a sit-up bench (the classic camp fitness corner). */
function fitnessCorner(k: Kit, x: number, z: number, y: number) {
  for (const dx of [-0.3, 0.3]) k.box(0.05, 0.85, 0.05, '#2f6fa8', x + dx, y, z);
  k.box(0.65, 0.03, 0.03, '#c9ced2', x, y + 0.82, z);
  for (const dz of [-0.1, 0.1]) {
    for (const dx of [0.5, 0.95]) k.box(0.04, 0.42, 0.04, '#ffc93c', x + dx, y, z + dz);
    k.box(0.5, 0.03, 0.03, '#c9ced2', x + 0.72, y + 0.42, z + dz);
  }
  const bench = k.box(0.5, 0.05, 0.14, '#2f6fa8', x - 0.1, y + 0.18, z + 0.45);
  bench.rotation.z = 0.25;
  k.box(0.04, 0.2, 0.12, '#33383d', x - 0.3, y, z + 0.45);
}

/** Heavy punching bag on a frame, swinging. */
function punchBag(k: Kit, x: number, z: number, y: number) {
  for (const dx of [-0.2, 0.2]) k.box(0.04, 1.0, 0.04, '#5c6166', x + dx, y, z);
  k.box(0.44, 0.04, 0.04, '#5c6166', x, y + 1.0, z);
  const g = new THREE.Group();
  g.position.set(x, y + 0.98, z);
  const chain = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.14, 0.01), M('#33383d'));
  chain.position.y = -0.07;
  const bag = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.42, 10), M('#c0392b'));
  bag.position.y = -0.36;
  bag.castShadow = true;
  g.add(chain, bag);
  k.add(g);
  k.anims.push((t) => {
    g.rotation.x = Math.sin(t * 2.2 + x) * 0.25;
    g.rotation.z = Math.sin(t * 1.7 + x) * 0.12;
  });
}

/** Weights rack with dumbbells. */
function weights(k: Kit, x: number, z: number, y: number, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  k.box(0.6, 0.25, 0.18, '#33383d', 0, 0, 0, g);
  for (let i = 0; i < 4; i++) {
    const db = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.14, 6).rotateZ(Math.PI / 2), M('#5c6166'));
    db.position.set(-0.22 + i * 0.15, 0.28, 0);
    g.add(db);
  }
  k.add(g);
}

/** Tiered spectator stand (rows of coloured seats) facing +z, optional roof. */
function stands(k: Kit, w: number, rows: number, x: number, z: number, y: number, rotY = 0, roof = true) {
  const g = new Kit();
  for (let r = 0; r < rows; r++) {
    g.box(w, 0.16 + r * 0.16, 0.22, CONCRETE, 0, 0, -r * 0.22);
    const n = Math.max(3, Math.round(w / 0.16));
    for (let i = 0; i < n; i++) g.box(w / n - 0.03, 0.05, 0.1, SEAT[(i + r) % SEAT.length], -w / 2 + (w / n) * (i + 0.5), 0.16 + r * 0.16, -r * 0.22 + 0.04);
  }
  const top = 0.16 * rows;
  if (roof) {
    for (const s of [-1, 1]) g.box(0.06, top + 0.55, 0.06, '#8a9196', (s * w) / 2 - s * 0.05, 0, -(rows - 1) * 0.22 - 0.05);
    const r = g.box(w + 0.15, 0.05, rows * 0.22 + 0.35, C.roofGreen, 0, top + 0.55, -(rows - 1) * 0.11 + 0.12);
    r.rotation.x = -0.12;
  }
  g.group.position.set(x, y, z);
  g.group.rotation.y = rotY;
  k.add(g.group);
  for (const a of g.anims) k.anims.push(a);
}

/** Scoreboard on posts with flickering digits. */
function scoreboard(k: Kit, x: number, z: number, y: number, h = 1.2, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  for (const s of [-0.25, 0.25]) k.box(0.05, h, 0.05, '#5c6166', s, 0, 0, g);
  k.box(0.7, 0.36, 0.08, '#2a2f33', 0, h, 0, g);
  const digits: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const d = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.01), new THREE.MeshStandardMaterial({ color: '#ffb020', emissive: '#ffb020', emissiveIntensity: 1 }));
    d.position.set(-0.24 + i * 0.16 + (i > 1 ? 0.04 : 0), h + 0.18, 0.045);
    g.add(d);
    digits.push(d);
  }
  k.add(g);
  k.anims.push((t) => digits.forEach((d, i) => (d.scale.y = 0.5 + (Math.floor(t * 0.7 + i * 3.1) % 3) * 0.25)));
}

/** Floodlight mast with a lamp head that glows. */
function floodlight(k: Kit, x: number, z: number, y: number, h = 2.6) {
  k.cyl(0.04, h, '#8a9196', x, y, z, 6);
  k.box(0.36, 0.22, 0.06, '#33383d', x, y + h, z);
  for (let i = 0; i < 4; i++) k.box(0.07, 0.07, 0.01, '#fff6c8', x - 0.12 + (i % 2) * 0.24, y + h + 0.04 + Math.floor(i / 2) * 0.1, z + 0.035);
}

/** Swimming pool: tiled rim, water that shimmers, lane ropes. */
function pool(k: Kit, w: number, d: number, x: number, z: number, y: number, lanes = 3) {
  k.box(w + 0.16, 0.12, d + 0.16, '#e9ecee', x, y, z);
  const water = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, d), new THREE.MeshStandardMaterial({ color: '#4fc7d4', emissive: '#1d8fa8', emissiveIntensity: 0.15, flatShading: true, roughness: 0.2 }));
  water.position.set(x, y + 0.11, z);
  k.add(water);
  for (let i = 1; i < lanes; i++) k.box(0.02, 0.02, d, i % 2 ? '#e94f37' : '#ffc93c', x - w / 2 + (w / lanes) * i, y + 0.13, z);
  const mat = water.material as THREE.MeshStandardMaterial;
  const base = new THREE.Color('#4fc7d4');
  const hi = new THREE.Color('#8fe6ee');
  k.anims.push((t) => {
    mat.color.copy(base).lerp(hi, Math.sin(t * 1.8 + x) * 0.5 + 0.5);
    water.position.y = y + 0.11 + Math.sin(t * 2.4) * 0.006;
  });
  // A swimmer doing laps
  const sw = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.14, 2, 6).rotateX(Math.PI / 2), M('#e94f37'));
  k.add(sw);
  k.anims.push((t) => {
    const c = (t * 0.15 + x) % 2;
    const p = c < 1 ? c : 2 - c;
    sw.position.set(x - w / 2 + (w / lanes) * 0.5, y + 0.14, z - d / 2 + 0.15 + p * (d - 0.3));
    sw.rotation.y = c < 1 ? 0 : Math.PI;
  });
}

/** Spinning ceiling fan inside halls. */
function fan(k: Kit, x: number, y: number, z: number) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  k.box(0.5, 0.01, 0.06, '#f4f4f0', 0, 0, 0, g);
  k.box(0.06, 0.01, 0.5, '#f4f4f0', 0, 0, 0, g);
  k.add(g);
  k.anims.push((t) => (g.rotation.y = t * 6));
}

/** Big flickering video screen. */
function screen(k: Kit, w: number, h: number, x: number, y: number, z: number, rotY = 0, color = '#3fd1ff') {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  k.box(w + 0.08, h + 0.08, 0.05, '#2a2f33', 0, 0, 0, g);
  const mat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.8 });
  const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.01), mat);
  s.position.set(0, (h + 0.08) / 2, 0.03);
  g.add(s);
  k.add(g);
  const cols = ['#3fd1ff', '#ff5ec4', '#ffd23f', '#7cff8a'].map((c) => new THREE.Color(c));
  k.anims.push((t) => {
    const i = Math.floor(t * 0.8 + x) % cols.length;
    mat.color.copy(cols[i]);
    mat.emissive.copy(cols[i]);
    mat.emissiveIntensity = 0.6 + Math.abs(Math.sin(t * 9)) * 0.3;
  });
}

function waterCooler(k: Kit, x: number, z: number, y: number) {
  k.waterPoint(x, z, y);
}

// ------------------------------------------------------------------ levels

function field(k: Kit, level: number, y: number) {
  if (level === 1) {
    // Fitness corner: bars, bench, takraw ball being kicked up
    k.box(2.6, 0.02, 2.0, '#d9b98a', -0.2, y, -0.2); // sand pit
    fitnessCorner(k, -0.7, -0.5, y);
    punchBag(k, 1.2, -0.9, y);
    const pl = player(k, 0.6, 0.8, y, '#ff8a3d', 9);
    void pl;
    rally(k, 0.6, 0.8, y + 0.15, 0.0, 0.45, '#e8c26a', 0.05, 0, false);
    // Timber shade shelter over the bench
    for (const [x, z] of [[-1.5, 0.95], [-0.3, 0.95], [-1.5, 1.6], [-0.3, 1.6]]) k.box(0.06, 0.85, 0.06, C.wood, x, y, z);
    k.gableRoof(1.3, 0.75, 0.25, -0.9, y + 0.85, 1.28, C.zinc, 0.1, C.wood, false);
    k.bench(-0.9, 1.3, 0.8, y);
    waterCooler(k, 1.4, 1.3, y);
    return;
  }
  if (level === 2) {
    // Half-court basketball with a shooting ball, bench and pull-up bars
    court(k, 2.6, 2.4, -0.3, -0.2, y, COURT_B);
    const rim = hoop(k, -0.3, -1.45, y, 0);
    shootingBall(k, new THREE.Vector3(-0.1, y + 0.03, 0.3), rim, 0);
    fitnessCorner(k, 1.25, 0.6, y);
    const ch = k.block(0.9, 0.8, 1, -1.3, y, 1.2, C.wood);
    k.gableRoof(0.9, 0.8, 0.3, -1.3, y + ch, 1.2, C.zinc, 0.1, C.wood);
    k.door('front', -1.3, 1.2, 0.9, 0.8, 0, y, 0.28, 0.55, '#7a5a3b');
    waterCooler(k, 1.4, -1.3, y);
    player(k, -0.1, 0.45, y, '#2bb3a3', 4);
    player(k, -0.75, -0.6, y, '#ffc93c', 3.2);
    return;
  }
  // 3: games shed: timber open shed, zinc roof, ping-pong + carrom; hoop outside
  const sx = -0.4, sz = -0.55, w = 2.2, d = 1.7;
  for (const x of [-1.0, 0, 1.0]) for (const z of [-0.75, 0.75]) k.box(0.08, 0.95, 0.08, C.wood, sx + x, y, sz + z);
  k.gableRoof(w, d, 0.4, sx, y + 0.95, sz, C.zinc, 0.15, C.wood);
  k.box(w, 0.02, d, '#c9b38f', sx, y, sz);
  pingPong(k, sx - 0.45, sz - 0.15, y, 0);
  carrom(k, sx + 0.6, sz + 0.3, y);
  k.bench(sx + 0.55, sz - 0.5, 0.5, y);
  fan(k, sx, y + 0.9, sz);
  const rim = hoop(k, 1.4, 1.2, y, -Math.PI * 0.75);
  shootingBall(k, new THREE.Vector3(0.6, y + 0.03, 0.5), rim, 1);
}

function camp(k: Kit, level: number, y: number) {
  if (level === 4) {
    // Sepak takraw court with a net, ball volleying; small red-roofed pavilion
    court(k, 2.2, 3.0, 0.6, -0.1, y, COURT);
    net(k, 2.2, 0.6, -0.1, y, 0.5);
    rally(k, 0.6, -0.1, y, 1.6, 0.8, '#e8c26a', 0.045, 0);
    player(k, 0.4, -1.0, y, '#ff8a3d', 5);
    player(k, 0.8, 0.8, y, '#2bb3a3', 5);
    const h = k.block(1.0, 3.2, 1, -1.25, y, -0.1, C.wall);
    k.box(1.0, 0.3, 3.2, C.wall, -1.25, y + STOREY, -0.1);
    k.hipRoof(1.0, 3.2, 0.5, -1.25, y + h + 0.3, -0.1);
    k.windowRow('right', -1.25, -0.1, 1.0, 3.2, 4, y + 0.42, { louvre: true });
    stands(k, 1.8, 2, 0.6, 1.7, y, Math.PI, false);
    return;
  }
  if (level === 5) {
    // Gym hut: open-front hut with weights, punching bag outside, hoop
    const h = k.block(2.2, 1.3, 1, -0.6, y, -0.9, C.wall);
    k.box(2.2, 0.25, 1.3, C.wall, -0.6, y + STOREY, -0.9);
    k.gableRoof(2.2, 1.3, 0.5, -0.6, y + h + 0.25, -0.9);
    k.box(1.6, 0.75, 0.04, '#3a3f44', -0.6, y + 0.05, -0.24);
    weights(k, -1.0, -0.6, y);
    weights(k, -0.1, -0.6, y);
    k.windowRow('left', -0.6, -0.9, 2.2, 1.3, 2, y + 0.42, { louvre: true });
    punchBag(k, 1.1, -0.9, y);
    court(k, 2.2, 1.5, -0.3, 0.95, y, COURT_B);
    const rim = hoop(k, 1.3, 0.95, y, -Math.PI / 2);
    shootingBall(k, new THREE.Vector3(0.2, y + 0.03, 1.0), rim, 0.5);
    fitnessCorner(k, -1.3, 1.0, y);
    k.linkway(-1.7, 0.2, 0.7, 0.2, y, 0.8, 0.5);
    stands(k, 1.6, 2, -0.6, 1.75, y, Math.PI, false);
    return;
  }
  // 6: covered court: steel-frame curved canopy over a full court (MPH style)
  court(k, 3.2, 2.6, 0, -0.2, y, COURT);
  for (const x of [-1.6, -0.55, 0.55, 1.6]) for (const z of [-1.5, 1.1]) k.box(0.08, 1.6, 0.08, '#8a9196', x, y, z);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 3.5, 16, 1, true, Math.PI / 2 - 0.75, 1.5), M(C.roofGreen, { side: THREE.DoubleSide }));
  roof.rotation.z = Math.PI / 2;
  roof.position.set(0, y + 0.15, -0.2);
  roof.castShadow = true;
  k.add(roof);
  const rim1 = hoop(k, -1.45, -0.2, y, Math.PI / 2);
  hoop(k, 1.45, -0.2, y, -Math.PI / 2);
  shootingBall(k, new THREE.Vector3(-0.4, y + 0.03, 0.1), rim1, 0);
  player(k, -0.4, 0.2, y, '#ff8a3d', 0);
  player(k, 0.5, -0.5, y, '#2f6fa8', 6);
  k.bench(0, 1.45, 1.2, y);
  waterCooler(k, 1.45, 1.45, y);
}

function base(k: Kit, level: number, y: number) {
  if (level === 7) {
    // Rec hall with a TV lounge visible through the windows; badminton court outside
    const hw = 3.4, hd = 1.7, hz = -0.95;
    const h = k.block(hw, hd, 2, 0, y, hz);
    k.windowRow('front', 0, hz, hw, hd, 5, y + STOREY + 0.45, { louvre: true });
    k.hipRoof(hw, hd, 0.65, 0, y + h, hz);
    k.box(1.0, 0.5, 0.02, '#bfe6f2', -0.9, y + 0.3, hz + hd / 2 + 0.005);
    screen(k, 0.5, 0.3, -0.9, y + 0.32, hz + hd / 2 - 0.3, 0);
    k.windowRow('front', 0, hz, hw, hd, 4, y + 0.45, { louvre: true, skip: [0] });
    k.door('front', 0, hz, hw, hd, 0.6, y, 0.4, 0.66);
    fan(k, -0.9, y + 0.85, hz);
    court(k, 3.2, 1.6, 0, 0.9, y, COURT);
    net(k, 1.6, 0, 0.9, y, 0.55, Math.PI / 2);
    rally(k, 0, 0.9, y, 1.4, 0.6, '#ffffff', 0.03, 0, true);
    player(k, -0.8, 0.9, y, '#ff8a3d', 4);
    player(k, 0.8, 0.9, y, '#2bb3a3', 4);
    return;
  }
  if (level === 8) {
    // Sports pavilion: roofed grandstand overlooking a court, scoreboard
    court(k, 3.4, 2.0, 0, 0.6, y, COURT_B);
    const cb = k.block(3.4, 1.5, 1, 0, y, -1.15, C.wall);
    k.windowRow('front', 0, -1.25, 3.4, 1.3, 5, y + 0.42, { louvre: true, skip: [2] });
    k.door('front', 0, -1.25, 3.4, 1.3, 0, y, 0.4, 0.66);
    stands(k, 3.2, 5, 0, -0.75, y + cb, 0, true);
    const rim = hoop(k, -1.6, 0.6, y, Math.PI / 2);
    hoop(k, 1.6, 0.6, y, -Math.PI / 2);
    shootingBall(k, new THREE.Vector3(-0.5, y + 0.03, 0.9), rim, 0.7);
    scoreboard(k, 1.5, 1.55, y, 1.5, Math.PI);
    k.linkway(-1.75, 1.6, 0.9, 1.6, y, 0.85, 0.55);
    player(k, 0.3, 0.6, y, '#2f6fa8', 6);
    return;
  }
  if (level === 9) {
    // Gym & pool: two-storey gym block plus an outdoor pool with a swimmer
    const h = k.block(1.4, 3.2, 2, -1.15, y, -0.2, C.wall);
    k.hipRoof(1.4, 3.2, 0.5, -1.15, y + h, -0.2);
    for (let f = 0; f < 2; f++) k.windowRow('right', -1.15, -0.2, 1.4, 3.2, 4, y + f * STOREY + 0.42, { louvre: f > 0 });
    k.door('right', -1.15, -0.2, 1.4, 3.2, 1.0, y, 0.4, 0.66);
    pool(k, 2.0, 2.6, 0.75, -0.2, y, 4);
    for (const z of [-1.4, 1.0]) {
      k.box(0.36, 0.05, 0.14, '#ffffff', 1.55, y + 0.15, z);
      const umb = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.14, 8), M(z < 0 ? '#ffc93c' : '#2bb3a3'));
      umb.position.set(1.55, y + 0.95, z);
      k.add(umb);
      k.cyl(0.02, 0.85, C.metal, 1.55, y, z, 5);
    }
    k.stairs(0.1, 1.25, 0.18, 0.3, 0.12);
    // Shade pavilion over the deep end
    for (const [x, z] of [[-0.2, -1.55], [1.7, -1.55], [-0.2, -0.65], [1.7, -0.65]]) k.box(0.06, 1.05, 0.06, C.white, x, y, z);
    k.box(2.1, 0.07, 1.1, C.roofGreen, 0.75, y + 1.05, -1.1);
    return;
  }
  // 10: complex: sports hall with a clerestory, pool, fitness corner
  const hw = 2.6, hd = 2.2, hx = -0.55, hz = -0.75;
  k.box(hw, 2.2, hd, C.wall, hx, y, hz);
  k.box(hw + 0.03, 0.16, hd + 0.03, C.trim, hx, y, hz);
  k.box(hw - 0.3, 0.3, 0.02, '#86b7cc', hx, y + 1.75, hz + hd / 2 + 0.005);
  k.gableRoof(hw, hd, 0.55, hx, y + 2.2, hz, C.roof);
  k.box(1.1, 0.95, 0.04, '#3a3f44', hx, y + 0.05, hz + hd / 2 + 0.01);
  court(k, 1.0, 0.6, hx, hz + hd / 2 - 0.35, y, COURT_B);
  k.plaque('REC CENTRE', hx - 0.8, 0.65, y, 0.9);
  pool(k, 1.0, 2.2, 1.45, -0.75, y, 2);
  fitnessCorner(k, 0.2, 1.1, y);
  punchBag(k, 1.4, 1.2, y);
  fan(k, hx, y + 1.9, hz);
}

function command(k: Kit, level: number, y: number) {
  if (level === 11) {
    // Climbing wall hall: modern hall with a tall coloured climbing wall and a climber
    const h = k.block(2.4, 2.4, 3, -0.6, y, -0.6, C.wallAlt);
    k.flatRoof(2.4, 2.4, -0.6, y + h, -0.6);
    for (let f = 0; f < 3; f++) k.windowRow('left', -0.6, -0.6, 2.4, 2.4, 3, y + f * STOREY + 0.42);
    const wx = 1.0;
    k.box(0.75, 2.9, 1.8, '#e9e4d6', wx, y, -0.7);
    for (let i = 0; i < 40; i++) {
      const hold = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0), M(SEAT[i % 4]));
      hold.position.set(wx + 0.38, y + 0.2 + ((i * 37) % 26) * 0.1, -1.5 + ((i * 53) % 16) * 0.1);
      k.add(hold);
    }
    const climber = player(k, wx + 0.45, -0.7, y, '#ff8a3d', 0);
    climber.rotation.y = Math.PI / 2;
    k.anims.push((t) => {
      const c = (t * 0.12) % 2;
      const p = c < 1 ? c : 2 - c;
      climber.position.y = y + 0.1 + p * 2.3;
      climber.position.z = -0.7 + Math.sin(t * 1.3) * 0.25;
    });
    k.box(0.02, 3.0, 0.02, '#ffffff', wx + 0.5, y, -0.7); // rope
    court(k, 3.2, 1.0, 0, 1.15, y, COURT);
    const rim = hoop(k, -1.5, 1.15, y, Math.PI / 2);
    shootingBall(k, new THREE.Vector3(-0.5, y + 0.03, 1.2), rim, 0.3);
    return;
  }
  if (level === 12) {
    // Rooftop futsal: two-storey block with a netted futsal cage on the roof
    const h = k.block(3.2, 2.8, 3, 0, y, -0.4, C.wall);
    k.flatRoof(3.2, 2.8, 0, y + h, -0.4);
    for (let f = 0; f < 3; f++) k.windowRow('front', 0, -0.4, 3.2, 2.8, 5, y + f * STOREY + 0.42, { louvre: f > 0 });
    k.door('front', 0, -0.4, 3.2, 2.8, 0, y, 0.5, 0.66);
    const ry = y + h + 0.06;
    court(k, 3.0, 2.6, 0, -0.4, ry, '#3f9b4a');
    for (const x of [-1.5, 0, 1.5]) for (const z of [-1.7, 0.9]) k.box(0.04, 0.6, 0.04, '#5c6166', x, ry, z);
    const netMat = M('#e8e8e8', { transparent: true, opacity: 0.25, side: THREE.DoubleSide });
    for (const z of [-1.7, 0.9]) {
      const n = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.6), netMat);
      n.position.set(0, ry + 0.3, z);
      k.add(n);
    }
    for (const x of [-1.5, 1.5]) {
      const n = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.6), netMat);
      n.rotation.y = Math.PI / 2;
      n.position.set(x, ry + 0.3, -0.4);
      k.add(n);
      k.box(0.05, 0.3, 0.5, '#ffffff', x - Math.sign(x) * 0.1, ry, -0.4); // goals
    }
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M('#ffffff'));
    k.add(ball);
    k.anims.push((t) => {
      ball.position.set(Math.sin(t * 0.9) * 1.1, ry + 0.07 + Math.abs(Math.sin(t * 3)) * 0.08, -0.4 + Math.sin(t * 1.4) * 0.8);
      ball.rotation.z = t * 6;
    });
    player(k, -0.6, -0.7, ry, '#ff8a3d', 5);
    player(k, 0.6, 0.0, ry, '#2f6fa8', 5);
    return;
  }
  if (level === 13) {
    // Aquatic centre: open-sided pool hall under a swooping wave roof, back glass wall, diving tower
    k.glassBox(3.4, 2.6, 0.3, 0, y, -1.75);
    for (const x of [-1.6, -0.55, 0.55, 1.6]) k.cyl(0.06, 2.4, C.white, x, y, 0.85, 8);
    const roofG = new THREE.PlaneGeometry(3.7, 3.0, 12, 4).rotateX(-Math.PI / 2);
    const rp = roofG.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < rp.count; i++) rp.setY(i, Math.sin(rp.getX(i) * 1.6) * 0.18 + (rp.getZ(i) + 1.5) * -0.08);
    roofG.computeVertexNormals();
    const roofM = new THREE.Mesh(roofG, M('#f4f6f7', { side: THREE.DoubleSide }));
    roofM.position.set(0, y + 2.65, -0.45);
    roofM.castShadow = true;
    k.add(roofM);
    k.box(3.7, 0.05, 0.08, '#2bb3a3', 0, y + 2.45, 1.05);
    k.plaque('AQUATIC', -1.2, 1.55, y, 0.8);
    pool(k, 2.4, 1.6, -0.3, -0.5, y, 5);
    k.box(0.4, 1.8, 0.4, CONCRETE, 1.3, y, -1.3);
    k.box(0.5, 0.06, 0.12, '#2bb3a3', 1.3, y + 1.8, -1.05);
    k.box(0.5, 0.06, 0.12, '#2bb3a3', 1.3, y + 1.2, -1.05);
    const diver = player(k, 1.3, -1.0, y + 1.8, '#e94f37', 0);
    k.anims.push((t) => {
      const c = (t % 5) / 5;
      if (c < 0.5) {
        diver.position.set(1.3, y + 1.86, -1.0);
        diver.rotation.x = 0;
      } else {
        const p = (c - 0.5) / 0.5;
        diver.position.set(1.3 - p * 0.6, y + 1.86 + Math.sin(p * Math.PI) * 0.3 - p * 1.9, -1.0 + p * 0.3);
        diver.rotation.x = p * Math.PI;
      }
    });
    return;
  }
  if (level === 14) {
    // E-sports arena: dark box with big flickering screens and neon strips
    k.box(3.4, 2.8, 2.8, '#2f3640', 0, y, -0.4);
    k.box(3.44, 0.08, 2.84, '#ff5ec4', 0, y + 2.1, -0.4);
    k.box(3.44, 0.08, 2.84, '#3fd1ff', 0, y + 0.5, -0.4);
    screen(k, 2.2, 1.1, 0, y + 0.75, 1.02, 0);
    screen(k, 1.6, 0.9, 1.73, y + 1.0, -0.4, Math.PI / 2, '#ff5ec4');
    k.box(1.4, 0.1, 0.5, '#ffc93c', 0, y + 2.25, 1.15);
    k.plaque('E-SPORTS', -1.1, 1.55, y, 0.9);
    for (const x of [-1.3, 1.3]) k.blinker(x, y + 2.8, 0.9, '#ff5ec4', 0.05, 0.8);
    const logo = new THREE.Group();
    logo.position.set(0, y + 3.05, -0.4);
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.MeshStandardMaterial({ color: '#3fd1ff', emissive: '#3fd1ff', emissiveIntensity: 0.6, flatShading: true }));
    logo.add(cube);
    k.cyl(0.04, 0.25, '#5c6166', 0, y + 2.8, -0.4, 6);
    k.add(logo);
    k.anims.push((t) => {
      cube.rotation.set(t * 0.7, t, 0);
      logo.position.y = y + 3.05 + Math.sin(t * 1.5) * 0.05;
    });
    k.door('front', 0, -0.4, 3.4, 2.8, 1.25, y, 0.4, 0.66, DARK_GLASS);
    for (const x of [-1.15, 1.15]) {
      k.cyl(0.3, 0.16, '#5c6166', x, y + 2.8, -1.2, 10);
      fan(k, x, y + 2.97, -1.2);
    }
    player(k, 0.55, 1.5, y, '#ff5ec4', 3.5);
    player(k, 0.85, 1.65, y, '#3fd1ff', 2.8);
    return;
  }
  // 15: stadium bowl: oval stands ringing a pitch, floodlight masts, gold trim
  court(k, 2.0, 1.4, 0, 0.0, y, '#3f9b4a');
  const cc = k.block(3.4, 1.0, 1, 0, y, -1.45, C.wall);
  k.windowRow('front', 0, -1.45, 3.4, 1.0, 6, y + 0.42, { louvre: true });
  stands(k, 3.4, 6, 0, -0.95, y + cc, 0, true);
  stands(k, 3.4, 4, 0, 1.25, y, Math.PI, true);
  for (const s of [-1, 1]) stands(k, 1.4, 4, s * 1.45, 0.0, y, -s * Math.PI / 2, true);
  for (const [x, z] of [[-1.7, -1.7], [1.7, -1.7]]) floodlight(k, x, z, y, 2.8);
  k.box(3.5, 0.08, 1.05, '#d9b24a', 0, y + cc - 0.08, -1.45);
  scoreboard(k, 0, 1.55, y + 0.5, 1.4, Math.PI);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), M('#ffffff'));
  k.add(ball);
  k.anims.push((t) => ball.position.set(Math.sin(t * 0.8) * 0.8, y + 0.07, Math.cos(t * 1.1) * 0.5));
  player(k, -0.4, 0.2, y, '#ff8a3d', 6);
  player(k, 0.5, -0.3, y, '#2f6fa8', 6);
}

function secure(k: Kit, level: number, y: number) {
  perimeter(k, y, 1.72, 1.72, false);
  if (level === 16) {
    // Obstacle course: concrete gym block plus walls, monkey bars, rope swing, tyre run
    const h = k.block(1.3, 3.0, 3, -1.15, y, -0.3, CONCRETE);
    k.flatRoof(1.3, 3.0, -1.15, y + h, -0.3);
    for (let f = 0; f < 3; f++) k.windowRow('right', -1.15, -0.3, 1.3, 3.0, 3, y + f * STOREY + 0.42);
    // Timber rope-climb tower with a deck
    for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) k.box(0.08, 1.9, 0.08, '#7a5a3b', 1.05 + dx, y, -1.0 + dz);
    k.box(0.85, 0.08, 0.85, '#9c6b45', 1.05, y + 1.9, -1.0);
    k.box(0.85, 0.25, 0.05, '#7a5a3b', 1.05, y + 1.98, -0.6);
    k.box(0.85, 0.5, 0.85, '#d9b98a', 1.05, y, -1.0); // sand pit base
    k.box(0.12, 0.8, 0.9, '#7a5a3b', 0.0, y, -0.9); // vault wall

    for (const dx of [0.1, 1.2]) k.box(0.05, 1.1, 0.05, '#ffc93c', dx, y, 0.2);
    k.box(1.15, 0.04, 0.05, '#c9ced2', 0.65, y + 1.08, 0.2);
    for (let i = 0; i < 8; i++) k.box(0.02, 0.02, 0.18, '#c9ced2', 0.15 + i * 0.14, y + 1.06, 0.2);
    for (const dx of [0.2, 1.3]) k.box(0.05, 1.6, 0.05, '#5c6166', dx, y, 0.95);
    k.box(1.15, 0.05, 0.05, '#5c6166', 0.75, y + 1.6, 0.95);
    const rope = new THREE.Group();
    rope.position.set(0.75, y + 1.58, 0.95);
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.3, 0.02).translate(0, -0.65, 0), M('#c9a36a'));
    rope.add(r);
    k.add(rope);
    k.anims.push((t) => (rope.rotation.x = Math.sin(t * 1.6) * 0.45));
    for (let i = 0; i < 4; i++) {
      const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 5, 10), M('#2a2b2d'));
      tyre.rotation.x = Math.PI / 2;
      tyre.position.set(0.62 + i * 0.27, y + 0.04, 1.5);
      k.add(tyre);
    }
    // Instructor's covered viewing stand
    for (const [x, z] of [[-0.45, 1.25], [0.45, 1.25], [-0.45, 1.75], [0.45, 1.75]]) k.box(0.05, 0.9, 0.05, C.metal, x, y, z);
    k.box(1.05, 0.06, 0.6, C.roofGreen, 0, y + 0.9, 1.5);
    const runner = player(k, 0, -0.3, y, '#5d6b35', 0);
    k.anims.push((t) => {
      const c = (t * 0.2) % 1;
      runner.position.set(-0.3 + c * 1.6, y + Math.abs(Math.sin(c * Math.PI * 4)) * 0.4, -0.35);
    });
    return;
  }
  if (level === 17) {
    // Sky track: four-storey block with a red rooftop running track and a runner
    const h = 3 * STOREY;
    k.box(3.2, h, 2.8, CONCRETE, 0, y, -0.4);
    for (let f = 0; f < 3; f++) k.box(2.9, 0.34, 0.04, DARK_GLASS, 0, y + f * STOREY + 0.32, 1.01);
    k.box(3.3, 0.1, 2.9, C.white, 0, y + h, -0.4);
    const track = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.16, 3, 28), M('#c9643a'));
    track.rotation.x = Math.PI / 2;
    track.scale.set(1.35, 1, 1);
    track.position.set(0, y + h + 0.12, -0.4);
    k.add(track);
    const infield = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.05, 24), M('#6cbf45'));
    infield.scale.set(1.35, 1, 1);
    infield.position.set(0, y + h + 0.12, -0.4);
    k.add(infield);
    for (const s of [-1, 1]) k.box(3.2, 0.25, 0.04, '#ffffff', 0, y + h + 0.1, -0.4 + s * 1.38);
    const runner = player(k, 0, -0.4, y + h + 0.15, '#ff8a3d', 0);
    k.anims.push((t) => {
      const a = t * 0.9;
      runner.position.set(Math.cos(a) * 1.42, y + h + 0.15 + Math.abs(Math.sin(t * 9)) * 0.03, -0.4 + Math.sin(a) * 1.05);
      runner.rotation.y = -a;
    });
    k.door('front', 0, -0.4, 3.2, 2.8, 0, y, 0.6, 0.7, DARK_GLASS);
    return;
  }
  if (level === 18) {
    // Bowling lanes: tall hall with a glass front showing lanes, pins and a rolling ball
    const h = 2.85;
    k.box(3.4, h, 2.6, '#f2f0ea', 0, y, -0.5);
    k.box(3.44, 0.35, 2.64, '#8a5cb8', 0, y + h - 0.35, -0.5);
    k.glassBox(3.0, 1.3, 0.3, 0, y, 0.75);
    for (let l = 0; l < 3; l++) {
      const lx = -1.0 + l * 1.0;
      k.box(0.36, 0.02, 2.2, '#d9b98a', lx, y + 0.01, -0.5);
      for (let p = 0; p < 6; p++) k.cyl(0.02, 0.09, '#ffffff', lx - 0.08 + (p % 3) * 0.08, y + 0.02, -1.45 + Math.floor(p / 3) * 0.08, 6);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), M(SEAT[l]));
      k.add(ball);
      k.anims.push((t) => {
        const c = ((t + l * 1.3) % 4) / 4;
        ball.position.set(lx, y + 0.07, 0.5 - c * 1.9);
        ball.rotation.x = -t * 10;
      });
    }
    k.plaque('BOWL', 1.2, 1.55, y, 0.8);
    // Giant rooftop bowling pin that wobbles, plus a ball beside it
    const pin = new THREE.Group();
    pin.position.set(-0.6, y + h + 0.1, -0.6);
    const prof = [[0, 0], [0.16, 0.05], [0.22, 0.3], [0.12, 0.62], [0.09, 0.75], [0.13, 0.9], [0.1, 1.02], [0, 1.06]].map(([r, hh]) => new THREE.Vector2(r, hh));
    const pinM = new THREE.Mesh(new THREE.LatheGeometry(prof, 12), M('#ffffff'));
    pinM.castShadow = true;
    pin.add(pinM);
    for (const hh of [0.66, 0.74]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.035, 12), M('#e94f37'));
      band.position.y = hh;
      pin.add(band);
    }
    k.add(pin);
    k.anims.push((t) => {
      pin.rotation.z = Math.sin(t * 2.6) * 0.08;
      pin.rotation.x = Math.cos(t * 2.1) * 0.05;
    });
    const bigBall = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), M('#8a5cb8'));
    bigBall.position.set(0.3, y + h + 0.32, -0.5);
    k.add(bigBall);
    k.anims.push((t) => (bigBall.rotation.y = t * 1.2));
    k.solarPanels(0.9, y + h + 0.06, -1.0, 1.0, 0.8);
    return;
  }
  if (level === 19) {
    // Wave pool hall: tall glass hall over a wave pool with rolling waves and a slide
    k.box(3.4, 0.35, 2.8, CONCRETE, 0, y, -0.4);
    const wg = new THREE.PlaneGeometry(3.0, 2.4, 16, 12).rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(wg, M('#4fc7d4', { roughness: 0.2 }));
    water.position.set(0, y + 0.37, -0.4);
    k.add(water);
    const pos = wg.getAttribute('position') as THREE.BufferAttribute;
    const z0 = Array.from({ length: pos.count }, (_, i) => pos.getZ(i));
    k.anims.push((t) => {
      for (let i = 0; i < pos.count; i++) pos.setY(i, Math.sin(z0[i] * 4 - t * 3) * 0.04);
      pos.needsUpdate = true;
      wg.computeVertexNormals();
    });
    const hall = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 3.4, 16, 1, true, 0, Math.PI), M('#86b7cc', { transparent: true, opacity: 0.45, side: THREE.DoubleSide }));
    hall.rotation.z = Math.PI / 2;
    hall.position.set(0, y + 1.6, -0.4);
    k.add(hall);
    for (let i = 0; i < 5; i++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.03, 4, 16, Math.PI), M(C.white));
      rib.rotation.y = Math.PI / 2;
      rib.position.set(-1.6 + i * 0.8, y + 1.6, -0.4);
      k.add(rib);
    }
    const slide = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 5, 14, Math.PI * 1.5), M('#ffc93c'));
    slide.position.set(1.2, y + 1.2, -1.2);
    slide.rotation.x = 0.4;
    k.add(slide);
    k.box(0.3, 1.8, 0.3, CONCRETE, 1.5, y, -1.5);
    player(k, -0.6, -0.2, y + 0.35, '#e94f37', 2);
    player(k, 0.3, -0.8, y + 0.35, '#2f6fa8', 2);
    return;
  }
  // 20: arena citadel: oval arena with a gold-ringed roof, glass concourse, floodlights
  const ar = 1.6;
  k.cyl(ar, 2.0, '#f2f0ea', 0, y, -0.3, 20);
  k.glassBox(1.6, 1.0, 0.3, 0, y, 1.2);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    k.box(0.05, 2.0, 0.08, C.trim, Math.cos(a) * ar, y, -0.3 + Math.sin(a) * ar).rotation.y = -a;
  }
  k.cyl(ar + 0.12, 0.14, '#d9b24a', 0, y + 2.0, -0.3, 20);
  const roof = new THREE.Mesh(new THREE.SphereGeometry(ar + 0.1, 20, 6, 0, Math.PI * 2, 0, Math.PI / 5), M('#e9ecee'));
  roof.position.set(0, y + 1.25, -0.3);
  k.add(roof);
  k.cyl(0.6, 0.12, '#86b7cc', 0, y + 2.45, -0.3, 16);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.04, 6, 24), M('#d9b24a'));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, y + 2.6, -0.3);
  k.add(ring);
  k.anims.push((t) => (ring.position.y = y + 2.6 + Math.sin(t * 1.5) * 0.04));
  screen(k, 1.0, 0.45, 0, y + 1.3, 1.36, 0);
  for (const [x, z] of [[-1.6, 1.3], [1.6, 1.3]]) floodlight(k, x, z, y, 2.4);
}

export function buildRecCentre(level: number): Kit {
  const k = new Kit();
  const y = k.pad(4, 4);
  if (level <= 3) field(k, level, y);
  else if (level <= 6) camp(k, level, y);
  else if (level <= 10) base(k, level, y);
  else if (level <= 15) command(k, level, y);
  else secure(k, level, y);
  return k;
}

export const REC_CENTRE: BuildingDef = {
  id: 'reccentre',
  name: 'Rec Centre',
  role: 'Recruits relax and play here. Lifts Morale across the outpost.',
  footprint: [4, 4],
  unlockHq: 3,
  levels: REC_LEVELS,
  designedLevels: 20,
  build: buildRecCentre,
};
