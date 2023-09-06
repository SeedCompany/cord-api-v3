import { ModuleRef } from '@nestjs/core';
import { node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '~/core/database';
import { ACTIVE } from '~/core/database/query';
import { FileVersion } from '../dto';
import { FileRepository } from '../file.repository';
import { MediaService } from './media.service';

@Migration('2023-09-06T12:00:00')
export class DetectExistingMediaMigration extends BaseMigration {
  constructor(
    private readonly mediaService: MediaService,
    private readonly moduleRef: ModuleRef,
  ) {
    super();
  }

  async up() {
    await this.fixVideoLabels();
    await this.dropAllDuplicatedMedia();

    const detect = async (f: FileVersion) => {
      try {
        const result = await this.mediaService.detectAndSave(f);
        this.logger.info('Detected and saved media', {
          ...f,
          ...(result ?? {}),
        });
      } catch (e) {
        this.logger.error('Failed to detect media', { ...f, exception: e });
      }
    };
    for (const type of ['image', 'audio', 'video'] as const) {
      for await (const file of this.grabFileVersionsToDetect(type)) {
        await detect(file);
      }
    }
  }

  private async *grabFileVersionsToDetect(type: string) {
    const fileRepo = this.moduleRef.get(FileRepository, { strict: false });

    let page = 0;
    const size = 100;
    do {
      this.logger.info(`Grabbing page of files to detect ${page}`);

      const currentPage = await this.db
        .query()
        // eslint-disable-next-line no-loop-func
        .subQuery((sub) =>
          sub
            .match([
              node('fv', 'FileVersion'),
              relation('out', '', 'mimeType', ACTIVE),
              node('mt', 'Property'),
            ])
            .optionalMatch([
              node('fv'),
              relation('out', '', 'media'),
              node('media', 'Media'),
            ])
            .with('fv, mt, media')
            .raw(
              `where mt.value starts with '${type}/' and (media is null or media.duration = 0)`,
            )
            .return('fv')
            .orderBy('fv.createdAt')
            .skip(page * size)
            .limit(size),
        )
        .with('fv as node')
        .apply(fileRepo.hydrate())
        .map((row) => row.dto as FileVersion)
        .run();

      if (currentPage.length === 0) {
        return;
      }
      yield* currentPage;
      page++;
      // eslint-disable-next-line no-constant-condition
    } while (true);
  }

  private async fixVideoLabels() {
    await this.db.query().raw`
      match (v:Video)
      set v:VisualMedia:TemporalMedia:Media
    `.executeAndLogStats();
  }

  private async dropAllDuplicatedMedia() {
    await this.db.query().raw`
      match (fv:FileVersion)-->(media:Media)
      with fv, collect(media) as medias
      where size(medias) > 1
      unwind medias as media
      detach delete media
    `.executeAndLogStats();
  }
}
