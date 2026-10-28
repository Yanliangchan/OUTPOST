import * as THREE from 'three';
import { PALETTE } from '../config/palette';
import { C, Kit, STOREY } from './kit';

/**
 * Building catalogue: data + a builder per level. Footprints stay constant
 * across upgrades (like CoC) so upgrading never needs re-placement.
 */
export interface BuildingDef {
  id: string;
  name: string;
  /** Footprint in tiles: [width along x, depth along z]. */
  footprint: [number, number];
  maxLevel: number;
  build(level: number): Kit;
}

// ------------------------------------------------------------------ HQ

function hq(level: number): Kit {
  const k = new Kit();
  const y = k.pad(5, 5);
  k.path(0.9, 1.5, 0, 1.75, y);
  if (level === 1) {
    // Field HQ: single-storey admin block with a green porch.
    const bw = 3.4, bd = 2.0, bz = -0.75;
    const h = k.block(bw, bd, 1, 0, y, bz);
    k.hipRoof(bw, bd, 0.6, 0, y + h, bz);
    k.door('front', 0, bz, bw, bd, 0, y);
    k.windowRow('front', 0, bz, bw, bd, 4, y + 0.42);
    k.windowRow('left', 0, bz, bw, bd, 2, y + 0.42);
    k.windowRow('right', 0, bz, bw, bd, 2, y + 0.42);
    k.porch(0, bz + bd / 2 + 0.42, 1.1, 0.8, 0.72, y);
    k.aircon(bw / 2 + 0.08, y + 0.25, bz - 0.4, Math.PI / 2);
    k.flagpole(-1.85, 1.75, 1.9, y);
    k.planter(-0.95, 0.75, 0.6, y);
    k.planter(0.95, 0.75, 0.6, y);
    k.plaque('HQ', 1.55, 1.85, y, 0.8);
  } else if (level === 2) {
    // Admin block: two storeys, porch with a balcony, radio mast.
    const bw = 3.8, bd = 2.1, bz = -0.75;
    const h = k.block(bw, bd, 2, 0, y, bz);
    k.hipRoof(bw, bd, 0.7, 0, y + h, bz);
    k.door('front', 0, bz, bw, bd, 0, y, 0.44);
    for (const fy of [0.42, STOREY + 0.42]) k.windowRow('front', 0, bz, bw, bd, 5, y + fy, { skip: fy < 1 ? [2] : [] });
    for (const fy of [0.42, STOREY + 0.42]) {
      k.windowRow('left', 0, bz, bw, bd, 2, y + fy);
      k.windowRow('right', 0, bz, bw, bd, 2, y + fy);
    }
    k.porch(0, bz + bd / 2 + 0.45, 1.5, 0.85, STOREY - 0.05, y, 2);
    k.box(1.5, 0.28, 0.05, C.white, 0, y + STOREY + 0.03, bz + bd / 2 + 0.86); // balcony parapet
    k.window('front', 0, bz, bw, bd, 0, y + STOREY + 0.42, 0.5, 0.42);
    k.antenna(1.2, y + h + 0.35, bz - 0.2, 1.2);
    k.aircon(bw / 2 + 0.08, y + 0.25, bz - 0.4, Math.PI / 2);
    k.aircon(bw / 2 + 0.08, y + STOREY + 0.25, bz - 0.4, Math.PI / 2);
    k.aircon(-bw / 2 - 0.08, y + 0.25, bz + 0.3, -Math.PI / 2);
    k.flagpole(-1.9, 1.8, 2.3, y);
    k.planter(-1.05, 0.95, 0.7, y);
    k.planter(1.05, 0.95, 0.7, y);
    k.plaque('HQ', 1.6, 1.9, y, 0.85);
    k.noticeboard(2.05, 0.6, -Math.PI / 2, y);
  } else {
    // Headquarters: three storeys with a central look-out tower and a grand porch.
    const bw = 4.2, bd = 2.0, bz = -1.05;
    const h = k.block(bw, bd, 3, 0, y, bz);
    k.hipRoof(bw, bd, 0.7, 0, y + h, bz);
    for (let f = 0; f < 3; f++) {
      k.windowRow('front', 0, bz, bw, bd, 6, y + f * STOREY + 0.42, { skip: [2, 3], louvre: f > 0 });
      k.windowRow('left', 0, bz, bw, bd, 2, y + f * STOREY + 0.42);
      k.windowRow('right', 0, bz, bw, bd, 2, y + f * STOREY + 0.42);
    }
    // Tower
    const tw = 1.4, td = 1.0, tz = bz + bd / 2 + td / 2 - 0.05;
    const th = k.block(tw, td, 4, 0, y, tz, C.wallAlt);
    k.flatRoof(tw, td, 0, y + th, tz);
    k.dish(0.35, y + th + 0.06, tz - 0.15);
    k.antenna(-0.4, y + th + 0.06, tz - 0.2, 1.3);
    k.door('front', 0, tz, tw, td, 0, y, 0.5, 0.66);
    for (let f = 1; f < 4; f++) k.window('front', 0, tz, tw, td, 0, y + f * STOREY + 0.36, 0.7, 0.44);
    // Clock face on the tower
    const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f7f5ef', flatShading: true }));
    clock.position.set(0, y + 3 * STOREY + 0.55, tz + td / 2 + 0.04);
    k.add(clock);
    k.box(0.02, 0.14, 0.02, C.dark, 0, y + 3 * STOREY + 0.53, tz + td / 2 + 0.07);
    k.box(0.1, 0.02, 0.02, C.dark, 0.04, y + 3 * STOREY + 0.55, tz + td / 2 + 0.07);
    k.porch(0, tz + td / 2 + 0.45, 1.9, 0.85, STOREY - 0.05, y, 4);
    for (let f = 0; f < 3; f++) {
      k.aircon(bw / 2 + 0.08, y + f * STOREY + 0.25, bz - 0.4, Math.PI / 2);
      k.aircon(-bw / 2 - 0.08, y + f * STOREY + 0.25, bz - 0.4, -Math.PI / 2);
    }
    k.flagpole(-2.0, 1.95, 2.6, y);
    k.flagpole(2.0, 1.95, 2.6, y);
    k.planter(-1.4, 1.35, 0.9, y);
    k.planter(1.4, 1.35, 0.9, y);
    k.plaque('HEADQUARTERS', -1.25, 2.0, y, 1.3);
    k.lamp(1.2, 2.05, y);
    k.noticeboard(2.1, 0.55, -Math.PI / 2, y);
  }
  return k;
}

// ------------------------------------------------------------------ Bunk

function bunk(level: number): Kit {
  const k = new Kit();
  const y = k.pad(6, 4);
  if (level === 1) {
    // Old-school single-storey barrack with a zinc roof.
    const bw = 5.2, bd = 1.7, bz = -0.55;
    const h = k.block(bw, bd, 1, 0, y, bz);
    k.gableRoof(bw, bd, 0.55, 0, y + h, bz, C.zinc);
    k.windowRow('front', 0, bz, bw, bd, 7, y + 0.42, { louvre: true, skip: [1, 5] });
    k.windowRow('back', 0, bz, bw, bd, 7, y + 0.42, { louvre: true });
    for (const dx of [-1.43, 1.43]) {
      k.door('front', 0, bz, bw, bd, dx, y);
      k.box(0.6, 0.06, 0.35, '#c9c3b5', dx, y, bz + bd / 2 + 0.17);
    }
    k.clothesLine(-1.6, 1.35, 1.6, y);
    k.bench(1.3, 1.05, 0.8, y);
    k.bin(2.6, 1.5, y);
    k.box(0.06, 0.06, 2.0, '#8a9196', 2.7, y + 0.06, bz); // drain pipe along the side
  } else {
    // Bunk block: two/three storeys with a common corridor along the front.
    const storeys = level === 2 ? 2 : 3;
    const bw = 4.8, bd = 1.35, bz = -0.95;
    const cd = 0.55;
    const cz = bz + bd / 2 + cd / 2;
    const h = k.block(bw, bd, storeys, 0, y, bz);
    k.hipRoof(bw, bd + cd, 0.65, 0, y + h, bz + cd / 2, C.roof);
    for (let f = 0; f < storeys; f++) {
      const fy = y + f * STOREY;
      if (f > 0) k.corridor(0, cz, bw, cd, fy);
      // Columns supporting the corridor
      for (let i = 0; i < 5; i++) k.box(0.08, STOREY, 0.08, C.white, -bw / 2 + 0.06 + (i * (bw - 0.12)) / 4, fy, cz + cd / 2 - 0.06);
      for (let i = 0; i < 4; i++) {
        const dx = -1.8 + i * 1.2;
        k.door('front', 0, bz, bw, bd, dx, fy, 0.3, 0.6);
        k.window('front', 0, bz, bw, bd, dx + 0.45, fy + 0.48, 0.3, 0.22, true);
      }
      k.windowRow('back', 0, bz, bw, bd, 6, fy + 0.45, { louvre: true });
      if (f > 0) {
        // Towels and uniforms hung over the corridor parapet
        const colours = ['#4b6b3a', '#ffffff', '#ff8a3d', '#4b6b3a', '#2f5a8a'];
        for (let t = 0; t < 6; t++) k.box(0.16, 0.2, 0.012, colours[(t + f) % colours.length], -2.1 + t * 0.82 + (f % 2) * 0.2, fy + 0.14, cz + cd / 2 + 0.02);
      }
      k.aircon(bw / 2 + 0.08, fy + 0.3, bz - 0.2, Math.PI / 2);
    }
    k.box(bw, 0.03, cd, '#c9c3b5', 0, y, cz); // ground-floor walkway
    // External staircase at the right end
    k.stairs(2.68, bz + 0.2, 0.42, 1.9, (storeys - 1) * STOREY);
    k.box(0.04, (storeys - 1) * STOREY + 0.3, 1.9, C.white, 2.9, y, bz + 0.2);
    if (level === 3) {
      k.waterTank(-2.7, y, -1.45, 0.17, 0.3);
      k.waterTank(-2.7, y, -0.95, 0.17, 0.3);
      k.lamp(-2.6, 1.6, y);
      k.noticeboard(-1.0, 1.65, 0, y);
    }
    k.clothesLine(-1.9, 1.5, 1.4, y);
    k.bicycleRack(1.6, 1.55, 3, y);
    k.bin(2.65, 1.6, y);
  }
  return k;
}

// ------------------------------------------------------------------ Cookhouse

function umbrella(k: Kit, x: number, z: number, y: number, color: string) {
  k.cyl(0.025, 0.7, C.metal, x, y, z, 5);
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.22, 8), new THREE.MeshStandardMaterial({ color, flatShading: true }));
  top.position.set(x, y + 0.8, z);
  k.add(top);
  k.cyl(0.26, 0.03, '#e9e4d6', x, y + 0.26, z, 10);
  k.cyl(0.04, 0.26, C.metal, x, y, z, 5);
}

function cookhouse(level: number): Kit {
  const k = new Kit();
  const y = k.pad(5, 4);
  if (level === 1) {
    // Field cookhouse: open-sided shelter with long tables, kitchen shed behind.
    const sz = 0.35;
    for (const x of [-1.75, -0.6, 0.6, 1.75]) for (const z of [-0.85, 0.85]) k.box(0.08, 0.85, 0.08, C.white, x, y, sz + z);
    k.gableRoof(3.6, 1.8, 0.45, 0, y + 0.85, sz, C.roofGreen);
    for (const z of [-0.45, 0.15, 0.75]) for (const x of [-0.85, 0.85]) k.diningTable(x, sz + z - 0.15, 1.2, y);
    // Kitchen shed
    const kz = -1.38;
    const h = k.block(2.4, 0.85, 1, -0.5, y, kz);
    k.gableRoof(2.4, 0.85, 0.3, -0.5, y + h, kz, C.zinc);
    k.chimney(-1.2, y + h, kz, 0.55, 'steam');
    k.box(2.0, 0.32, 0.3, '#b9bec2', -0.5, y, kz + 0.58); // serving counter
    k.gasCylinders(1.55, -1.4, 3, y);
    k.waterPoint(-2.05, 1.5, y);
    k.bin(2.1, 1.6, y);
    k.bin(1.85, 1.6, y, '#2f5a8a');
  } else {
    const big = level === 3;
    const hw = big ? 4.3 : 3.8, hd = big ? 2.1 : 1.9, hz = big ? 0.15 : 0.3;
    const h = k.block(hw, hd, 1, 0, y, hz) + (big ? 0.15 : 0);
    if (big) k.box(hw, 0.15, hd, C.wall, 0, y + STOREY, hz);
    k.gableRoof(hw, hd, 0.55, 0, y + h, hz);
    if (big) {
      // Raised clerestory over the hall for light and air
      k.box(2.8, 0.3, 0.7, C.wall, 0, y + h + 0.32, hz);
      k.windowRow('front', 0, hz, 2.8, 0.7, 6, y + h + 0.4, { ww: 0.3, wh: 0.16, louvre: true, span: 2.4 });
      k.gableRoof(2.8, 0.7, 0.25, 0, y + h + 0.62, hz);
    }
    k.windowRow('front', 0, hz, hw, hd, big ? 6 : 5, y + 0.45, { louvre: true, skip: big ? [2, 3] : [2] });
    k.windowRow('left', 0, hz, hw, hd, 2, y + 0.45, { louvre: true });
    k.windowRow('right', 0, hz, hw, hd, 2, y + 0.45, { louvre: true });
    for (const dx of [-0.22, 0.22]) k.door('front', 0, hz, hw, hd, dx, y, 0.42, 0.66);
    // Kitchen block at the back
    const kw = big ? 3.4 : 2.8, kd = 0.85, kz = hz - hd / 2 - kd / 2;
    const kh = k.block(kw, kd, 1, -0.3, y, kz, C.wallAlt);
    k.flatRoof(kw, kd, -0.3, y + kh, kz);
    k.chimney(-1.3, y + kh, kz, 0.55, 'steam');
    k.chimney(0.4, y + kh, kz, 0.45, 'smoke');
    k.box(0.5, 0.18, 0.4, '#b9bec2', -0.5, y + kh + 0.06, kz); // exhaust hood
    k.shutter('right', -0.3, kz, kw, kd, 0, 0.6, 0.62);
    k.gasCylinders(2.15, kz - 0.05, big ? 4 : 3, y);
    // Covered queue line to the doors
    k.linkway(-2.3, hz + hd / 2 + 0.45, -0.35, hz + hd / 2 + 0.45, y);
    k.waterPoint(-2.05, 1.7, y);
    k.bin(1.9, 1.65, y);
    k.bin(2.15, 1.65, y, '#2f5a8a');
    if (big) {
      // Solar water heater on the kitchen roof
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.04, 0.5), new THREE.MeshStandardMaterial({ color: '#284a73', flatShading: true, roughness: 0.4 }));
      p.position.set(1.0, y + kh + 0.3, kz);
      p.rotation.x = -0.5;
      k.add(p);
      k.cyl(0.08, 0.7, '#e8e6e0', 1.0, y + kh + 0.38, kz - 0.28, 8);
      umbrella(k, 0.9, 1.65, y, PALETTE.accentOrange);
      umbrella(k, 1.85, 1.0, y, PALETTE.accentTeal);
      k.lamp(-2.35, 0.2, y);
    } else {
      k.bench(1.2, 1.65, 0.9, y);
    }
  }
  return k;
}

export const BUILDINGS: BuildingDef[] = [
  { id: 'hq', name: 'HQ', footprint: [5, 5], maxLevel: 3, build: hq },
  { id: 'bunk', name: 'Bunk', footprint: [6, 4], maxLevel: 3, build: bunk },
  { id: 'cookhouse', name: 'Cookhouse', footprint: [5, 4], maxLevel: 3, build: cookhouse },
];
