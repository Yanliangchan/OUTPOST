import { WORLD } from '../config/world';

/**
 * Land zones of the buildable area.
 * - starter: the clearing the player begins with.
 * - jungle:  plateau zones that start overgrown and are cleared one by one.
 * - hidden:  late-game special sites, never shown to the player until unlocked.
 */
export type ZoneKind = 'starter' | 'jungle' | 'hidden';

export interface Zone {
  id: string;
  kind: ZoneKind;
  label: string;
  /** Tile-edge bounds in world units. */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  /** Terrain level the zone sits on. */
  level: number;
  /** Clearance tier: 0 = start, 1 = beside the start, 2 = corners, 3 = late game. */
  tier: number;
}

const ROWS = 'ABCDEFGH';

function buildZones(): Zone[] {
  const zones: Zone[] = [];
  const s = WORLD.starterHalf;
  zones.push({ id: 'start', kind: 'starter', label: 'Start', minX: -s, maxX: s, minZ: -s, maxZ: s, level: WORLD.plateauLevel, tier: 0 });

  const size = WORLD.clearanceZone;
  const half = WORLD.buildHalf;
  const n = Math.round((2 * half) / size);
  for (let iz = 0; iz < n; iz++) {
    for (let ix = 0; ix < n; ix++) {
      const minX = -half + ix * size;
      const minZ = -half + iz * size;
      const maxX = minX + size;
      const maxZ = minZ + size;
      // Skip chunks covered by the starter clearing.
      if (minX >= -s && maxX <= s && minZ >= -s && maxZ <= s) continue;
      const edgeX = ix === 0 || ix === n - 1;
      const edgeZ = iz === 0 || iz === n - 1;
      const id = `${ROWS[iz]}${ix + 1}`;
      zones.push({ id, kind: 'jungle', label: id, minX, maxX, minZ, maxZ, level: WORLD.plateauLevel, tier: edgeX && edgeZ ? 2 : 1 });
    }
  }

  for (const site of WORLD.hiddenSites) {
    const h = site.half + 0.5;
    zones.push({
      id: site.id,
      kind: 'hidden',
      label: site.id[0].toUpperCase() + site.id.slice(1),
      minX: site.x - h,
      maxX: site.x + h,
      minZ: site.z - h,
      maxZ: site.z + h,
      level: site.level,
      tier: 3,
    });
  }
  return zones;
}

export const ZONES: Zone[] = buildZones();

export const zoneTiles = (z: Zone) => Math.round((z.maxX - z.minX) * (z.maxZ - z.minZ));

/** Plateau zone (starter or jungle) containing a point; hidden sites are matched separately. */
export function plateauZoneAt(x: number, z: number): Zone | undefined {
  return ZONES.find((zn) => zn.kind !== 'hidden' && x >= zn.minX && x < zn.maxX && z >= zn.minZ && z < zn.maxZ);
}
