import { Injectable } from '@nestjs/common';
import { ID, isIdLike, PublicOf, Role } from '~/common';
import { e, RepoFor, ScopeOf } from '~/core/gel';
import { hydrateUser } from '../../user/user.gel.repository';
import {
  CreateProjectMember,
  ProjectMember,
  ProjectMemberListInput,
} from './dto';
import { ProjectMemberRepository as Neo4jRepository } from './project-member.repository';

@Injectable()
export class ProjectMemberGelRepository
  extends RepoFor(ProjectMember, {
    hydrate: (member) => ({
      ...member['*'],
      user: hydrateUser(member.user),
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

  async listAsNotifiers(projectId: ID, roles?: Role[]) {
    const project = e.cast(e.Project, e.uuid(projectId));
    const members = e.select(project.members, (member) => ({
      filter: roles
        ? e.op(
            'exists',
            e.op(member.roles, 'intersect', e.cast(e.Role, e.set(...roles))),
          )
        : undefined,
    }));
    const query = e.select(members.user, () => ({
      id: true,
      email: true,
    }));
    return await this.db.run(query);
  }

  protected listFilters(
    member: ScopeOf<typeof e.Project.Member>,
    { filter: input }: ProjectMemberListInput,
  ) {
    if (!input) return [];
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
