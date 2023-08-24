import { ModuleRef } from '@nestjs/core';
import { asyncPool } from '@seedcompany/common';
import { node, relation } from 'cypher-query-builder';
import { IdOf } from '~/common';
import { BaseMigration, Migration } from '~/core/database';
import { ACTIVE } from '~/core/database/query';
import { FileVersion } from '../dto';
import { FileService } from '../file.service';
import { MediaService } from './media.service';

@Migration('2023-08-24T15:00:00')
export class DetectExistingMediaMigration extends BaseMigration {
  constructor(
    private readonly mediaService: MediaService,
    private readonly moduleRef: ModuleRef,
  ) {
    super();
  }

  async up() {
    const fileService = this.moduleRef.get(FileService, { strict: false });
    await asyncPool(5, this.grabFileVersionsToDetect(), async (f) => {
      this.logger.info('Detecting', f);
      try {
        const d = fileService.asDownloadable(f, f.file);
        const result = await this.mediaService.detectAndSave(d);
        this.logger.info('Detected and saved media', {
          ...f,
          ...(result ?? {}),
        });
      } catch (e) {
        this.logger.error('Failed to detect media', { ...f, exception: e });
      }
    });
  }

  private async *grabFileVersionsToDetect() {
    let page = 0;
    const size = 100;
    do {
      this.logger.info(`Grabbing page of files to detect ${page}`);

      const currentPage = await this.db
        .query()
        .match([
          node('fv', 'FileVersion'),
          relation('out', '', 'mimeType', ACTIVE),
          node('mt', 'Property'),
        ])
        .raw(
          `where not (fv)-[:media]->(:Media)
            and (mt.value starts with 'video/'
              or mt.value starts with 'audio/'
              or mt.value starts with 'image/')`,
        )
        .return<{ file: IdOf<FileVersion>; mimeType: string }>(
          'fv.id as file, mt.value as mimeType',
        )
        .orderBy('fv.createdAt')
        .skip(page * size)
        .limit(size)
        .run();

      if (currentPage.length === 0) {
        return;
      }
      yield* currentPage;
      page++;
      // eslint-disable-next-line no-constant-condition
    } while (true);
  }
}
