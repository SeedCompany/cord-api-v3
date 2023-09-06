import { Injectable } from '@nestjs/common';
import { RequireAtLeastOne } from 'type-fest';
import { IdOf, NotFoundException, ServerException } from '~/common';
import { FileVersion } from '../dto';
import { MediaDetector } from './media-detector.service';
import { AnyMedia, MediaUserMetadata } from './media.dto';
import { MediaRepository } from './media.repository';

@Injectable()
export class MediaService {
  constructor(
    private readonly detector: MediaDetector,
    private readonly repo: MediaRepository,
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
