import { Injectable } from '@nestjs/common';
import { Node, node, Query, relation } from 'cypher-query-builder';
import { difference } from 'lodash';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  ID,
  InputException,
  NotFoundException,
  Role,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '../../../common';
import { DtoRepository, ILogger, Logger } from '../../../core';
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
import { User } from '../../user';
import { UserRepository } from '../../user/user.repository';
import {
  CreateProjectMember,
  ProjectMember,
  ProjectMemberListInput,
  UpdateProjectMember,
} from './dto';
import { ProjectMemberService } from './project-member.service';

@Injectable()
export class ProjectMemberRepository extends DtoRepository<
  typeof ProjectMember,
  [session: Session]
>(ProjectMember) {
  constructor(
    private readonly users: UserRepository,
    @Logger('project:member:repository') private readonly logger: ILogger,
    private readonly service: ProjectMemberService,
  ) {
    super();
  }

  async verifyRelationshipEligibility(projectId: ID, userId: ID) {
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
      .return(['user', 'project', 'member'])
      .asResult<{ user?: Node; project?: Node; member?: Node }>()
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

    return result;
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
      .return<{ id: ID }>('projectMember')
      .first();
  }

  async update(input: UpdateProjectMember, session: Session) {
    const existing = await this.readOne(input.id, session);
    await this.assertValidRoles(input.roles, () => {
      const user = existing.user;
      if (!user) {
        throw new UnauthorizedException(
          'Cannot read user to verify roles available',
        );
      }
      return user;
    });
    const changes = this.getActualChanges(existing, input);
    this.service.privileges
      .for(session, ProjectMember, existing)
      .verifyChanges(changes);

    await this.updateProperties(existing, changes);
    return await this.readOne(existing.id, session);
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
    const forbiddenRoles = difference(roles, availableRoles);
    if (forbiddenRoles.length) {
      const forbiddenRolesStr = forbiddenRoles.join(', ');
      throw new InputException(
        `Role(s) ${forbiddenRolesStr} cannot be assigned to this project member`,
        'input.roles',
      );
    }
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

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException(
        'Could not find project member',
        'projectMember.id',
      );
    }

    try {
      await this.deleteNode(object);
    } catch (exception) {
      this.logger.warning('Failed to delete project member', {
        exception,
      });

      throw new ServerException('Failed to delete project member', exception);
    }
  }
}
