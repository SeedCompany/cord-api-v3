import { Injectable } from '@nestjs/common';
import { type Node, node, type Query, relation } from 'cypher-query-builder';
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
  createNode,
  createRelationships,
  filter,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  oncePerProject,
  paginate,
  sorting,
} from '~/core/database/query';
import { UserRepository } from '../../user/user.repository';
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

  async listAsNotifiers(projectId: ID, roles?: Role[]) {
    return await this.db
      .query()
      .match([
        node('node', 'ProjectMember'),
        relation('out', '', 'user', ACTIVE),
        node('user', 'User'),
      ])
      .apply(projectMemberFilters({ projectId, roles }))
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
}

export const projectMemberFilters = filter.define(() => ProjectMemberFilters, {
  projectId: filter.pathExists((id) => [
    node('', 'Project', { id }),
    relation('out', '', 'member', ACTIVE),
    node('node'),
  ]),
  roles: filter.intersectsProp(),
});
