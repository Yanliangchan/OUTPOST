import * as THREE from 'three';
import { PALETTE } from '../config/palette';
import { C, Kit, STOREY } from './kit';

import { HQ } from './hq';
import { BUNK } from './bunk';
import type { BuildingDef } from './types';

/**
 * Building catalogue. Footprints stay constant across upgrades (like CoC) so
 * upgrading never needs re-placement. Buildings are being brought up to the
 * full 15-level plan one at a time (see docs/BUILDINGS_PLAN.md).
 */

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
  HQ,
  // Early concepts (levels 1–3); full 15-level plans to follow building by building.
  BUNK,
  { id: 'cookhouse', name: 'Cookhouse', role: 'Feeds the outpost.', footprint: [5, 4], unlockHq: 1, levels: [], designedLevels: 3, build: cookhouse },
];
