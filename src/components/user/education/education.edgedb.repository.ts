import { Injectable } from '@nestjs/common';
import { ID, PublicOf } from '~/common';
import { e, RepoFor } from '~/core/edgedb';
import { Education } from './dto';
import { EducationRepository } from './education.repository';

@Injectable()
export class EducationEdgeDBRepository
  extends RepoFor(Education, {
    hydrate: (education) => education['*'],
  }).withDefaults()
  implements PublicOf<EducationRepository>
{
  async getUserIdByEducation(id: ID) {
    const edu = e.cast(e.User.Education, e.uuid(id));
    const query = e.assert_exists(
      e.select(e.User, (user) => ({
        filter_single: e.op(edu, 'in', user.education),
      })),
    );
    return await this.db.run(query);
  }
}
