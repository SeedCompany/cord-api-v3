import { Injectable } from '@nestjs/common';
import levenshtein from 'js-levenshtein-esm';
import { sortBy, startCase, without } from 'lodash';
import { MergeExclusive } from 'type-fest';
import {
  CalendarDate,
  DateInterval,
  entries,
  expandToFullFiscalYears,
  fullFiscalYear,
} from '../../common';
import { Column, Range, Row, WorkBook } from '../../common/xlsx.util';
import { Downloadable } from '../file';
import { ScriptureRange } from '../scripture';
import { Book } from '../scripture/books';
import { parseScripture } from '../scripture/parser';
import { ProductStep as Step } from './dto';
import 'ix/add/iterable-operators/filter';
import 'ix/add/iterable-operators/map';
import 'ix/add/iterable-operators/toarray';

@Injectable()
export class ProductExtractor {
  async extract(
    file: Downloadable<unknown>,
    availableSteps: readonly Step[]
  ): Promise<readonly ExtractedRow[]> {
    const buffer = await file.download();
    const pnp = WorkBook.fromBuffer(buffer);

    const sheet = pnp.sheet('Planning');

    const isOBS = sheet.cell('P19').asString === 'Stories';

    const dates = sheet.range(
      sheet.cell(isOBS ? 'X16' : 'Z14'),
      sheet.cell(isOBS ? 'X17' : 'Z15')
    );
    const interval = DateInterval.tryFrom(dates.start.asDate, dates.end.asDate);
    if (!interval) {
      throw new Error('Unable to find project date range');
    }

    const stepColumns = findStepColumns(
      sheet.range(isOBS ? 'U20:X20' : 'U18:Z18'),
      availableSteps
    );
    const noteFallback = isOBS ? undefined : sheet.cell('AI16').asString;
    const startingRow = sheet.row(23);

    const productRows = findProductRows(startingRow, isOBS)
      .map(
        parseProductRow(
          isOBS,
          expandToFullFiscalYears(interval),
          stepColumns,
          noteFallback,
          startingRow
        )
      )
      .filter((goal) => goal.steps.length > 0);

    // Ignoring for now because not sure how to track progress
    const _otherRows = isOBS
      ? sheet
          .range('Y17:AA20')
          .walkDown()
          .map((cell) => ({
            title: `Train ${cell.asString?.replace(/:$/, '') ?? ''}`,
            count: cell.row.cell('AA').asNumber ?? 0,
          }))
          .filter((goal) => goal.count > 0)
      : [];

    return productRows;
  }
}

function findProductRows(startingRow: Row, isOBS: boolean) {
  const lastRow = startingRow.sheet.sheetRange.end.row;
  const matchedRows = [];
  let row = startingRow;
  while (
    row < lastRow &&
    row.cell('Q').asString !== 'Other Goals and Milestones'
  ) {
    if (isProductRow(row, isOBS)) {
      matchedRows.push(row);
    }
    row = row.next();
  }
  return matchedRows;
}

const isProductRow = (row: Row, isOBS: boolean) => {
  if (isOBS) {
    return !!row.cell('Q').asString;
  }
  const book = Book.tryFind(row.cell('Q').asString);
  const totalVerses = row.cell('T').asNumber ?? 0;
  return book && totalVerses > 0 && totalVerses <= book.totalVerses;
};

/**
 * Fuzzy match available steps to their column address.
 */
export function findStepColumns(
  fromRange: Range,
  availableSteps: readonly Step[] = Object.values(Step)
) {
  const matchedColumns: Partial<Record<Step, Column>> = {};
  let remainingSteps = availableSteps;
  const possibleSteps = fromRange
    .walkRight()
    .filter((cell) => !!cell.asString)
    .map((cell) => ({ label: cell.asString!, column: cell.column }))
    .toArray();
  possibleSteps.forEach(({ label, column }, index) => {
    if (index === possibleSteps.length - 1) {
      // The last step should always be called Completed in CORD per Seth.
      // Written PnP already match, but OBS calls it Record. This is mislabeled
      // depending on the methodology.
      matchedColumns[Step.Completed] = column;
      return;
    }
    const distances = remainingSteps.map((step) => {
      const humanLabel = startCase(step).replace(' And ', ' & ');
      const distance = levenshtein(label, humanLabel);
      return [step, distance] as const;
    });
    // Pick the step that is the closest fuzzy match
    const chosen = sortBy(
      // 5 is too far ignore those
      distances.filter(([_, distance]) => distance < 5),
      ([_, distance]) => distance
    )[0]?.[0];
    if (!chosen) {
      return;
    }
    matchedColumns[chosen] = column;

    remainingSteps = without(remainingSteps, chosen);
  });
  return matchedColumns as Record<Step, Column>;
}

const parseProductRow =
  (
    isOBS: boolean,
    projectRange: DateInterval,
    stepColumns: Record<Step, Column>,
    noteFallback: string | undefined,
    startingRow: Row
  ) =>
  (row: Row, index: number): ExtractedRow => {
    const steps = entries(stepColumns).flatMap(([step, column]) => {
      const fiscalYear = row.cell(column).asNumber;
      const fullFY = fiscalYear ? fullFiscalYear(fiscalYear) : undefined;
      // only include step if it references a fiscal year within the project
      if (!fullFY || !projectRange.intersection(fullFY)) {
        return [];
      }
      return { step, plannedCompleteDate: fullFY.end };
    });
    const note = row.cell(isOBS ? 'Y' : 'AI').asString ?? noteFallback;

    const common = {
      rowIndex: row.a1 - startingRow.a1 + 1,
      order: index + 1,
      steps,
      note,
    };

    if (isOBS) {
      const story = row.cell('Q').asString!; // Asserting bc loop verified this
      const scripture = (() => {
        try {
          const raw = row.cell('R').asString;
          return parseScripture(
            // Ignore these two strings that are meaningless here
            raw?.replace('Composite', '').replace('other portions', '') ?? ''
          );
        } catch (e) {
          return [];
        }
      })();
      const totalVerses = row.cell('T').asNumber;
      return {
        ...common,
        story,
        scripture,
        totalVerses,
        composite: row.cell('S').asString?.toUpperCase() === 'Y',
        placeholder: scripture.length === 0 && !totalVerses,
      };
    }
    return {
      ...common,
      bookName: row.cell('Q').asString!, // Asserting bc loop verified this
      totalVerses: row.cell('T').asNumber!, // Asserting bc loop verified this
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
