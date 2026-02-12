import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { RequireAtLeastOne } from 'type-fest';
import {
  createAndInject,
  type ID,
  NotFoundException,
  Polls,
  ServerException,
  UnauthorizedException,
} from '~/common';
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
    private readonly moduleRef: ModuleRef,
  ) {}

  async detectAndSave(file: FileVersion, metadata?: MediaUserMetadata) {
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
