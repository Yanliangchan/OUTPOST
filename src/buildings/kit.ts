import * as THREE from 'three';
import { PALETTE } from '../config/palette';
import { timeUniform } from '../core/wind';

/**
 * Architecture kit for the SAF-camp look: cream walls, dark green trim and doors,
 * red-brown roofs, yellow/black kerbs. Every building is assembled from these parts
 * so proportions and materials stay consistent.
 *
 * Conventions: origin at the footprint centre on the ground, +z is the front.
 * 1 unit = 1 tile. A storey is STOREY tall.
 */
export const STOREY = 0.95;

export const C = {
  wall: PALETTE.cream,
  wallAlt: PALETTE.offWhite,
  trim: PALETTE.trimGreen,
  roof: PALETTE.roofRedBrown,
  roofDark: '#7d3b27',
  roofGreen: PALETTE.roofGreen,
  zinc: '#9aa3a6',
  concrete: PALETTE.concrete,
  pad: '#d9d4c8',
  kerbY: PALETTE.kerbYellow,
  kerbB: PALETTE.kerbBlack,
  glass: '#3d5a6c',
  glassLight: '#6f93a6',
  frame: PALETTE.trimGreen,
  sill: '#f4f1e8',
  wood: PALETTE.wood,
  metal: '#8a9196',
  dark: '#33383d',
  white: '#f7f5ef',
};

/**
 * Build a geometry from a triangle soup, flipping any triangle whose normal
 * points toward `centre` so every face points outward (correct flat shading).
 */
function outwardGeo(tris: THREE.Vector3[], centre: THREE.Vector3) {
  const out: THREE.Vector3[] = [];
  const n = new THREE.Vector3();
  const mid = new THREE.Vector3();
  for (let i = 0; i < tris.length; i += 3) {
    const [a, b, c] = [tris[i], tris[i + 1], tris[i + 2]];
    n.crossVectors(new THREE.Vector3().subVectors(b, a), new THREE.Vector3().subVectors(c, a));
    mid.copy(a).add(b).add(c).divideScalar(3).sub(centre);
    if (n.dot(mid) < 0) out.push(a, c, b);
    else out.push(a, b, c);
  }
  const geo = new THREE.BufferGeometry().setFromPoints(out);
  geo.computeVertexNormals();
  return geo;
}

const cache = new Map<string, THREE.MeshStandardMaterial>();
export function mat(color: string, opts: THREE.MeshStandardMaterialParameters = {}) {
  const key = color + JSON.stringify(opts);
  let m = cache.get(key);
  if (!m) cache.set(key, (m = new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.8, metalness: 0, ...opts })));
  return m;
}

export type Face = 'front' | 'back' | 'left' | 'right';

/** Wraps a group with helpers for placing kit parts. */
export class Kit {
  readonly group = new THREE.Group();
  /** World-space-relative points where smoke/steam can be emitted. */
  readonly emitters: { pos: THREE.Vector3; kind: 'steam' | 'smoke' }[] = [];
  /** Animated sub-objects (flags etc.). */
  readonly flags: THREE.Mesh[] = [];

  add<T extends THREE.Object3D>(o: T, parent: THREE.Object3D = this.group): T {
    o.traverse((c) => {
      if (c instanceof THREE.Mesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    parent.add(o);
    return o;
  }

  /** Box with its base at y. */
  box(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, parent?: THREE.Object3D) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
    m.position.set(x, y + h / 2, z);
    return this.add(m, parent);
  }

  cyl(r: number, h: number, color: string, x = 0, y = 0, z = 0, sides = 8, rTop = r) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, r, h, sides), mat(color));
    m.position.set(x, y + h / 2, z);
    return this.add(m);
  }

  // ---------------- Ground ----------------

  /** Concrete pad with the classic painted yellow/black kerb around the edge. */
  pad(w: number, d: number, h = 0.08) {
    this.box(w - 0.12, h, d - 0.12, C.pad, 0, 0, 0);
    const seg = 0.36;
    const kerb = (len: number, horiz: boolean, offset: number) => {
      const n = Math.max(2, Math.round(len / seg));
      const s = len / n;
      for (let i = 0; i < n; i++) {
        const t = -len / 2 + s * (i + 0.5);
        const color = i % 2 ? C.kerbB : C.kerbY;
        if (horiz) this.box(s, h + 0.05, 0.12, color, t, 0, offset);
        else this.box(0.12, h + 0.05, s, color, offset, 0, t);
      }
    };
    kerb(w, true, d / 2 - 0.06);
    kerb(w, true, -d / 2 + 0.06);
    kerb(d - 0.24, false, w / 2 - 0.06);
    kerb(d - 0.24, false, -w / 2 + 0.06);
    return h;
  }

  /** A painted path strip on the pad (walkway markings). */
  path(w: number, d: number, x: number, z: number, y = 0.08) {
    return this.box(w, 0.012, d, '#c9c3b5', x, y, z);
  }

  // ---------------- Walls ----------------

  /**
   * Building block: cream walls, green dado band at the base, a storey line
   * between floors and a cornice at the top.
   */
  block(w: number, d: number, storeys: number, x = 0, y = 0, z = 0, wall: string = C.wall) {
    const h = storeys * STOREY;
    this.box(w, h, d, wall, x, y, z);
    this.box(w + 0.03, 0.16, d + 0.03, C.trim, x, y, z);
    for (let s = 1; s < storeys; s++) this.box(w + 0.05, 0.06, d + 0.05, C.trim, x, y + s * STOREY - 0.03, z);
    this.box(w + 0.06, 0.07, d + 0.06, C.white, x, y + h - 0.07, z);
    return h;
  }

  /** Face-relative placement helper for windows/doors on a block. */
  private onFace(face: Face, bx: number, bz: number, w: number, d: number, along: number) {
    const out = 0.02;
    switch (face) {
      case 'front': return { x: bx + along, z: bz + d / 2 + out, rotY: 0 };
      case 'back': return { x: bx - along, z: bz - d / 2 - out, rotY: Math.PI };
      case 'left': return { x: bx - w / 2 - out, z: bz + along, rotY: -Math.PI / 2 };
      default: return { x: bx + w / 2 + out, z: bz - along, rotY: Math.PI / 2 };
    }
  }

  /** Window with green frame, glass and white sill. `louvre` adds horizontal slats. */
  window(face: Face, bx: number, bz: number, bw: number, bd: number, along: number, y: number, ww = 0.38, wh = 0.36, louvre = false) {
    const p = this.onFace(face, bx, bz, bw, bd, along);
    const g = new THREE.Group();
    g.position.set(p.x, y, p.z);
    g.rotation.y = p.rotY;
    this.box(ww + 0.08, wh + 0.08, 0.04, C.frame, 0, -0.04, 0, g);
    this.box(ww, wh, 0.05, C.glass, 0, 0, 0.005, g);
    this.box(0.03, wh, 0.055, C.frame, 0, 0, 0.006, g);
    if (louvre) for (let i = 1; i < 4; i++) this.box(ww, 0.02, 0.06, C.glassLight, 0, (wh / 4) * i - 0.01, 0.01, g);
    this.box(ww + 0.12, 0.04, 0.09, C.sill, 0, -0.07, 0.03, g);
    return this.add(g);
  }

  /** A row of windows evenly spaced along a face. */
  windowRow(face: Face, bx: number, bz: number, bw: number, bd: number, count: number, y: number, opts: { ww?: number; wh?: number; louvre?: boolean; skip?: number[]; span?: number } = {}) {
    const len = opts.span ?? (face === 'front' || face === 'back' ? bw : bd) * 0.82;
    for (let i = 0; i < count; i++) {
      if (opts.skip?.includes(i)) continue;
      const along = count === 1 ? 0 : -len / 2 + (len / (count - 1)) * i;
      this.window(face, bx, bz, bw, bd, along, y, opts.ww, opts.wh, opts.louvre);
    }
  }

  door(face: Face, bx: number, bz: number, bw: number, bd: number, along: number, y = 0, dw = 0.36, dh = 0.62, color: string = C.trim) {
    const p = this.onFace(face, bx, bz, bw, bd, along);
    const g = new THREE.Group();
    g.position.set(p.x, y, p.z);
    g.rotation.y = p.rotY;
    this.box(dw + 0.08, dh + 0.05, 0.04, C.white, 0, 0, 0, g);
    this.box(dw, dh, 0.06, color, 0, 0, 0.005, g);
    this.box(0.03, 0.03, 0.08, '#d8c26a', dw / 2 - 0.07, dh * 0.48, 0.01, g);
    return this.add(g);
  }

  /** Roller shutter (loading bays, garages). */
  shutter(face: Face, bx: number, bz: number, bw: number, bd: number, along: number, sw: number, sh: number) {
    const p = this.onFace(face, bx, bz, bw, bd, along);
    const g = new THREE.Group();
    g.position.set(p.x, 0.08, p.z);
    g.rotation.y = p.rotY;
    this.box(sw + 0.1, sh + 0.06, 0.04, C.trim, 0, 0, 0, g);
    this.box(sw, sh, 0.06, '#a7adb1', 0, 0, 0.005, g);
    for (let i = 1; i < 7; i++) this.box(sw, 0.015, 0.07, '#8f969b', 0, (sh / 7) * i, 0.006, g);
    return this.add(g);
  }

  // ---------------- Roofs ----------------

  /** Hip roof: four sloped faces, ridge along the longer side, with a dark ridge cap. */
  hipRoof(w: number, d: number, h: number, x = 0, y = 0, z = 0, color: string = C.roof, overhang = 0.18) {
    const W = w / 2 + overhang;
    const D = d / 2 + overhang;
    const alongX = w >= d;
    const r = alongX ? Math.max(0, W - D) : Math.max(0, D - W);
    const r0 = alongX ? new THREE.Vector3(-r, h, 0) : new THREE.Vector3(0, h, -r);
    const r1 = alongX ? new THREE.Vector3(r, h, 0) : new THREE.Vector3(0, h, r);
    const a = new THREE.Vector3(-W, 0, D);
    const b = new THREE.Vector3(W, 0, D);
    const c = new THREE.Vector3(W, 0, -D);
    const e = new THREE.Vector3(-W, 0, -D);
    // Long faces are trapezoids (two tris), ends are triangles; orientation is fixed below.
    const faces = alongX
      ? [a, b, r1, a, r1, r0, c, e, r0, c, r0, r1, b, c, r1, e, a, r0]
      : [b, c, r0, b, r0, r1, e, a, r1, e, r1, r0, a, b, r1, c, e, r0];
    const geo = outwardGeo(faces, new THREE.Vector3(0, -1, 0));
    const m = new THREE.Mesh(geo, mat(color));
    m.position.set(x, y, z);
    this.add(m);
    // Eaves fascia and ridge cap
    this.box(2 * W, 0.06, 2 * D, C.trim, x, y - 0.06, z);
    const len = 2 * r + 0.08;
    if (len > 0.1) this.box(alongX ? len : 0.08, 0.05, alongX ? 0.08 : len, C.roofDark, x, y + h - 0.02, z);
    return m;
  }

  /** Gable roof with the ridge along x (rotate the kit group for other directions). */
  gableRoof(w: number, d: number, h: number, x = 0, y = 0, z = 0, color: string = C.roof, overhang = 0.18) {
    const W = w / 2 + overhang;
    const D = d / 2 + overhang;
    const v = (px: number, py: number, pz: number) => new THREE.Vector3(px, py, pz);
    const tris = [
      v(-W, 0, D), v(W, 0, D), v(W, h, 0), v(-W, 0, D), v(W, h, 0), v(-W, h, 0),
      v(W, 0, -D), v(-W, 0, -D), v(-W, h, 0), v(W, 0, -D), v(-W, h, 0), v(W, h, 0),
    ];
    const roof = new THREE.Mesh(outwardGeo(tris, new THREE.Vector3(0, -1, 0)), mat(color));
    roof.position.set(x, y, z);
    this.add(roof);
    // Gable end walls (triangles) in wall colour
    const ends = [v(-w / 2, 0, d / 2), v(-w / 2, h * (d / 2) / D, 0), v(-w / 2, 0, -d / 2), v(w / 2, 0, -d / 2), v(w / 2, h * (d / 2) / D, 0), v(w / 2, 0, d / 2)];
    const gable = new THREE.Mesh(outwardGeo(ends, new THREE.Vector3(0, 0.1, 0)), mat(C.wall));
    gable.position.set(x, y, z);
    this.add(gable);
    this.box(2 * W + 0.04, 0.05, 0.09, C.roofDark, x, y + h - 0.03, z);
    this.box(2 * W, 0.05, 2 * D, C.trim, x, y - 0.05, z);
  }

  /** Flat roof slab with a low parapet. */
  flatRoof(w: number, d: number, x = 0, y = 0, z = 0, parapet = 0.14) {
    this.box(w + 0.06, 0.06, d + 0.06, '#bdb8ad', x, y, z);
    for (const [pw, pd, px, pz] of [[w + 0.06, 0.06, 0, d / 2], [w + 0.06, 0.06, 0, -d / 2], [0.06, d, w / 2, 0], [0.06, d, -w / 2, 0]]) {
      this.box(pw, parapet, pd, C.white, x + px, y + 0.06, z + pz);
    }
  }

  // ---------------- Structures ----------------

  /** Covered link-way: white posts with a green roof slab — the camp's signature walkway. */
  linkway(x0: number, z0: number, x1: number, z1: number, y = 0.08, h = 0.72, width = 0.7) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const g = new THREE.Group();
    g.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    g.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    const n = Math.max(2, Math.round(len / 1.2) + 1);
    for (let i = 0; i < n; i++) {
      const t = -len / 2 + (len / (n - 1)) * i;
      for (const s of [-1, 1]) this.box(0.06, h, 0.06, C.white, t, 0, (s * width) / 2 - s * 0.05, g);
    }
    this.box(len + 0.2, 0.06, width + 0.2, C.roofGreen, 0, h, 0, g);
    this.box(len + 0.22, 0.03, width + 0.22, C.trim, 0, h - 0.02, 0, g);
    this.box(len, 0.012, width, '#c9c3b5', 0, 0, 0, g);
    return this.add(g);
  }

  /** Porch canopy on columns in front of a door. */
  porch(x: number, z: number, w: number, d: number, h: number, y = 0.08, cols = 2, roof: string = C.roofGreen) {
    for (let i = 0; i < cols; i++) {
      const cx = cols === 1 ? 0 : -w / 2 + 0.1 + ((w - 0.2) / (cols - 1)) * i;
      this.box(0.09, h, 0.09, C.white, x + cx, y, z + d / 2 - 0.08);
    }
    this.box(w + 0.1, 0.08, d + 0.1, roof, x, y + h, z);
    this.box(w + 0.12, 0.04, d + 0.12, C.white, x, y + h - 0.03, z);
    this.box(w, 0.05, d, '#c9c3b5', x, y, z); // step
  }

  /** External corridor with railing along the front of a storey (bunk blocks). */
  corridor(x: number, z: number, w: number, depth: number, y: number) {
    this.box(w, 0.07, depth, '#cfc9bc', x, y - 0.07, z);
    this.box(w, 0.32, 0.05, C.white, x, y, z + depth / 2 - 0.025); // parapet wall
    this.box(w + 0.02, 0.04, 0.08, C.trim, x, y + 0.32, z + depth / 2 - 0.025);
  }

  stairs(x: number, z: number, w: number, d: number, h: number, alongX = false) {
    const steps = Math.max(3, Math.round(h / 0.12));
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      if (alongX) this.box(d / steps, h * (1 - t), w, '#c2bcae', x - d / 2 + (d / steps) * (i + 0.5), 0, z);
      else this.box(w, h * (1 - t), d / steps, '#c2bcae', x, 0, z - d / 2 + (d / steps) * (i + 0.5));
    }
  }

  // ---------------- Details ----------------

  /** Outdoor aircon condenser unit — a ubiquitous Singapore detail. */
  aircon(x: number, y: number, z: number, rotY = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    this.box(0.32, 0.24, 0.14, '#ecebe6', 0, 0, 0, g);
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.01, 10).rotateX(Math.PI / 2), mat('#7a8085'));
    fan.position.set(-0.04, 0.12, 0.075);
    g.add(fan);
    this.box(0.36, 0.02, 0.18, C.metal, 0, -0.02, 0, g);
    return this.add(g);
  }

  waterTank(x: number, y: number, z: number, r = 0.22, h = 0.34) {
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.box(0.04, 0.3, 0.04, C.metal, x + dx * r * 0.7, y, z + dz * r * 0.7);
    this.cyl(r, h, '#e8e6e0', x, y + 0.3, z, 10);
    this.cyl(r * 1.02, 0.04, C.trim, x, y + 0.3 + h, z, 10);
  }

  antenna(x: number, y: number, z: number, h = 1.1) {
    this.cyl(0.025, h, C.metal, x, y, z, 5);
    for (let i = 1; i <= 3; i++) this.box(0.26 - i * 0.05, 0.015, 0.015, C.metal, x, y + h * (i / 4), z);
    this.cyl(0.03, 0.05, '#e04a3a', x, y + h, z, 6);
  }

  dish(x: number, y: number, z: number, rotY = 0.6) {
    this.cyl(0.03, 0.18, C.metal, x, y, z, 5);
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 4, 0, Math.PI * 2, 0, Math.PI / 3), mat('#f2f2ee', { side: THREE.DoubleSide }));
    d.position.set(x, y + 0.32, z);
    d.rotation.set(-1.1, rotY, 0);
    this.add(d);
  }

  /** Flagpole with a waving flag (plain camp colours, no real insignia). */
  flagpole(x: number, z: number, h = 2.2, y = 0.08) {
    this.box(0.36, 0.1, 0.36, C.concrete, x, y, z);
    this.cyl(0.025, h, C.white, x, y + 0.1, z, 6);
    this.cyl(0.04, 0.05, '#e3c050', x, y + 0.1 + h, z, 6);
    const geo = new THREE.PlaneGeometry(0.62, 0.38, 8, 1).translate(0.31, 0, 0);
    // Two-band flag: camp green over white, drawn with vertex colours.
    const cols: number[] = [];
    const pos = geo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const c = new THREE.Color(pos.getY(i) > 0 ? C.trim : C.white);
      cols.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const fm = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true, roughness: 0.9 });
    fm.onBeforeCompile = (s) => {
      s.uniforms.uTime = timeUniform;
      s.vertexShader = 'uniform float uTime;\n' + s.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        transformed.z += sin(position.x * 9.0 - uTime * 6.0) * 0.06 * position.x;
        transformed.y -= position.x * position.x * 0.12;`,
      );
    };
    const flag = new THREE.Mesh(geo, fm);
    flag.position.set(x + 0.03, y + h - 0.12, z);
    this.add(flag);
    this.flags.push(flag);
  }

  /** Concrete planter with flowering bougainvillea. */
  planter(x: number, z: number, w = 0.6, y = 0.08, flower: string = PALETTE.bougainvillea) {
    this.box(w, 0.2, 0.28, '#d0cabd', x, y, z);
    for (let i = 0; i < Math.max(2, Math.round(w / 0.25)); i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), mat(i % 2 ? PALETTE.leafB : flower));
      b.position.set(x - w / 2 + 0.15 + i * 0.22, y + 0.3, z + (i % 2 ? 0.03 : -0.03));
      b.scale.set(1, 0.8, 1);
      this.add(b);
    }
  }

  noticeboard(x: number, z: number, rotY = 0, y = 0.08) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    for (const s of [-0.28, 0.28]) this.box(0.04, 0.6, 0.04, C.trim, s, 0, 0, g);
    this.box(0.66, 0.38, 0.05, C.trim, 0, 0.36, 0, g);
    this.box(0.58, 0.3, 0.055, '#c79a5b', 0, 0.4, 0.004, g);
    const papers = ['#ffffff', '#fff3a8', '#d7ecff', '#ffffff'];
    papers.forEach((c, i) => this.box(0.1, 0.13, 0.06, c, -0.2 + i * 0.13, 0.48 - (i % 2) * 0.04, 0.006, g));
    this.box(0.7, 0.05, 0.12, C.roofGreen, 0, 0.76, 0.02, g);
    return this.add(g);
  }

  lamp(x: number, z: number, y = 0.08, h = 1.3) {
    this.cyl(0.025, h, C.trim, x, y, z, 6);
    this.box(0.26, 0.04, 0.06, C.trim, x + 0.1, y + h, z);
    this.box(0.12, 0.04, 0.08, '#fff2c0', x + 0.18, y + h - 0.03, z);
  }

  /** Signboard plaque with lettering (building name). */
  plaque(text: string, x: number, z: number, y = 0.08, w = 0.9) {
    for (const s of [-w / 2 + 0.05, w / 2 - 0.05]) this.box(0.05, 0.42, 0.05, '#bdb8ad', x + s, y, z);
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 96;
    const g = c.getContext('2d')!;
    g.fillStyle = C.trim;
    g.fillRect(0, 0, 256, 96);
    g.strokeStyle = '#e3c050';
    g.lineWidth = 6;
    g.strokeRect(6, 6, 244, 84);
    g.fillStyle = '#ffffff';
    g.font = '900 46px Nunito, system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(text, 128, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.BoxGeometry(w, w * 0.375, 0.05), [
      mat(C.trim), mat(C.trim), mat(C.trim), mat(C.trim), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }), mat(C.trim),
    ]);
    board.position.set(x, y + 0.42 + (w * 0.375) / 2, z);
    this.add(board);
  }

  /** Clothes line with towels and PT kit drying — a small slice of bunk life. */
  clothesLine(x: number, z: number, len: number, y = 0.08, rotY = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    for (const s of [-len / 2, len / 2]) this.box(0.04, 0.62, 0.04, C.metal, s, 0, 0, g);
    this.box(len, 0.012, 0.012, '#dddddd', 0, 0.6, 0, g);
    const colors = ['#4b6b3a', '#ffffff', '#ff8a3d', '#4b6b3a', '#2f5a8a', '#ffffff', '#4b6b3a'];
    const n = Math.max(3, Math.floor(len / 0.2));
    for (let i = 0; i < n; i++) {
      const w = 0.12 + (i % 3) * 0.03;
      this.box(w, 0.16 + (i % 2) * 0.06, 0.01, colors[i % colors.length], -len / 2 + 0.15 + i * ((len - 0.3) / (n - 1)), 0.6 - 0.2 - (i % 2) * 0.06, 0, g);
    }
    return this.add(g);
  }

  /** Chimney/exhaust stack; registers a steam/smoke emitter at its top. */
  chimney(x: number, y: number, z: number, h = 0.5, kind: 'steam' | 'smoke' = 'steam') {
    this.box(0.16, h, 0.16, '#bdb8ad', x, y, z);
    this.box(0.2, 0.05, 0.2, C.dark, x, y + h, z);
    this.emitters.push({ pos: new THREE.Vector3(x, y + h + 0.1, z), kind });
  }

  gasCylinders(x: number, z: number, n = 4, y = 0.08) {
    this.box(0.18 * n + 0.1, 0.02, 0.32, C.metal, x, y, z);
    for (let i = 0; i < n; i++) {
      this.cyl(0.07, 0.38, '#e0622c', x - (0.18 * (n - 1)) / 2 + i * 0.18, y + 0.02, z, 8);
      this.cyl(0.03, 0.05, C.metal, x - (0.18 * (n - 1)) / 2 + i * 0.18, y + 0.4, z, 6);
    }
    // Cage
    this.box(0.18 * n + 0.14, 0.02, 0.36, C.trim, x, y + 0.48, z);
  }

  /** Yellow insulated drinks cooler on a stand ("water point"). */
  waterPoint(x: number, z: number, y = 0.08) {
    this.box(0.4, 0.3, 0.26, '#8a9196', x, y, z);
    this.cyl(0.11, 0.24, '#ffc93c', x - 0.08, y + 0.3, z, 10);
    this.cyl(0.11, 0.24, '#2bb3a3', x + 0.12, y + 0.3, z, 10);
  }

  bench(x: number, z: number, len: number, y = 0.08, rotY = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    this.box(len, 0.04, 0.12, C.wood, 0, 0.16, 0, g);
    for (const s of [-len / 2 + 0.08, len / 2 - 0.08]) this.box(0.04, 0.16, 0.1, C.metal, s, 0, 0, g);
    return this.add(g);
  }

  /** Long dining table with benches either side. */
  diningTable(x: number, z: number, len: number, y = 0.08, rotY = 0) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    this.box(len, 0.04, 0.3, '#e9e4d6', 0, 0.26, 0, g);
    for (const s of [-len / 2 + 0.1, len / 2 - 0.1]) this.box(0.05, 0.26, 0.24, C.metal, s, 0, 0, g);
    for (const side of [-0.28, 0.28]) {
      this.box(len, 0.035, 0.1, C.wood, 0, 0.15, side, g);
      for (const s of [-len / 2 + 0.1, len / 2 - 0.1]) this.box(0.04, 0.15, 0.08, C.metal, s, 0, side, g);
    }
    return this.add(g);
  }

  bin(x: number, z: number, y = 0.08, color: string = "#3f7d4a") {
    this.box(0.2, 0.28, 0.2, color, x, y, z);
    this.box(0.22, 0.04, 0.22, C.dark, x, y + 0.28, z);
  }

  bicycleRack(x: number, z: number, n = 3, y = 0.08) {
    this.box(0.25 * n, 0.03, 0.04, C.metal, x, y + 0.2, z);
    for (let i = 0; i < n; i++) {
      const bx = x - (0.25 * (n - 1)) / 2 + i * 0.25;
      for (const dz of [-0.12, 0.12]) {
        const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 4, 10), mat(C.dark));
        wheel.position.set(bx, y + 0.09, z + dz);
        wheel.rotation.y = Math.PI / 2;
        this.add(wheel);
      }
      this.box(0.02, 0.02, 0.24, ['#d8342c', '#2f5a8a', '#3f7d4a'][i % 3], bx, y + 0.16, z);
    }
  }
}
