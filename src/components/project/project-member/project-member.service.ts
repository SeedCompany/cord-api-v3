import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession } from '../../../common';
import { DatabaseService, ILogger, Logger } from '../../../core';
import { RedactedUser, User, UserService } from '../../user';
import {
  CreateProjectMember,
  ProjectMember,
  ProjectMemberListInput,
  ProjectMemberListOutput,
  UpdateProjectMember,
} from './dto';

@Injectable()
export class ProjectMemberService {
  constructor(
    private readonly db: DatabaseService,
    private readonly userService: UserService,
    @Logger('project:member:service') private readonly logger: ILogger
  ) {}

  async readOne(id: string, session: ISession): Promise<ProjectMember> {
    const result = await this.db
      .query()
      .raw(
        `
        MATCH
        (toekn: Token {
          active: true,
          value: $token
        })
          <-[:token {active: true}]-
        (requestingUser:User {
          active: true,
          id: $requestingUserId,
          owningOrgId: $owningOrgId
        }),
        (projectMember:ProjectMember {active: true, id: $id})

        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadRoles:ACL {canReadRoles: true})-[:toNode]->(projectMember)-[:roles {active: true}]->(roles: Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditRoles:ACL {canEditRoles: true})-[:toNode]->(projectMember)
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadUser:ACL {canReadUser: true})-[:toNode]->(projectMember)-[:user {active: true}]->(user)

        RETURN
          projectMember.id as id,
          projectMember.createdAt as createdAt,
          user.id as userId,
          roles.value as roles,
          canReadRoles.canReadRoles as canReadRoles,
          canEditRoles.canEditRoles as canEditRoles,
          canReadUser.canReadUser as canReadUser
        `,
        {
          token: session.token,
          requestingUserId: session.userId,
          owningOrgId: session.owningOrgId,
          id,
        }
      )
      .first();

    if (!result) {
      throw new NotFoundException('Could not find project member');
    }

    let user: User = RedactedUser;
    if (result.canReadUser) {
      user = await this.userService.readOne(result.userId, session);
    }

    return {
      id: id,
      createdAt: result.createdAt,
      modifiedAt: result.modifiedAt,
      user: {
        value: {
          ...user,
        },
        canRead: true,
        canEdit: true,
      },
      roles: {
        value: result.roles || [],
        canEdit: true,
        canRead: true,
      },
    };
  }

  async create(
    { userId, projectId, ...input }: CreateProjectMember,
    session: ISession
  ): Promise<ProjectMember> {
    const id = generate();
    const acls = {
      canReadRoles: true,
      canEditRoles: true,
      canReadUser: true,
    };

    try {
      await this.db.createNode({
        session,
        type: ProjectMember.classType,
        input: {
          id,
          roles: [],
          ...input,
        },
        acls,
      });
      //connect the User to the ProjectMember
      await this.db
        .query()
        .match([
          [node('user', 'User', { id: userId, active: true })],
          [node('project', 'Project', { id: projectId, active: true })],
          [node('projectMember', 'ProjectMember', { id, active: true })],
        ])
        .create([
          node('project'),
          relation('out', '', 'member', {
            // direction is out per latest schema
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
        .return('projectMember.id as id')
        .first();

      return await this.readOne(id, session);
    } catch (e) {
      this.logger.warning('Failed to create project member', {
        exception: e,
      });

      throw new InternalServerErrorException('Could not create project member');
    }
  }

  async list(
    { page, count, sort, order, filter }: ProjectMemberListInput,
    session: ISession
  ): Promise<ProjectMemberListOutput> {
    const result = await this.db.list<ProjectMember>({
      session,
      nodevar: 'projectMember',
      aclReadProp: 'canReadProjectMembers',
      aclEditProp: 'canCreateProjectMember',
      props: [
        { name: 'roles', secure: true, list: true },
        { name: 'user', secure: true },
        { name: 'modifiedAt', secure: false },
      ],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });

    return {
      items: result.items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }

  async update(
    input: UpdateProjectMember,
    session: ISession
  ): Promise<ProjectMember> {
    const object = await this.readOne(input.id, session);

    await this.db.updateProperties({
      session,
      object,
      props: ['roles'],
      changes: {
        ...input,
        roles: (input.roles ? input.roles : undefined) as any,
      },
      nodevar: 'projectMember',
    });
    return this.readOne(input.id, session);
  }

  async delete(id: string, session: ISession): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find project member');
    }

    try {
      await this.db.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.warning('Failed to delete project member', {
        exception: e,
      });

      throw new ServerException('Failed to delete project member');
    }
  }
}
