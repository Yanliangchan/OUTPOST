import * as THREE from 'three';
import { PALETTE } from '../config/palette';
import { WORLD } from '../config/world';

/**
 * Greybox scale markers (NOT final art): a 5×5 HQ footprint, a 2×1 utility truck,
 * and three 0.6-tall residents. Lets us agree on proportions before Phase 2.
 */
export function createScaleReference(groundY: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'scaleReference';
  const mat = (c: string) => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.85 });
  const box = (w: number, h: number, d: number, c: string, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
    m.position.set(x, groundY + y + h / 2, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };

  // HQ greybox: concrete pad, two-storey block, flat roof with a teal parapet, covered walkway.
  box(5.4, 0.12, 5.4, PALETTE.concrete, 0, 0, 0);
  box(4.2, 1.9, 3.0, PALETTE.cream, 0, 0.12, -0.6);
  box(4.26, 0.12, 3.06, PALETTE.trimGreen, 0, 0.12, -0.6);
  box(4.4, 0.2, 3.2, PALETTE.roofRedBrown, 0, 2.02, -0.6);
  box(0.8, 0.9, 0.06, PALETTE.trimGreen, 0, 0.24, 0.92);
  box(3.0, 0.08, 1.2, PALETTE.roofGreen, 0, 1.2, 1.5);
  for (const x of [-1.3, 1.3]) box(0.1, 1.1, 0.1, PALETTE.offWhite, x, 0.12, 2.0);

  // Utility truck greybox (2×1 tiles)
  box(1.9, 0.55, 0.9, PALETTE.utilityGreen, 4.2, 0.2, 2.6);
  box(0.6, 0.45, 0.85, PALETTE.utilityGreen, 4.95, 0.75, 2.6);
  box(1.2, 0.5, 0.92, PALETTE.khaki, 3.9, 0.75, 2.6);

  // Residents: 0.6 units tall (~1 tile = 2.5 m world scale, people exaggerated ~1.4× for readability)
  const outfits = [PALETTE.utilityGreen, PALETTE.olive, PALETTE.accentOrange];
  outfits.forEach((c, i) => {
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.22, 2, 6), mat(c));
    body.position.set(2.2 + i * 0.45, groundY + 0.25, 3.2 + (i % 2) * 0.3);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.11, 0), mat('#e0ac7e'));
    head.position.set(body.position.x, groundY + 0.52, body.position.z);
    body.castShadow = head.castShadow = true;
    g.add(body, head);
  });
  g.visible = false;
  return g;
}

/** Faint build grid over the plateau, with the starter plot outlined. */
export function createBuildGrid(groundY: number): THREE.Group {
  const g = new THREE.Group();
  g.name = 'buildGrid';
  const half = WORLD.buildHalf;
  const pts: number[] = [];
  for (let t = -half; t <= half; t++) {
    pts.push(-half, 0, t, half, 0, t, t, 0, -half, t, 0, half);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22 }));
  lines.position.y = groundY + 0.02;
  g.add(lines);

  const s = WORLD.starterHalf;
  const edgeMat = new THREE.MeshBasicMaterial({ color: PALETTE.accentYellow, transparent: true, opacity: 0.85 });
  const strip = (w: number, d: number, x: number, z: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), edgeMat);
    m.position.set(x, groundY + 0.03, z);
    g.add(m);
  };
  strip(2 * s + 0.15, 0.15, 0, -s);
  strip(2 * s + 0.15, 0.15, 0, s);
  strip(0.15, 2 * s + 0.15, -s, 0);
  strip(0.15, 2 * s + 0.15, s, 0);
  g.visible = false;
  return g;
}
