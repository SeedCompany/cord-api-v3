import {
  DataLoaderOptions,
  DataLoaderStrategy,
} from '@seedcompany/data-loader';
import { ID } from '~/common';
import { LoaderFactory } from '~/core/resources';
import { AnyMedia } from './media.dto';
import { MediaRepository } from './media.repository';

@LoaderFactory()
export class MediaByFileVersionLoader
  implements DataLoaderStrategy<AnyMedia, ID>
{
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
