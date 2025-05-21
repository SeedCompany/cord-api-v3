import { Injectable } from '@nestjs/common';
import { type ID, type PublicOf } from '~/common';
import { e, RepoFor } from '~/core/gel';
import { FieldRegion } from './dto';
import { type FieldRegionRepository } from './field-region.repository';

@Injectable()
export class FieldRegionGelRepository
  extends RepoFor(FieldRegion, {
    hydrate: (region) => ({
      ...region['*'],
      director: true,
      fieldZone: true,
    }),
  })
  implements PublicOf<FieldRegionRepository>
{
  async readAllByDirector(id: ID<'User'>) {
    return await this.db.run(this.readAllByDirectorQuery, { id });
  }
  private readonly readAllByDirectorQuery = e.params({ id: e.uuid }, ($) => {
    const director = e.cast(e.User, $.id);
    return e.select(e.FieldRegion, (region) => ({
      filter: e.op(region.director, '=', director),
      ...this.hydrate(region),
    }));
  });
}
