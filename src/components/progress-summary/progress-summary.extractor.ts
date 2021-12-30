import { Injectable } from '@nestjs/common';
import { memoize } from 'lodash';
import { CalendarDate, fiscalQuarter, fiscalYear } from '../../common';
import { Row, Sheet, WorkBook } from '../../common/xlsx.util';
import { Downloadable } from '../file';
import { ProgressSummary as Progress } from './dto';

@Injectable()
export class ProgressSummaryExtractor {
  async extract(file: Downloadable<unknown>, date: CalendarDate) {
    const buffer = await file.download();
    const pnp = WorkBook.fromBuffer(buffer);
    const sheet = pnp.sheet('Progress');

    const isOBS = sheet.cell('P19').asString === 'Stories';

    const yearRow = findFiscalYearRow(sheet, fiscalYear(date), isOBS);

    const convertToPercent = percentConverter(() => {
      const total = sheet.cell('AG18').asNumber;
      if (total) {
        return total;
      }
      throw new Error('Unable to find total verse equivalents in pnp file');
    });

    const quarterCol = ['AH', 'AI', 'AJ', 'AK'][fiscalQuarter(date) - 1];
    return {
      reportPeriod: convertToPercent(
        this.summaryFrom(yearRow, quarterCol, quarterCol)
      ),
      fiscalYear: convertToPercent(this.summaryFrom(yearRow, 'AL', 'AM')),
      cumulative: convertToPercent(this.summaryFrom(yearRow, 'AN', 'AO')),
    };
  }

  private summaryFrom(
    fiscalYear: Row,
    plannedColumn: string,
    actualColumn: string
  ): Progress | null {
    const planned = fiscalYear.cell(plannedColumn).asNumber;
    const actual = fiscalYear.cell(actualColumn).asNumber;
    return planned && actual ? { planned, actual } : null;
  }
}

const findFiscalYearRow = (
  sheet: Sheet,
  fiscalYear: number,
  isOBS: boolean
) => {
  let row = sheet.row(isOBS ? 28 : 20);
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const cell = row.cell('AG');
    if (cell.asNumber === fiscalYear) {
      return row;
    }
    if (!cell.isNumber) {
      throw new Error('Unable to find fiscal year in pnp file');
    }
    row = row.next();
  }
};

/**
 * The PnP has the macro option to do calculations as percents or verse equivalents.
 * We need to standardize as percents here.
 */
const percentConverter = (getTotalVerseEquivalents: () => number) => {
  const memoTotalVerseEquivalents = memoize(getTotalVerseEquivalents);
  return (summary: Progress | null) => {
    if (!summary) {
      return null;
    }
    if (summary.planned <= 1) {
      // Already a percent so no conversion needed
      return summary;
    }
    const totalVerseEquivalents = memoTotalVerseEquivalents();
    return {
      planned: summary.planned / totalVerseEquivalents,
      actual: summary.actual / totalVerseEquivalents,
    };
  };
};
