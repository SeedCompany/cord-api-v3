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

    const pnp = read(workbook, { type: 'buffer' });
    const progressSheet = utils.sheet_to_json(pnp.Sheets.Progress, {
      header: 'A',
      raw: false,
    });
    let progressPlanned = '';
    let progressActual = '';
    let variance = '';
    progressSheet.forEach((row: any) => {
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
    });
    return {
      progressPlanned: progressPlanned
        ? parseFloat(progressPlanned.replace('%', ''))
        : 0.0,
      progressActual: progressActual
        ? parseFloat(progressActual.replace('%', ''))
        : 0.0,
      variance: variance ? parseFloat(variance.replace('%', '')) : 0.0,
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
