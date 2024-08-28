import { Injectable } from '@nestjs/common';
import { entries } from '@seedcompany/common';
import { assert } from 'ts-essentials';
import { MergeExclusive } from 'type-fest';
import { Cell, Column, Row } from '~/common/xlsx.util';
import { Downloadable } from '../file/dto';
import {
  extractScripture,
  findStepColumns,
  isGoalRow,
  isGoalStepPlannedInsideProject,
  isProgressCompletedOutsideProject,
  Pnp,
  ProgressSheet,
  WrittenScripturePlanningSheet,
} from '../pnp';
import { PnpProgressExtractionResult } from '../pnp/extraction-result';
import { ProductStep as Step } from '../product/dto';
import { ScriptureRange } from '../scripture/dto';
import { StepProgressInput } from './dto';

type ExtractedRow = MergeExclusive<
  {
    bookName: string;
    totalVerses: number | undefined;
    scripture: readonly ScriptureRange[];
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
  async extract(
    file: Downloadable<unknown>,
    result: PnpProgressExtractionResult,
  ) {
    const pnp = await Pnp.fromDownloadable(file);
    const sheet = pnp.progress;

    const stepColumns = findStepColumns(sheet);
    const planningStepColumns = findStepColumns(pnp.planning, result);

    return sheet.goals
      .walkDown()
      .filter((cell) => isGoalRow(cell))
      .map(parseProgressRow(pnp, stepColumns, planningStepColumns, result))
      .filter((row) => row.steps.length > 0)
      .toArray();
  }
}

const parseProgressRow =
  (
    pnp: Pnp,
    stepColumns: Record<Step, Column>,
    planningStepColumns: Record<Step, Column>,
    result: PnpProgressExtractionResult,
  ) =>
  (cell: Cell<ProgressSheet>, index: number): ExtractedRow => {
    const sheet = cell.sheet;
    const row = cell.row;
    const rowIndex = row.a1 - sheet.goals.start.row.a1;
    const planningRow = pnp.planning.row(
      pnp.planning.goals.start.row.a1 + rowIndex,
    );

    const steps = entries(stepColumns).flatMap<StepProgressInput>(
      ([step, column]) => {
        const fiscalYear = pnp.planning.cell(
          planningStepColumns[step],
          planningRow,
        );

        const cell = sheet.cell(column, row);
        if (
          !isGoalStepPlannedInsideProject(pnp, fiscalYear, step, result) ||
          isProgressCompletedOutsideProject(pnp, cell, step, result)
        ) {
          return [];
        }

        return { step, completed: progress(cell) };
      },
    );

    const common = {
      rowIndex: rowIndex + 1,
      order: index + 1,
      steps,
    };

    if (sheet.isOBS()) {
      const story = sheet.storyName(row).asString!; // Asserting bc loop verified this
      return { ...common, story };
    }

    assert(sheet.isWritten());
    return {
      ...common,
      ...extractScripture(
        planningRow as Row<WrittenScripturePlanningSheet>,
        result,
      ),
    };
  };

const progress = (cell: Cell) => {
  if (cell.asString?.startsWith('Q')) {
    // Q# means completed that quarter
    return 100;
  }
  const percentDecimal = cell.asNumber;
  return percentDecimal ? percentDecimal * 100 : undefined;
};
