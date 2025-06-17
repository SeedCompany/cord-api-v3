import { Injectable } from '@nestjs/common';
import { type ID, isIdLike, type PublicOf, type Role } from '~/common';
import { e, RepoFor, type ScopeOf } from '~/core/gel';
import { hydrateUser } from '../../user/user.gel.repository';
import {
  type CreateProjectMember,
  ProjectMember,
  type ProjectMemberListInput,
} from './dto';
import { type ProjectMemberRepository as Neo4jRepository } from './project-member.repository';

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
  async create({
    projectId: projectOrId,
    userId,
    ...rest
  }: CreateProjectMember) {
    const projectId = isIdLike(projectOrId) ? projectOrId : projectOrId.id;
    const project = e.cast(e.Project, e.uuid(projectId));

    const created = e.insert(this.resource.db, {
      user: e.cast(e.User, e.uuid(userId)),
      project,
      projectContext: project.projectContext,
      ...rest,
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

  async replaceMembershipsOnOpenProjects(
    oldDirector: ID<'User'>,
    newDirector: ID<'User'>,
    role: Role,
    region?: ID<'FieldRegion'>,
  ) {
    return await this.db.run(this.replaceMembershipsOnOpenProjectsQuery, {
      oldDirector,
      newDirector,
      role,
      region,
    });
  }
  private readonly replaceMembershipsOnOpenProjectsQuery = e.params(
    {
      oldDirector: e.uuid,
      newDirector: e.uuid,
      role: e.Role,
      region: e.optional(e.uuid),
    },
    ($) => {
      const oldDirector = e.cast(e.User, $.oldDirector);
      const newDirector = e.cast(e.User, $.newDirector);
      const region = e.cast(e.FieldRegion, $.region);

      const members = e.select(e.Project.members, (member) => ({
        filter: e.all(
          e.set(
            e.op(member.user, '=', oldDirector),
            e.op(member.active, '=', true),
            e.op($.role, 'in', member.roles),
            e.op(member.project.status, 'in', e.set('Active', 'InDevelopment')),
            e.op(
              'if',
              e.op('exists', region),
              'then',
              e.op(member.project.fieldRegion, '=', region),
              'else',
              true,
            ),
          ),
        ),
      }));
      const inactivated = e.update(members, () => ({
        set: {
          inactiveAt: e.datetime_of_transaction(),
        },
      }));
      const replacements = e.for(inactivated.project, (project) =>
        e
          .insert(e.Project.Member, {
            project,
            projectContext: project.projectContext,
            user: newDirector,
            roles: $.role,
          })
          .unlessConflict((member) => ({
            on: member.user,
            else: e.update(member, () => ({
              set: {
                roles: { '+=': $.role },
                inactiveAt: null,
              },
            })),
          })),
      );
      return e.select({
        timestampId: e.datetime_of_transaction(),
        projects: replacements.project.id,
      });
    },
  );
}
