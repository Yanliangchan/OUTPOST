import * as THREE from 'three';
import { Terrain } from './terrain';
import { ZONES, zoneTiles, type Zone } from './zones';

/** Overlay colours per zone kind / tier. */
const COLORS: Record<string, string> = {
  starter: '#3fd16b',
  tier1: '#ffc93c',
  tier2: '#ff8a3d',
  hidden: '#b07bff',
};

const colorFor = (z: Zone) => (z.kind === 'starter' ? COLORS.starter : z.kind === 'hidden' ? COLORS.hidden : z.tier === 1 ? COLORS.tier1 : COLORS.tier2);

function label(text: string, sub: string, color: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 112;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(255,255,252,0.94)';
  g.beginPath();
  g.roundRect(8, 8, 240, 96, 22);
  g.fill();
  g.fillStyle = color;
  g.beginPath();
  g.roundRect(8, 8, 18, 96, [22, 0, 0, 22]);
  g.fill();
  g.fillStyle = '#26332a';
  g.textAlign = 'center';
  g.font = '900 40px Nunito, system-ui, sans-serif';
  g.fillText(text, 136, 56);
  g.fillStyle = '#5d6b60';
  g.font = '700 24px Nunito, system-ui, sans-serif';
  g.fillText(sub, 136, 88);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  sp.scale.set(6.4, 2.8, 1);
  sp.renderOrder = 20;
  return sp;
}

/**
 * Design overlay showing the buildable land: the starting clearing, jungle
 * clearance zones by tier, and the hidden late-game sites. Drawn on top of
 * the jungle so zones read clearly. (Will evolve into the in-game Expand view,
 * which will NOT show hidden sites until they are unlocked.)
 */
export function createPlanOverlay(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'planOverlay';
  for (const z of ZONES) {
    const color = colorFor(z);
    const y = Terrain.levelHeight(z.level) + 0.08;
    const w = z.maxX - z.minX;
    const d = z.maxZ - z.minZ;
    const cx = (z.minX + z.maxX) / 2;
    const cz = (z.minZ + z.maxZ) / 2;
    const inset = 0.18;

    const fill = new THREE.Mesh(
      new THREE.PlaneGeometry(w - inset * 2, d - inset * 2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: z.kind === 'starter' ? 0.22 : 0.32, depthTest: false, depthWrite: false }),
    );
    fill.position.set(cx, y, cz);
    fill.renderOrder = 10;
    group.add(fill);

    const pts = [
      [z.minX + inset, z.minZ + inset], [z.maxX - inset, z.minZ + inset],
      [z.maxX - inset, z.maxZ - inset], [z.minX + inset, z.maxZ - inset],
    ].map(([x, zz]) => new THREE.Vector3(x, y + 0.01, zz));
    const border = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true }),
    );
    border.renderOrder = 11;
    group.add(border);

    const sub = z.kind === 'starter' ? `${w}×${d} · open` : z.kind === 'hidden' ? `${w}×${d} · late game` : `${w}×${d} · jungle`;
    const tag = label(z.label, sub, color);
    tag.position.set(cx, y + 1.2, cz);
    group.add(tag);
  }
  group.visible = false;
  return group;
}

/** Summary numbers for the legend. */
export function planSummary() {
  const sum = (k: Zone['kind']) => ZONES.filter((z) => z.kind === k).reduce((a, z) => a + zoneTiles(z), 0);
  const count = (k: Zone['kind']) => ZONES.filter((z) => z.kind === k).length;
  return {
    starter: sum('starter'),
    jungle: sum('jungle'),
    jungleZones: count('jungle'),
    hidden: sum('hidden'),
    hiddenZones: count('hidden'),
    total: sum('starter') + sum('jungle') + sum('hidden'),
  };
}
