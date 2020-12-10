import { Injectable } from '@nestjs/common';
import got from 'got';
import { read, utils } from 'xlsx';
import { Session } from '../../common';
import { CreateDefinedFileVersionInput, FileService } from '../file';
import { PnpData } from './dto';

@Injectable()
export class PnpExtractor {
  constructor(private readonly files: FileService) {}

  async extract(
    input: CreateDefinedFileVersionInput,
    session: Session
  ): Promise<PnpData> {
    const workbook = await this.downloadWorkbook(input, session);

    const progressSheet = utils.sheet_to_json<any>(workbook.Sheets.Progress, {
      header: 'A',
      raw: false,
    });
    let progressPlanned = '';
    let progressActual = '';
    let variance = '';
    for (const row of progressSheet) {
      // new version (2020)
      if (row.AL === 'Summary Info ====>') {
        progressPlanned = row.AN;
        progressActual = row.AO;
        variance = row.AP;
      }
      // row.CK is current year. if current year is greater than 2019 grab data
      else if (row.CK && parseInt(row.CK) >= 2019) {
        progressPlanned = row.CT;
        progressActual = row.CU;
        variance = row.CV;
        // 09 version
        // BX is current year
      } else if (row.BX && parseInt(row.BX) >= 2019) {
        progressPlanned = row.BZ;
        progressActual = row.CA;
        variance = row.CB;
      }
    }

    const parsePercent = (raw: string) =>
      raw ? parseFloat(raw.replace('%', '')) : 0.0;
    return {
      progressPlanned: parsePercent(progressPlanned),
      progressActual: parsePercent(progressActual),
      variance: parsePercent(variance),
    };
  }

  private async downloadWorkbook(
    input: CreateDefinedFileVersionInput,
    session: Session
  ) {
    const version = await this.files.getFileVersion(input.uploadId, session);
    const url = await this.files.getDownloadUrl(version);
    const buffer = await got.get(url).buffer();
    return read(buffer, { type: 'buffer' });
  }
}
