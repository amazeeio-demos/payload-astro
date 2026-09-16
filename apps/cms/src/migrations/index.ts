import * as migration_20260916_203330_initial from './20260916_203330_initial';

export const migrations = [
  {
    up: migration_20260916_203330_initial.up,
    down: migration_20260916_203330_initial.down,
    name: '20260916_203330_initial'
  },
];
