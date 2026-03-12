import { Injectable } from '@nestjs/common';
import { type ID } from '~/common';
import { CommonRepository } from '~/core/gel';
import { e } from '~/core/gel/reexports';

@Injectable()
export class Rev79GelRepository extends CommonRepository {
  /**
   * Returns IDs of all projects whose rev79ProjectId matches.
   * Uniqueness is not enforced in the schema, so multiple results are possible;
   * the service layer checks for that condition.
   */
  async findProjectsByRev79Id(
    rev79ProjectId: string,
  ): Promise<ReadonlyArray<{ id: ID<'Project'> }>> {
    const query = e.select(e.Project, (p) => ({
      filter: e.op(p.rev79ProjectId, '=', rev79ProjectId),
      id: true,
    }));
    return (await this.db.run(query)) as Array<{ id: ID<'Project'> }>;
  }

  /**
   * Returns IDs of all LanguageEngagements within `projectId` whose
   * rev79CommunityId matches.
   * The service layer enforces that exactly one result is returned.
   */
  async findEngagementsByRev79CommunityId(
    projectId: ID<'Project'>,
    rev79CommunityId: string,
  ): Promise<ReadonlyArray<{ id: ID<'LanguageEngagement'> }>> {
    const project = e.cast(e.Project, e.uuid(projectId));
    const query = e.select(e.LanguageEngagement, (eng) => ({
      filter: e.op(
        e.op(eng.project, '=', project),
        'and',
        e.op(eng.rev79CommunityId, '=', rev79CommunityId),
      ),
      id: true,
    }));
    return (await this.db.run(query)) as Array<{
      id: ID<'LanguageEngagement'>;
    }>;
  }
}
