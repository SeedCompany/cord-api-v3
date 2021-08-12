import { Injectable } from '@nestjs/common';
import { CellObject, read, WorkBook, WorkSheet } from 'xlsx';
import { CalendarDate, fiscalQuarter, fiscalYear } from '../../common';
import { ILogger, Logger } from '../../core';
import { FileService, FileVersion } from '../file';
import { ProgressSummary as Progress } from './dto';

@Injectable()
export class ProgressExtractor {
  constructor(
    private readonly files: FileService,
    @Logger('progress:extractor') private readonly logger: ILogger
  ) {}

  extract(pnp: WorkBook, file: FileVersion, date: CalendarDate) {
    const sheet = pnp.Sheets.Progress;
    if (!sheet) {
      this.logger.warning('Unable to find progress sheet in pnp file', {
        name: file.name,
        id: file.id,
      });
      return null;
    }

    const yearRow = findFiscalYearRow(sheet, fiscalYear(date));
    if (!yearRow) {
      this.logger.warning('Unable to find fiscal year in pnp file', {
        name: file.name,
        id: file.id,
      });
      return null;
    }

    const quarterCol = ['AH', 'AI', 'AJ', 'AK'][fiscalQuarter(date) - 1];
    return {
      reportPeriod: this.summaryFrom(sheet, yearRow, quarterCol, quarterCol),
      fiscalYear: this.summaryFrom(sheet, yearRow, 'AL', 'AM'),
      cumulative: this.summaryFrom(sheet, yearRow, 'AN', 'AO'),
    };
  }

  async readWorkbook(file: FileVersion) {
    const buffer = await this.files.downloadFileVersion(file.id);
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

const findFiscalYearRow = (sheet: WorkSheet, fiscalYear: number) => {
  let i = 20;
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

const cellAsNumber = (cell: CellObject) =>
  cell && cell.t === 'n' && typeof cell.v === 'number' ? cell.v : undefined;
