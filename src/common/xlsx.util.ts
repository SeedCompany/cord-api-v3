import type { CellObject } from 'xlsx';

export const cellAsNumber = (cell: CellObject) =>
  cell && cell.t === 'n' && typeof cell.v === 'number' ? cell.v : undefined;

export const cellAsString = (cell: CellObject) =>
  cell && cell.t === 's' && typeof cell.v === 'string' ? cell.v : undefined;
