import { Injectable } from '@nestjs/common';
import { read, WorkBook, WorkSheet } from 'xlsx';
import { ILogger, Logger } from '../../core';
import { FileService, FileVersion } from '../file';
import { ProgressSummary as Progress } from './dto';

@Injectable()
export class ProgressExtractor {
  constructor(
    private readonly files: FileService,
    @Logger('progress:extractor') private readonly logger: ILogger
  ) {}

  extractCumulative(
    pnp: WorkBook,
    file: FileVersion,
    fiscalYear: number
  ): Progress | null {
    const sheet = pnp.Sheets.Progress;
    if (!sheet) {
      this.logger.warning('Unable to parse pnp file', {
        name: file.name,
        id: file.id,
      });
      return null;
    }

    const fiscalYearRow = findFiscalYearRow(sheet, fiscalYear);
    if (!fiscalYearRow) {
      this.logger.warning(
        'Unable to find cumulative summary data in pnp file',
        {
          name: file.name,
          id: file.id,
        }
      );
      return null;
    }

    return this.parseRawData(
      sheet[`AN${fiscalYearRow}`].v,
      sheet[`AO${fiscalYearRow}`].v
    );
  }

  extractReportPeriod(
    pnp: WorkBook,
    file: FileVersion,
    fiscalQuarter: number,
    fiscalYear: number
  ): Progress | null {
    const sheet = pnp.Sheets.Progress;
    if (!sheet) {
      this.logger.warning('Unable to parse pnp file', {
        name: file.name,
        id: file.id,
      });
      return null;
    }

    const fiscalYearRow = findFiscalYearRow(sheet, fiscalYear);
    const fiscalQuarterCol = findFiscalQuarterColumn(sheet, fiscalQuarter);
    if (!fiscalYearRow || !fiscalQuarterCol) {
      this.logger.warning(
        'Unable to find report period summary data in pnp file',
        {
          name: file.name,
          id: file.id,
        }
      );
      return null;
    }

    return this.parseRawData(
      sheet[`A${fiscalQuarterCol}${fiscalYearRow}`].v,
      sheet[`A${fiscalQuarterCol}${fiscalYearRow}`].v
    );
  }

  extractFiscalYear(
    pnp: WorkBook,
    file: FileVersion,
    fiscalYear: number
  ): Progress | null {
    const sheet = pnp.Sheets.Progress;
    if (!sheet) {
      this.logger.warning('Unable to parse pnp file', {
        name: file.name,
        id: file.id,
      });
      return null;
    }

    const fiscalYearRow = findFiscalYearRow(sheet, fiscalYear);
    if (!fiscalYearRow) {
      this.logger.warning(
        'Unable to find fiscal year summary data in pnp file',
        {
          name: file.name,
          id: file.id,
        }
      );
      return null;
    }

    return this.parseRawData(
      sheet[`AL${fiscalYearRow}`].v,
      sheet[`AM${fiscalYearRow}`].v
    );
  }

  async readWorkbook(file: FileVersion) {
    const buffer = await this.files.downloadFileVersion(file.id);
    return read(buffer, { type: 'buffer' });
  }

  private parseRawData(planned: string, actual: string): Progress | null {
    if (!planned || !actual) return null;
    return {
      planned: parseFloat(planned),
      actual: parseFloat(actual),
    };
  }
}

const findFiscalYearRow = (sheet: WorkSheet, fiscalYear: number) => {
  for (let i = 20; i < 40; i++) {
    const cell = sheet[`AG${i}`];
    if (cell.v === fiscalYear) {
      return i;
    }
  }
  return null;
};

const findFiscalQuarterColumn = (sheet: WorkSheet, fiscalQuarter: number) => {
  const cols = ['H', 'I', 'J', 'K'];
  for (const col of cols) {
    const cell = sheet[`A${col}18`];
    const quarter = cell.v.split('Q')[1];
    if (parseInt(quarter) === fiscalQuarter) {
      return col;
    }
  }
  return null;
};

// const parsePercent = (raw: string) => {
//   const num = raw.replace('%', '');
//   if (!isNumeric(num)) {
//     throw new Error(`Could not parse "${raw}" to a float`);
//   }
//   return parseFloat(num);
// };

// const isNumeric = (str: string) => !isNaN(parseFloat(str));
