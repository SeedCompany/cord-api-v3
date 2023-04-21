import { Injectable } from '@nestjs/common';
import { Node, node, Query, relation } from 'cypher-query-builder';
import { difference, union } from 'lodash';
import { DateTime } from 'luxon';
import {
  generateId,
  ID,
  InputException,
  MaybeAsync,
  Role,
  Session,
  UnsecuredDto,
} from '../../../common';
import { DatabaseService, DtoRepository } from '../../../core';
import {
  ACTIVE,
  deleteBaseNode,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  oncePerProject,
  paginate,
  property,
  requestingUser,
  sorting,
  variable,
} from '../../../core/database/query';
import { User } from '../../user';
import { UserRepository } from '../../user/user.repository';
import {
  CreateProjectMember,
  ProjectMember,
  ProjectMemberListInput,
} from './dto';

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

  async assertValidRoles(
    roles: Role[] | undefined,
    forUser: () => MaybeAsync<User>,
  ) {
    if (!roles || roles.length === 0) {
      return;
    }
    const user = await forUser();
    const availableRoles = user.roles.value ?? [];
    const forbiddenRoles = difference(roles, availableRoles);
    if (forbiddenRoles.length) {
      const forbiddenRolesStr = forbiddenRoles.join(', ');
      throw new InputException(
        `Role(s) ${forbiddenRolesStr} cannot be assigned to this project member`,
        'input.roles',
      );
    }
  }

  async swapMembers(oldMemberId: ID, newMember: User) {
    const projectsRoles = await this.db
      .query()
      .comment('swapMembers: get projects oldMember is apart of')
      .matchNode('oldUser', 'User', { id: oldMemberId })
      .match([
        [
          node('project', 'Project'),
          relation('out', '', 'member', ACTIVE),
          node('projectMember'),
          relation('out', '', 'user'),
          node('oldUser'),
        ],
        [
          node('projectMember'),
          relation('out', '', 'roles', ACTIVE),
          node('rolesProp', 'Property'),
        ],
      ])
      .return<{
        projectId: ID;
        oldProjectMemberId: ID;
        oldMemberProjectRoles: Role[];
      }>(
        'project.id as projectId, projectMember.id as oldProjectMemberId, rolesProp.value as oldMemberProjectRoles',
      )
      .run();

    const memberRoles = union(
      projectsRoles.map((pRole) => pRole.oldMemberProjectRoles).flat(),
    );

    await this.assertValidRoles(memberRoles, () => {
      return newMember;
    });

    const projectsRolesIds = projectsRoles
      ? await Promise.all(
          projectsRoles.map(async (projRole) => ({
            memberId: await generateId(),
            roles: projRole.oldMemberProjectRoles,
            projectId: projRole.projectId,
            oldProjectMemberId: projRole.oldProjectMemberId,
          })),
        )
      : null;
    if (!projectsRolesIds) return;

    await this.db
      .query()
      .comment('swapMember: create new project members')
      .unwind(projectsRolesIds, 'projectRolesId')
      .subQuery('projectRolesId', (sub) =>
        sub
          .create([
            [
              node('newProjectMember', 'ProjectMember:BaseNode', {
                createdAt: DateTime.local(),
                id: variable('projectRolesId.memberId'),
              }),
            ],
            ...property(
              'roles',
              variable('projectRolesId.roles'),
              'newProjectMember',
            ),
            ...property('modifiedAt', DateTime.local(), 'newProjectMember'),
          ])
          .return('newProjectMember.id as newMemberId'),
      )
      .return<{ newMemberId: ID }>('newMemberId')
      .run();

    await this.db
      .query()
      .comment('connect new projectMember nodes to user and project')
      .unwind(projectsRolesIds, 'projectRolesId')
      .subQuery('projectRolesId', (sub) =>
        sub
          .match([
            [
              node('project', 'Project', {
                id: variable('projectRolesId.projectId'),
              }),
            ],
            [
              node('projectMember', 'ProjectMember', {
                id: variable('projectRolesId.memberId'),
              }),
            ],
            [node('newMember', 'User', { id: newMember.id })],
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
            node('newMember'),
          ])
          .return('newMember.id as newUserId'),
      )
      .return('newUserId')
      .run();

    await this.db
      .query()
      .comment('deleting old project member...')
      .unwind(projectsRolesIds, 'projectRolesId')
      .subQuery('projectRolesId', (sub) =>
        sub
          .matchNode('projectMember', {
            id: variable('projectRolesId.oldProjectMemberId'),
          })
          .apply(deleteBaseNode('projectMember'))
          .return('*'),
      )
      .return('*')
      .run();
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
