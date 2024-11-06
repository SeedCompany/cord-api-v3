import { Injectable } from '@nestjs/common';
import { oneLine } from 'common-tags';
import { clamp, round } from 'lodash';
import {
  CalendarDate,
  fiscalQuarter,
  fiscalQuarterLabel,
  fiscalYear,
} from '~/common';
import { Column, Row } from '~/common/xlsx.util';
import { Downloadable } from '../file/dto';
import { Pnp, ProgressSheet } from '../pnp';
import { PnpProgressExtractionResult } from '../pnp/extraction-result';
import { ProgressSummary as Progress } from './dto';

@Injectable()
export class ProgressSummaryExtractor {
  async extract(
    file: Downloadable<unknown>,
    date: CalendarDate,
    result: PnpProgressExtractionResult,
  ) {
    const pnp = await Pnp.fromDownloadable(file);
    const sheet = pnp.progress;

    if (!(sheet.reportingQuarter && date <= sheet.reportingQuarter.end)) {
      const cells = sheet.reportingQuarterCells;
      result.addProblem({
        severity: 'Error',
        groups: 'Mismatched Reporting Quarter',
        message: oneLine`
          The PnP's Reporting Quarter
            (_${
              sheet.reportingQuarter
                ? fiscalQuarterLabel(sheet.reportingQuarter.start)
                : 'undetermined'
            }_ \`${cells.quarter.ref}\`/\`${cells.year.ref}\`)
          needs to be *at least* the quarter of this CORD report
            (_${fiscalQuarterLabel(date)}_).
        `,
        source: cells.quarter,
      });
      return {};
    }

    const currentFiscalYear = fiscalYear(date);
    const yearRow = findFiscalYearRow(sheet, currentFiscalYear);
    const quarterCol = sheet.columnForQuarterSummary(fiscalQuarter(date));
    return {
      reportPeriod: summaryFrom(yearRow, quarterCol, quarterCol),
      fiscalYear: summaryFrom(yearRow, ...sheet.columnsForFiscalYear),
      cumulative: findLatestCumulative(yearRow),
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

const findLatestCumulative = (currentYear: Row<ProgressSheet>) => {
  const { sheet } = currentYear;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const summary = summaryFrom(currentYear, ...sheet.columnsForCumulative);
    if (summary) {
      return summary;
    }
    currentYear = currentYear.move(-1);
    if (currentYear < sheet.summaryFiscalYears.start.row) {
      return null;
    }
  }
};

const summaryFrom = (
  fiscalYear: Row<ProgressSheet>,
  plannedColumn: Column,
  actualColumn: Column,
): Progress => {
  let planned = fiscalYear.cell(plannedColumn).asNumber ?? 0;
  let actual = fiscalYear.cell(actualColumn).asNumber ?? 0;
  const normalize = (val: number) => {
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
