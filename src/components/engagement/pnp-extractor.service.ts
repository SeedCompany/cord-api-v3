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
  ): Promise<PnpData | null> {
    const pnp = await this.downloadWorkbook(input, session);

    const progressSheet = utils.sheet_to_json<any>(
      // new standard 2020 version has new sheet "Harvest" which isolates relevant progress data
      pnp.Sheets.Harvest ?? pnp.Sheets.Progress,
      {
        header: 'A',
        raw: false,
      }
    );

    for (const row of progressSheet) {
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

    return null;
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

  private parseRawData(
    progressPlanned: string,
    progressActual: string,
    variance: string
  ): PnpData | null {
    if (!progressPlanned || !progressActual || !variance) return null;
    const parsePercent = (raw: string) => parseFloat(raw.replace('%', ''));
    return {
      progressPlanned: parsePercent(progressPlanned),
      progressActual: parsePercent(progressActual),
      variance: parsePercent(variance),
    };
  }
}
