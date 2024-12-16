import { Injectable } from '@nestjs/common';
import { entries } from '@seedcompany/common';
import { parseScripture } from '@seedcompany/scripture';
import { assert } from 'ts-essentials';
import { MergeExclusive } from 'type-fest';
import { CalendarDate } from '~/common';
import { Cell, Column, Row } from '~/common/xlsx.util';
import { Downloadable } from '../file/dto';
import {
  extractScripture,
  findStepColumns,
  isGoalRow,
  isGoalStepPlannedInsideProject,
  isProgressCompletedOutsideProject,
  PlanningSheet,
  Pnp,
  stepPlanCompleteDate,
  WrittenScripturePlanningSheet,
} from '../pnp';
import {
  PnpPlanningExtractionResult,
  PnpProblemType,
} from '../pnp/extraction-result';
import { ScriptureRange, UnspecifiedScripturePortion } from '../scripture/dto';
import { ProductStep, ProductStep as Step } from './dto';

@Injectable()
export class ProductExtractor {
  async extract(
    file: Downloadable<unknown>,
    availableSteps: readonly ProductStep[],
    result: PnpPlanningExtractionResult,
  ): Promise<readonly ExtractedRow[]> {
    const pnp = await Pnp.fromDownloadable(file);
    const sheet = pnp.planning;

    const stepColumns = findStepColumns(sheet, result, availableSteps);
    const progressStepColumns = findStepColumns(
      pnp.progress,
      undefined,
      availableSteps,
    );

    const productRows = sheet.goals
      .walkDown()
      .filter((cell) => isGoalRow(cell, result))
      .map(parseProductRow(pnp, stepColumns, progressStepColumns, result))
      .filter((row) => row.steps.length > 0)
      .toArray();

    if (productRows.length === 0) {
      result.addProblem(NoGoals, pnp.planning.goals.start, {});
    }

    // Ignoring for now because not sure how to track progress
    const _otherRows = sheet.isOBS()
      ? sheet.sustainabilityGoals
          .walkDown()
          .map((cell) => ({
            title: `Train ${
              sheet.sustainabilityRole(cell.row)?.replace(/:$/, '') ?? ''
            }`,
            count: sheet.sustainabilityRoleCount(cell.row) ?? 0,
          }))
          .filter((row) => row.count > 0)
      : [];

    return productRows;
  }
}

const parseProductRow =
  (
    pnp: Pnp,
    stepColumns: Record<Step, Column>,
    progressStepColumns: Record<Step, Column>,
    result: PnpPlanningExtractionResult,
  ) =>
  (cell: Cell<PlanningSheet>, index: number): ExtractedRow => {
    const sheet = cell.sheet;
    const row = cell.row;
    const rowIndex = row.a1 - sheet.goals.start.row.a1;
    const progressRow = pnp.progress.goals.start.row.a1 + rowIndex;

    const steps = entries(stepColumns).flatMap(([step, column]) => {
      const plannedCell = sheet.cell(column, row);
      const progressCell = pnp.progress.cell(
        progressStepColumns[step],
        progressRow,
      );

      if (
        !isGoalStepPlannedInsideProject(pnp, plannedCell, step, result) ||
        isProgressCompletedOutsideProject(pnp, progressCell, step, result)
      ) {
        return [];
      }
      const plannedCompleteDate = stepPlanCompleteDate(plannedCell)!;
      return { step, plannedCompleteDate: plannedCompleteDate };
    });

    const common = {
      rowIndex: row.a1 - sheet.goals.start.row.a1 + 1,
      order: index + 1,
      steps,
      note: sheet.myNote(row).asString,
      source: cell,
    };

    if (sheet.isOBS()) {
      const story = sheet.storyName(row).asString!; // Asserting bc loop verified this
      const scripture = (() => {
        try {
          return parseScripture(
            sheet
              .scriptureReference(row)
              // Ignore these two strings that are meaningless here
              ?.replace('Composite', '')
              .replace('other portions', '') ?? '',
          ).map(ScriptureRange.fromVerses);
        } catch (e) {
          return [];
        }
      })();
      const totalVerses = sheet.totalVerses(row).asNumber;
      return {
        ...common,
        story,
        scripture,
        totalVerses,
        composite: sheet.composite(row)?.toUpperCase() === 'Y',
        placeholder: scripture.length === 0 && !totalVerses,
      };
    }
    assert(sheet.isWritten());

    return {
      ...common,
      ...extractScripture(row as Row<WrittenScripturePlanningSheet>, result),
    };
  };

export type ExtractedRow = MergeExclusive<
  {
    story: string;
    composite: boolean;
    placeholder: boolean;
  },
  {
    bookName: string;
    unspecifiedScripture?: UnspecifiedScripturePortion;
  }
> & {
  scripture: readonly ScriptureRange[];
  totalVerses: number | undefined;
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
  steps: ReadonlyArray<{ step: Step; plannedCompleteDate: CalendarDate }>;
  note: string | undefined;
  source: Cell<PlanningSheet>;
};

const NoGoals = PnpProblemType.register({
  name: 'NoGoals',
  severity: 'Error',
  render: () => () => ({
    message: `No goals found`,
  }),
});
