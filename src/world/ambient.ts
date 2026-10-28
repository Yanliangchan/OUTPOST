import * as THREE from 'three';
import { mulberry32 } from '../core/rng';
import { WORLD } from '../config/world';

export interface Ambient {
  group: THREE.Group;
  update(dt: number, t: number): void;
}

/** Circling seagulls. (Cloud shadows are shader-based: see core/cloudShadow.ts.) */
export function createAmbient(): Ambient {
  const rand = mulberry32(WORLD.seed + 900);
  const group = new THREE.Group();
  group.name = 'ambient';

  // ---- Seagulls ----
  const birdMat = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, side: THREE.DoubleSide, roughness: 0.8 });
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.12, 0, 0, 0.12, 0.55, 0.05, 0.02], 3));
  wingGeo.computeVertexNormals();
  const bodyGeo = new THREE.ConeGeometry(0.07, 0.42, 4).rotateX(Math.PI / 2);
  const birds: { obj: THREE.Group; l: THREE.Mesh; r: THREE.Mesh; cx: number; cz: number; rad: number; h: number; spd: number; ph: number }[] = [];
  for (let b = 0; b < 9; b++) {
    const obj = new THREE.Group();
    const body = new THREE.Mesh(bodyGeo, birdMat);
    const l = new THREE.Mesh(wingGeo, birdMat);
    const r = new THREE.Mesh(wingGeo, birdMat);
    r.scale.x = -1;
    obj.add(body, l, r);
    obj.scale.setScalar(1.3);
    body.castShadow = l.castShadow = r.castShadow = true;
    group.add(obj);
    const flock = b % 3;
    birds.push({
      obj, l, r,
      cx: [-20, 25, 5][flock] + (rand() - 0.5) * 4,
      cz: [30, -10, -35][flock] + (rand() - 0.5) * 4,
      rad: 7 + rand() * 6,
      h: 9 + rand() * 4,
      spd: (0.25 + rand() * 0.15) * (flock === 1 ? -1 : 1),
      ph: rand() * Math.PI * 2,
    });
  }

  return {
    group,
    update(_dt, t) {
      for (const b of birds) {
        const a = t * b.spd + b.ph;
        b.obj.position.set(b.cx + Math.cos(a) * b.rad, b.h + Math.sin(a * 2.3) * 0.4, b.cz + Math.sin(a) * b.rad);
        // Face along the direction of travel.
        b.obj.rotation.y = -a + (b.spd > 0 ? Math.PI : 0);
        const flap = Math.sin(t * 9 + b.ph * 3) * 0.55 * (0.5 + 0.5 * Math.sin(t * 0.7 + b.ph));
        b.l.rotation.z = flap;
        b.r.rotation.z = -flap;
      }
    },
  };
}
