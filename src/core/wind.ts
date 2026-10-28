import * as THREE from 'three';

/** Shared time uniform for all wind / water vertex animation. */
export const timeUniform = { value: 0 };

/**
 * Patch a material so instanced foliage sways gently. The sway grows with
 * the vertex's local height, so trunks stay planted and canopies move.
 */
export function addWindSway(mat: THREE.Material, strength = 0.05, minHeight = 0.4) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 ip = instanceMatrix[3].xyz;
      #else
        vec3 ip = vec3(0.0);
      #endif
      float hgt = max(position.y - ${minHeight.toFixed(2)}, 0.0);
      float sway = sin(uTime * 1.5 + ip.x * 0.6 + ip.z * 0.45) + 0.4 * sin(uTime * 3.1 + ip.z * 1.3);
      transformed.x += sway * ${strength.toFixed(3)} * hgt;
      transformed.z += sway * ${(strength * 0.6).toFixed(3)} * hgt;`,
    );
  };
  mat.customProgramCacheKey = () => `wind-${strength}-${minHeight}`;
}
