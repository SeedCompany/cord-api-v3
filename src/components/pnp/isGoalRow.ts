import { sumBy } from 'lodash';
import { Cell } from '../../common/xlsx.util';
import { parseScripture, ScriptureRange } from '../scripture';
import { PlanningSheet } from './planning-sheet';
import { ProgressSheet } from './progress-sheet';

export const isGoalRow = (cell: Cell<PlanningSheet | ProgressSheet>) => {
  if (cell.sheet.isOBS()) {
    return !!cell.sheet.storyName(cell.row);
  }
  if (!cell.sheet.isWritten()) {
    return false;
  }
  try {
    const ranges = parseScripture(cell.sheet.bookName(cell.row));
    if (ranges.length > 0) {
      const versesToTranslate = cell.sheet.totalVerses(cell.row) ?? 0; //lifetime verses to translate
      const versesInBook = sumBy(ranges, (range) => {
        const verseRange = ScriptureRange.fromReferences(range);
        return verseRange.end - verseRange.start + 1;
      });
      return versesToTranslate > 0 && versesToTranslate <= versesInBook;
    } else {
      return false;
    }
  } catch (e) {
    return false;
  }
};
