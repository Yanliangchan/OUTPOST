import * as THREE from 'three';
import { C, Kit, STOREY } from './kit';
import { CONCRETE, DARK_GLASS, perimeter, roofCanopy } from './common';
import { DAY, HOUR, MIN, type BuildingDef, type LevelStats } from './types';

/*
 * Medical Centre: recovery. Tired or injured Recruits heal here (later it
 * also heals troops after raids). Signature at every level: a green medical
 * cross sign (never the protected red-on-white emblem), an ambulance, medevac
 * vehicle or stretcher, and a white-and-green clinical look.
 * Footprint 4×3; height cap ~3.5 storeys.
 */

const TITLES = [
  'Aid Post', 'Field Clinic', 'Sick Bay Hut', 'Medical Centre', 'Clinic · Ward Wing', 'Clinic · Veranda Ward',
  'Polyclinic', 'Ward Block', 'Medevac Clinic', 'Medical Complex', 'Modern Clinic', 'Rehab Centre', 'Imaging Centre',
  'Raised Medevac Pad', 'Grand Hospital', 'Secure Med Bunker', 'Field Hospital Domes', 'Isolation Wards', 'Bio-Lab',
  'Medical Citadel',
];
const SUPPLIES = [400, 1_100, 2_400, 5_500, 11_000, 20_000, 35_000, 58_000, 95_000, 150_000, 230_000, 345_000, 485_000, 655_000, 870_000, 1_130_000, 1_430_000, 1_770_000, 2_150_000, 2_600_000];
const REPUTATION = [0, 20, 60, 150, 300, 500, 850, 1_250, 1_850, 2_550, 3_450, 4_550, 5_850, 7_350, 9_050, 10_850, 13_050, 15_550, 18_350, 21_350];
const TIME = [3 * MIN, 10 * MIN, 30 * MIN, 1.25 * HOUR, 2.5 * HOUR, 4.5 * HOUR, 7 * HOUR, 11 * HOUR, 17 * HOUR, 1 * DAY, 1.5 * DAY, 2 * DAY, 2.5 * DAY, 3 * DAY, 3.5 * DAY, 4 * DAY, 4.5 * DAY, 5 * DAY, 5.5 * DAY, 6 * DAY];

export const MEDICAL_LEVELS: LevelStats[] = TITLES.map((title, i) => {
  const level = i + 1;
  const beds = 2 + i * 2;
  const healRate = 10 + level * 4;
  return {
    level, title,
    supplies: SUPPLIES[i],
    reputation: REPUTATION[i],
    buildTime: TIME[i],
    hp: Math.round((280 * Math.pow(1.2, i)) / 10) * 10,
    stats: { beds, healRate },
    unlocks: [`${beds} beds`, `Heals ${healRate}%/h`],
  };
});

// ------------------------------------------------------------------ signature props

const MED_GREEN = '#1f9a5a';
const MED_WHITE = '#f7f8f5';
const MINT = '#d9efe2';
const M = (c: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.6, ...o });

/** White cross on a green square plate (the medical sign used everywhere). Faces +z. */
function crossPlate(s: number) {
  const g = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(s, s, 0.04), M(MED_GREEN));
  g.add(plate);
  for (const [w, h] of [[s * 0.62, s * 0.2], [s * 0.2, s * 0.62]]) {
    for (const z of [0.022, -0.022]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.01), M(MED_WHITE, { emissive: '#ffffff', emissiveIntensity: 0.15 }));
      bar.position.z = z;
      g.add(bar);
    }
  }
  return g;
}

/** Cross sign mounted flat on a wall, at (x, y, z) facing +z. */
function wallCross(k: Kit, x: number, y: number, z: number, s = 0.32) {
  const c = crossPlate(s);
  c.position.set(x, y, z);
  k.add(c);
  return c;
}

/** Cross sign on a pole that slowly turns (visible from every side). */
function poleCross(k: Kit, x: number, z: number, y: number, h = 1.2, s = 0.34) {
  k.cyl(0.03, h, C.metal, x, y, z, 6);
  const c = crossPlate(s);
  c.position.set(x, y + h + s / 2, z);
  k.add(c);
  k.anims.push((t) => (c.rotation.y = t * 0.8 + x));
  return c;
}

/** Cubic illuminated cross beacon (four faces) that rotates on a rooftop. */
function crossCube(k: Kit, x: number, y: number, z: number, s = 0.42) {
  const g = new THREE.Group();
  g.position.set(x, y + s / 2, z);
  for (let i = 0; i < 4; i++) {
    const c = crossPlate(s);
    const holder = new THREE.Group();
    holder.rotation.y = (i * Math.PI) / 2;
    c.position.z = s / 2;
    holder.add(c);
    g.add(holder);
  }
  k.add(g);
  k.cyl(0.04, 0.15, C.metal, x, y - 0.15, z, 6);
  k.anims.push((t) => (g.rotation.y = t * 0.6));
}

/** Stretcher on folding legs with a swinging IV drip stand. */
function stretcher(k: Kit, x: number, z: number, y: number, rotY = 0) {
  const g = new Kit();
  g.box(0.6, 0.04, 0.22, '#5d6b35', 0, 0.28, 0);
  for (const sx of [-0.33, 0.33]) g.box(0.08, 0.02, 0.02, '#8a5a3b', sx, 0.29, 0.1).visible = true;
  for (const sx of [-0.25, 0.25]) for (const sz of [-0.09, 0.09]) g.box(0.02, 0.28, 0.02, C.metal, sx, 0, sz);
  g.box(0.15, 0.05, 0.16, MED_WHITE, -0.2, 0.32, 0); // pillow
  g.group.position.set(x, y, z);
  g.group.rotation.y = rotY;
  k.add(g.group);
  // IV drip stand beside it
  const ix = x + Math.cos(rotY) * 0.42, iz = z - Math.sin(rotY) * 0.42;
  k.cyl(0.012, 0.7, C.metal, ix, y, iz, 5);
  k.box(0.18, 0.012, 0.012, C.metal, ix, y + 0.68, iz);
  const bag = k.box(0.06, 0.1, 0.03, '#bfe6f2', ix + 0.06, y + 0.54, iz);
  k.swing(bag, 0, 0.35, x * 3 + z);
}

/** Hospital bed with a sheet; used in visible wards. */
function bed(k: Kit, x: number, z: number, y: number, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  k.box(0.45, 0.06, 0.24, MED_WHITE, 0, 0.18, 0, g);
  k.box(0.3, 0.03, 0.25, '#9fd8b7', 0.06, 0.24, 0, g);
  k.box(0.04, 0.26, 0.24, C.metal, -0.23, 0, 0, g);
  for (const sx of [-0.2, 0.2]) k.box(0.02, 0.18, 0.2, C.metal, sx, 0, 0, g);
  k.add(g);
}

/** Heartbeat monitor on a stand: its screen pulses. */
function monitor(k: Kit, x: number, z: number, y: number) {
  k.cyl(0.015, 0.5, C.metal, x, y, z, 5);
  k.box(0.16, 0.12, 0.05, '#33383d', x, y + 0.5, z);
  const blip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.01), new THREE.MeshStandardMaterial({ color: '#3fd16b', emissive: '#3fd16b', emissiveIntensity: 1 }));
  blip.position.set(x, y + 0.56, z + 0.03);
  k.add(blip);
  k.anims.push((t) => {
    const c = (t * 1.2) % 1;
    blip.position.x = x - 0.06 + c * 0.12;
    blip.position.y = y + 0.56 + (c > 0.45 && c < 0.55 ? 0.035 : 0);
  });
}

/** Ceiling fan for open verandas and porches. */
function ceilingFan(k: Kit, x: number, y: number, z: number) {
  k.cyl(0.012, 0.12, C.dark, x, y - 0.12, z, 4);
  const b = new THREE.Group();
  b.position.set(x, y - 0.14, z);
  k.box(0.42, 0.01, 0.05, MED_WHITE, 0, 0, 0, b);
  k.box(0.05, 0.01, 0.42, MED_WHITE, 0, 0, 0, b);
  k.add(b);
  k.anims.push((t) => (b.rotation.y = t * 6));
}

/** Privacy curtain that sways in the breeze through open windows. */
function curtain(k: Kit, x: number, y: number, z: number, w = 0.3, h = 0.45, color = '#9fd8b7') {
  const c = k.box(w, h, 0.01, color, x, y - h, z);
  k.swing(c, 0, 0.18, x * 5 + y);
}

/**
 * Ambulance: white van with a green stripe and cross, blue and amber
 * beacons. If `drive` is set it pulls out of the bay and back on a loop.
 */
function ambulance(k: Kit, x: number, z: number, y: number, rot = 0, drive = 0, olive = false) {
  const g = new Kit();
  const body = olive ? '#5d6b35' : MED_WHITE;
  g.box(0.7, 0.36, 0.38, body, -0.05, 0.1, 0);
  g.box(0.24, 0.26, 0.37, body, 0.38, 0.1, 0);
  g.box(0.02, 0.14, 0.33, DARK_GLASS, 0.5, 0.24, 0);
  g.box(0.71, 0.05, 0.385, MED_GREEN, -0.05, 0.26, 0);
  for (const s of [-1, 1]) {
    const c = crossPlate(0.14);
    c.position.set(-0.1, 0.38, s * 0.195);
    c.rotation.y = s > 0 ? 0 : Math.PI;
    g.group.add(c);
  }
  const wheels: THREE.Mesh[] = [];
  for (const sx of [-0.25, 0.3]) for (const sz of [-0.17, 0.17]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 10).rotateX(Math.PI / 2), M('#2a2b2d'));
    w.position.set(sx, 0.08, sz);
    g.group.add(w);
    wheels.push(w);
  }
  g.group.position.set(x, y, z);
  g.group.rotation.y = rot;
  k.add(g.group);
  // Light bar: alternating blue and amber
  const lights: THREE.Mesh[] = [];
  for (const [dz, col] of [[-0.1, '#3a7bff'], [0.1, '#ffb020']] as [number, string][]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.08), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.2 }));
    l.position.set(0.12, 0.49, dz);
    g.group.add(l);
    lights.push(l);
  }
  const dir = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot));
  const base = g.group.position.clone();
  const seed = (x * 3 + z * 7) % 5;
  k.anims.push((t) => {
    const flash = Math.floor((t + seed) * 4) % 2;
    (lights[0].material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 1.6 : 0.1;
    (lights[1].material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 0.1 : 1.6;
    if (drive) {
      // Pull out, pause, reverse back into the bay
      const c = ((t + seed) % 12) / 12;
      const out = c < 0.2 ? c / 0.2 : c < 0.5 ? 1 : c < 0.7 ? 1 - (c - 0.5) / 0.2 : 0;
      const e = out * out * (3 - 2 * out);
      g.group.position.copy(base).addScaledVector(dir, e * drive);
      for (const w of wheels) w.rotation.z = -e * drive * 12;
    } else {
      // Idling: gentle engine shiver
      g.group.position.y = base.y + Math.abs(Math.sin(t * 30)) * 0.004;
    }
  });
}

/** Medevac helicopter (olive with green crosses) with spinning rotors. */
function helicopter(k: Kit, x: number, z: number, y: number, rot = 0, bob = false) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rot;
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 4, 10).rotateZ(Math.PI / 2), M(MED_WHITE));
  body.position.y = 0.26;
  g.add(body);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.12, 10).rotateZ(Math.PI / 2), M(MED_GREEN));
  stripe.position.set(-0.05, 0.26, 0);
  g.add(stripe);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6, 0, Math.PI), M(DARK_GLASS));
  glass.position.set(0.24, 0.3, 0);
  glass.rotation.y = -Math.PI / 2;
  g.add(glass);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.6, 6).rotateZ(Math.PI / 2), M(MED_WHITE));
  boom.position.set(-0.55, 0.3, 0);
  g.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.02), M(MED_GREEN));
  fin.position.set(-0.82, 0.38, 0);
  g.add(fin);
  for (const s of [-1, 1]) {
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.025), M(C.metal));
    skid.position.set(0, 0.04, s * 0.14);
    g.add(skid);
    const c = crossPlate(0.12);
    c.position.set(0.02, 0.27, s * 0.175);
    c.rotation.y = s > 0 ? 0 : Math.PI;
    g.add(c);
  }
  const rotor = new THREE.Group();
  rotor.position.set(0, 0.48, 0);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.01, 0.04).translate(0.27, 0, 0), M('#33383d'));
    b.rotation.y = (i * Math.PI) / 2;
    rotor.add(b);
  }
  g.add(rotor);
  const tail = new THREE.Group();
  tail.position.set(-0.84, 0.38, 0.03);
  for (let i = 0; i < 2; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.01), M('#33383d'));
    b.rotation.z = (i * Math.PI) / 2;
    tail.add(b);
  }
  g.add(tail);
  k.add(g);
  k.anims.push((t) => {
    rotor.rotation.y = t * 9;
    tail.rotation.z = t * 20;
    if (bob) g.position.y = y + Math.max(0, Math.sin(t * 0.35)) * 0.6;
  });
}

/** Medevac helipad: green square, white H, green cross corners, landing lights. */
function medPad(k: Kit, x: number, y: number, z: number, s = 1.3) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2f6a4a';
  g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 6;
  g.strokeRect(10, 10, 108, 108);
  g.fillStyle = '#ffffff';
  g.fillRect(36, 30, 14, 68);
  g.fillRect(78, 30, 14, 68);
  g.fillRect(36, 57, 56, 14);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const pad = new THREE.Mesh(new THREE.BoxGeometry(s, 0.05, s), [M('#2f6a4a'), M('#2f6a4a'), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), M('#2f6a4a'), M('#2f6a4a'), M('#2f6a4a')]);
  pad.position.set(x, y + 0.025, z);
  k.add(pad);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.blinker(x + (dx * s) / 2, y + 0.05, z + (dz * s) / 2, '#7cff8a', 0.03, 1.6);
}

/** Clinical block: white walls, green trim band and a cross on the parapet. */
function clinic(k: Kit, w: number, d: number, storeys: number, x: number, z: number, y: number, wall: string = MED_WHITE) {
  const h = k.block(w, d, storeys, x, y, z, wall);
  k.box(w + 0.04, 0.12, d + 0.04, MED_GREEN, x, y + h - 0.2, z);
  return h;
}

// ------------------------------------------------------------------ levels

function field(k: Kit, level: number, y: number) {
  if (level === 1) {
    // Aid post: canvas tent, stretcher with IV drip, aid boxes, cross pole
    k.tent(2.0, 1.4, -0.6, -0.5, y, '#b9a878');
    wallCross(k, -0.6, y + 0.85, 0.22, 0.26);
    stretcher(k, 0.9, 0.3, y, 0.3);
    for (let i = 0; i < 3; i++) k.box(0.22, 0.16, 0.16, i === 1 ? MED_GREEN : MED_WHITE, 1.3 - i * 0.25, y, -0.9);
    poleCross(k, 1.55, 0.95, y, 0.9, 0.26);
    k.sandbags(-0.6, 1.0, 1.4, 0, y);
    return;
  }
  if (level === 2) {
    // Field clinic: two linked tents, olive field ambulance with flashing light bar
    k.tent(1.5, 1.3, -1.0, -0.55, y, '#b9a878');
    k.tent(1.5, 1.3, 0.75, -0.55, y, '#c4b585');
    k.box(0.4, 0.5, 0.6, '#a8996a', -0.12, y, -0.55); // tent link
    for (const x of [-1.0, 0.75]) wallCross(k, x, y + 0.8, 0.12, 0.24);
    curtain(k, 0.75, y + 0.48, 0.13, 0.4, 0.4, '#d9cfa8');
    ambulance(k, 0.9, 0.85, y, Math.PI, 0, true);
    stretcher(k, -1.0, 0.75, y, 0);
    return;
  }
  // 3: timber sick bay hut with a veranda, turning cross sign, stretcher
  const w = 2.6, d = 1.3, z = -0.6;
  const h = k.block(w, d, 1, -0.3, y, z, C.wood);
  for (let i = 1; i < 6; i++) k.box(w + 0.01, 0.015, d + 0.01, '#8a5a3b', -0.3, y + i * 0.15, z);
  k.gableRoof(w, d, 0.5, -0.3, y + h, z, C.zinc, 0.18, C.wood);
  k.box(w, 0.05, 0.6, '#9c6b45', -0.3, y, z + d / 2 + 0.3);
  for (const x of [-1.5, -0.3, 0.9]) k.box(0.06, 0.75, 0.06, '#8a5a3b', x, y, z + d / 2 + 0.55);
  k.box(w + 0.2, 0.05, 0.75, C.zinc, -0.3, y + 0.78, z + d / 2 + 0.32);
  k.door('front', -0.3, z, w, d, 0, y + 0.05, 0.34, 0.6);
  k.windowRow('front', -0.3, z, w, d, 2, y + 0.45, { span: 1.6 });
  wallCross(k, -0.3, y + h - 0.2, z + d / 2 + 0.03, 0.26);
  ceilingFan(k, -0.9, y + 0.78, z + d / 2 + 0.3);
  stretcher(k, 0.4, z + d / 2 + 0.3, y + 0.05, 0);
  poleCross(k, 1.45, 0.9, y, 1.0);
}

function camp(k: Kit, level: number, y: number) {
  if (level === 4) {
    // Medical centre: white block, green band, ambulance bay canopy; ambulance pulls out and back
    const h = clinic(k, 2.2, 1.4, 1, -0.75, -0.6, y);
    k.hipRoof(2.2, 1.4, 0.5, -0.75, y + h, -0.6);
    k.windowRow('front', -0.75, -0.6, 2.2, 1.4, 3, y + 0.42, { skip: [1] });
    k.door('front', -0.75, -0.6, 2.2, 1.4, 0, y, 0.4, 0.62, MED_GREEN);
    wallCross(k, -0.75, y + 0.8, 0.12, 0.26);
    k.box(1.2, 0.06, 1.5, MED_GREEN, 1.2, y + 0.85, -0.25);
    for (const zz of [-0.9, 0.4]) k.box(0.06, 0.85, 0.06, C.white, 1.75, y, zz);
    ambulance(k, 1.2, -0.55, y, Math.PI / 2, 0.8);
    k.planter(-1.5, 0.55, 0.5, y);
    return;
  }
  if (level === 5) {
    // L-plan clinic: ward wing projecting forward on the left, reception on the right
    const h = clinic(k, 2.4, 1.1, 1, 0.5, -0.8, y);
    k.hipRoof(2.4, 1.1, 0.45, 0.5, y + h, -0.8);
    k.windowRow('front', 0.5, -0.8, 2.4, 1.1, 3, y + 0.42, { skip: [1] });
    k.door('front', 0.5, -0.8, 2.4, 1.1, 0, y, 0.4, 0.62, MED_GREEN);
    wallCross(k, 0.5, y + 0.8, -0.23, 0.26);
    const wh = clinic(k, 1.1, 2.4, 1, -1.25, -0.15, y, MINT);
    k.hipRoof(1.1, 2.4, 0.45, -1.25, y + wh, -0.15);
    k.windowRow('right', -1.25, -0.15, 1.1, 2.4, 3, y + 0.42);
    for (let i = 0; i < 3; i++) curtain(k, -0.68, y + 0.75, -0.75 + i * 0.6, 0.02, 0.3);
    ambulance(k, 0.75, 0.6, y, 0, 0.6);
    return;
  }
  // 6: two-storey clinic with a deep green veranda ward and ceiling fans
  const h = clinic(k, 3.2, 1.2, 2, 0, -0.75, y);
  k.hipRoof(3.2, 1.2, 0.5, 0, y + h, -0.75);
  for (let f = 0; f < 2; f++) k.windowRow('front', 0, -0.75, 3.2, 1.2, 5, y + f * STOREY + 0.42, { skip: f === 0 ? [2] : [], louvre: f > 0 });
  k.door('front', 0, -0.75, 3.2, 1.2, 0, y, 0.4, 0.62, MED_GREEN);
  k.box(3.2, 0.05, 0.8, '#c9c3b5', 0, y, 0.25);
  for (let i = 0; i < 5; i++) k.box(0.07, 0.85, 0.07, C.white, -1.55 + i * 0.775, y, 0.6);
  k.box(3.4, 0.07, 0.95, MED_GREEN, 0, y + 0.85, 0.22);
  for (const x of [-0.9, 0.9]) ceilingFan(k, x, y + 0.85, 0.25);
  bed(k, -0.9, 0.25, y);
  bed(k, 0.9, 0.25, y);
  wallCross(k, 0, y + h - 0.4, -0.13, 0.34);
  k.waterTank(1.3, y + h + 0.1, -0.9, 0.15, 0.25);
  poleCross(k, -1.7, 1.05, y, 1.1, 0.26);
}

function base(k: Kit, level: number, y: number) {
  if (level === 7) {
    // Polyclinic: wide two-storey block with a curved drop-off canopy and a turning cross
    const h = clinic(k, 3.4, 1.3, 2, 0, -0.75, y);
    k.flatRoof(3.4, 1.3, 0, y + h, -0.75);
    for (let f = 0; f < 2; f++) k.windowRow('front', 0, -0.75, 3.4, 1.3, 6, y + f * STOREY + 0.42, { skip: f === 0 ? [2, 3] : [] });
    k.glassBox(1.0, STOREY - 0.05, 0.3, 0, y, -0.0);
    const arc = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.6, 12, 1, true, -Math.PI / 2, Math.PI), M(MED_GREEN, { side: THREE.DoubleSide }));
    arc.rotation.z = Math.PI / 2;
    arc.scale.set(0.25, 1, 0.7);
    arc.position.set(0, y + 1.0, 0.55);
    k.add(arc);
    for (const x of [-0.75, 0.75]) k.box(0.06, 1.0, 0.06, C.white, x, y, 1.1);
    ambulance(k, 0.3, 0.6, y, 0, 0.5);
    crossCube(k, 1.3, y + h + 0.2, -0.9, 0.36);
    k.aircon(1.72, y + 0.3, -0.9, Math.PI / 2);
    return;
  }
  if (level === 8) {
    // Ward block: three storeys of balconies with swaying privacy curtains
    const h = clinic(k, 3.2, 1.1, 3, 0, -0.85, y);
    k.hipRoof(3.2, 1.1, 0.28, 0, y + h, -0.85);
    for (let f = 1; f < 3; f++) {
      const fy = y + f * STOREY;
      k.box(3.2, 0.06, 0.4, '#cfc9bc', 0, fy - 0.06, -0.1);
      k.box(3.2, 0.26, 0.04, MED_WHITE, 0, fy, 0.08);
      for (let i = 0; i < 4; i++) {
        k.window('front', 0, -0.85, 3.2, 1.1, -1.2 + i * 0.8, fy + 0.42, 0.42, 0.4);
        curtain(k, -1.2 + i * 0.8 + 0.12, fy + 0.8, -0.28, 0.18, 0.35);
      }
    }
    k.windowRow('front', 0, -0.85, 3.2, 1.1, 4, y + 0.42, { skip: [1] });
    k.door('front', 0, -0.85, 3.2, 1.1, -0.4, y, 0.4, 0.62, MED_GREEN);
    wallCross(k, 1.3, y + h - 0.45, -0.28, 0.3);
    ambulance(k, 0.6, 0.75, y, 0, 0.6);
    stretcher(k, -1.1, 0.75, y, 0);
    return;
  }
  if (level === 9) {
    // Medevac clinic: two-storey block with a rooftop green medevac pad and helicopter
    const h = clinic(k, 2.6, 1.6, 3, -0.5, -0.55, y);
    k.flatRoof(2.6, 1.6, -0.5, y + h, -0.55);
    for (let f = 0; f < 3; f++) k.windowRow('front', -0.5, -0.55, 2.6, 1.6, 4, y + f * STOREY + 0.42, { skip: f === 0 ? [1] : [] });
    k.door('front', -0.5, -0.55, 2.6, 1.6, -0.3, y, 0.4, 0.62, MED_GREEN);
    medPad(k, -0.5, y + h + 0.06, -0.55, 1.3);
    helicopter(k, -0.5, -0.55, y + h + 0.11, 0.5);
    k.windsock(0.65, y + h + 0.06, -1.25);
    const wh = clinic(k, 0.9, 1.6, 2, 1.25, -0.55, y, MINT);
    k.hipRoof(0.9, 1.6, 0.35, 1.25, y + wh, -0.55);
    ambulance(k, 1.2, 0.8, y, Math.PI, 0);
    wallCross(k, 1.25, y + 0.6, 0.27, 0.26);
    return;
  }
  // 10: complex: three-storey ward block, emergency wing with ambulance bay, rooftop cross
  const h = clinic(k, 2.2, 1.4, 3, -0.8, -0.7, y);
  k.hipRoof(2.2, 1.4, 0.45, -0.8, y + h, -0.7);
  for (let f = 0; f < 3; f++) k.windowRow('front', -0.8, -0.7, 2.2, 1.4, 3, y + f * STOREY + 0.42, { louvre: f > 0 });
  const eh = clinic(k, 1.4, 1.4, 2, 1.1, -0.7, y, MINT);
  k.flatRoof(1.4, 1.4, 1.1, y + eh, -0.7);
  crossCube(k, 1.1, y + eh + 0.2, -0.7, 0.4);
  k.box(1.5, 0.07, 0.9, MED_GREEN, 1.1, y + 0.9, 0.35);
  for (const x of [0.45, 1.75]) k.box(0.06, 0.9, 0.06, C.white, x, y, 0.75);
  fascia(k, 'EMERGENCY', 1.2, 1.1, y + 0.98, 0.82);
  ambulance(k, 1.1, 0.15, y, Math.PI / 2, 0.7);
  k.door('front', -0.8, -0.7, 2.2, 1.4, 0, y, 0.4, 0.62, MED_GREEN);
  stretcher(k, -0.8, 0.6, y, 0);
}

/** Lettered sign band (e.g. EMERGENCY). */
function fascia(k: Kit, text: string, w: number, x: number, y: number, z: number, bg = MED_GREEN) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 40;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 40);
  g.fillStyle = '#ffffff';
  g.font = '900 28px Nunito, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 22);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, w * 0.156, 0.03), [M(bg), M(bg), M(bg), M(bg), new THREE.MeshStandardMaterial({ map: tex }), M(bg)]);
  m.position.set(x, y + w * 0.078, z);
  k.add(m);
}

function command(k: Kit, level: number, y: number) {
  if (level === 11) {
    // Modern clinic: white block with green-glass ribbon, illuminated rotating cross cube
    k.box(3.4, 3 * STOREY, 1.9, MED_WHITE, 0, y, -0.4);
    for (let f = 0; f < 3; f++) {
      k.box(3.0, 0.38, 0.04, '#5fae8a', 0, y + f * STOREY + 0.3, 0.56);
      k.box(3.44, 0.05, 1.94, MED_GREEN, 0, y + f * STOREY, -0.4);
    }
    k.box(3.48, 0.1, 1.98, C.white, 0, y + 3 * STOREY, -0.4);
    crossCube(k, 1.2, y + 3 * STOREY + 0.25, -0.6, 0.5);
    k.box(1.6, 0.06, 0.6, MED_GREEN, -0.6, y + 0.95, 0.85);
    for (const x of [-1.3, 0.1]) k.box(0.05, 0.95, 0.05, C.white, x, y, 1.1);
    ambulance(k, 0.9, 0.95, y, Math.PI, 0);
    return;
  }
  if (level === 12) {
    // Rehab centre: three-storey block beside a hydrotherapy pool and a walking garden
    const h = clinic(k, 2.0, 1.3, 3, -0.95, -0.75, y);
    k.flatRoof(2.0, 1.3, -0.95, y + h, -0.75);
    for (let f = 0; f < 3; f++) k.windowRow('front', -0.95, -0.75, 2.0, 1.3, 3, y + f * STOREY + 0.42, { louvre: f > 0 });
    k.hedge(-0.95, -0.75, 1.7, 1.0, y + h + 0.06);
    // Covered pool hall with glass roof
    k.box(1.6, 0.35, 1.9, CONCRETE, 0.95, y, -0.35);
    const water = k.box(1.4, 0.02, 1.7, '#5fd0dc', 0.95, y + 0.34, -0.35);
    k.anims.push((t) => (water.position.y = y + 0.345 + Math.sin(t * 2) * 0.006));
    for (const [x, z] of [[0.2, -1.2], [1.7, -1.2], [0.2, 0.55], [1.7, 0.55]]) k.box(0.06, 1.6, 0.06, C.white, x, y, z);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 1.6, 12, 1, true, -Math.PI / 2, Math.PI), M('#9fd8b7', { transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
    roof.rotation.x = Math.PI / 2;
    roof.scale.set(0.8, 1, 0.45);
    roof.position.set(0.95, y + 1.6, -0.35);
    k.add(roof);
    wallCross(k, -0.95, y + 0.75, -0.08, 0.28);
    stretcher(k, -0.9, 0.7, y, 0);
    ambulance(k, 1.15, 1.0, y, 0, 0);
    return;
  }
  if (level === 13) {
    // Imaging centre: clinic plus a round glass rotunda with a turning scanner ring inside
    const h = clinic(k, 2.0, 1.5, 3, -0.95, -0.6, y);
    k.flatRoof(2.0, 1.5, -0.95, y + h, -0.6);
    for (let f = 0; f < 3; f++) k.windowRow('front', -0.95, -0.6, 2.0, 1.5, 3, y + f * STOREY + 0.42);
    k.cyl(0.85, 2.2, '#bfe0ec', 1.0, y, -0.45, 16);
    k.cyl(0.88, 0.08, MED_GREEN, 1.0, y + 2.2, -0.45, 16);
    k.cyl(0.88, 0.08, MED_GREEN, 1.0, y, -0.45, 16);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.13, 8, 20), M(MED_WHITE));
    ring.position.set(1.0, y + 0.75, -0.45);
    k.add(ring);
    const bedTop = k.box(0.9, 0.05, 0.22, '#9fd8b7', 1.0, y + 0.6, -0.45);
    k.anims.push((t) => {
      ring.rotation.y = Math.PI / 2;
      ring.rotation.x = t * 1.5;
      bedTop.position.x = 1.0 + Math.sin(t * 0.5) * 0.25;
    });
    crossCube(k, -0.95, y + h + 0.25, -0.6, 0.4);
    ambulance(k, -0.4, 0.9, y, 0, 0);
    return;
  }
  if (level === 14) {
    // Raised medevac pad on columns over the ambulance bay; a helicopter lands and lifts off
    const h = clinic(k, 1.8, 1.6, 3, -1.05, -0.55, y);
    k.flatRoof(1.8, 1.6, -1.05, y + h, -0.55);
    for (let f = 0; f < 3; f++) k.windowRow('right', -1.05, -0.55, 1.8, 1.6, 3, y + f * STOREY + 0.42, { louvre: f > 0 });
    for (let f = 0; f < 3; f++) k.windowRow('front', -1.05, -0.55, 1.8, 1.6, 2, y + f * STOREY + 0.42);
    const py = y + 2.0;
    for (const [x, z] of [[0.35, -1.1], [1.65, -1.1], [0.35, 0.4], [1.65, 0.4]]) k.box(0.1, 2.0, 0.1, C.white, x, y, z);
    k.box(1.55, 0.12, 1.75, CONCRETE, 1.0, py - 0.12, -0.35);
    medPad(k, 1.0, py, -0.35, 1.45);
    k.box(0.3, 0.04, 0.6, C.metal, 0.05, py - 0.1, -0.35); // link bridge
    helicopter(k, 1.0, -0.35, py + 0.05, 1.2, true);
    ambulance(k, 1.0, -0.4, y, Math.PI / 2, 0.8);
    wallCross(k, -1.05, y + h - 0.4, 0.27, 0.32);
    return;
  }
  // 15: grand hospital: U-plan with gold band, green-cross pediment, healing-garden gazebo
  const h = clinic(k, 3.6, 1.0, 3, 0, -1.0, y);
  k.hipRoof(3.6, 1.0, 0.4, 0, y + h, -1.0);
  for (let f = 0; f < 3; f++) k.windowRow('front', 0, -1.0, 3.6, 1.0, 6, y + f * STOREY + 0.42, { skip: f === 0 ? [2, 3] : [], louvre: f > 0 });
  for (const s of [-1, 1]) {
    const wx = s * 1.45;
    const wh = clinic(k, 0.7, 1.3, 3, wx, 0.05, y, MINT);
    k.hipRoof(0.7, 1.3, 0.35, wx, y + wh, 0.05);
    for (let f = 0; f < 3; f++) k.window('front', wx, 0.05, 0.7, 1.3, 0, y + f * STOREY + 0.42);
    k.box(0.74, 0.06, 1.34, '#d9b24a', wx, y + wh - 0.25, 0.05);
  }
  k.box(3.64, 0.06, 1.04, '#d9b24a', 0, y + h - 0.25, -1.0);
  // Portico with pediment and the cross
  for (const x of [-0.5, -0.17, 0.17, 0.5]) k.cyl(0.05, 0.95, C.white, x, y, -0.3, 8);
  k.box(1.3, 0.08, 0.5, C.white, 0, y + 0.95, -0.4);
  k.gableRoof(1.3, 0.5, 0.3, 0, y + 1.03, -0.4, C.roof, 0.05, C.white, false);
  wallCross(k, 0, y + h - 0.15, -0.48, 0.34);
  // Healing garden gazebo with hanging planters
  k.box(1.8, 0.02, 1.0, '#6cbf45', 0, y, 0.75);
  k.cyl(0.32, 0.6, C.white, 0, y, 0.75, 8, 0.32);
  k.cyl(0.42, 0.18, MED_GREEN, 0, y + 0.6, 0.75, 8, 0.05);
  for (const x of [-0.7, 0.7]) {
    const pot = k.box(0.1, 0.1, 0.1, '#b8653a', x, y + 0.45, 0.75);
    k.swing(pot, 0, 0.25, x * 4);
    k.box(0.01, 0.4, 0.01, '#dddddd', x, y + 0.55, 0.75);
    k.box(0.06, 0.95, 0.06, C.metal, x, y, 0.75);
  }
  ambulance(k, 1.45, 1.15, y, Math.PI, 0);
}

/** Jersey barriers lining the secure forecourt. */
function barriers(k: Kit, x0: number, x1: number, z: number, y: number) {
  const n = Math.max(1, Math.round((x1 - x0) / 0.42));
  for (let i = 0; i < n; i++) {
    const x = x0 + ((x1 - x0) / n) * (i + 0.5);
    k.box(0.38, 0.36, 0.26, CONCRETE, x, y, z);
    k.box(0.38, 0.05, 0.27, i % 2 ? C.kerbB : C.kerbY, x, y + 0.24, z);
  }
}

function secure(k: Kit, level: number, y: number) {
  perimeter(k, y, 4 / 2 - 0.28, 3 / 2 - 0.28, false);
  if (level <= 17) barriers(k, -1.65, -0.85, 1.02, y);
  if (level === 16) {
    // Secure med bunker: concrete block with blast doors, big painted cross, decon tent
    k.box(2.3, 3 * STOREY, 2.0, CONCRETE, -0.5, y, -0.15);
    for (let i = 1; i < 6; i++) k.box(2.32, 0.03, 2.02, '#c2bdb3', -0.5, y + i * 0.48, -0.15);
    wallCross(k, -0.5, y + 2.0, 0.86, 0.7);
    k.box(0.9, 0.85, 0.08, '#6b7075', -0.5, y, 0.88);
    for (let i = 0; i < 6; i++) k.box(0.16, 0.08, 0.1, i % 2 ? C.kerbB : C.kerbY, -0.9 + i * 0.16, y + 0.87, 0.9);
    roofCanopy(k, 2.0, 1.6, -0.5, y + 3 * STOREY, -0.15, 0.35);
    // Decontamination annex with a cross over its door
    const ah = clinic(k, 1.0, 1.65, 1, 1.15, -0.4, y, MINT);
    k.flatRoof(1.0, 1.65, 1.15, y + ah, -0.4);
    k.door('front', 1.15, -0.4, 1.0, 1.65, 0, y, 0.3, 0.55, MED_GREEN);
    wallCross(k, 1.15, y + 0.7, 0.45, 0.18);
    ambulance(k, 0.95, 0.85, y, 0, 0, true);
    return;
  }
  if (level === 17) {
    // Field hospital domes: three linked inflatable domes with cross caps and a 3-storey core
    const h = clinic(k, 1.1, 2.0, 3, -1.15, -0.25, y);
    k.flatRoof(1.1, 2.0, -1.15, y + h, -0.25);
    crossCube(k, -1.15, y + h + 0.25, -0.25, 0.36);
    for (const [x, r] of [[0.15, 0.8], [1.15, 0.62]] as [number, number][]) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M('#e8f1ea'));
      d.scale.y = 1.45;
      d.position.set(x, y, -0.5);
      d.castShadow = true;
      k.add(d);
      for (let i = 0; i < 4; i++) {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(r + 0.005, 0.02, 4, 16, Math.PI), M('#9fd8b7'));
        rib.rotation.y = (i * Math.PI) / 4;
        rib.scale.y = 1.45;
        rib.position.set(x, y, -0.5);
        k.add(rib);
      }
      const cap = crossPlate(0.22);
      cap.rotation.x = -Math.PI / 2;
      cap.position.set(x, y + r * 1.45 + 0.03, -0.5);
      k.add(cap);
      // Domes "breathe" as the blowers run
      k.anims.push((t) => d.scale.set(1 + Math.sin(t * 1.3 + x) * 0.012, 1.45 + Math.sin(t * 1.3 + x) * 0.02, 1));
    }
    k.box(0.6, 0.5, 0.4, '#e8f1ea', 0.55, y, -0.5);
    k.box(0.7, 0.5, 0.45, '#5d6b35', 1.3, y, 0.75); // generator container
    k.box(0.72, 0.05, 0.47, '#33383d', 1.3, y + 0.5, 0.75);
    ambulance(k, 0.2, 0.85, y, 0, 0);
    return;
  }
  if (level === 18) {
    // Isolation wards: glass-fronted pods with negative-pressure vents spinning on top
    k.box(3.4, 3 * STOREY, 1.4, CONCRETE, 0, y, -0.65);
    for (let f = 0; f < 3; f++) {
      for (let i = 0; i < 4; i++) {
        const px = -1.25 + i * 0.83;
        k.box(0.72, STOREY - 0.12, 0.04, '#9fd8b7', px, y + f * STOREY + 0.06, 0.07);
        k.box(0.72, 0.03, 0.05, MED_GREEN, px, y + f * STOREY + 0.06, 0.08);
        if (f === 0) bed(k, px, -0.15, y, Math.PI / 2);
      }
      k.box(3.44, 0.05, 1.44, MED_GREEN, 0, y + f * STOREY, -0.65);
    }
    k.box(3.44, 0.08, 1.44, C.white, 0, y + 3 * STOREY, -0.65);
    for (const x of [-1.2, -0.4, 0.4, 1.2]) {
      k.cyl(0.1, 0.1, C.metal, x, y + 3 * STOREY + 0.08, -0.85, 8);
      const v = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 4), M('#c9ced2'));
      v.position.set(x, y + 3 * STOREY + 0.27, -0.85);
      k.add(v);
      k.anims.push((t) => (v.rotation.y = t * 4 + x));
    }
    wallCross(k, 1.45, y + 2.4, 0.1, 0.3);
    monitor(k, -1.4, 0.5, y);
    ambulance(k, 0.4, 0.75, y, 0, 0.5);
    return;
  }
  if (level === 19) {
    // Bio-lab: clean-room block with tall sealed sample tanks and an airlock tunnel
    const h = clinic(k, 2.0, 1.6, 3, -0.85, -0.5, y);
    k.flatRoof(2.0, 1.6, -0.85, y + h, -0.5);
    for (let f = 0; f < 3; f++) k.box(1.7, 0.3, 0.04, '#5fae8a', -0.85, y + f * STOREY + 0.35, 0.31);
    for (const [x, z] of [[0.75, -1.0], [1.35, -1.0], [0.75, -0.35], [1.35, -0.35]]) {
      k.cyl(0.24, 2.6, '#e8f1f4', x, y, z, 12);
      k.cyl(0.25, 0.05, MED_GREEN, x, y + 1.3, z, 12);
      k.cyl(0.25, 0.2, '#c9ced2', x, y + 2.6, z, 12, 0.08);
      k.blinker(x, y + 2.8, z, '#7cff8a', 0.03, 1.2 + x);
    }
    const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 12, 1, false).rotateX(Math.PI / 2), M('#d9efe2'));
    tunnel.position.set(-0.85, y + 0.3, 0.75);
    k.add(tunnel);
    for (let i = 0; i < 4; i++) k.cyl(0.32, 0.03, MED_GREEN, -0.85, y + 0.3, 0.4 + i * 0.22, 12).rotation.x = Math.PI / 2;
    crossCube(k, -0.85, y + h + 0.25, -0.5, 0.36);
    ambulance(k, 1.05, 0.75, y, Math.PI, 0);
    return;
  }
  // 20: medical citadel: curved green-glass wing hugging a white tower, gold-ringed cross beacon
  const h = clinic(k, 1.4, 1.4, 3, -1.15, -0.55, y);
  k.flatRoof(1.4, 1.4, -1.15, y + h, -0.55);
  const curve = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 3 * STOREY, 18, 1, true, -Math.PI / 2, Math.PI * 0.75), M('#5fae8a', { side: THREE.DoubleSide }));
  curve.position.set(-0.4, y + 1.425, -0.55);
  k.add(curve);
  for (let f = 1; f < 3; f++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.03, 4, 18, Math.PI * 0.75), M(MED_WHITE));
    band.rotation.x = Math.PI / 2;
    band.rotation.z = -Math.PI / 2 + 0;
    band.position.set(-0.4, y + f * STOREY, -0.55);
    k.add(band);
  }
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.1, 18, 1, false, -Math.PI / 2, Math.PI * 0.75), M('#d9b24a'));
  roof.position.set(-0.4, y + 3 * STOREY + 0.05, -0.55);
  k.add(roof);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 20), M('#d9b24a'));
  ring.position.set(-1.15, y + h + 0.55, -0.55);
  k.add(ring);
  crossCube(k, -1.15, y + h + 0.3, -0.55, 0.45);
  k.anims.push((t) => {
    ring.rotation.x = Math.PI / 2 + Math.sin(t * 0.7) * 0.4;
    ring.rotation.y = t * 0.9;
  });
  ambulance(k, 0.9, 0.85, y, 0, 0);
  stretcher(k, -0.4, 0.95, y, 0);
}

export function buildMedical(level: number): Kit {
  const k = new Kit();
  const y = k.pad(4, 3);
  if (level <= 3) field(k, level, y);
  else if (level <= 6) camp(k, level, y);
  else if (level <= 10) base(k, level, y);
  else if (level <= 15) command(k, level, y);
  else secure(k, level, y);
  return k;
}

export const MEDICAL_CENTRE: BuildingDef = {
  id: 'medical',
  name: 'Medical Centre',
  role: 'Recovery: tired or injured Recruits heal here; later it heals troops after raids.',
  footprint: [4, 3],
  unlockHq: 4,
  levels: MEDICAL_LEVELS,
  designedLevels: 20,
  build: buildMedical,
};
