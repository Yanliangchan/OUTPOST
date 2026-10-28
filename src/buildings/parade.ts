import { C, Kit } from './kit';
import type { BuildingDef } from './types';

// Placeholder: replaced by the full 20-level design.
export const PARADE_SQUARE: BuildingDef = {
  id: 'parade',
  name: 'Parade Square',
  role: 'TODO',
  footprint: [6, 6],
  unlockHq: 5,
  levels: [],
  designedLevels: 1,
  build: () => {
    const k = new Kit();
    const y = k.pad(6, 6);
    k.block(1, 1, 1, 0, y, 0, C.wall);
    return k;
  },
};
