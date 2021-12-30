import { Injectable } from '@nestjs/common';
import levenshtein from 'js-levenshtein-esm';
import { range, sortBy, startCase, without } from 'lodash';
import { MergeExclusive } from 'type-fest';
import { read, utils, WorkSheet } from 'xlsx';
import {
  CalendarDate,
  DateInterval,
  entries,
  expandToFullFiscalYears,
  fullFiscalYear,
} from '../../common';
import {
  cellAsDate,
  cellAsNumber,
  cellAsString,
  sheetRange,
} from '../../common/xlsx.util';
import { Downloadable } from '../file';
import { ScriptureRange } from '../scripture';
import { Book } from '../scripture/books';
import { parseScripture } from '../scripture/parser';
import { ProductStep as Step } from './dto';

@Injectable()
export class ProductExtractor {
  async extract(
    file: Downloadable<unknown>,
    availableSteps: readonly Step[]
  ): Promise<readonly ExtractedRow[]> {
    const buffer = await file.download();
    const pnp = read(buffer, { type: 'buffer', cellDates: true });

    const sheet = pnp.Sheets.Planning;
    if (!sheet) {
      throw new Error('Unable to find planning sheet');
    }

    const isOBS = cellAsString(sheet.P19) === 'Stories';

    const interval = isOBS
      ? DateInterval.tryFrom(cellAsDate(sheet.X16), cellAsDate(sheet.X17))
      : DateInterval.tryFrom(cellAsDate(sheet.Z14), cellAsDate(sheet.Z15));
    if (!interval) {
      throw new Error('Unable to find project date range');
    }

    const stepColumns = findStepColumns(
      sheet,
      isOBS ? 'U20:X20' : 'U18:Z18',
      availableSteps
    );
    const noteFallback = isOBS ? undefined : cellAsString(sheet.AI16);
    const startingRow = 23;

    const productRows = findProductRows(sheet, isOBS, startingRow)
      .map(
        parseProductRow(
          sheet,
          isOBS,
          expandToFullFiscalYears(interval),
          stepColumns,
          noteFallback,
          startingRow
        )
      )
      .filter((row) => row.steps.length > 0);

    // Ignoring for now because not sure how to track progress
    const _otherRows = isOBS
      ? range(17, 20 + 1)
          .map((row) => ({
            title: `Train ${
              cellAsString(sheet[`Y${row}`])?.replace(/:$/, '') ?? ''
            }`,
            count: cellAsNumber(sheet[`AA${row}`]) ?? 0,
          }))
          .filter((row) => row.count > 0)
      : [];

    return productRows;
  }
}

function findProductRows(
  sheet: WorkSheet,
  isOBS: boolean,
  startingRow: number
) {
  const lastRow = sheetRange(sheet)?.e.r ?? 200;
  const matchedRows = [];
  let row = startingRow;
  while (
    row < lastRow &&
    cellAsString(sheet[`Q${row}`]) !== 'Other Goals and Milestones'
  ) {
    if (isProductRow(sheet, isOBS, row)) {
      matchedRows.push(row);
    }
    row++;
  }
  return matchedRows;
}

const isProductRow = (sheet: WorkSheet, isOBS: boolean, row: number) => {
  if (isOBS) {
    return !!cellAsString(sheet[`Q${row}`]);
  }
  const book = Book.tryFind(cellAsString(sheet[`Q${row}`]));
  const totalVerses = cellAsNumber(sheet[`T${row}`]) ?? 0;
  return book && totalVerses > 0 && totalVerses <= book.totalVerses;
};

/**
 * Fuzzy match available steps to their column address.
 */
export function findStepColumns(
  sheet: WorkSheet,
  fromRange: string,
  availableSteps: readonly Step[] = Object.values(Step)
) {
  const matchedColumns: Partial<Record<Step, string>> = {};
  let remainingSteps = availableSteps;
  const selection = utils.decode_range(fromRange);
  const possibleSteps = range(selection.s.c, selection.e.c + 1).flatMap(
    (column) => {
      const cellRef = utils.encode_cell({ r: selection.s.r, c: column });
      const label = cellAsString(sheet[cellRef]);
      return label ? { label, column: utils.encode_col(column) } : [];
    }
  );
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
  return matchedColumns as Record<Step, string>;
}

const parseProductRow =
  (
    sheet: WorkSheet,
    isOBS: boolean,
    projectRange: DateInterval,
    stepColumns: Record<Step, string>,
    noteFallback: string | undefined,
    startingRow: number
  ) =>
  (row: number, index: number): ExtractedRow => {
    const steps = entries(stepColumns).flatMap(([step, column]) => {
      const fiscalYear = cellAsNumber(sheet[`${column}${row}`]);
      const fullFY = fiscalYear ? fullFiscalYear(fiscalYear) : undefined;
      // only include step if it references a fiscal year within the project
      if (!fullFY || !projectRange.intersection(fullFY)) {
        return [];
      }
      return { step, plannedCompleteDate: fullFY.end };
    });
    const note =
      cellAsString(sheet[`${isOBS ? 'Y' : 'AI'}${row}`]) ?? noteFallback;

    const common = {
      rowIndex: row - startingRow + 1,
      order: index + 1,
      steps,
      note,
    };

    if (isOBS) {
      const story = cellAsString(sheet[`Q${row}`])!; // Asserting bc loop verified this
      const scripture = (() => {
        try {
          return parseScripture(
            cellAsString(sheet[`R${row}`])
              // Ignore these two strings that are meaningless here
              ?.replace('Composite', '')
              .replace('other portions', '') ?? ''
          );
        } catch (e) {
          return [];
        }
      })();
      const totalVerses = cellAsNumber(sheet[`T${row}`]);
      return {
        ...common,
        story,
        scripture,
        totalVerses,
        composite: cellAsString(sheet[`S${row}`])?.toUpperCase() === 'Y',
        placeholder: scripture.length === 0 && !totalVerses,
      };
    }
    return {
      ...common,
      bookName: cellAsString(sheet[`Q${row}`])!, // Asserting bc loop verified this
      totalVerses: cellAsNumber(sheet[`T${row}`])!, // Asserting bc loop verified this
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
