import { Injectable } from '@nestjs/common';
import { Node, node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  ID,
  isIdLike,
  NotFoundException,
  Role,
  ServerException,
  Session,
  UnsecuredDto,
} from '~/common';
import { DtoRepository } from '~/core/database';
import {
  ACTIVE,
  createNode,
  createRelationships,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  oncePerProject,
  paginate,
  requestingUser,
  sorting,
} from '~/core/database/query';
import { UserRepository } from '../../user/user.repository';
import {
  CreateProjectMember,
  ProjectMember,
  ProjectMemberListInput,
  UpdateProjectMember,
} from './dto';

@Injectable()
export class ProjectMemberRepository extends DtoRepository<
  typeof ProjectMember,
  [session: Session]
>(ProjectMember) {
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

  async create(
    { userId, projectId: projectOrId, ...input }: CreateProjectMember,
    session: Session,
  ) {
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
      .apply(this.hydrate(session))
      .map('dto')
      .first();
    if (!created) {
      throw new ServerException('Failed to create project member');
    }
    return created;
  }

  async update({ id, ...changes }: UpdateProjectMember, session: Session) {
    await this.updateProperties({ id }, changes);
    return await this.readOne(id, session);
  }

  protected hydrate(session: Session) {
    return (query: Query) =>
      query
        .match([
          node('project', 'Project'),
          relation('out', '', 'member', ACTIVE),
          node('node'),
        ])
        .apply(matchPropsAndProjectSensAndScopedRoles(session))
        .match([
          node('node'),
          relation('out', '', 'user'),
          node('user', 'User'),
        ])
        .subQuery('user', (sub) =>
          sub
            .with('user as node')
            .apply(this.users.hydrateAsNeo4j(session.userId)),
        )
        .return<{ dto: UnsecuredDto<ProjectMember> }>(
          merge('props', { user: 'dto' }).as('dto'),
        );
  }

  async list({ filter, ...input }: ProjectMemberListInput, session: Session) {
    const result = await this.db
      .query()
      .match([
        node(
          'project',
          'Project',
          filter.projectId ? { id: filter.projectId } : {},
        ),
        relation('out', '', 'member'),
        node('node', 'ProjectMember'),
      ])
      .apply((q) =>
        filter.roles
          ? q
              .match([
                node('node'),
                relation('out', '', 'roles', ACTIVE),
                node('role', 'Property'),
              ])
              .raw(
                `WHERE size(apoc.coll.intersection(role.value, $filteredRoles)) > 0`,
                { filteredRoles: filter.roles },
              )
          : q,
      )
      .match(requestingUser(session))
      .apply(
        this.privileges.forUser(session).filterToReadable({
          wrapContext: oncePerProject,
        }),
      )
      .apply(sorting(ProjectMember, input))
      .apply(paginate(input, this.hydrate(session)))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  async listAsNotifiers(projectId: ID, roles?: Role[]) {
    return await this.db
      .query()
      .match([
        node('', 'Project', { id: projectId }),
        relation('out', '', 'member', ACTIVE),
        node('node', 'ProjectMember'),
        relation('out', '', 'user', ACTIVE),
        node('user', 'User'),
      ])
      .apply((q) =>
        roles
          ? q
              .match([
                node('node'),
                relation('out', '', 'roles', ACTIVE),
                node('role', 'Property'),
              ])
              .raw(
                `WHERE size(apoc.coll.intersection(role.value, $filteredRoles)) > 0`,
                { filteredRoles: roles },
              )
          : q,
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
}
