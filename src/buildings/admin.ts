import { C, Kit } from './kit';
import type { BuildingDef } from './types';

// Placeholder: replaced by the full 20-level design.
export const ADMIN_OFFICE: BuildingDef = {
  id: 'admin',
  name: 'Admin Office',
  role: 'TODO',
  footprint: [4, 3],
  unlockHq: 3,
  levels: [],
  designedLevels: 1,
  build: () => {
    const k = new Kit();
    const y = k.pad(4, 3);
    k.block(1, 1, 1, 0, y, 0, C.wall);
    return k;
  },
};
