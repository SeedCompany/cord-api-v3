import { Injectable } from '@nestjs/common';
import { Except } from 'type-fest';
import { Downloadable } from '../dto';
import { MediaDetector } from './media-detector.service';
import { Media } from './media.dto';
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
      return;
    }
    await this.repo.create({ ...input, ...media });
  }
}
