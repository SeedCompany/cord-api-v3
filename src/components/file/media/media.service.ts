import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { RequireAtLeastOne } from 'type-fest';
import {
  createAndInject,
  IdOf,
  NotFoundException,
  Poll,
  ServerException,
  UnauthorizedException,
} from '~/common';
import { IEventBus } from '~/core';
import { FileVersion } from '../dto';
import { CanUpdateMediaUserMetadataEvent } from './events/can-update-event';
import { MediaDetector } from './media-detector.service';
import { AnyMedia, MediaUserMetadata } from './media.dto';
import { MediaRepository } from './media.repository';

@Injectable()
export class MediaService {
  constructor(
    private readonly detector: MediaDetector,
    private readonly repo: MediaRepository,
    private readonly eventBus: IEventBus,
    private readonly moduleRef: ModuleRef,
  ) {}

  async detectAndSave(file: FileVersion, metadata?: MediaUserMetadata) {
    const media = await this.detector.detect(file);
    if (!media) {
      return null;
    }
    return await this.repo.save({
      file: file.id as IdOf<FileVersion>,
      mimeType: file.mimeType,
      ...media,
      ...metadata,
    });
  }

  async updateUserMetadata(
    input: RequireAtLeastOne<Pick<AnyMedia, 'id' | 'file'>> & MediaUserMetadata,
  ) {
    const media = await this.repo.readOne(input);
    const poll = new Poll();
    const event = await createAndInject(
      this.moduleRef,
      CanUpdateMediaUserMetadataEvent,
      media,
      input,
      poll,
    );
    await this.eventBus.publish(event);
    if (!(poll.plurality && !poll.vetoed)) {
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
