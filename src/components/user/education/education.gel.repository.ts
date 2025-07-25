import { Injectable } from '@nestjs/common';
import { type ID, type PublicOf } from '~/common';
import { e, RepoFor } from '~/core/gel';
import { Education } from './dto';
import { type EducationRepository } from './education.repository';

@Injectable()
export class EducationGelRepository
  extends RepoFor(Education, {
    hydrate: (education) => education['*'],
  })
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
