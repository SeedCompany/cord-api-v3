import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { type AnyMedia, Media } from './media.dto';
import { MediaRepository } from './media.repository';

@LoaderFactory(() => Media)
export class MediaLoader implements DataLoaderStrategy<AnyMedia, ID> {
  constructor(private readonly repo: MediaRepository) {}

  async loadMany(ids: ID[]) {
    return await this.repo.readMany({ mediaIds: ids });
  }
}
