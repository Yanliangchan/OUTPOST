import * as THREE from 'three';
import { BUILDINGS } from './catalogue';
import { STOREY } from './kit';

export interface LevelMetric {
  level: number;
  /** Height of the main mass in storeys (ignores thin parts like masts and flags). */
  bulk: number;
  /** Highest point in storeys, including thin parts. */
  peak: number;
  /** Fraction of the pad covered by structure taller than ~0.3 units. */
  coverage: number;
  tris: number;
  parts: number;
}

/**
 * Design QA: measures every level of every building so progressions can be
 * checked numerically (an upgrade should never look smaller than the level before).
 */
export function buildingMetrics(): Record<string, LevelMetric[]> {
  const out: Record<string, LevelMetric[]> = {};
  const box = new THREE.Box3();
  for (const def of BUILDINGS) {
    const [fw, fd] = def.footprint;
    const cell = 0.2;
    const nx = Math.round(fw / cell), nz = Math.round(fd / cell);
    out[def.id] = [];
    for (let lv = 1; lv <= def.designedLevels; lv++) {
      const kit = def.build(lv);
      kit.group.updateMatrixWorld(true);
      const grid = new Float32Array(nx * nz);
      let peak = 0, tris = 0, parts = 0;
      kit.group.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        parts++;
        const g = o.geometry as THREE.BufferGeometry;
        tris += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
        box.setFromObject(o);
        if (box.isEmpty()) return;
        peak = Math.max(peak, box.max.y);
        const w = box.max.x - box.min.x, d = box.max.z - box.min.z;
        if (w * d < 0.08) return; // thin elements: masts, poles, flags
        const top = box.max.y;
        if (top < 0.3) return;
        const x0 = Math.max(0, Math.floor((box.min.x + fw / 2) / cell)), x1 = Math.min(nx - 1, Math.floor((box.max.x + fw / 2) / cell));
        const z0 = Math.max(0, Math.floor((box.min.z + fd / 2) / cell)), z1 = Math.min(nz - 1, Math.floor((box.max.z + fd / 2) / cell));
        for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) grid[j * nx + i] = Math.max(grid[j * nx + i], top);
      });
      let covered = 0, bulk = 0;
      const heights: number[] = [];
      grid.forEach((h) => {
        if (h > 0.3) {
          covered++;
          heights.push(h);
        }
      });
      // Bulk: 90th percentile of covered-cell heights (robust against a few tall props).
      heights.sort((a, b) => a - b);
      if (heights.length) bulk = heights[Math.floor(heights.length * 0.9)];
      out[def.id].push({
        level: lv,
        bulk: +(bulk / STOREY).toFixed(2),
        peak: +(peak / STOREY).toFixed(2),
        coverage: +(covered / (nx * nz)).toFixed(2),
        tris: Math.round(tris),
        parts,
      });
    }
  }
  return out;
}
