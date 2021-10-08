import type { CellObject } from 'xlsx';
import { CalendarDate } from './temporal';

export const cellAsNumber = (cell: CellObject) =>
  cell && cell.t === 'n' && typeof cell.v === 'number' ? cell.v : undefined;

export const cellAsString = (cell: CellObject) =>
  cell && cell.t === 's' && typeof cell.v === 'string' ? cell.v : undefined;

/**
 * Requires `cellDates: true` in parsing options
 */
export const cellAsDate = (cell: CellObject) =>
  cell && cell.t === 'd' && cell.v instanceof Date
    ? CalendarDate.fromJSDate(cell.v)
    : undefined;
