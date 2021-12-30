import { Injectable } from '@nestjs/common';
import { MergeExclusive } from 'type-fest';
import { entries } from '../../common';
import { Column, Row, WorkBook } from '../../common/xlsx.util';
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
    const pnp = WorkBook.fromBuffer(buffer);

    const sheet = pnp.sheet('Progress');

    const isOBS = sheet.cell('P19').asString === 'Stories';

    const stepColumns = findStepColumns(sheet.range('R19:AB19'));

    const startingRow = sheet.row(23);

    return findProductProgressRows(startingRow, isOBS).map(
      parseProgressRow(stepColumns, isOBS, startingRow)
    );
  }
}

function findProductProgressRows(startingRow: Row, isOBS: boolean) {
  const lastRow = startingRow.sheet.sheetRange.end.row;
  const matchedRows = [];
  let row = startingRow;
  while (
    row < lastRow &&
    row.cell('P').asString !== 'Other Goals and Milestones'
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
  const book = Book.tryFind(row.cell('P').asString);
  const totalVerses = row.cell('Q').asNumber ?? 0;
  return book && totalVerses > 0 && totalVerses <= book.totalVerses;
};

const parseProgressRow =
  (stepColumns: Record<Step, Column>, isOBS: boolean, startingRow: Row) =>
  (row: Row, index: number): ExtractedRow => {
    const progress = (column: Column) => {
      const cell = row.cell(column);
      if (cell.asString?.startsWith('Q')) {
        // Q# means completed that quarter
        return 100;
      }
      const percentDecimal = cell.asNumber;
      return percentDecimal ? percentDecimal * 100 : undefined;
    };
    const steps = entries(stepColumns).map(
      ([step, column]): StepProgressInput => ({
        step,
        completed: progress(column),
      })
    );
    const common = {
      rowIndex: row.a1 - startingRow.a1 + 1,
      order: index + 1,
      steps,
    };
    if (isOBS) {
      const story = row.cell('Q').asString!; // Asserting bc loop verified this
      return { ...common, story };
    }
    const bookName = row.cell('P').asString!; // Asserting bc loop verified this
    const totalVerses = row.cell('Q').asNumber!; // Asserting bc loop verified this
    return { ...common, bookName, totalVerses };
  };
