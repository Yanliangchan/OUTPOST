import * as THREE from 'three';
import { PALETTE } from '../config/palette';
import { WORLD } from '../config/world';
import { timeUniform } from '../core/wind';

/** Faceted, gently rolling sea plus a deep-ocean floor beyond the terrain mesh. */
export function createWater(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'water';

  const geo = new THREE.PlaneGeometry(420, 420, 140, 140);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: PALETTE.water,
    transparent: true,
    opacity: 0.72,
    roughness: 0.25,
    metalness: 0.05,
    flatShading: true,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec4 wp = modelMatrix * vec4(position, 1.0);
      transformed.y += sin(wp.x * 0.42 + uTime * 1.1) * 0.06 + cos(wp.z * 0.37 + uTime * 0.85) * 0.06
                     + sin((wp.x + wp.z) * 0.9 + uTime * 1.7) * 0.025;`,
    );
  };
  const sea = new THREE.Mesh(geo, mat);
  sea.position.y = WORLD.waterLevel;
  sea.receiveShadow = true;
  sea.renderOrder = 1;
  group.add(sea);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: PALETTE.seabedDeep, roughness: 1 }),
  );
  floor.position.y = -5;
  group.add(floor);
  return group;
}
