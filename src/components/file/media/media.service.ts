import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { RequireAtLeastOne } from 'type-fest';
import {
  createAndInject,
  type ID,
  NotFoundException,
  NotImplementedException,
  Polls,
  ServerException,
  UnauthorizedException,
} from '~/common';
import { ConfigService } from '~/core/config';
import { Hooks } from '~/core/hooks';
import { type FileVersion } from '../dto';
import { CanUpdateMediaUserMetadataHook } from './hooks/can-update.hook';
import { MediaDetector } from './media-detector.service';
import { type AnyMedia, type MediaUserMetadata } from './media.dto';
import { MediaRepository } from './media.repository';

@Injectable()
export class MediaService {
  constructor(
    private readonly detector: MediaDetector,
    private readonly repo: MediaRepository,
    private readonly hooks: Hooks,
    private readonly config: ConfigService,
    private readonly moduleRef: ModuleRef,
  ) {}

  async detectAndSave(file: FileVersion, metadata?: MediaUserMetadata) {
    // migration-todo (PR #2): Media has no Postgres repository yet — its
    // `attachedTo` needs the same reverse-lookup across consuming FK columns as
    // File.rootAttachedTo, which lands in PR #2. Until then, skip detection
    // under Postgres so uploads don't fall through to the Neo4j MediaRepository.
    // Drop this guard at Phase 7 cutover.
    if (this.config.databaseEngine === 'postgres') {
      return null;
    }
    const media = await this.detector.detect(file);
    if (!media) {
      return null;
    }
    return await this.repo.save({
      file: file.id as ID<FileVersion>,
      mimeType: file.mimeType,
      ...media,
      ...metadata,
    });
  }

  async updateUserMetadata(
    input: RequireAtLeastOne<Pick<AnyMedia, 'id' | 'file'>> & MediaUserMetadata,
  ) {
    // migration-todo (PR #2): same as detectAndSave — Media has no Postgres
    // repository yet. Fail explicitly rather than reading/writing through the
    // Neo4j MediaRepository cross-engine. Drop this guard at Phase 7 cutover.
    if (this.config.databaseEngine === 'postgres') {
      throw new NotImplementedException(
        'Media metadata is not yet supported under Postgres',
      );
    }
    const media = await this.repo.readOne(input);
    const canUpdatePoll = new Polls.Poll<boolean>();
    const event = await createAndInject(
      this.moduleRef,
      CanUpdateMediaUserMetadataHook,
      media,
      input,
      canUpdatePoll.ballotBox,
    );
    await this.hooks.run(event);
    const canUpdate = canUpdatePoll.close().winner ?? false;
    if (!canUpdate) {
      throw new UnauthorizedException(
        'You do not have permission to update this media metadata',
      );
    }

    try {
      return await this.repo.save(input);
    } catch (e) {
      if (e instanceof ServerException) {
        const exists = await this.repo.getBaseNode(
          input.id ?? input.file!,
          input.id ? 'Media' : 'FileVersion',
        );
        if (!exists) {
          throw new NotFoundException('Media not found');
        }
      }
      throw e;
    }
  }
}
