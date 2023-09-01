import { Injectable } from '@nestjs/common';
import { Nil } from '@seedcompany/common';
import { clamp, round } from 'lodash';
import { CalendarDate, fiscalQuarter, fiscalYear } from '../../common';
import { Column, Row } from '../../common/xlsx.util';
import { Downloadable } from '../file';
import { Pnp, ProgressSheet } from '../pnp';
import { ProgressSummary as Progress } from './dto';

@Injectable()
export class ProgressSummaryExtractor {
  async extract(file: Downloadable<unknown>, date: CalendarDate) {
    const pnp = await Pnp.fromDownloadable(file);
    const sheet = pnp.progress;

    const yearRow = findFiscalYearRow(sheet, fiscalYear(date));
    const quarterCol = sheet.columnForQuarterSummary(fiscalQuarter(date));
    return {
      reportPeriod: summaryFrom(yearRow, quarterCol, quarterCol),
      fiscalYear: summaryFrom(yearRow, ...sheet.columnsForFiscalYear),
      cumulative: summaryFrom(yearRow, ...sheet.columnsForCumulative),
    };
  }
}

const findFiscalYearRow = (sheet: ProgressSheet, fiscalYear: number) => {
  for (const cell of sheet.summaryFiscalYears.walkDown()) {
    if (cell.asNumber === fiscalYear) {
      return cell.row;
    }
  }
  throw new Error('Unable to find fiscal year in pnp file');
};

const summaryFrom = (
  fiscalYear: Row<ProgressSheet>,
  plannedColumn: Column,
  actualColumn: Column,
): Progress | null => {
  let planned = fiscalYear.cell(plannedColumn).asNumber;
  let actual = fiscalYear.cell(actualColumn).asNumber;
  if (!planned && !actual) {
    return null;
  }
  const normalize = (val: number | Nil) => {
    if (!val) return 0;
    if (round(val, 4) > 1) {
      // The PnP has the macro option to do calculations as percents or verse equivalents.
      // We need to standardize as percents here.
      val /= fiscalYear.sheet.totalVerseEquivalents;
    }
    return clamp(val, 0, 1);
  };
  planned = normalize(planned);
  actual = normalize(actual);
  return { planned, actual };
};
