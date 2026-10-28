import type * as THREE from 'three';
import { timeUniform } from './wind';

/** Strength of the drifting cloud shading (0 = off). */
export const CLOUD_SHADE = 0.2;

const GLSL = /* glsl */ `
uniform float uTime;
varying vec3 vCloudWorld;
float cHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(cHash(i), cHash(i + vec2(1, 0)), u.x), mix(cHash(i + vec2(0, 1)), cHash(i + vec2(1, 1)), u.x), u.y);
}
float cloudMask(vec2 xz) {
  vec2 p = xz * 0.035 + vec2(uTime * 0.05, uTime * 0.018);
  float n = cNoise(p) * 0.6 + cNoise(p * 2.1) * 0.3 + cNoise(p * 4.3) * 0.1;
  return smoothstep(0.58, 0.78, n);
}
`;

/**
 * Patch a compiled shader so soft cloud shadows drift across it.
 * Call from inside a material's onBeforeCompile.
 */
export function applyCloudShadow(shader: THREE.WebGLProgramParametersWithUniforms) {
  shader.uniforms.uTime = timeUniform;
  if (!shader.vertexShader.includes('vCloudWorld')) {
    shader.vertexShader = 'varying vec3 vCloudWorld;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vCloudWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    );
  }
  // Declare uTime once, ahead of any existing declaration from other patches.
  shader.fragmentShader = GLSL + shader.fragmentShader.replace('uniform float uTime;', '').replace(
    '#include <lights_fragment_begin>',
    `diffuseColor.rgb *= 1.0 - ${CLOUD_SHADE.toFixed(2)} * cloudMask(vCloudWorld.xz);
    #include <lights_fragment_begin>`,
  );
}
