import { Injectable } from '@nestjs/common';
import { MergeExclusive } from 'type-fest';
import { CellObject, read, WorkSheet } from 'xlsx';
import { entries } from '../../common';
import { cellAsNumber, cellAsString, sheetRange } from '../../common/xlsx.util';
import { Downloadable } from '../file';
import { ProductStep as Step } from '../product';
import { findStepColumns } from '../product/product-extractor.service';
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
    const buffer = await file.download();
    const pnp = read(buffer, { type: 'buffer' });

    const sheet = pnp.Sheets.Progress;
    if (!sheet) {
      throw new Error('Unable to find progress sheet in pnp file');
    }

    const isOBS = cellAsString(sheet.P19) === 'Stories';

    const stepColumns = findStepColumns(sheet, 'R19:AB19');

    const startingRow = 23;

    return findProductProgressRows(sheet, isOBS, startingRow).map(
      parseProgressRow(sheet, stepColumns, isOBS, startingRow)
    );
  }
}

function findProductProgressRows(
  sheet: WorkSheet,
  isOBS: boolean,
  startingRow: number
) {
  const lastRow = sheetRange(sheet)?.e.r ?? 200;
  const matchedRows = [];
  let row = startingRow;
  while (
    row < lastRow &&
    cellAsString(sheet[`P${row}`]) !== 'Other Goals and Milestones'
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
  const book = Book.tryFind(cellAsString(sheet[`P${row}`]));
  const totalVerses = cellAsNumber(sheet[`Q${row}`]) ?? 0;
  return book && totalVerses > 0 && totalVerses <= book.totalVerses;
};

const parseProgressRow =
  (
    sheet: WorkSheet,
    stepColumns: Record<Step, string>,
    isOBS: boolean,
    startingRow: number
  ) =>
  (row: number, index: number): ExtractedRow => {
    const progress = (column: string) => {
      const cell: CellObject = sheet[`${column}${row}`];
      if (cellAsString(cell)?.startsWith('Q')) {
        // Q# means completed that quarter
        return 100;
      }
      const percentDecimal = cellAsNumber(cell);
      return percentDecimal ? percentDecimal * 100 : undefined;
    };
    const steps = entries(stepColumns).map(
      ([step, column]): StepProgressInput => ({
        step,
        completed: progress(column),
      })
    );
    const common = {
      rowIndex: row - startingRow + 1,
      order: index + 1,
      steps,
    };
    if (isOBS) {
      const story = cellAsString(sheet[`Q${row}`])!; // Asserting bc loop verified this
      return { ...common, story };
    }
    const bookName = cellAsString(sheet[`P${row}`])!; // Asserting bc loop verified this
    const totalVerses = cellAsNumber(sheet[`Q${row}`])!; // Asserting bc loop verified this
    return { ...common, bookName, totalVerses };
  };
