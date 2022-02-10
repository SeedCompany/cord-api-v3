import { Injectable } from '@nestjs/common';
import { assert } from 'ts-essentials';
import { MergeExclusive } from 'type-fest';
import { entries, fullFiscalYear } from '../../common';
import { Cell, Column } from '../../common/xlsx.util';
import { Downloadable } from '../file';
import { findStepColumns, isGoalRow, PlanningSheet, Pnp } from '../pnp';
import { ProductStep as Step } from '../product';
import { Book } from '../scripture/books';
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
    const progressSheet = pnp.progress;
    const planningSheet = pnp.planning;
    const planningStepColumns = findStepColumns(planningSheet);
    const progressStepColumns = findStepColumns(progressSheet);

    return planningSheet.goals
      .walkDown()
      .filter(isGoalRow)
      .map(parseProgressRow(planningStepColumns, progressStepColumns))
      .filter((row) => row.steps.length > 0)
      .toArray();
  }
}

const parseProgressRow =
  (
    stepColumns: Record<Step, Column>,
    progressStepColumns: Record<Step, Column>
  ) =>
  (cell: Cell<PlanningSheet>, index: number): ExtractedRow => {
    const sheet = cell.sheet;
    const row = cell.row;
    const progress = (column: Column) => {
      const cell = column.cell(row);
      if (cell.asString?.startsWith('Q')) {
        // Q# means completed that quarter
        return 100;
      }
      const percentDecimal = cell.asNumber;
      return percentDecimal ? percentDecimal * 100 : undefined;
    };
    const steps = entries(stepColumns).flatMap<StepProgressInput>(
      ([step, column]) => {
        const fiscalYear = sheet.cell(column, row).asNumber;
        const fullFY = fiscalYear ? fullFiscalYear(fiscalYear) : undefined;
        // Only include step if it references a fiscal year within the project
        if (!fullFY || !sheet.projectFiscalYears.intersection(fullFY)) {
          return [];
        }
        return { step, completed: progress(progressStepColumns[step]) };
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
