import { Injectable } from '@nestjs/common';
import { assert } from 'ts-essentials';
import { MergeExclusive } from 'type-fest';
import { CalendarDate, entries } from '../../common';
import { Cell, Column } from '../../common/xlsx.util';
import { Downloadable } from '../file';
import {
  findStepColumns,
  isGoalRow,
  isGoalStepPlannedInsideProject,
  isProgressCompletedOutsideProject,
  PlanningSheet,
  Pnp,
  stepPlanCompleteDate,
} from '../pnp';
import {
  Book,
  parseScripture,
  ScriptureRange,
  ScriptureRangeInput,
} from '../scripture';
import { ProductStep as Step } from './dto';

type UnspecifiedScriptureType = {
  book: string;
  totalVerses: number;
} | null;
@Injectable()
export class ProductExtractor {
  async extract(
    file: Downloadable<unknown>,
    availableSteps: readonly Step[]
  ): Promise<readonly ExtractedRow[]> {
    const pnp = await Pnp.fromDownloadable(file);
    const sheet = pnp.planning;

    const stepColumns = findStepColumns(sheet, availableSteps);
    const progressStepColumns = findStepColumns(pnp.progress, availableSteps);

    const productRows = sheet.goals
      .walkDown()
      .filter(isGoalRow)
      .map(parseProductRow(pnp, stepColumns, progressStepColumns))
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
  (
    pnp: Pnp,
    stepColumns: Record<Step, Column>,
    progressStepColumns: Record<Step, Column>
  ) =>
  (cell: Cell<PlanningSheet>, index: number): ExtractedRow => {
    const sheet = cell.sheet;
    const row = cell.row;
    const rowIndex = row.a1 - sheet.goals.start.row.a1;
    const progressRow = pnp.progress.goals.start.row.a1 + rowIndex;

    const steps = entries(stepColumns).flatMap(([step, column]) => {
      const plannedCompleteDate = stepPlanCompleteDate(sheet.cell(column, row));
      const progressCell = pnp.progress.cell(
        progressStepColumns[step],
        progressRow
      );

      if (
        !isGoalStepPlannedInsideProject(pnp, plannedCompleteDate) ||
        isProgressCompletedOutsideProject(pnp, progressCell)
      ) {
        return [];
      }

      return { step, plannedCompleteDate };
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
    /**  Load Scripture References **/
    let scriptureReferences: ScriptureRangeInput[] = [];
    let unspecifiedScripture: UnspecifiedScriptureType = null;
    const totalVersesToTranslate = sheet.totalVerses(row) ?? 0;
    const bookName = sheet.bookName(row)!;
    const book = Book.tryFind(bookName);
    const versesInBook = book ? book.totalVerses : null;
    const isWholeBook = versesInBook === totalVersesToTranslate;

    book
      ? isWholeBook
        ? (scriptureReferences = [
            {
              start: book.firstChapter.firstVerse.reference,
              end: book.lastChapter.lastVerse.reference,
            },
          ])
        : (scriptureReferences = findScriptures(sheet.myNote(row)!))
      : (scriptureReferences = findScriptures(bookName));

    unspecifiedScripture =
      scriptureReferences.length > 0 || !book
        ? null
        : {
            book: book.name,
            totalVerses: totalVersesToTranslate,
          };

    return {
      ...common,
      bookName,
      totalVerses: totalVersesToTranslate,
      scriptureReferences,
      unspecifiedScripture,
    };
  };

const findScriptures = (input: string): ScriptureRangeInput[] => {
  let parsedScriptures: readonly ScriptureRange[] = [];
  let scriptureReferences: ScriptureRangeInput[] = [];
  try {
    parsedScriptures = parseScripture(input);
    scriptureReferences =
      parsedScriptures.length > 0
        ? [
            {
              start: parsedScriptures[0].start,
              end: parsedScriptures[0].end,
            },
          ]
        : [];
    return scriptureReferences;
  } catch (e) {
    return [];
  }
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
    scriptureReferences: ScriptureRangeInput[];
    unspecifiedScripture: UnspecifiedScriptureType;
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
