import { Book, parseScripture } from '@seedcompany/scripture';
import { Cell } from '~/common/xlsx.util';
import { ScriptureRange } from '../scripture/dto';
import { PlanningSheet } from './planning-sheet';
import { ProgressSheet } from './progress-sheet';

export const isGoalRow = (cell: Cell<PlanningSheet | ProgressSheet>) => {
  if (cell.sheet.isOBS()) {
    return !!cell.sheet.storyName(cell.row);
  }
  if (!cell.sheet.isWritten()) {
    return false;
  }

  const rawBook = cell.sheet.bookName(cell.row);
  const versesToTranslate = cell.sheet.totalVerses(cell.row) ?? 0;

  if (versesToTranslate <= 0) {
    return false;
  }

  // Try as book name first since it's faster than parsing scripture string
  const maybeBook = rawBook ? Book.namedMaybe(rawBook) : undefined;
  if (maybeBook) {
    // Sanity check to ensure total verses given is plausible
    return versesToTranslate <= maybeBook.totalVerses;
  }

  let scriptureRanges;
  try {
    scriptureRanges = parseScripture(rawBook);
  } catch {
    return false;
  }

  const totalVersesInRange = ScriptureRange.totalVerses(...scriptureRanges);

  // Treat range(s) as valid if the total verses represented
  // equals what's been given in the other column.
  return versesToTranslate === totalVersesInRange;
};
