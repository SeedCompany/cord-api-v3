import { Injectable } from '@nestjs/common';
import levenshtein from 'js-levenshtein-esm';
import { sortBy, startCase, without } from 'lodash';
import { read, utils, WorkSheet } from 'xlsx';
import {
  DateInterval,
  entries,
  expandToFullFiscalYears,
  fullFiscalYear,
} from '../../common';
import { cellAsDate, cellAsNumber, cellAsString } from '../../common/xlsx.util';
import { ILogger, Logger } from '../../core';
import { Downloadable, File } from '../file';
import { Book } from '../scripture/books';
import { ProductStep as Step } from './dto';

@Injectable()
export class ProductExtractor {
  constructor(@Logger('product:extractor') private readonly logger: ILogger) {}

  async extract(
    file: Downloadable<Pick<File, 'id'>>,
    availableSteps: readonly Step[]
  ) {
    const buffer = await file.download();
    const pnp = read(buffer, { type: 'buffer', cellDates: true });

    const sheet = pnp.Sheets.Planning;
    if (!sheet) {
      this.logger.warning('Unable to find planning sheet', {
        id: file.id,
      });
      return [] as const;
    }

    const interval = DateInterval.tryFrom(
      cellAsDate(sheet.Z14),
      cellAsDate(sheet.Z15)
    );
    if (!interval) {
      this.logger.warning('Unable to find project date range', {
        id: file.id,
      });
      return [];
    }

    const stepColumns = findStepColumns(sheet, 'U18:Z18', availableSteps);

    return findProductRows(sheet)
      .map(
        parseProductRow(sheet, expandToFullFiscalYears(interval), stepColumns)
      )
      .filter((row) => row.steps.length > 0);
  }
}

function findProductRows(sheet: WorkSheet) {
  const lastRow = sheet['!ref'] ? utils.decode_range(sheet['!ref']).e.r : 200;
  const matchedRows = [];
  let row = 23;
  while (
    row < lastRow &&
    cellAsString(sheet[`Q${row}`]) !== 'Other Goals and Milestones'
  ) {
    if (
      Book.isValid(cellAsString(sheet[`Q${row}`])) &&
      (cellAsNumber(sheet[`T${row}`]) ?? 0) > 0
    ) {
      matchedRows.push(row);
    }
    row++;
  }
  return matchedRows;
}

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
  const range = utils.decode_range(fromRange);
  for (let column = range.s.c; column <= range.e.c; ++column) {
    const cellRef = utils.encode_cell({ r: range.s.r, c: column });
    const label = cellAsString(sheet[cellRef]);
    if (!label) {
      continue;
    }
    const distances = remainingSteps.map((step) => {
      const humanLabel = startCase(step).replace(' And ', ' & ');
      const distance = levenshtein(label, humanLabel);
      return [step, distance] as const;
    });
    // Grab the
    const chosen = sortBy(
      // 5 is too far ignore those
      distances.filter(([_, distance]) => distance < 5),
      ([_, distance]) => distance
    )[0][0];
    matchedColumns[chosen] = utils.encode_col(column);

    remainingSteps = without(remainingSteps, chosen);
  }
  return matchedColumns as Record<Step, string>;
}

const parseProductRow =
  (
    sheet: WorkSheet,
    projectRange: DateInterval,
    stepColumns: Record<Step, string>
  ) =>
  (row: number) => {
    const bookName = cellAsString(sheet[`Q${row}`])!; // Asserting bc loop verified this
    const totalVerses = cellAsNumber(sheet[`T${row}`])!;
    // include step if it references a fiscal year within the project
    const includeStep = (column: string) => {
      const fiscalYear = cellAsNumber(sheet[`${column}${row}`]);
      return (
        fiscalYear && projectRange.intersection(fullFiscalYear(fiscalYear))
      );
    };
    const steps: readonly Step[] = entries(stepColumns).flatMap(
      ([step, column]) => (includeStep(column) ? step : [])
    );
    return { bookName, totalVerses, steps };
  };
