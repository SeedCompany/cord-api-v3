import { Injectable } from '@nestjs/common';
import { ID, Resource } from '~/common';
import { e, RepoFor, ScopeOf } from '~/core/edgedb';
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

    async update(
      existing: ProjectMember,
      changes: Partial<
        Omit<UpdateProjectMember, keyof Resource> &
          Pick<ProjectMember, 'modifiedAt'>
      >,
    ) {
      // Adapt the roles property to the expected type
      const adaptedExisting = {
        ...existing,
        roles: existing.roles.value,
      };

      // Pass through to the generated update method
      await this.defaults.update({ ...adaptedExisting, ...changes });
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
