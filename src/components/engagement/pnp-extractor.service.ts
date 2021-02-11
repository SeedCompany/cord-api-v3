import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { read, utils, WorkBook } from 'xlsx';
import { Session } from '../../common';
import { ILogger, Logger } from '../../core';
import {
  CreateDefinedFileVersionInput,
  FileService,
  FileVersion,
} from '../file';
import { PnpData } from './dto';

@Injectable()
export class PnpExtractor {
  constructor(
    private readonly files: FileService,
    @Logger('pnp:extractor') private readonly logger: ILogger
  ) {}

  async extract(
    input: CreateDefinedFileVersionInput,
    session: Session
  ): Promise<PnpData | null> {
    const file = await this.files.getFileVersion(input.uploadId, session);
    const pnp = await this.downloadWorkbook(file);
    const workbookData = this.parseWorkbook(pnp, file);
    if (!workbookData) {
      return null;
    }
    const timeData = this.parseYearAndQuarter(file.name);
    return { ...workbookData, ...timeData };
  }

  private parseWorkbook(pnp: WorkBook, file: FileVersion) {
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
          return this.parseRawData(row.AC, row?.AD, row?.AE);
        }
        // other 2020 version
        else if (!pnp.Sheets.Harvest && row?.AL === 'Summary Info ====>') {
          return this.parseRawData(row?.AN, row?.AO, row?.AP);
        }
        // row.CK is current year. if current year is greater than 2019 grab data
        else if (!pnp.Sheets.Harvest && parseInt(row?.CK) >= 2019) {
          return this.parseRawData(row?.CT, row?.CU, row?.CV);
          // 09 version
          // BX is current year
        } else if (!pnp.Sheets.Harvest && parseInt(row?.BX) >= 2019) {
          return this.parseRawData(row?.BZ, row?.CA, row?.CB);
        }
      }
    } catch (e) {
      this.logger.warning('Unable to parse summary data in pnp file', {
        name: file.name,
        id: file.id,
        exception: e,
      });
      return null;
    }

    this.logger.warning('Unable to find summary data in pnp file', {
      name: file.name,
      id: file.id,
    });
    return null;
  }

  private async downloadWorkbook(file: FileVersion) {
    const buffer = await this.files.downloadFileVersion(file.id);
    return read(buffer, { type: 'buffer' });
  }

  private parseRawData(
    progressPlanned: string,
    progressActual: string,
    variance: string
  ) {
    if (!progressPlanned || !progressActual || !variance) return null;
    return {
      progressPlanned: parsePercent(progressPlanned),
      progressActual: parsePercent(progressActual),
      variance: parsePercent(variance),
    };
  }

  private parseYearAndQuarter(fileName: string) {
    // I don't want to mess with this since there are some files names with a range
    // i.e. fy18-20. I think this naming has become outmoded anyway.
    const fyReg = /fy19|fy20|fy21/i;
    const quarterReg = /q[1-4]/i;

    const currentYear = DateTime.local().year;

    // split by anything that's not a digit
    // this removes any non-digit characters and allows for distinction
    // between 4 digit and larger numbers (2021 vs 201983)
    const fourDigitYears = fileName
      .split(/[^\d]/)
      .filter((i) => i && i.length === 4)
      .map((i) => Number(i))
      .filter((i) => i <= currentYear && i > 1990);

    const year = fourDigitYears.length
      ? Math.max(...fourDigitYears)
      : fyReg.exec(fileName)
      ? Number('20' + fyReg.exec(fileName)![0].toLowerCase().replace('fy', ''))
      : 0;
    const quarter = quarterReg.exec(fileName)
      ? Number(quarterReg.exec(fileName)![0].toLowerCase().replace('q', ''))
      : 0;

    return { year, quarter };
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
