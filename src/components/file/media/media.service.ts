import { Injectable } from '@nestjs/common';
import { Except, RequireAtLeastOne } from 'type-fest';
import { NotFoundException, ServerException } from '~/common';
import { Downloadable } from '../dto';
import { MediaDetector } from './media-detector.service';
import { AnyMedia, Media, MediaUserMetadata } from './media.dto';
import { MediaRepository } from './media.repository';

@Injectable()
export class MediaService {
  constructor(
    private readonly detector: MediaDetector,
    private readonly repo: MediaRepository,
  ) {}

  async detectAndSave(input: Downloadable<Except<Media, 'id' | '__typename'>>) {
    const media = await this.detector.detect(input);
    if (!media) {
      return null;
    }
    return await this.repo.create({ ...input, ...media });
  }

  async updateUserMetadata(
    input: RequireAtLeastOne<Pick<AnyMedia, 'id' | 'file'>> & MediaUserMetadata,
  ) {
    try {
      return await this.repo.update(input);
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
