import { DataLoaderStrategy } from '@seedcompany/data-loader';
import { ID } from '~/common';
import { LoaderFactory } from '~/core/resources';
import { AnyMedia } from './media.dto';
import { MediaRepository } from './media.repository';

@LoaderFactory()
export class MediaLoader implements DataLoaderStrategy<AnyMedia, ID> {
  constructor(private readonly repo: MediaRepository) {}

  async loadMany(ids: ID[]) {
    return await this.repo.readMany({ mediaIds: ids });
  }
}
