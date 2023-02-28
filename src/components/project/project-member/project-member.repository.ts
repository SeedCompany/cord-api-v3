import { Injectable } from '@nestjs/common';
import { Node, node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { CreateProjectMember, ProjectMember, ProjectMemberListInput } from '.';
import { ID, Session, UnsecuredDto } from '../../../common';
import { DatabaseService, DtoRepository } from '../../../core';
import {
  ACTIVE,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  oncePerProject,
  paginate,
  property,
  requestingUser,
  sorting,
} from '../../../core/database/query';
import { UserRepository } from '../../user/user.repository';

@Injectable()
export class ProjectMemberRepository extends DtoRepository<
  typeof ProjectMember,
  [session: Session]
>(ProjectMember) {
  constructor(private readonly users: UserRepository, db: DatabaseService) {
    super(db);
  }

  async verifyRelationshipEligibility(projectId: ID, userId: ID) {
    return await this.db
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
      .return(['user', 'project', 'member'])
      .asResult<{ user?: Node; project?: Node; member?: Node }>()
      .first();
  }

  async create(
    { userId, projectId, ...input }: CreateProjectMember,
    id: ID,
    session: Session,
    createdAt: DateTime,
  ) {
    const createProjectMember = this.db
      .query()
      .create([
        [
          node('newProjectMember', 'ProjectMember:BaseNode', {
            createdAt,
            id,
          }),
        ],
        ...property('roles', input.roles, 'newProjectMember'),
        ...property('modifiedAt', createdAt, 'newProjectMember'),
      ])
      .return<{ id: ID }>('newProjectMember.id as id');
    await createProjectMember.first();

    // connect the Project to the ProjectMember
    // and connect ProjectMember to User
    return await this.db
      .query()
      .match([
        [node('user', 'User', { id: userId })],
        [node('project', 'Project', { id: projectId })],
        [node('projectMember', 'ProjectMember', { id })],
      ])
      .create([
        node('project'),
        relation('out', '', 'member', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('projectMember'),
        relation('out', '', 'user', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('user'),
      ])
      .return<{ id: ID }>('projectMember.id as id')
      .first();
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
          sub.with('user as node').apply(this.users.hydrate(session.userId)),
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
}
