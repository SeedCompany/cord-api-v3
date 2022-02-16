import { Injectable } from '@nestjs/common';
import { assert } from 'ts-essentials';
import { MergeExclusive } from 'type-fest';
import { entries } from '../../common';
import { Cell, Column } from '../../common/xlsx.util';
import { Downloadable } from '../file';
import { findStepColumns, isGoalRow, Pnp, ProgressSheet } from '../pnp';
import { ProductStep as Step } from '../product';
import { Book } from '../scripture';
import { StepProgressInput } from './dto';

type ExtractedRow = MergeExclusive<
  {
    bookName: string;
    totalVerses: number;
  },
  { story: string }
> & {
  /**
   * 1-indexed row for the order of the goal.
   * This will not have jumps in numbers, blank rows are ignored.
   */
  order: number;
  /**
   * 1-indexed row number with the starting row normalized out.
   * This could have jumps in numbers because blank rows are accounted for here.
   * If those rows are filled in later the previously defined rows will be unaffected.
   */
  rowIndex: number;
  steps: ReadonlyArray<{ step: Step; completed?: number | null }>;
};

@Injectable()
export class StepProgressExtractor {
  async extract(file: Downloadable<unknown>) {
    const pnp = await Pnp.fromDownloadable(file);
    const sheet = pnp.progress;

    const stepColumns = findStepColumns(sheet);

    return sheet.goals
      .walkDown()
      .filter(isGoalRow)
      .map(parseProgressRow(stepColumns))
      .toArray();
  }
}

const parseProgressRow =
  (stepColumns: Record<Step, Column>) =>
  (cell: Cell<ProgressSheet>, index: number): ExtractedRow => {
    const sheet = cell.sheet;
    const row = cell.row;
    const steps = entries(stepColumns).map(
      ([step, column]): StepProgressInput => {
        const cell = sheet.cell(column, row);
        return { step, completed: progress(cell) };
      }
    );
    const common = {
      rowIndex: row.a1 - sheet.goals.start.row.a1 + 1,
      order: index + 1,
      steps,
    };
    if (sheet.isOBS()) {
      const story = sheet.storyName(row)!; // Asserting bc loop verified this
      return { ...common, story };
    }
    assert(sheet.isWritten());
    const bookName = Book.find(
      sheet.bookName(row)! // Asserting bc loop verified this
    ).name;
    const totalVerses = sheet.totalVerses(row)!; // Asserting bc loop verified this
    return { ...common, bookName, totalVerses };
  };

const progress = (cell: Cell) => {
  if (cell.asString?.startsWith('Q')) {
    // Q# means completed that quarter
    return 100;
  }
  const percentDecimal = cell.asNumber;
  return percentDecimal ? percentDecimal * 100 : undefined;
};
