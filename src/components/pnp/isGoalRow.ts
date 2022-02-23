import { Cell } from '../../common/xlsx.util';
import { Book } from '../scripture';
import { PlanningSheet } from './planning-sheet';
import { ProgressSheet } from './progress-sheet';

export const isGoalRow = (cell: Cell<PlanningSheet | ProgressSheet>) => {
  if (cell.sheet.isOBS()) {
    return !!cell.sheet.storyName(cell.row);
  }
  if (!cell.sheet.isWritten()) {
    return false;
  }
  const book = Book.tryFind(cell.sheet.bookName(cell.row));
  const totalVerses = cell.sheet.totalVerses(cell.row) ?? 0;
  return !!book && totalVerses > 0 && totalVerses <= book.totalVerses;
};
