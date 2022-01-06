import { Injectable } from '@nestjs/common';
import { assert } from 'ts-essentials';
import { MergeExclusive } from 'type-fest';
import { CalendarDate, entries, fullFiscalYear } from '../../common';
import { Cell, Column } from '../../common/xlsx.util';
import { Downloadable } from '../file';
import { findStepColumns, isGoalRow, PlanningSheet, Pnp } from '../pnp';
import { ScriptureRange } from '../scripture';
import { parseScripture } from '../scripture/parser';
import { ProductStep as Step } from './dto';

@Injectable()
export class ProductExtractor {
  async extract(
    file: Downloadable<unknown>,
    availableSteps: readonly Step[]
  ): Promise<readonly ExtractedRow[]> {
    const pnp = await Pnp.fromDownloadable(file);
    const sheet = pnp.planning;

    const stepColumns = findStepColumns(sheet, availableSteps);

    const productRows = sheet.goals
      .walkDown()
      .filter(isGoalRow)
      .map(parseProductRow(stepColumns))
      .filter((row) => row.steps.length > 0)
      .toArray();

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
  (stepColumns: Record<Step, Column>) =>
  (cell: Cell<PlanningSheet>, index: number): ExtractedRow => {
    const sheet = cell.sheet;
    const row = cell.row;
    const steps = entries(stepColumns).flatMap(([step, column]) => {
      const fiscalYear = sheet.cell(column, row).asNumber;
      const fullFY = fiscalYear ? fullFiscalYear(fiscalYear) : undefined;
      // only include step if it references a fiscal year within the project
      if (!fullFY || !sheet.projectFiscalYears.intersection(fullFY)) {
        return [];
      }
      return { step, plannedCompleteDate: fullFY.end };
    });

    const common = {
      rowIndex: row.a1 - sheet.goals.start.row.a1 + 1,
      order: index + 1,
      steps,
      note: sheet.myNote(row),
    };

    if (sheet.isOBS()) {
      const story = sheet.storyName(row)!; // Asserting bc loop verified this
      const scripture = (() => {
        try {
          return parseScripture(
            sheet
              .scriptureReference(row)
              // Ignore these two strings that are meaningless here
              ?.replace('Composite', '')
              .replace('other portions', '') ?? ''
          );
        } catch (e) {
          return [];
        }
      })();
      const totalVerses = sheet.totalVerses(row);
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
      bookName: sheet.bookName(row)!, // Asserting bc loop verified this
      totalVerses: sheet.totalVerses(row)!, // Asserting bc loop verified this
    };
  };

export type ExtractedRow = MergeExclusive<
  {
    story: string;
    scripture: readonly ScriptureRange[];
    totalVerses: number | undefined;
    composite: boolean;
    placeholder: boolean;
  },
  {
    bookName: string;
    totalVerses: number;
  }
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
  steps: ReadonlyArray<{ step: Step; plannedCompleteDate: CalendarDate }>;
  note: string | undefined;
};
