import { C, Kit } from './kit';
import type { BuildingDef } from './types';

// Placeholder: replaced by the full 20-level design.
export const MOTOR_POOL: BuildingDef = {
  id: 'motorpool',
  name: 'Motor Pool',
  role: 'TODO',
  footprint: [5, 4],
  unlockHq: 4,
  levels: [],
  designedLevels: 1,
  build: () => {
    const k = new Kit();
    const y = k.pad(5, 4);
    k.block(1, 1, 1, 0, y, 0, C.wall);
    return k;
  },
};
