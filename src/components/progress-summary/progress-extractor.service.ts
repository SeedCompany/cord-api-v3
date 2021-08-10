import { Injectable } from '@nestjs/common';
import { read, utils, WorkBook } from 'xlsx';
import { NotImplementedException } from '../../common';
import { ILogger, Logger } from '../../core';
import { FileService, FileVersion } from '../file';
import { ProgressSummary as Progress } from './dto';

@Injectable()
export class ProgressExtractor {
  constructor(
    private readonly files: FileService,
    @Logger('progress:extractor') private readonly logger: ILogger
  ) {}

  extractCumulative(pnp: WorkBook, file: FileVersion): Progress | null {
    // new standard 2020 version has new sheet "Harvest" which isolates relevant progress data
    const sheet = pnp.Sheets.Harvest ?? pnp.Sheets.Progress;
    if (!sheet) {
      this.logger.warning('Unable to parse pnp file', {
        name: file.name,
        id: file.id,
      });
      return null;
    }

    const rows = utils.sheet_to_json<any>(sheet, {
      header: 'A',
      raw: false,
    });
    try {
      for (const row of rows) {
        // new standard 11/09/2020
        if (pnp.Sheets.Harvest && /\d/.test(row?.AC)) {
          return this.parseRawData(row.AC, row?.AD);
        }
        // other 2020 version
        else if (!pnp.Sheets.Harvest && row?.AL === 'Summary Info ====>') {
          return this.parseRawData(row?.AN, row?.AO);
        }
        // row.CK is current year. if current year is greater than 2019 grab data
        else if (!pnp.Sheets.Harvest && parseInt(row?.CK) >= 2019) {
          return this.parseRawData(row?.CT, row?.CU);
          // 09 version
          // BX is current year
        } else if (!pnp.Sheets.Harvest && parseInt(row?.BX) >= 2019) {
          return this.parseRawData(row?.BZ, row?.CA);
        }
      }
    } catch (e) {
      this.logger.warning(
        'Unable to parse cumulative summary data in pnp file',
        {
          name: file.name,
          id: file.id,
          exception: e,
        }
      );
      return null;
    }

    this.logger.warning('Unable to find cumulative summary data in pnp file', {
      name: file.name,
      id: file.id,
    });
    return null;
  }

  extractReportPeriod(pnp: WorkBook, file: FileVersion): Progress | null {
    // TODO implement extraction
    new NotImplementedException().with(pnp, file);
    return null;
  }

  extractFiscalYear(pnp: WorkBook, file: FileVersion): Progress | null {
    // TODO implement extraction
    new NotImplementedException().with(pnp, file);
    return null;
  }

  async readWorkbook(file: FileVersion) {
    const buffer = await this.files.downloadFileVersion(file.id);
    return read(buffer, { type: 'buffer' });
  }

  private parseRawData(planned: string, actual: string): Progress | null {
    if (!planned || !actual) return null;
    return {
      planned: parsePercent(planned),
      actual: parsePercent(actual),
    };
  }
}

const parsePercent = (raw: string) => {
  const num = raw.replace('%', '');
  if (!isNumeric(num)) {
    throw new Error(`Could not parse "${raw}" to a float`);
  }
  return parseFloat(num);
};

const isNumeric = (str: string) => !isNaN(parseFloat(str));
