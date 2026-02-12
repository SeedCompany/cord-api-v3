import { type ID } from '~/common';
import {
  type DataLoaderOptions,
  type DataLoaderStrategy,
  LoaderFactory,
} from '~/core/data-loader';
import { type AnyMedia } from './media.dto';
import { MediaRepository } from './media.repository';

@LoaderFactory()
export class MediaByFileVersionLoader implements DataLoaderStrategy<
  AnyMedia,
  ID
> {
  constructor(private readonly repo: MediaRepository) {}

  getOptions(): DataLoaderOptions<AnyMedia, ID> {
    return {
      propertyKey: (media) => media.file,
    };
  }

  async loadMany(ids: ID[]) {
    return await this.repo.readMany({ fvIds: ids });
  }
}
