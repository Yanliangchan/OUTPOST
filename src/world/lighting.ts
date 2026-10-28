import * as THREE from 'three';
import { PALETTE } from '../config/palette';

/** Warm late-morning sun with soft shadows and a sky/grass hemisphere fill. */
export function createLighting(): THREE.Group {
  const g = new THREE.Group();
  g.name = 'lighting';
  g.add(new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.35));
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.6);
  // Light from the upper-left of the default view so shadows fall down-right, as in the reference.
  sun.position.set(-40, 70, 20);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  const s = sun.shadow.camera;
  s.left = -75; s.right = 75; s.top = 75; s.bottom = -75; s.near = 1; s.far = 220;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  g.add(sun, sun.target);
  return g;
}
