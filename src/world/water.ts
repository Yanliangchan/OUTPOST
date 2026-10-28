import * as THREE from 'three';
import { PALETTE } from '../config/palette';
import { WORLD } from '../config/world';
import { timeUniform } from '../core/wind';
import { applyCloudShadow } from '../core/cloudShadow';
import type { Terrain } from './terrain';

const H_MIN = -6;
const H_MAX = 10;

/** Bake terrain heights into a texture so the water shader knows its depth. */
function heightTexture(terrain: Terrain) {
  const v = terrain.n + 1;
  const data = new Uint8Array(v * v);
  for (let k = 0; k < v * v; k++) {
    data[k] = Math.round(((terrain.heights[k] - H_MIN) / (H_MAX - H_MIN)) * 255);
  }
  const tex = new THREE.DataTexture(data, v, v, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Faceted, gently rolling sea: turquoise over shallow shelves, deep blue offshore,
 * with animated foam bands where it meets land.
 */
export function createWater(terrain: Terrain): THREE.Group {
  const group = new THREE.Group();
  group.name = 'water';

  const geo = new THREE.PlaneGeometry(420, 420, 140, 140);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0.9,
    roughness: 0.3,
    metalness: 0.0,
    flatShading: true,
  });
  const uniforms = {
    uTime: timeUniform,
    uHeights: { value: heightTexture(terrain) },
    uGrid: { value: new THREE.Vector2(terrain.half, terrain.n) },
    uHRange: { value: new THREE.Vector2(H_MIN, H_MAX) },
    uWater: { value: WORLD.waterLevel },
    uShallow: { value: new THREE.Color(PALETTE.waterShallow) },
    uMid: { value: new THREE.Color(PALETTE.water) },
    uDeep: { value: new THREE.Color(PALETTE.waterDeep) },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'uniform float uTime;\nvarying vec3 vWorld;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec4 wp = modelMatrix * vec4(position, 1.0);
      transformed.y += sin(wp.x * 0.42 + uTime * 1.1) * 0.05 + cos(wp.z * 0.37 + uTime * 0.85) * 0.05
                     + sin((wp.x + wp.z) * 0.9 + uTime * 1.7) * 0.02;
      vWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    );
    shader.fragmentShader =
      `uniform float uTime; uniform sampler2D uHeights; uniform vec2 uGrid; uniform vec2 uHRange;
       uniform float uWater; uniform vec3 uShallow; uniform vec3 uMid; uniform vec3 uDeep;
       varying vec3 vWorld;\n` +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 huv = (vWorld.xz + uGrid.x + 0.5) / (uGrid.y + 1.0);
        float ground = mix(uHRange.x, uHRange.y, texture2D(uHeights, huv).r);
        float depth = uWater - ground;
        vec3 wcol = mix(uShallow, uMid, smoothstep(0.2, 1.6, depth));
        wcol = mix(wcol, uDeep, smoothstep(1.6, 4.5, depth));
        // Shore foam: a solid lip plus bands that roll in toward the beach.
        float lip = 1.0 - smoothstep(0.05, 0.22, depth);
        float bands = smoothstep(0.75, 0.95, sin(depth * 14.0 + uTime * 1.8)) * (1.0 - smoothstep(0.2, 0.75, depth));
        float foam = clamp(max(lip, bands * 0.8), 0.0, 1.0);
        wcol = mix(wcol, vec3(1.0), foam * 0.9);
        diffuseColor.rgb = wcol;
        diffuseColor.a = mix(0.82, 0.95, smoothstep(0.2, 2.0, depth));
        diffuseColor.a = max(diffuseColor.a, foam);`,
      );
    applyCloudShadow(shader);
  };
  mat.customProgramCacheKey = () => 'outpost-water';
  const sea = new THREE.Mesh(geo, mat);
  sea.position.y = WORLD.waterLevel;
  sea.receiveShadow = true;
  sea.renderOrder = 1;
  group.add(sea);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: PALETTE.seabedDeep, roughness: 1 }),
  );
  floor.position.y = -5.2;
  group.add(floor);
  return group;
}
