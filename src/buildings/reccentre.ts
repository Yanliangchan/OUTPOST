import { C, Kit } from './kit';
import type { BuildingDef } from './types';

// Placeholder: replaced by the full 20-level design.
export const REC_CENTRE: BuildingDef = {
  id: 'reccentre',
  name: 'Rec Centre',
  role: 'TODO',
  footprint: [4, 4],
  unlockHq: 3,
  levels: [],
  designedLevels: 1,
  build: () => {
    const k = new Kit();
    const y = k.pad(4, 4);
    k.block(1, 1, 1, 0, y, 0, C.wall);
    return k;
  },
};
