import { Injectable } from '@nestjs/common';
import got from 'got';
import { read } from 'xlsx';
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

    // TODO
    return {
      progressPlanned: 0.0,
      progressActual: 0.0,
      variance: 0.0,
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
