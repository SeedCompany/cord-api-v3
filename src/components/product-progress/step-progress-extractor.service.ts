import { Injectable } from '@nestjs/common';
import { assert } from 'ts-essentials';
import { MergeExclusive } from 'type-fest';
import { entries, fullFiscalQuarter, fullFiscalYear } from '../../common';
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
    const planningStepColumns = findStepColumns(pnp.planning);

    return sheet.goals
      .walkDown()
      .filter(isGoalRow)
      .map(parseProgressRow(pnp, stepColumns, planningStepColumns))
      .filter((row) => row.steps.length > 0)
      .toArray();
  }
}

const parseProgressRow =
  (
    pnp: Pnp,
    stepColumns: Record<Step, Column>,
    planningStepColumns: Record<Step, Column>
  ) =>
  (cell: Cell<ProgressSheet>, index: number): ExtractedRow => {
    const sheet = cell.sheet;
    const row = cell.row;
    const rowIndex = row.a1 - sheet.goals.start.row.a1;
    const planningRow = pnp.planning.goals.start.row.a1 + rowIndex;

    const steps = entries(stepColumns).flatMap<StepProgressInput>(
      ([step, column]) => {
        const fiscalYear = pnp.planning.cell(
          planningStepColumns[step],
          planningRow
        ).asNumber;
        if (
          !fiscalYear ||
          !pnp.planning.projectDateRange.intersection(
            fullFiscalYear(fiscalYear)
          )
        ) {
          // Not planned or planned outside project, skip
          return [];
        }

        const cell = sheet.cell(column, row);
        if (isCompletedOutsideProject(pnp, cell)) {
          return [];
        }
        return { step, completed: progress(cell) };
      }
    );
    const common = {
      rowIndex: rowIndex + 1,
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

const isCompletedOutsideProject = (pnp: Pnp, cell: Cell) => {
  const completeDate = stepCompleteDate(cell);
  return completeDate && !pnp.planning.projectDateRange.contains(completeDate);
};

/**
 * Convert cell (and one to its right) to a calendar date.
 * ['Q2', '2022'] -> 03/31/2022
 */
const stepCompleteDate = (cell: Cell) => {
  const fiscalQuarter = Number(cell.asString?.slice(1));
  const fiscalYear = cell.moveX(1).asNumber;
  if (!fiscalQuarter || !fiscalYear) {
    return null;
  }
  return fullFiscalQuarter(fiscalQuarter, fiscalYear).end;
};

const progress = (cell: Cell) => {
  if (cell.asString?.startsWith('Q')) {
    // Q# means completed that quarter
    return 100;
  }
  const percentDecimal = cell.asNumber;
  return percentDecimal ? percentDecimal * 100 : undefined;
};
