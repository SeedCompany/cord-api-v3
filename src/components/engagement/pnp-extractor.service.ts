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
    const workbook = await this.downloadWorkbook(input, session);

    const pnp = read(workbook, { type: 'buffer' });
    const progressSheet: any[] = utils.sheet_to_json(
      // new standard 2020 version has new sheet "Harvest" which isolates relevant progress data
      pnp.Sheets.Harvest ?? pnp.Sheets.Progress,
      {
        header: 'A',
        raw: false,
      }
    );
    const parseRawData = (
      progressPlanned: string,
      progressActual: string,
      variance: string
    ) => {
      if (!progressPlanned || !progressActual || !variance) return null;
      const parsePercent = (raw: string) => parseFloat(raw.replace('%', ''));
      return {
        progressPlanned: parsePercent(progressPlanned),
        progressActual: parsePercent(progressActual),
        variance: parsePercent(variance),
      };
    };
    for (const row of progressSheet) {
      // new standard 11/09/2020
      if (pnp.Sheets.Harvest && /\d/.test(row?.AC)) {
        return parseRawData(row.AC, row?.AD, row?.AE);
      }
      // other 2020 version
      else if (!pnp.Sheets.Harvest && row?.AL === 'Summary Info ====>') {
        return parseRawData(row?.AN, row?.AO, row?.AP);
      }
      // row.CK is current year. if current year is greater than 2019 grab data
      else if (!pnp.Sheets.Harvest && parseInt(row?.CK) >= 2019) {
        return parseRawData(row?.CT, row?.CU, row?.CV);
        // 09 version
        // BX is current year
      } else if (!pnp.Sheets.Harvest && parseInt(row?.BX) >= 2019) {
        return parseRawData(row?.BZ, row?.CA, row?.CB);
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
}
