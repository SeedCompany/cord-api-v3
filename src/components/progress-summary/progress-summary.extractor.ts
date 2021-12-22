import { Injectable } from '@nestjs/common';
import { memoize } from 'lodash';
import { CellObject, read, WorkBook, WorkSheet } from 'xlsx';
import { CalendarDate, fiscalQuarter, fiscalYear } from '../../common';
import { cellAsNumber, cellAsString } from '../../common/xlsx.util';
import { ILogger, Logger } from '../../core';
import { Downloadable, FileNode } from '../file';
import { ProgressSummary as Progress } from './dto';

@Injectable()
export class ProgressSummaryExtractor {
  constructor(
    @Logger('progress-summary:extractor') private readonly logger: ILogger
  ) {}

  extract(pnp: WorkBook, file: FileNode, date: CalendarDate) {
    const sheet = pnp.Sheets.Progress;
    if (!sheet) {
      this.logger.warning('Unable to find progress sheet in pnp file', {
        name: file.name,
        id: file.id,
      });
      return null;
    }

    const isOBS = cellAsString(sheet.P19) === 'Stories';

    const yearRow = findFiscalYearRow(sheet, fiscalYear(date), isOBS);
    if (!yearRow) {
      this.logger.warning('Unable to find fiscal year in pnp file', {
        name: file.name,
        id: file.id,
      });
      return null;
    }

    const convertToPercent = percentConverter(() => {
      const total = cellAsNumber(sheet.AG18);
      if (total) {
        return total;
      }
      this.logger.warning(
        'Unable to find total verse equivalents in pnp file',
        {
          name: file.name,
          id: file.id,
        }
      );
      return null;
    });

    const quarterCol = ['AH', 'AI', 'AJ', 'AK'][fiscalQuarter(date) - 1];
    return {
      reportPeriod: convertToPercent(
        this.summaryFrom(sheet, yearRow, quarterCol, quarterCol)
      ),
      fiscalYear: convertToPercent(
        this.summaryFrom(sheet, yearRow, 'AL', 'AM')
      ),
      cumulative: convertToPercent(
        this.summaryFrom(sheet, yearRow, 'AN', 'AO')
      ),
    };
  }

  async readWorkbook(file: Downloadable<unknown>) {
    const buffer = await file.download();
    return read(buffer, { type: 'buffer' });
  }

  private summaryFrom(
    sheet: WorkSheet,
    fiscalYearRow: number,
    plannedColumn: string,
    actualColumn: string
  ): Progress | null {
    const planned = cellAsNumber(sheet[`${plannedColumn}${fiscalYearRow}`]);
    const actual = cellAsNumber(sheet[`${actualColumn}${fiscalYearRow}`]);
    return planned && actual ? { planned, actual } : null;
  }
}

const findFiscalYearRow = (
  sheet: WorkSheet,
  fiscalYear: number,
  isOBS: boolean
) => {
  let i = isOBS ? 28 : 20;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const cell: CellObject = sheet[`AG${i}`];
    if (cellAsNumber(cell) === fiscalYear) {
      return i;
    }
    if (!cell || cell.t !== 'n') {
      return null;
    }
    i++;
  }
};

/**
 * The PnP has the macro option to do calculations as percents or verse equivalents.
 * We need to standardize as percents here.
 */
const percentConverter = (getTotalVerseEquivalents: () => number | null) => {
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
    if (!totalVerseEquivalents) {
      // Ignore parsed summary as we cannot convert it to a percent
      return null;
    }
    return {
      planned: summary.planned / totalVerseEquivalents,
      actual: summary.actual / totalVerseEquivalents,
    };
  };
};
