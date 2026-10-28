import * as THREE from 'three';
import { C, Kit, STOREY } from './kit';

/* Shared architectural helpers used by every building's level designs. */

export const GOLD = '#d9b24a';
export const CONCRETE = '#d8d4cb';
export const DARK_GLASS = '#2f4a57';

export function frontWindows(k: Kit, bx: number, bz: number, bw: number, bd: number, floors: number, y: number, count: number, skip: number[] = [], louvreFrom = 1) {
  for (let f = 0; f < floors; f++) k.windowRow('front', bx, bz, bw, bd, count, y + f * STOREY + 0.42, { skip: f === 0 ? skip : [], louvre: f >= louvreFrom });
}

export function sideWindows(k: Kit, bx: number, bz: number, bw: number, bd: number, floors: number, y: number, n = 2) {
  for (let f = 0; f < floors; f++) {
    k.windowRow('left', bx, bz, bw, bd, n, y + f * STOREY + 0.42);
    k.windowRow('right', bx, bz, bw, bd, n, y + f * STOREY + 0.42);
  }
}

export function aircons(k: Kit, x: number, bz: number, floors: number, y: number, side: 1 | -1) {
  for (let f = 0; f < floors; f++) k.aircon(x + side * 0.08, y + f * STOREY + 0.25, bz - 0.35, (side * Math.PI) / 2);
}

export function clock(k: Kit, y: number, z: number) {
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f7f5ef', flatShading: true }));
  face.position.set(0, y, z + 0.04);
  k.add(face);
  k.cyl(0.215, 0.03, C.trim, 0, y - 0.015, z + 0.02, 16);
  // Hands pivot at the centre of the face; the minute hand turns visibly.
  const hand = (len: number, w: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.02).translate(0, len / 2, 0), new THREE.MeshStandardMaterial({ color: C.dark }));
    m.position.set(0, y, z + 0.07);
    k.add(m);
    return m;
  };
  const minute = hand(0.15, 0.02);
  const hour = hand(0.1, 0.025);
  k.anims.push((t) => {
    minute.rotation.z = -t * 0.5;
    hour.rotation.z = -t * 0.5 / 12;
  });
}

/** Gold belvedere crown with a pyramid and spire, sized by s. */
export function crown(k: Kit, x: number, y: number, z: number, s = 1) {
  k.box(1.56 * s, 0.12, 1.56 * s, GOLD, x, y, z);
  const cy = y + 0.12;
  for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.box(0.16, 0.85 * s, 0.16, C.white, x + cx * 0.45 * s, cy, z + cz * 0.45 * s);
  k.box(0.7 * s, 0.85 * s, 0.7 * s, '#5d8aa3', x, cy, z);
  k.box(1.2 * s, 0.1, 1.2 * s, GOLD, x, cy + 0.85 * s, z);
  k.hipRoof(1.1 * s, 1.1 * s, 0.6 * s, x, cy + 0.85 * s + 0.1, z, GOLD, 0.05);
  k.cyl(0.035, 0.7 * s, GOLD, x, cy + 0.85 * s + 0.6 * s, z, 6, 0.005);
}

export function bigDish(k: Kit, x: number, y: number, z: number, r: number, rotY = 0.7) {
  k.cyl(0.18, 0.5, C.metal, x, y, z, 8);
  k.box(0.6, 0.12, 0.6, C.metal, x, y, z);
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(r, 18, 6, 0, Math.PI * 2, 0, Math.PI / 3.3),
    new THREE.MeshStandardMaterial({ color: '#f4f4f0', flatShading: true, side: THREE.DoubleSide, roughness: 0.6 }),
  );
  dish.position.set(x, y + 0.55 + r, z);
  dish.rotation.set(-2.2, rotY, 0);
  k.add(dish);
  // Feed horn on a tripod
  const fy = y + 0.55 + r * 0.55;
  k.cyl(0.02, r * 0.9, C.metal, x + Math.sin(rotY) * r * 0.35, fy, z + Math.cos(rotY) * r * 0.35, 4);
  k.box(0.12, 0.12, 0.12, C.dark, x + Math.sin(rotY) * r * 0.45, fy + r * 0.9, z + Math.cos(rotY) * r * 0.45);
}

/** Gardens-by-the-Bay-style "supertree": steel trunk, flared planted canopy. */
export function supertree(k: Kit, x: number, z: number, h: number, y: number, color = '#8a5cb8') {
  k.cyl(0.16, h, '#6e6a78', x, y, z, 8, 0.07);
  for (let i = 0; i < 4; i++) k.box(0.06, h * 0.6, 0.02, '#4fae3a', x + Math.cos(i * 1.6) * 0.12, y + 0.2, z + Math.sin(i * 1.6) * 0.12);
  k.cyl(0.12, 0.35, color, x, y + h, z, 10, 0.6);
  k.cyl(0.62, 0.05, '#4fae3a', x, y + h + 0.35, z, 10);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    k.box(0.06, 0.06, 0.06, '#ffe48a', x + Math.cos(a) * 0.5, y + h + 0.36, z + Math.sin(a) * 0.5);
  }
}

/** Perimeter security: wall with mesh fence on top, gatehouse, boom gate, bollards, CCTV. */
export function perimeter(k: Kit, y: number, ex = 2.72, ez = 2.72, flags = true) {
  const e = ez, gate = 0.75, h = 0.32;
  const wall = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    k.box(along ? len : 0.14, h, along ? 0.14 : len, CONCRETE, cx, y, cz);
    k.box(along ? len : 0.16, 0.04, along ? 0.16 : len, C.trim, cx, y + h, cz);
    // Mesh fence: posts + thin top rail
    const n = Math.max(2, Math.round(len / 0.6));
    for (let i = 0; i <= n; i++) {
      const t = -len / 2 + (len / n) * i;
      k.box(0.03, 0.32, 0.03, C.metal, along ? cx + t : cx, y + h, along ? cz : cz + t);
    }
    k.box(along ? len : 0.02, 0.02, along ? 0.02 : len, C.metal, cx, y + h + 0.3, cz);
    k.box(along ? len : 0.01, 0.24, along ? 0.01 : len, '#9aa3a6', cx, y + h + 0.05, cz).material = new THREE.MeshStandardMaterial({ color: '#9aa3a6', transparent: true, opacity: 0.35 });
  };
  wall(-ex, -e, ex, -e);
  wall(-ex, -e, -ex, e);
  wall(ex, -e, ex, e);
  wall(-ex, e, -gate, e);
  wall(gate, e, ex, e);
  // Gatehouse + boom gate
  k.box(0.55, 0.62, 0.5, C.white, -gate - 0.4, y, e - 0.45);
  k.box(0.57, 0.18, 0.04, DARK_GLASS, -gate - 0.4, y + 0.36, e - 0.19);
  k.box(0.65, 0.06, 0.6, C.trim, -gate - 0.4, y + 0.62, e - 0.45);
  k.box(0.12, 0.3, 0.12, '#f2c230', -gate + 0.02, y, e);
  // Boom arm pivots at the post and lifts every so often to let a vehicle through.
  const boom = new THREE.Group();
  boom.position.set(-gate + 0.02, y + 0.26, e);
  for (let i = 0; i < 5; i++) k.box(0.28, 0.035, 0.035, i % 2 ? '#ffffff' : '#d8342c', 0.13 + i * 0.28, 0, 0, boom);
  k.add(boom);
  k.anims.push((t) => {
    const c = (t % 14) / 14;
    const up = c < 0.08 ? c / 0.08 : c < 0.3 ? 1 : c < 0.38 ? 1 - (c - 0.3) / 0.08 : 0;
    boom.rotation.z = up * up * (3 - 2 * up) * 1.35;
  });
  for (const x of [-0.45, -0.15, 0.15, 0.45]) k.cyl(0.04, 0.18, '#f2c230', x, y, e - 0.35, 6);
  // CCTV on poles at the rear corners
  for (const [x, z] of [[-ex + 0.15, -e + 0.15], [ex - 0.15, -e + 0.15], [ex - 0.15, e - 0.15]]) {
    k.cyl(0.025, 1.0, C.metal, x, y, z, 5);
    const cam = new THREE.Group();
    cam.position.set(x, y + 1.0, z);
    k.box(0.16, 0.07, 0.07, '#f4f4f0', 0.05, 0, 0.05, cam);
    k.box(0.03, 0.04, 0.03, '#33383d', 0.14, 0.01, 0.05, cam);
    k.add(cam);
    k.anims.push((t) => (cam.rotation.y = Math.sin(t * 0.4 + x + z) * 0.9));
  }
  if (flags) {
    k.flagpole(-1.6, e - 0.47, 2.2, y);
    k.flagpole(1.6, e - 0.47, 2.2, y);
  }
}

/** Concrete block with dark ribbon windows on the front and right; returns its height. */
export function ribbonBlock(k: Kit, x: number, z: number, w: number, d: number, floors: number, y: number) {
  const h = floors * STOREY;
  k.box(w, h, d, CONCRETE, x, y, z);
  for (let f = 0; f < floors; f++) {
    const fy = y + f * STOREY + 0.32;
    k.box(w - 0.3, 0.36, 0.04, DARK_GLASS, x, fy, z + d / 2 + 0.01);
    k.box(0.04, 0.36, d - 0.3, DARK_GLASS, x + w / 2 + 0.01, fy, z);
    k.box(w + 0.04, 0.06, d + 0.04, C.trim, x, y + f * STOREY, z);
  }
  k.box(w + 0.08, 0.1, d + 0.08, C.white, x, y + h, z);
  return h;
}


/** Rooftop solar canopy on slim posts: gives modern flat roofs presence without extra storeys. */
export function roofCanopy(k: Kit, w: number, d: number, x: number, y: number, z: number, h = 0.5) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) k.box(0.05, h, 0.05, C.metal, x + sx * (w / 2 - 0.1), y, z + sz * (d / 2 - 0.1));
  const p = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), new THREE.MeshStandardMaterial({ color: '#284a73', flatShading: true, roughness: 0.4 }));
  p.position.set(x, y + h, z);
  p.rotation.x = -0.08;
  p.castShadow = true;
  k.add(p);
  k.box(w + 0.04, 0.03, 0.04, C.white, x, y + h + 0.03, z + d / 2);
}

/**
 * Breeze-block screen: the patterned ventilation blocks of Singapore stairwells.
 * A wall panel in the x/y plane at local z, turned by rotY.
 */
export function breezeBlocks(k: Kit, w: number, h: number, x: number, y: number, z: number, rotY = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  k.box(w, h, 0.05, C.white, 0, 0, 0, g);
  const cell = 0.16;
  const nx = Math.max(1, Math.floor((w - 0.1) / cell));
  const ny = Math.max(1, Math.floor((h - 0.1) / cell));
  const geo = new THREE.BoxGeometry(cell * 0.62, cell * 0.62, 0.06);
  const holes = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: '#8f9a92', flatShading: true }), nx * ny);
  const m4 = new THREE.Matrix4();
  let i = 0;
  for (let a = 0; a < nx; a++) for (let b = 0; b < ny; b++) {
    m4.makeRotationZ(Math.PI / 4).setPosition(-((nx - 1) * cell) / 2 + a * cell, 0.08 + cell / 2 + b * cell, 0.0);
    holes.setMatrixAt(i++, m4);
  }
  g.add(holes);
  return k.add(g);
}
