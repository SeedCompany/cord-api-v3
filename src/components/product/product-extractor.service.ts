import { Injectable } from '@nestjs/common';
import { read, WorkSheet } from 'xlsx';
import { DateInterval, entries, fullFiscalYear } from '../../common';
import { cellAsDate, cellAsNumber, cellAsString } from '../../common/xlsx.util';
import { ILogger, Logger } from '../../core';
import { Downloadable, File } from '../file';
import { MethodologyStep } from './dto';

@Injectable()
export class ProductExtractor {
  constructor(@Logger('product:extractor') private readonly logger: ILogger) {}

  async extract(file: Downloadable<Pick<File, 'id'>>) {
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
      cellAsDate(sheet.Z13),
      cellAsDate(sheet.Z15)
    );
    if (!interval) {
      this.logger.warning('Unable to find project date range', {
        id: file.id,
      });
      return [];
    }

    return findProductRows(sheet).map(parseProductRow(sheet, interval));
  }
}

function findProductRows(sheet: WorkSheet) {
  const matchedRows = [];
  let row = 23;
  while (
    cellAsString(sheet[`Q${row}`]) &&
    cellAsString(sheet[`Q${row}`]) !== 'Other Goals and Milestones' &&
    (cellAsNumber(sheet[`T${row}`]) ?? 0) > 0
  ) {
    matchedRows.push(row);
    row++;
  }
  return matchedRows;
}

const parseProductRow =
  (sheet: WorkSheet, projectRange: DateInterval) => (row: number) => {
    const bookName = cellAsString(sheet[`Q${row}`])!; // Asserting bc loop verified this
    const totalVerses = cellAsNumber(sheet[`T${row}`])!;
    const stepColumns = {
      [MethodologyStep.ExegesisAndFirstDraft]: 'U',
      [MethodologyStep.TeamCheck]: 'V',
      [MethodologyStep.CommunityTesting]: 'W',
      [MethodologyStep.BackTranslation]: 'X',
      [MethodologyStep.ConsultantCheck]: 'Y',
      [MethodologyStep.Completed]: 'Z',
    };
    // include step if it references a fiscal year within the project
    const includeStep = (column: string) => {
      const fiscalYear = cellAsNumber(sheet[`${column}${row}`]);
      return (
        fiscalYear && projectRange.intersection(fullFiscalYear(fiscalYear))
      );
    };
    const steps: readonly MethodologyStep[] = entries(stepColumns).flatMap(
      ([step, column]) => (includeStep(column) ? step : [])
    );
    return { bookName, totalVerses, steps };
  };
