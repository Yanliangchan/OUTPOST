import * as THREE from 'three';
import { C, Kit, STOREY } from './kit';
import { CONCRETE, DARK_GLASS } from './common';
import { DAY, HOUR, MIN, type BuildingDef, type LevelStats } from './types';

/*
 * Mama Shop: the neighbourhood provision shop. Lifts Morale and brings in a
 * trickle of Supplies. Signature at every level: a striped awning, shelves of
 * colourful snacks, a drinks fridge. Footprint 2×2; height cap ~2.6.
 */

const TITLES = [
  'Tricycle Cart', 'Drinks Kiosk', 'Kedai Kayu', 'Mama Shop', 'Corner Shop', 'Shophouse', 'Mini-Mart',
  'Billboard Shop', 'Twin Shophouses', 'Convenience Store', 'Vending Pavilion', 'Bubble Tea Kiosk', 'Container Pop-up',
  'Glass Cube Store', 'Heritage Shophouse', 'Armoured Kiosk', 'Locker Shop', 'Garden Kiosk', 'Drone Drop Kiosk', 'Galleria',
];
const SUPPLIES = [150, 450, 1_000, 2_500, 5_500, 11_000, 20_000, 36_000, 60_000, 95_000, 150_000, 225_000, 320_000, 440_000, 590_000, 770_000, 990_000, 1_240_000, 1_520_000, 1_850_000];
const REPUTATION = [0, 0, 25, 90, 220, 400, 700, 1_100, 1_600, 2_300, 3_100, 4_100, 5_300, 6_700, 8_300, 10_000, 12_000, 14_300, 16_900, 19_800];
const TIME = [1 * MIN, 5 * MIN, 15 * MIN, 45 * MIN, 1.5 * HOUR, 3 * HOUR, 5 * HOUR, 8 * HOUR, 14 * HOUR, 20 * HOUR, 1.25 * DAY, 1.75 * DAY, 2.25 * DAY, 2.75 * DAY, 3.25 * DAY, 3.75 * DAY, 4.25 * DAY, 4.75 * DAY, 5.25 * DAY, 5.75 * DAY];

export const MAMA_LEVELS: LevelStats[] = TITLES.map((title, i) => {
  const level = i + 1;
  const morale = 1 + Math.floor(i / 2);
  const income = Math.round((15 * Math.pow(1.3, i)) / 5) * 5;
  return {
    level, title,
    supplies: SUPPLIES[i],
    reputation: REPUTATION[i],
    buildTime: TIME[i],
    hp: Math.round((200 * Math.pow(1.2, i)) / 10) * 10,
    stats: { morale, suppliesPerHour: income },
    unlocks: [`+${morale} Morale nearby`, `${income} Supplies/h from sales`],
  };
});

// ------------------------------------------------------------------ signature props

const STRIPES: [string, string][] = [['#e94f37', '#ffffff'], ['#2bb3a3', '#ffffff'], ['#ffc93c', '#e94f37'], ['#2f6fa8', '#ffffff']];
const GOODS = ['#e94f37', '#ffc93c', '#2bb3a3', '#ff8a3d', '#8a5cb8', '#3fd16b', '#ffffff', '#2f6fa8'];
const PASTEL = ['#f6c6c0', '#bfe3d6', '#f6e1a6', '#c9d8f0', '#e7c9ef'];
const M = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.7, ...o });

/** Striped sloping awning with a scalloped fringe that flaps in the breeze. */
function awning(k: Kit, w: number, x: number, z: number, y: number, depth = 0.4, stripe = 0) {
  const [a, b] = STRIPES[stripe % STRIPES.length];
  const n = Math.max(4, Math.round(w / 0.14));
  const g = new THREE.Group();
  g.position.set(x, y, z);
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(w / n, 0.025, depth), M(i % 2 ? b : a));
    s.position.set(-w / 2 + (w / n) * (i + 0.5), 0, depth / 2);
    g.add(s);
  }
  g.rotation.x = 0.35;
  k.add(g);
  // Fringe: little flaps along the front edge
  const fy = y - Math.sin(0.35) * depth - 0.02;
  const fz = z + Math.cos(0.35) * depth;
  for (let i = 0; i < n; i++) {
    const f = k.box(w / n - 0.01, 0.08, 0.012, i % 2 ? b : a, x - w / 2 + (w / n) * (i + 0.5), fy - 0.08, fz);
    k.swing(f, 0, 0.25, i);
  }
}

/** Shelf unit stacked with colourful snack packets. */
function shelf(k: Kit, w: number, x: number, z: number, y: number, rows = 3, rotY = 0, seed = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  k.box(w, rows * 0.2 + 0.04, 0.2, '#b07a4a', 0, 0, 0, g);
  for (let r = 0; r < rows; r++) {
    const n = Math.max(2, Math.round(w / 0.09));
    for (let i = 0; i < n; i++) {
      const c = GOODS[(i * 3 + r * 5 + seed) % GOODS.length];
      const h = 0.08 + ((i + r) % 3) * 0.025;
      k.box(w / n - 0.012, h, 0.07, c, -w / 2 + (w / n) * (i + 0.5), 0.04 + r * 0.2, 0.08, g);
    }
  }
  k.add(g);
}

/** Glass-door drinks fridge with bottles and a flickering light. */
function fridge(k: Kit, x: number, z: number, y: number, rotY = 0, w = 0.32) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  k.box(w, 0.62, 0.26, '#e94f37', 0, 0, 0, g);
  k.box(w - 0.04, 0.48, 0.01, '#bfe6f2', 0, 0.06, 0.13, g);
  for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) {
    k.box(0.04, 0.1, 0.04, GOODS[(r + i * 2) % GOODS.length], -w / 2 + 0.06 + i * ((w - 0.08) / 4), 0.09 + r * 0.15, 0.09, g);
  }
  const light = new THREE.Mesh(new THREE.BoxGeometry(w - 0.06, 0.03, 0.01), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#e8fbff', emissiveIntensity: 1 }));
  light.position.set(0, 0.58, 0.135);
  g.add(light);
  k.box(w, 0.1, 0.27, '#ffffff', 0, 0.62, 0, g); // brand header
  k.add(g);
  k.anims.push((t) => {
    // Occasional flicker, like an old fridge tube
    const f = Math.sin(t * 23) > 0.96 || Math.sin(t * 0.7) > 0.995 ? 0.2 : 1.2;
    (light.material as THREE.MeshStandardMaterial).emissiveIntensity = f;
  });
}

/** Snack packets hanging on strings from an awning or shop front; they sway. */
function hangingSnacks(k: Kit, x0: number, x1: number, y: number, z: number, n = 5) {
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) / (n - 1)) * i;
    k.box(0.006, 0.1, 0.006, '#dddddd', x, y - 0.1, z);
    const p = k.box(0.07, 0.11, 0.02, GOODS[(i * 3) % GOODS.length], x, y - 0.22, z);
    k.swing(p, 0, 0.5, i + 2);
  }
}

function stool(k: Kit, x: number, z: number, y: number, color = '#e94f37') {
  k.cyl(0.07, 0.03, color, x, y + 0.15, z, 8);
  for (const [dx, dz] of [[-0.04, -0.04], [0.04, -0.04], [-0.04, 0.04], [0.04, 0.04]]) k.box(0.015, 0.15, 0.015, color, x + dx, y, z + dz);
}

/** Painted fascia signboard with lettering. */
function fascia(k: Kit, text: string, w: number, x: number, y: number, z: number, bg = '#2f5a3a', fg = '#ffffff', h = 0.16) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = Math.round((256 * h) / w);
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = fg;
  g.font = `900 ${Math.round(c.height * 0.62)}px Nunito, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.03), [M(bg), M(bg), M(bg), M(bg), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), M(bg)]);
  m.position.set(x, y + h / 2, z);
  k.add(m);
  return m;
}

/** Rolled-up roller shutter above an open shop front. */
function rolledShutter(k: Kit, w: number, x: number, y: number, z: number) {
  const r = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, w, 8).rotateZ(Math.PI / 2), M('#a7adb1'));
  r.position.set(x, y, z);
  k.add(r);
}

/** Open shop box: three walls and a roof slab, interior shelves visible from the front. */
function shopBox(k: Kit, w: number, d: number, h: number, x: number, z: number, y: number, wall: string = C.wall) {
  k.box(w, h, 0.08, wall, x, y, z - d / 2 + 0.04);
  for (const s of [-1, 1]) k.box(0.08, h, d, wall, x + s * (w / 2 - 0.04), y, z);
  k.box(w + 0.06, 0.08, d + 0.06, C.white, x, y + h, z);
  k.box(w - 0.16, 0.02, d - 0.1, '#d9cfb9', x, y + 0.005, z); // tiled floor
  shelf(k, w - 0.25, x, z - d / 2 + 0.2, y, 3, 0, Math.round(x * 10));
}

function pastelFront(k: Kit, w: number, h: number, x: number, z: number, y: number, color: string) {
  k.box(w, 0.08, 0.06, C.white, x, y + h - 0.08, z);
  // Shuttered upper windows with decorative surrounds
  const n = Math.max(2, Math.round(w / 0.45));
  for (let i = 0; i < n; i++) {
    const wx = x - w / 2 + (w / n) * (i + 0.5);
    k.box(0.24, 0.34, 0.03, C.white, wx, y + h - 0.6, z + 0.02);
    k.box(0.09, 0.3, 0.035, '#3f8a6a', wx - 0.055, y + h - 0.58, z + 0.03);
    k.box(0.09, 0.3, 0.035, '#3f8a6a', wx + 0.055, y + h - 0.58, z + 0.03);
  }
  void color;
}

// ------------------------------------------------------------------ levels

function field(k: Kit, level: number, y: number) {
  if (level === 1) {
    // Tricycle cart with a striped canopy and a cooler box
    k.box(0.7, 0.3, 0.4, '#2bb3a3', 0, y + 0.18, -0.1);
    for (const sx of [-0.3, 0.3]) {
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 5, 12), M('#2a2b2d'));
      w.position.set(sx, y + 0.12, 0.13);
      k.add(w);
    }
    const fw = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 5, 12), M('#2a2b2d'));
    fw.position.set(-0.55, y + 0.12, -0.1);
    fw.rotation.y = Math.PI / 2;
    k.add(fw);
    k.box(0.3, 0.03, 0.03, '#33383d', -0.45, y + 0.45, -0.1);
    for (const sx of [-0.32, 0.32]) k.box(0.025, 0.5, 0.025, '#d0d0d0', sx, y + 0.48, -0.1);
    awning(k, 0.8, 0, -0.32, y + 0.98, 0.42, 0);
    shelf(k, 0.5, 0.05, -0.1, y + 0.48, 1, 0, 1);
    k.box(0.32, 0.22, 0.24, '#2f6fa8', 0.5, y, 0.5); // cooler box
    k.box(0.34, 0.04, 0.26, '#ffffff', 0.5, y + 0.22, 0.5);
    stool(k, -0.4, 0.55, y);
    stool(k, -0.1, 0.65, y, '#2f6fa8');
    return;
  }
  if (level === 2) {
    // Tiny zinc-roofed kiosk with a flip-up flap, fridge and crates of drinks
    k.box(1.0, 0.8, 0.7, '#5d6b35', 0, y, -0.4);
    k.box(0.8, 0.4, 0.02, '#33383d', 0, y + 0.3, -0.04);
    k.box(0.9, 0.04, 0.2, C.wood, 0, y + 0.3, 0.02);
    const flap = k.box(0.86, 0.03, 0.4, '#5d6b35', 0, y + 0.78, 0.12);
    flap.rotation.x = -0.25;
    k.box(1.1, 0.04, 0.85, C.zinc, 0, y + 0.82, -0.4);
    shelf(k, 0.7, 0, -0.65, y + 0.3, 2, 0, 2);
    fridge(k, 0.68, 0.15, y, -0.4, 0.28);
    for (let i = 0; i < 2; i++) k.box(0.26, 0.14, 0.18, '#ffc93c', -0.55, y + i * 0.14, 0.45);
    stool(k, -0.1, 0.6, y);
    hangingSnacks(k, -0.35, 0.35, y + 0.78, 0.1, 5);
    return;
  }
  // 3: timber kedai with folding doors open, goods hanging, bench outside
  const w = 1.3, d = 0.95;
  shopBox(k, w, d, 0.85, 0, -0.35, y, C.wood);
  for (let i = 1; i < 5; i++) k.box(w + 0.01, 0.01, d + 0.01, '#8a5a3b', 0, y + i * 0.15, -0.35);
  k.gableRoof(w, d, 0.22, 0, y + 0.93, -0.35, C.zinc, 0.15, C.wood);
  for (const s of [-1, 1]) {
    const door = k.box(0.3, 0.85, 0.03, '#8a6040', s * 0.75, y, 0.15);
    door.rotation.y = s * 1.2;
  }
  hangingSnacks(k, -0.5, 0.5, y + 0.92, 0.12, 6);
  fridge(k, 0.45, -0.2, y, 0, 0.3);
  k.bench(-0.3, 0.6, 0.6, y);
  fascia(k, 'KEDAI', 0.7, 0, y + 0.85, 0.14, '#7a5a3b', '#ffd23f');
}

function camp(k: Kit, level: number, y: number) {
  if (level === 4) {
    // Classic mama shop: cream box, rolled shutter, striped awning, fridge outside
    shopBox(k, 1.5, 1.0, 1.15, 0, -0.35, y);
    k.box(1.56, 0.08, 1.06, C.trim, 0, y, -0.35);
    k.gableRoof(1.5, 1.0, 0.3, 0, y + 1.23, -0.35, C.zinc, 0.12);
    fascia(k, 'MAMA SHOP', 1.3, 0, y + 1.0, 0.16, '#2f5a3a');
    rolledShutter(k, 1.3, 0, y + 0.93, 0.13);
    awning(k, 1.5, 0, 0.15, y + 0.9, 0.4, 0);
    fridge(k, 0.55, 0.45, y, -0.2);
    hangingSnacks(k, -0.6, -0.1, y + 0.82, 0.32, 4);
    stool(k, -0.5, 0.65, y);
    stool(k, -0.2, 0.7, y, '#2f6fa8');
    return;
  }
  if (level === 5) {
    // Corner shop: wrap-around awning, newspaper stand, ice-cream freezer chest
    shopBox(k, 1.4, 1.2, 1.25, -0.15, -0.3, y);
    k.hipRoof(1.4, 1.2, 0.35, -0.15, y + 1.33, -0.3);
    fascia(k, 'MAMA SHOP', 1.2, -0.15, y + 1.1, 0.31, '#2f5a3a');
    awning(k, 1.4, -0.15, 0.3, y + 1.0, 0.42, 1);
    const side = new THREE.Group();
    k.add(side);
    awning(k, 1.2, 0.56, -0.3, y + 1.0, 0.36, 1);
    k.box(0.5, 0.3, 0.3, '#ffffff', 0.55, y, 0.6); // ice-cream freezer
    k.box(0.46, 0.02, 0.26, '#bfe6f2', 0.55, y + 0.3, 0.6);
    k.box(0.5, 0.1, 0.02, '#ff8a3d', 0.55, y + 0.18, 0.76);
    k.box(0.3, 0.5, 0.15, '#8a9196', -0.65, y, 0.6); // newspaper rack
    for (let i = 0; i < 3; i++) k.box(0.26, 0.1, 0.02, ['#ffffff', '#f6e1a6', '#ffffff'][i], -0.65, y + 0.12 + i * 0.12, 0.69);
    fridge(k, 0.2, 0.55, y, 0);
    hangingSnacks(k, -0.6, 0.2, y + 0.92, 0.42, 5);
    return;
  }
  // 6: two-storey shophouse with a five-foot way arcade
  const w = 1.6, d = 1.3, z = -0.25;
  k.box(w, 2 * STOREY, d, PASTEL[0], 0, y, z);
  k.box(w + 0.03, 0.1, d + 0.03, C.trim, 0, y, z);
  // Five-foot way: recessed ground floor behind columns
  for (const x of [-0.75, 0, 0.75]) k.box(0.1, STOREY, 0.1, C.white, x, y, z + d / 2 - 0.05);
  k.box(w - 0.2, STOREY - 0.15, 0.02, '#4a3a2e', 0, y, z + d / 2 - 0.35);
  shelf(k, 0.6, -0.35, z + d / 2 - 0.45, y, 3, 0, 3);
  fridge(k, 0.4, z + d / 2 - 0.5, y, 0, 0.3);
  k.box(w + 0.04, 0.1, 0.1, C.white, 0, y + STOREY, z + d / 2 - 0.05);
  pastelFront(k, w, 2 * STOREY, 0, z + d / 2, y, PASTEL[0]);
  k.hipRoof(w, d, 0.25, 0, y + 2 * STOREY, z, C.roof);
  fascia(k, 'MAMA SHOP', 1.3, 0, y + STOREY - 0.2, z + d / 2 + 0.03, '#2f5a3a');
  hangingSnacks(k, -0.6, 0.6, y + STOREY - 0.2, z + d / 2 - 0.1, 6);
}

function base(k: Kit, level: number, y: number) {
  if (level === 7) {
    // Mini-mart: wide store with tall parapet, big shop window, blinking OPEN sign
    const w = 1.7, d = 1.4, z = -0.25;
    k.box(w, 2.0, d, C.wallAlt, 0, y, z);
    k.box(w + 0.04, 0.08, d + 0.04, C.white, 0, y + 2.0, z);
    k.box(w + 0.03, 0.1, d + 0.03, C.trim, 0, y, z);
    k.box(w - 0.3, 0.75, 0.02, '#bfe6f2', -0.1, y + 0.15, z + d / 2 + 0.005);
    for (let i = 0; i < 4; i++) k.box(0.3, 0.2, 0.01, GOODS[i * 2], -0.65 + i * 0.36, y + 0.25, z + d / 2 + 0.012);
    k.door('front', 0, z, w, d, 0.62, y, 0.3, 0.6, '#bfe6f2');
    fascia(k, 'MINI MART', 1.5, 0, y + 1.7, z + d / 2 + 0.02, '#e94f37', '#ffffff', 0.3);
    k.blinker(-0.6, y + 1.05, z + d / 2 + 0.04, '#ff3b30', 0.04, 1.2);
    awning(k, 1.7, 0, z + d / 2, y + 1.15, 0.35, 2);
    fridge(k, 0.7, 0.75, y, -0.3);
    stool(k, -0.6, 0.75, y);
    return;
  }
  if (level === 8) {
    // Two-storey shop with a rooftop rotating tri-vision billboard
    const w = 1.6, d = 1.3, z = -0.3;
    const h = k.block(w, d, 2, 0, y, z, PASTEL[1]);
    k.flatRoof(w, d, 0, y + h, z);
    k.windowRow('front', 0, z, w, d, 3, y + STOREY + 0.4);
    k.box(w - 0.3, 0.6, 0.02, '#bfe6f2', 0, y + 0.15, z + d / 2 + 0.005);
    awning(k, w, 0, z + d / 2, y + 0.9, 0.38, 3);
    fascia(k, 'MAMA SHOP', 1.3, 0, y + 0.95, z + d / 2 + 0.02);
    for (const x of [-0.4, 0.4]) k.box(0.05, 0.45, 0.05, C.metal, x, y + h + 0.06, z);
    const bill = new THREE.Group();
    bill.position.set(0, y + h + 0.75, z);
    for (let i = 0; i < 6; i++) {
      const slat = new THREE.Group();
      slat.position.x = -0.55 + i * 0.22;
      for (let f = 0; f < 3; f++) {
        const face = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.01), M(['#ffc93c', '#e94f37', '#2bb3a3'][f]));
        face.position.z = 0.06;
        const holder = new THREE.Group();
        holder.rotation.y = (f / 3) * Math.PI * 2;
        holder.add(face);
        slat.add(holder);
      }
      bill.add(slat);
    }
    k.add(bill);
    k.anims.push((t) => {
      const step = Math.floor(t / 3) % 3;
      const frac = Math.min(1, (t % 3) / 0.6);
      bill.children.forEach((sl, i) => (sl.rotation.y = -((step + Math.min(1, Math.max(0, frac * 1.6 - i * 0.12))) * Math.PI * 2) / 3));
    });
    fridge(k, 0.6, 0.65, y, 0);
    return;
  }
  if (level === 9) {
    // Twin shophouses: two narrow pastel fronts, two storeys plus attic, shared five-foot way
    for (const [x, c, s] of [[-0.42, PASTEL[2], 0], [0.42, PASTEL[3], 1]] as [number, string, number][]) {
      k.box(0.8, 2 * STOREY + 0.2, 1.3, c, x, y, -0.3);
      k.box(0.83, 0.1, 1.33, C.trim, x, y, -0.3);
      pastelFront(k, 0.8, 2 * STOREY + 0.2, x, 0.35, y, c);
      const g = new Kit();
      g.gableRoof(1.3, 0.8, 0.4, 0, 0, 0, C.roof, 0.08, C.white);
      g.group.rotation.y = Math.PI / 2;
      g.group.position.set(x, y + 2 * STOREY + 0.2, -0.3);
      k.add(g.group);
      awning(k, 0.75, x, 0.35, y + 0.85, 0.32, s);
      shelf(k, 0.55, x, -0.1, y, 3, 0, s * 3);
    }
    fascia(k, 'MAMA & SONS', 1.4, 0, y + 0.93, 0.37, '#2f5a3a', '#ffd23f');
    fridge(k, 0.5, 0.7, y, 0);
    stool(k, -0.5, 0.75, y);
    return;
  }
  // 10: convenience store: bright fascia, glass front, vending machines, ATM
  const w = 1.7, d = 1.3, z = -0.3;
  const h = k.block(w, d, 3, 0, y, z, '#f2f0ea');
  k.box(w + 0.04, 0.35, d + 0.04, '#2bb3a3', 0, y + h - 0.35, z);
  k.windowRow('front', 0, z, w, d, 3, y + 2 * STOREY + 0.2);
  fascia(k, '24/7 MART', 1.4, 0, y + h - 0.32, z + d / 2 + 0.03, '#2bb3a3', '#ffffff', 0.28);
  k.box(w - 0.2, 0.75, 0.02, '#bfe6f2', 0, y + 0.1, z + d / 2 + 0.005);
  k.windowRow('front', 0, z, w, d, 3, y + STOREY + 0.3);
  for (const [x, c] of [[-0.65, '#e94f37'], [-0.3, '#2f6fa8']] as [number, string][]) {
    k.box(0.3, 0.72, 0.25, c, x, y, 0.62);
    k.box(0.2, 0.45, 0.01, '#bfe6f2', x - 0.02, y + 0.2, 0.75);
    k.blinker(x + 0.1, y + 0.6, 0.76, '#7cff8a', 0.02, 1.1 + x);
  }
  k.box(0.24, 0.55, 0.2, '#5c6166', 0.35, y, 0.65); // ATM
  k.box(0.14, 0.1, 0.01, '#3fd16b', 0.35, y + 0.38, 0.755);
  awning(k, w, 0, z + d / 2, y + 0.95, 0.3, 1);
  fridge(k, 0.72, 0.55, y, -0.4, 0.28);
}

function command(k: Kit, level: number, y: number) {
  if (level === 11) {
    // Vending pavilion: glass box lined with colourful vending machines under a white canopy
    k.glassBox(1.6, 2.4, 1.2, 0, y, -0.35);
    for (let i = 0; i < 4; i++) {
      const c = ['#e94f37', '#2f6fa8', '#ffc93c', '#3fd16b'][i];
      k.box(0.32, 1.0, 0.3, c, -0.55 + i * 0.37, y, -0.75);
      k.box(0.22, 0.6, 0.01, '#bfe6f2', -0.55 + i * 0.37, y + 0.3, -0.595);
      k.blinker(-0.48 + i * 0.37, y + 0.15, -0.59, '#ffffff', 0.02, 0.9 + i * 0.2);
    }
    k.box(1.9, 0.08, 1.6, C.white, 0, y + 2.4, -0.25);
    for (const x of [-0.85, 0.85]) k.box(0.05, 2.4, 0.05, C.metal, x, y, 0.5);
    fascia(k, 'VENDING', 1.2, 0, y + 1.9, 0.26, '#e94f37');
    awning(k, 1.6, 0, 0.3, y + 1.0, 0.25, 0);
    fridge(k, 0.6, 0.65, y, 0);
    stool(k, -0.5, 0.7, y);
    return;
  }
  if (level === 12) {
    // Bubble-tea kiosk: round kiosk with a giant spinning cup on the roof
    k.box(1.7, 1.6, 0.5, '#f2f0ea', 0, y, -0.75); // back storeroom
    k.box(1.74, 0.06, 0.54, C.white, 0, y + 1.6, -0.75);
    k.cyl(0.65, 1.3, '#f6c6c0', 0, y, -0.2, 14);
    k.cyl(0.67, 0.08, C.white, 0, y + 1.3, -0.2, 14);
    k.box(0.9, 0.5, 0.02, '#bfe6f2', 0, y + 0.45, 0.45);
    k.box(1.0, 0.04, 0.25, '#e9e4d6', 0, y + 0.42, 0.52);
    awning(k, 1.1, 0, 0.45, y + 1.05, 0.3, 2);
    const cup = new THREE.Group();
    cup.position.set(0, y + 1.38, -0.2);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.7, 12), M('#f2d3a8', { transparent: true, opacity: 0.85 }));
    body.position.y = 0.35;
    cup.add(body);
    for (let i = 0; i < 8; i++) {
      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 4), M('#3a2a20'));
      pearl.position.set(Math.cos(i) * 0.12, 0.08, Math.sin(i) * 0.12);
      cup.add(pearl);
    }
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.29, 12, 4, 0, Math.PI * 2, 0, Math.PI / 2), M('#ffffff'));
    lid.position.y = 0.7;
    cup.add(lid);
    const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), M('#e94f37'));
    straw.position.set(0.06, 0.95, 0);
    straw.rotation.z = -0.2;
    cup.add(straw);
    k.add(cup);
    k.anims.push((t) => (cup.rotation.y = t * 0.8));
    stool(k, -0.6, 0.65, y, '#2bb3a3');
    stool(k, 0.6, 0.65, y, '#ffc93c');
    return;
  }
  if (level === 13) {
    // Container pop-up: two stacked shipping containers converted into a shop
    for (const [cy, c, w, cx] of [[0, '#2bb3a3', 1.7, 0], [0.72, '#ffc93c', 1.3, -0.2], [1.44, '#e94f37', 1.0, 0.15]] as [number, string, number, number][]) {
      k.box(w, 0.7, 0.8, c, cx, y + cy, -0.45);
      const n = Math.round(w / 0.1);
      for (let i = 1; i < n; i++) k.box(0.015, 0.66, 0.82, '#' + new THREE.Color(c).multiplyScalar(0.8).getHexString(), cx - w / 2 + (w / n) * i, y + cy + 0.02, -0.45);
    }
    k.box(1.2, 0.05, 0.9, C.white, 0.15, y + 2.45, -0.45);
    for (const [px, pz] of [[-0.4, -0.85], [0.7, -0.85], [-0.4, -0.05], [0.7, -0.05]]) k.box(0.04, 0.3, 0.04, C.metal, px, y + 2.15, pz);
    // Fold-down counter flap and shelves inside the open side
    k.box(1.2, 0.5, 0.02, '#2a2f33', 0, y + 0.1, -0.04);
    shelf(k, 1.0, 0, -0.15, y + 0.05, 2, 0, 4);
    k.box(1.3, 0.03, 0.3, '#2bb3a3', 0, y + 0.34, 0.1);
    k.stairs(0.65, -0.45, 0.25, 0.7, 0.7, true);
    k.box(0.04, 0.3, 0.8, C.metal, 0.55, y + 1.42, -0.45);
    awning(k, 1.3, -0.2, -0.05, y + 1.38, 0.3, 3);
    fridge(k, 0.65, 0.55, y, -0.3);
    stool(k, -0.5, 0.6, y);
    return;
  }
  if (level === 14) {
    // Glass cube store: crisp glass box with visible shelves and a green roof
    k.glassBox(1.6, 1.8, 1.3, 0, y, -0.3);
    for (const z of [-0.75, -0.3]) shelf(k, 1.2, 0, z, y, 4, 0, Math.round(z * 10));
    k.box(1.7, 0.1, 1.4, C.white, 0, y + 1.8, -0.3);
    k.box(1.5, 0.12, 1.2, '#6cbf45', 0, y + 1.9, -0.3);
    k.hedge(0, -0.3, 1.3, 0.9, y + 2.02);
    awning(k, 1.6, 0, 0.35, y + 1.2, 0.3, 1);
    fridge(k, 0.65, 0.65, y, 0);
    fascia(k, 'MAMA', 0.8, 0, y + 1.5, 0.37, '#2f5a3a');
    return;
  }
  // 15: heritage shophouse: three storeys, ornate pastel front, gold trim, lanterns
  const w = 1.7, d = 1.4, z = -0.3;
  k.box(w, 3 * STOREY - 0.2, d, PASTEL[4], 0, y, z);
  k.box(w + 0.03, 0.1, d + 0.03, C.trim, 0, y, z);
  for (let f = 1; f < 3; f++) k.box(w + 0.05, 0.06, d + 0.05, '#d9b24a', 0, y + f * STOREY - 0.05, z);
  pastelFront(k, w, 2 * STOREY, 0, z + d / 2, y + STOREY - 0.2, PASTEL[4]);
  for (const x of [-0.8, 0, 0.8]) k.box(0.1, STOREY, 0.1, C.white, x, y, z + d / 2 + 0.25);
  k.box(w + 0.06, 0.08, 0.35, C.white, 0, y + STOREY, z + d / 2 + 0.1);
  k.box(w - 0.2, 0.6, 0.02, '#bfe6f2', 0, y + 0.1, z + d / 2 + 0.005);
  k.gableRoof(w, d, 0.25, 0, y + 3 * STOREY - 0.2, z, C.roof, 0.12, '#d9b24a');
  fascia(k, 'MAMA & SONS', 1.4, 0, y + STOREY - 0.22, z + d / 2 + 0.28, '#2f5a3a', '#d9b24a');
  for (const x of [-0.45, 0.45]) {
    k.box(0.01, 0.12, 0.01, '#33383d', x, y + STOREY - 0.1, z + d / 2 + 0.2);
    const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({ color: '#e94f37', emissive: '#e94f37', emissiveIntensity: 0.4 }));
    lantern.scale.y = 1.3;
    lantern.position.set(x, y + STOREY - 0.2, z + d / 2 + 0.2);
    k.add(lantern);
    k.anims.push((t) => (lantern.rotation.z = Math.sin(t * 1.4 + x * 3) * 0.15));
  }
  fridge(k, 0.6, 0.7, y, 0);
  hangingSnacks(k, -0.6, 0.6, y + STOREY - 0.25, z + d / 2 + 0.1, 6);
}

function bollards(k: Kit, y: number) {
  for (const x of [-0.8, -0.27, 0.27, 0.8]) k.cyl(0.05, 0.2, '#f2c230', x, y, 0.85, 8);
  k.cyl(0.02, 1.2, C.metal, -0.85, y, -0.85, 5);
  const cam = new THREE.Group();
  cam.position.set(-0.85, y + 1.2, -0.85);
  k.box(0.14, 0.06, 0.06, '#f4f4f0', 0.05, 0, 0.05, cam);
  k.add(cam);
  k.anims.push((t) => (cam.rotation.y = Math.sin(t * 0.5) * 0.9 + 0.8));
}

function secure(k: Kit, level: number, y: number) {
  bollards(k, y);
  if (level === 16) {
    // Armoured kiosk: concrete block with a steel service hatch and hazard band
    k.box(1.8, 2.85, 1.5, CONCRETE, 0, y, -0.35);
    for (let i = 1; i < 5; i++) k.box(1.62, 0.03, 1.22, '#c2bdb3', 0, y + i * 0.6, -0.3);
    k.box(0.8, 0.4, 0.04, '#6b7075', -0.2, y + 0.45, 0.3);
    k.box(0.9, 0.04, 0.2, '#5c6166', -0.2, y + 0.43, 0.38);
    for (let i = 0; i < 8; i++) k.box(0.2, 0.12, 0.04, i % 2 ? C.kerbB : C.kerbY, -0.7 + i * 0.2, y + 1.0, 0.31);
    awning(k, 1.0, -0.2, 0.3, y + 0.95, 0.25, 3);
    fridge(k, 0.55, 0.45, y, 0);
    fascia(k, 'RATIONS', 1.0, 0, y + 1.9, 0.32, '#33383d', '#ffc93c');
    k.box(1.0, 0.5, 0.35, CONCRETE, -0.35, y, 0.62); // queue barrier counter
    k.box(1.04, 0.04, 0.39, '#ffc93c', -0.35, y + 0.5, 0.62);
    return;
  }
  if (level === 17) {
    // Locker shop: wall of colourful parcel lockers with blinking status lights
    k.box(1.7, 2.9, 0.6, CONCRETE, 0, y, -0.55);
    k.box(1.6, 1.6, 0.7, '#f2f0ea', 0.0, y, 0.25);
    k.box(1.64, 0.06, 0.74, C.white, 0.0, y + 1.6, 0.25);
    k.box(0.5, 0.3, 0.02, DARK_GLASS, 0.45, y + 0.8, 0.61);
    k.box(0.4, 0.6, 0.02, '#bfe6f2', -0.35, y + 0.1, 0.61);
    for (let r = 0; r < 7; r++) for (let i = 0; i < 6; i++) {
      const c = GOODS[(r + i * 2) % GOODS.length];
      k.box(0.24, 0.3, 0.02, c, -0.65 + i * 0.26, y + 0.12 + r * 0.38, -0.24);
      if ((r + i) % 4 === 0) k.blinker(-0.57 + i * 0.26, y + 0.36 + r * 0.38, -0.23, '#3fd16b', 0.015, 1 + i * 0.13);
    }
    k.box(0.3, 0.4, 0.04, DARK_GLASS, 0.6, y + 1.0, 0.04);
    awning(k, 1.7, 0, -0.22, y + 2.95, 0.3, 0);
    fridge(k, -0.75, 0.75, y, 0, 0.26);
    return;
  }
  if (level === 18) {
    // Garden kiosk: kiosk wrapped in a living wall with hanging planters
    k.box(1.8, 2.65, 1.5, '#4fae3a', 0, y, -0.3);
    for (let i = 0; i < 6; i++) k.box(1.82, 0.04, 1.52, '#3f8a2e', 0, y + 0.35 + i * 0.4, -0.3);
    k.box(1.0, 0.7, 0.02, '#bfe6f2', 0, y + 0.1, 0.46);
    shelf(k, 0.8, 0, 0.62, y, 2, 0, 6);
    k.hedge(0, -0.35, 1.3, 1.0, y + 2.65);
    for (const x of [-0.5, 0, 0.5]) {
      k.box(0.006, 0.25, 0.006, '#dddddd', x, y + 1.6, 0.4);
      const pot = k.box(0.14, 0.12, 0.14, '#b8653a', x, y + 1.45, 0.4);
      k.swing(pot, 0, 0.2, x * 10);
    }
    awning(k, 1.5, 0, 0.26, y + 1.2, 0.3, 1);
    fridge(k, 0.6, 0.65, y, 0);
    return;
  }
  if (level === 19) {
    // Drone-drop kiosk: kiosk with a rooftop pad; a delivery drone bobs above it
    const h = k.block(1.7, 1.5, 3, 0, y, -0.3, '#f2f0ea');
    k.flatRoof(1.7, 1.5, 0, y + h, -0.3);
    k.box(1.2, 0.6, 0.02, '#bfe6f2', 0, y + 0.12, 0.26);
    k.cyl(0.45, 0.03, '#4a4f54', 0, y + h + 0.06, -0.35, 14);
    k.cyl(0.38, 0.01, '#ffc93c', 0, y + h + 0.09, -0.35, 14);
    const drone = new Kit();
    drone.box(0.16, 0.05, 0.16, '#33383d', 0, 0, 0);
    const props: THREE.Mesh[] = [];
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.005, 0.02), M('#c9ced2'));
      p.position.set(dx * 0.13, 0.05, dz * 0.13);
      drone.group.add(p);
      props.push(p);
    }
    drone.box(0.12, 0.1, 0.12, '#ff8a3d', 0, -0.12, 0);
    k.add(drone.group);
    k.anims.push((t) => {
      const c = (t % 10) / 10;
      const alt = c < 0.4 ? 0.3 + c * 2 : c < 0.6 ? 1.1 : 1.1 - (c - 0.6) * 2;
      drone.group.position.set(Math.sin(t * 0.3) * 0.1, y + h + 0.15 + Math.max(0.15, alt), -0.35);
      for (const p of props) p.rotation.y = t * 40;
    });
    awning(k, 1.5, 0, 0.26, y + 0.95, 0.3, 2);
    fridge(k, 0.6, 0.65, y, 0);
    return;
  }
  // 20: galleria: glass barrel-vault arcade with a gold arch and shopfronts inside
  k.box(1.7, 2.15, 1.3, '#f2f0ea', 0, y, -0.35);
  k.windowRow('front', 0, -0.35, 1.7, 1.3, 3, y + 1.4, { louvre: false });
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.4, 14, 1, true, -Math.PI / 2, Math.PI), M('#86b7cc', { transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
  vault.rotation.x = Math.PI / 2;
  vault.rotation.y = Math.PI / 2;
  vault.position.set(0, y + 2.15, -0.35);
  k.add(vault);
  for (let i = 0; i < 4; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.71, 0.025, 4, 14, Math.PI), M('#d9b24a'));
    rib.rotation.y = Math.PI / 2;
    rib.position.set(-0.6 + i * 0.4, y + 2.15, -0.35);
    k.add(rib);
  }
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.06, 6, 16, Math.PI), M('#d9b24a'));
  arch.position.set(0, y + 0.9, 0.31);
  k.add(arch);
  k.box(0.9, 0.9, 0.02, '#bfe6f2', 0, y, 0.31);
  for (const x of [-0.6, 0.6]) {
    k.box(0.4, 0.7, 0.02, '#bfe6f2', x, y + 0.1, 0.31);
    awning(k, 0.4, x, 0.31, y + 0.95, 0.2, x < 0 ? 0 : 1);
  }
  shelf(k, 1.0, 0, -0.2, y, 3, 0, 7);
  fridge(k, 0.65, 0.6, y, 0);
}

export function buildMamaShop(level: number): Kit {
  const k = new Kit();
  const y = k.pad(2, 2);
  if (level <= 3) field(k, level, y);
  else if (level <= 6) camp(k, level, y);
  else if (level <= 10) base(k, level, y);
  else if (level <= 15) command(k, level, y);
  else secure(k, level, y);
  return k;
}

export const MAMA_SHOP: BuildingDef = {
  id: 'mamashop',
  name: 'Mama Shop',
  role: 'The neighbourhood provision shop. Lifts Morale nearby and earns a trickle of Supplies.',
  footprint: [2, 2],
  unlockHq: 2,
  levels: MAMA_LEVELS,
  designedLevels: 20,
  build: buildMamaShop,
};
