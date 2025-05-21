import { Injectable } from '@nestjs/common';
import { type ID, type PublicOf } from '~/common';
import { e, RepoFor } from '~/core/gel';
import { FieldZone } from './dto';
import { type FieldZoneRepository } from './field-zone.repository';

@Injectable()
export class FieldZoneGelRepository
  extends RepoFor(FieldZone, {
    hydrate: (zone) => ({
      ...zone['*'],
      director: true,
    }),
  })
  implements PublicOf<FieldZoneRepository>
{
  async readAllByDirector(id: ID<'User'>) {
    return await this.db.run(this.readAllByDirectorQuery, { id });
  }
  private readonly readAllByDirectorQuery = e.params({ id: e.uuid }, ($) => {
    const director = e.cast(e.User, $.id);
    return e.select(e.FieldZone, (zone) => ({
      filter: e.op(zone.director, '=', director),
      ...this.hydrate(zone),
    }));
  });
}
