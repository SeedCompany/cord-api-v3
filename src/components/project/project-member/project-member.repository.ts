import { Injectable } from '@nestjs/common';
import {
  type Node,
  node,
  not,
  type Query,
  relation,
} from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  CreationFailed,
  DuplicateException,
  type ID,
  isIdLike,
  NotFoundException,
  type Role,
  type UnsecuredDto,
} from '~/common';
import { DtoRepository } from '~/core/database';
import {
  ACTIVE,
  apoc,
  createNode,
  createRelationships,
  filter,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  oncePerProject,
  paginate,
  path,
  randomUUID,
  sorting,
  updateProperty,
  variable,
} from '~/core/database/query';
import { type FilterFn } from '~/core/database/query/filters';
import { userFilters, UserRepository } from '../../user/user.repository';
import { type ProjectFilters } from '../dto';
import { projectFilters } from '../project-filters.query';
import {
  type CreateProjectMember,
  ProjectMember,
  ProjectMemberFilters,
  type ProjectMemberListInput,
  type UpdateProjectMember,
} from './dto';

@Injectable()
export class ProjectMemberRepository extends DtoRepository(ProjectMember) {
  constructor(private readonly users: UserRepository) {
    super();
  }

  private async verifyRelationshipEligibility(projectId: ID, userId: ID) {
    const result = await this.db
      .query()
      .optionalMatch(node('user', 'User', { id: userId }))
      .optionalMatch(node('project', 'Project', { id: projectId }))
      .optionalMatch([
        node('project'),
        relation('out', '', 'member', ACTIVE),
        node('member', 'ProjectMember'),
        relation('out', '', 'user', ACTIVE),
        node('user'),
      ])
      .return<{ user?: Node; project?: Node; member?: Node }>([
        'user',
        'project',
        'member',
      ])
      .first();

    if (!result?.project) {
      throw new NotFoundException(
        'Could not find project',
        'projectMember.projectId',
      );
    }
    if (!result?.user) {
      throw new NotFoundException(
        'Could not find person',
        'projectMember.userId',
      );
    }
    if (result.member) {
      throw new DuplicateException(
        'projectMember.userId',
        'Person is already a member of this project',
      );
    }
  }

  async create({
    userId,
    projectId: projectOrId,
    ...input
  }: CreateProjectMember) {
    const projectId = isIdLike(projectOrId) ? projectOrId : projectOrId.id;

    await this.verifyRelationshipEligibility(projectId, userId);

    const created = await this.db
      .query()
      .apply(
        await createNode(ProjectMember, {
          initialProps: {
            roles: input.roles ?? [],
            modifiedAt: DateTime.local(),
            inactiveAt: input.inactiveAt ?? null,
          },
        }),
      )
      .apply(
        createRelationships(ProjectMember, {
          in: { member: ['Project', projectId] },
          out: { user: ['User', userId] },
        }),
      )
      .apply(this.hydrate())
      .map('dto')
      .first();
    if (!created) {
      throw new CreationFailed(ProjectMember);
    }
    return created;
  }

  async update({ id, ...changes }: UpdateProjectMember) {
    await this.updateProperties({ id }, changes);
    return await this.readOne(id);
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .match([
          node('project', 'Project'),
          relation('out', '', 'member', ACTIVE),
          node('node'),
        ])
        .apply(matchPropsAndProjectSensAndScopedRoles())
        .match([
          node('node'),
          relation('out', '', 'user'),
          node('user', 'User'),
        ])
        .subQuery('user', (sub) =>
          sub.with('user as node').apply(this.users.hydrateAsNeo4j()),
        )
        .return<{ dto: UnsecuredDto<ProjectMember> }>(
          merge('props', { user: 'dto' }).as('dto'),
        );
  }

  async list({ filter, ...input }: ProjectMemberListInput) {
    const result = await this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'member'),
        node('node', 'ProjectMember'),
      ])
      .apply(projectMemberFilters(filter))
      .with('*') // needed between where & where
      .apply(
        this.privileges.filterToReadable({
          wrapContext: oncePerProject,
        }),
      )
      .apply(sorting(ProjectMember, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  async listAsNotifiers(project: ID<'Project'>, roles?: Role[]) {
    return await this.db
      .query()
      .match([
        node('node', 'ProjectMember'),
        relation('out', '', 'user', ACTIVE),
        node('user', 'User'),
      ])
      .apply(
        projectMemberFilters({
          project: { id: project },
          roles,
          active: true,
        }),
      )
      .with('user')
      .optionalMatch([
        node('user'),
        relation('out', '', 'email', ACTIVE),
        node('email', 'EmailAddress'),
      ])
      .return<{ id: ID; email: string | null }>([
        'user.id as id',
        'email.value as email',
      ])
      .run();
  }

  async replaceMembershipsOnOpenProjects(
    oldDirector: ID<'User'>,
    newDirector: ID<'User'>,
    role: Role,
  ) {
    const nowVal = DateTime.now();
    const now = variable('$now');
    const createMember = await createNode(ProjectMember, {
      baseNodeProps: {
        id: variable(randomUUID()),
        createdAt: now,
      },
      initialProps: {
        roles: [role],
        inactiveAt: null,
        modifiedAt: now,
      },
    });
    const result = await this.db
      .query()
      .raw('', { now: nowVal })
      .match([
        node('project', 'Project'),
        relation('out', '', 'member', ACTIVE),
        node('node', 'ProjectMember'),
      ])
      .apply(
        projectMemberFilters({
          user: { id: oldDirector },
          active: true,
          roles: [role],
          project: { status: ['Active', 'InDevelopment'] },
        }),
      )
      .apply(
        updateProperty({
          resource: ProjectMember,
          key: 'inactiveAt',
          value: now,
          permanentAfter: 0,
        }),
      )
      .with('project')
      .subQuery('project', (sub) =>
        sub
          .match([
            [
              node('project'),
              relation('out', '', 'member', ACTIVE),
              node('node', 'ProjectMember'),
              relation('out', '', 'user', ACTIVE),
              node('', 'User', { id: newDirector }),
            ],
            [
              node('node', 'ProjectMember'),
              relation('out', '', 'roles', ACTIVE),
              node('roles', 'Property'),
            ],
          ])
          .apply(
            updateProperty({
              resource: ProjectMember,
              key: 'roles',
              value: variable(apoc.coll.union('roles.value', [`"${role}"`])),
              now,
              permanentAfter: 0,
              outputStatsVar: 'inactiveStats',
            }),
          )
          .apply(
            updateProperty({
              resource: ProjectMember,
              key: 'inactiveAt',
              value: null,
              now,
              permanentAfter: 0,
              outputStatsVar: 'rolesStats',
            }),
          )
          .apply(
            updateProperty({
              resource: ProjectMember,
              key: 'modifiedAt',
              value: now,
              now,
              permanentAfter: 0,
              outputStatsVar: 'modifiedAtStats',
            }),
          )
          .return('node as member')
          .union()
          .with('project')
          .with('project')
          .where(
            not(
              path([
                node('project'),
                relation('out', '', 'member', ACTIVE),
                node('', 'ProjectMember'),
                relation('out', '', 'user', ACTIVE),
                node('', 'User', { id: newDirector }),
              ]),
            ),
          )
          .apply(createMember)
          .apply(
            createRelationships(ProjectMember, {
              in: { member: variable('project') },
              out: { user: ['User', newDirector] },
            }),
          )
          .return('node as member'),
      )
      .return<{ id: ID }>('project.id as id')
      .run();
    return {
      projects: result.map(({ id }) => id) as readonly ID[],
      timestampId: nowVal,
    };
  }
}

export const projectMemberFilters = filter.define(() => ProjectMemberFilters, {
  project: filter.sub((): FilterFn<ProjectFilters> => projectFilters)((sub) =>
    sub.match([
      node('node', 'Project'),
      relation('out', '', 'member', ACTIVE),
      node('outer'),
    ]),
  ),
  user: filter.sub(() => userFilters)((sub) =>
    sub.match([
      node('outer'),
      relation('out', '', 'user'),
      node('node', 'User'),
    ]),
  ),
  roles: filter.intersectsProp(),
  active: filter.isPropNotNull('inactiveAt'),
});
