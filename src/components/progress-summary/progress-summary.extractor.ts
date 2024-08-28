import { Injectable } from '@nestjs/common';
import { Nil } from '@seedcompany/common';
import { clamp, round } from 'lodash';
import { CalendarDate, fiscalQuarter, fiscalYear } from '~/common';
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

    const currentFiscalYear = fiscalYear(date);
    const yearRow = findFiscalYearRow(sheet, currentFiscalYear);
    const quarterCol = sheet.columnForQuarterSummary(fiscalQuarter(date));
    return {
      reportPeriod: summaryFrom(
        yearRow,
        quarterCol,
        quarterCol,
        result,
        'Quarterly',
        currentFiscalYear,
      ),
      fiscalYear: summaryFrom(
        yearRow,
        ...sheet.columnsForFiscalYear,
        result,
        'Yearly',
        currentFiscalYear,
      ),
      cumulative: findLatestCumulative(yearRow, result, currentFiscalYear),
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

const findLatestCumulative = (
  currentYear: Row<ProgressSheet>,
  result: PnpProgressExtractionResult,
  currentFiscalYear: number,
) => {
  const { sheet } = currentYear;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const summary = summaryFrom(
      currentYear,
      ...sheet.columnsForCumulative,
      result,
      'Cumulative',
      currentFiscalYear,
    );
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
  result: PnpProgressExtractionResult,
  period: string,
  currentFiscalYear: number,
): Progress | null => {
  const plannedCell = fiscalYear.cell(plannedColumn);
  const actualCell = fiscalYear.cell(actualColumn);
  let planned = plannedCell.asNumber;
  let actual = actualCell.asNumber;
  if (!planned && +plannedColumn !== +actualColumn) {
    result.addProblem({
      severity: 'Error',
      groups: [
        'Missing progress summary percents',
        `The _${period}_ summary percents for _FY${currentFiscalYear}_ is missing`,
      ],
      message: `The _${period} Planned_ percent for _FY${currentFiscalYear}_ \`${plannedCell.ref}\` is missing`,
      source: plannedCell,
    });
  }
  if (!actual) {
    result.addProblem({
      severity: 'Error',
      groups: [
        'Missing progress summary percents',
        `The _${period}_ summary percents for _FY${currentFiscalYear}_ is missing`,
      ],
      message: `The _${period} Actual_ percent for _FY${currentFiscalYear}_ \`${actualCell.ref}\` is missing`,
      source: actualCell,
    });
  }
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
