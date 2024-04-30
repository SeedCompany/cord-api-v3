import { Injectable } from '@nestjs/common';
import {
  ID,
  InputException,
  NotFoundException,
  Role,
  UnsecuredDto,
} from '~/common';
import { e, RepoFor, ScopeOf } from '~/core/edgedb';
import { User } from '../../user';
import {
  CreateProjectMember,
  ProjectMember,
  ProjectMemberListInput,
  UpdateProjectMember,
} from './dto';

@Injectable()
export class ProjectMemberEdgeDBRepository extends RepoFor(ProjectMember, {
  hydrate: (projectMember) => ({
    ...projectMember['*'],
    user: projectMember.user['*'],
  }),
}).customize((cls) => {
  return class extends cls {
    async create({ userId, projectId, roles }: CreateProjectMember) {
      const project = e
        .select(e.Project, (p) => ({
          filter: e.op(p.id, '=', e.uuid(projectId as ID)),
        }))
        .assert_single();

      const query = e.insert(e.Project.Member, {
        user: e
          .select(e.User, (u) => ({
            filter: e.op(u.id, '=', e.uuid(userId)),
          }))
          .assert_single(),
        project,
        projectContext: project.projectContext,
        roles,
      });

      const projectMember = await this.db.run(query);

      return { id: projectMember.id };
    }

    async list(input: ProjectMemberListInput) {
      const query = e.select(e.Project.Member, (pm) => {
        const baseFilter = e.op(
          pm.project.id,
          '=',
          e.uuid(input.filter.projectId!),
        );

        const filters = this.listFilters(pm, input);
        const nonFalsyFilters = filters.filter(Boolean);
        const combinedFilter = nonFalsyFilters.reduce(
          (acc, cur) => e.op(acc, 'and', cur),
          baseFilter,
        );

        return {
          ...this.applyFilter(pm, { filter: combinedFilter }),
          ...this.applyOrderBy(pm, input),
        };
      });

      return await this.paginate(query, input);
    }

    async update(input: UpdateProjectMember) {
      const { id, ...changes } = input;
      const existing = await this.defaults.readOne(id);
      const adaptedChanges = {
        ...changes,
        roles: changes.roles ?? existing.roles,
      };

      return await this.defaults.update({
        ...existing,
        ...adaptedChanges,
      });
    }

    async assertValidRoles(
      roles: readonly Role[] | undefined,
      forUser: () => UnsecuredDto<User>,
    ) {
      if (!roles || roles.length === 0) {
        return;
      }

      const user = forUser();
      const availableRoles = user.roles ?? [];

      const forbiddenRoles = roles.filter(
        (role) => !availableRoles.includes(role),
      );

      if (forbiddenRoles.length) {
        const forbiddenRolesStr = forbiddenRoles.join(', ');
        throw new InputException(
          `Role(s) ${forbiddenRolesStr} cannot be assigned to this project member`,
          'input.roles',
        );
      }
    }

    async verifyRelationshipEligibility(projectId: ID, userId: ID) {
      const query = e.select({
        project: e
          .select(e.Project, (project) => ({
            filter: e.op(project.id, '=', e.uuid(projectId)),
          }))
          .assert_single(),
        user: e
          .select(e.User, (user) => ({
            filter: e.op(user.id, '=', e.uuid(userId)),
          }))
          .assert_single(),
        member: e.select(e.Project.Member, (member) => ({
          filter: e.op(
            e.op(member.project.id, '=', e.uuid(projectId)),
            'and',
            e.op(member.user.id, '=', e.uuid(userId)),
          ),
          limit: 1,
        })),
      });

      const result = await this.db.run(query);

      if (!result.project) {
        throw new NotFoundException(
          'Could not find project',
          'projectMember.projectId',
        );
      }

      if (!result.user) {
        throw new NotFoundException(
          'Could not find person',
          'projectMember.userId',
        );
      }

      const member = result.member.length > 0 ? result.member[0] : undefined;

      return {
        project: result.project
          ? {
              identity: result.project.id,
              labels: ['Project'],
              properties: {},
            }
          : undefined,
        user: result.user
          ? {
              identity: result.user.id,
              labels: ['User'],
              properties: {},
            }
          : undefined,
        member: member
          ? {
              identity: member.id,
              labels: ['ProjectMember'],
              properties: {},
            }
          : undefined,
      };
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
  };
}) {}
