import { type DataLoaderStrategy } from '@seedcompany/data-loader';
import { type ID } from '~/common';
import { LoaderFactory } from '~/core/resources';
import { type AnyMedia, Media } from './media.dto';
import { MediaRepository } from './media.repository';

@LoaderFactory(() => Media)
export class MediaLoader implements DataLoaderStrategy<AnyMedia, ID> {
  constructor(private readonly repo: MediaRepository) {}

  async loadMany(ids: ID[]) {
    return await this.repo.readMany({ mediaIds: ids });
  }
}
