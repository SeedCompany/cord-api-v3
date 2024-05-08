import { Injectable } from '@nestjs/common';
import { isIdLike, PublicOf } from '~/common';
import { e, RepoFor, ScopeOf } from '~/core/edgedb';
import {
  CreateProjectMember,
  ProjectMember,
  ProjectMemberListInput,
} from './dto';
import { ProjectMemberRepository as Neo4jRepository } from './project-member.repository';

@Injectable()
export class ProjectMemberEdgeDBRepository
  extends RepoFor(ProjectMember, {
    hydrate: (member) => ({
      ...member['*'],
      user: member.user['*'],
    }),
    omit: ['create'],
  })
  implements PublicOf<Neo4jRepository>
{
  async create({ projectId: projectOrId, userId, roles }: CreateProjectMember) {
    const projectId = isIdLike(projectOrId) ? projectOrId : projectOrId.id;
    const project = e.cast(e.Project, e.uuid(projectId));

    const created = e.insert(this.resource.db, {
      user: e.cast(e.User, e.uuid(userId)),
      project,
      projectContext: project.projectContext,
      roles,
    });
    const query = e.select(created, this.hydrate);
    return await this.db.run(query);
  }

  protected listFilters(
    member: ScopeOf<typeof e.Project.Member>,
    { filter: input }: ProjectMemberListInput,
  ) {
    return [
      (input.roles?.length ?? 0) > 0 &&
        e.op(
          'exists',
          e.op(
            member.roles,
            'intersect',
            e.cast(e.Role, e.set(...input.roles!)),
          ),
        ),
    ];
  }
}
