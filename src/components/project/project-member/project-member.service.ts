import { Injectable } from '@nestjs/common';
import { contains, node, Query, relation } from 'cypher-query-builder';
import { RelationDirection } from 'cypher-query-builder/dist/typings/clauses/relation-pattern';
import { upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import {
  DuplicateException,
  ISession,
  NotFoundException,
  ServerException,
} from '../../../common';
import {
  ConfigService,
  DatabaseService,
  getPermList,
  getPropList,
  ILogger,
  Logger,
  matchRequestingUser,
  matchSession,
} from '../../../core';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parsePropList,
  parseSecuredProperties,
  StandardReadResult,
} from '../../../core/database/results';
import { UserService } from '../../user';
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
    private readonly config: ConfigService,
    private readonly userService: UserService,
    @Logger('project:member:service') private readonly logger: ILogger
  ) {}

  // helper method for defining properties
  property = (prop: string, value: any) => {
    const createdAt = DateTime.local();
    return [
      [
        node('newProjectMember'),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(prop, 'Property', {
          active: true,
          value,
        }),
      ],
    ];
  };

  // helper method for defining properties
  permission = (property: string) => {
    const createdAt = DateTime.local();
    return [
      [
        node('adminSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: true,
          admin: true,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node('newProjectMember'),
      ],
      [
        node('readerSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: false,
          admin: false,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node('newProjectMember'),
      ],
    ];
  };

  propMatch = (query: Query, property: string) => {
    const readPerm = 'canRead' + upperFirst(property);
    const editPerm = 'canEdit' + upperFirst(property);
    query.optionalMatch([
      [
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node(editPerm, 'Permission', {
          property,
          active: true,
          edit: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('projectMember'),
        relation('out', '', property, { active: true }),
        node(property, 'Property', { active: true }),
      ],
    ]);
    query.optionalMatch([
      [
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node(readPerm, 'Permission', {
          property,
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('projectMember'),
        relation('out', '', property, { active: true }),
        node(property, 'Property', { active: true }),
      ],
    ]);
  };

  protected async getPMByProjectAndUser(
    projectId: string,
    userId: string
  ): Promise<boolean> {
    const result = await this.db
      .query()
      .match([node('user', 'User', { active: true, id: userId })])
      .match([node('project', 'Project', { active: true, id: projectId })])
      .match([
        node('project'),
        relation('out', '', 'member'),
        node('projectMember', 'ProjectMember', { active: true }),
        relation('out', '', 'user'),
        node('user'),
      ])
      .return('projectMember.id as id')
      .first();

    return result ? true : false;
  }

  async create(
    { userId, projectId, ...input }: CreateProjectMember,
    session: ISession
  ): Promise<ProjectMember> {
    const id = generate();
    const createdAt = DateTime.local();

    if (await this.getPMByProjectAndUser(projectId, userId)) {
      throw new DuplicateException(
        'projectMember.userId',
        'User is already a member of this project'
      );
    }

    try {
      const createProjectMember = this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreateProjectMember' }))
        .match([
          node('rootuser', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ])
        .create([
          [
            node('newProjectMember', 'ProjectMember:BaseNode', {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('roles', input.roles),
          ...this.property('modifiedAt', createdAt),
          [
            node('adminSG', 'SecurityGroup', {
              id: generate(),
              active: true,
              createdAt,
              name: `projectmember-SG admin`,
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
              id: generate(),
              active: true,
              createdAt,
              name: `projectmember-SG users`,
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('adminSG'),
            relation('out', '', 'member', { active: true, createdAt }),
            node('rootuser'),
          ],
          [
            node('readerSG'),
            relation('out', '', 'member', { active: true, createdAt }),
            node('rootuser'),
          ],
          ...this.permission('roles'),
          ...this.permission('modifiedAt'),
          ...this.permission('user'),
        ])
        .return('newProjectMember.id as id');
      await createProjectMember.first();

      // connect the Project to the ProjectMember
      // and connect ProjectMember to User
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
    } catch (exception) {
      this.logger.warning('Failed to create project member', {
        exception,
      });

      throw new ServerException('Could not create project member', exception);
    }
  }

  async readOne(id: string, session: ISession): Promise<ProjectMember> {
    this.logger.debug(`read one`, {
      id,
      userId: session.userId,
    });
    if (!id) {
      throw new NotFoundException(
        'No project member id to search for',
        'projectMember.id'
      );
    }

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'ProjectMember', { active: true, id })])
      .call(getPermList, 'requestingUser')
      .call(getPropList, 'permList')
      .match([
        node('node'),
        relation('out', '', 'user'),
        node('user', 'User', { active: true }),
      ])
      .return('node, permList, propList, user.id as userId')
      .asResult<
        StandardReadResult<DbPropsOfDto<ProjectMember>> & {
          userId: string;
        }
      >();

    const result = await query.first();
    if (!result) {
      throw new NotFoundException(
        'Could not find project member',
        'projectMember.id'
      );
    }

    const props = parsePropList(result.propList);
    const securedProps = parseSecuredProperties(props, result.permList, {
      user: true,
      roles: true,
    });

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      user: {
        ...securedProps.user,
        value: await this.userService.readOne(result.userId, session),
      },
      modifiedAt: props.modifiedAt,
      roles: {
        ...securedProps.roles,
        value: securedProps.roles.value ?? [],
      },
    };
  }

  async update(
    input: UpdateProjectMember,
    session: ISession
  ): Promise<ProjectMember> {
    const object = await this.readOne(input.id, session);

    await this.db.sgUpdateProperties({
      session,
      object,
      props: ['roles', 'modifiedAt'],
      changes: {
        ...input,
        roles: (input.roles ? input.roles : undefined) as any,
        modifiedAt: DateTime.local(),
      },
      nodevar: 'projectMember',
    });
    return await this.readOne(input.id, session);
  }

  async delete(id: string, session: ISession): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException(
        'Could not find project member',
        'projectMember.id'
      );
    }

    try {
      await this.db.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (exception) {
      this.logger.warning('Failed to delete project member', {
        exception,
      });

      throw new ServerException('Failed to delete project member', exception);
    }
  }

  async list(
    { filter, ...input }: ProjectMemberListInput,
    session: ISession
  ): Promise<ProjectMemberListOutput> {
    const skip = (input.page - 1) * input.count;

    const query = this.db.query();

    query.match([
      node('requestingUser', 'User', {
        active: true,
        id: session.userId,
      }),
      relation('in', '', 'member*1..'),
      node('', 'SecurityGroup', { active: true }),
      relation('out', '', 'permission'),
      node('', 'Permission', { active: true }),
      relation('out', '', 'baseNode'),
      node('node', 'ProjectMember', { active: true }),
    ]);

    if (filter.projectId) {
      query
        .match([
          node('node', { active: true }),
          relation('in', '', 'member', { active: true }),
          node('filter', 'Project', { active: true }),
        ])
        .where({ filter: [{ id: contains(filter.projectId) }] });
    }

    query
      .with('collect(distinct node) as nodes, count(distinct node) as total')
      .raw('unwind nodes as node');

    if (input.sort === 'id' || input.sort === 'createdAt') {
      query.with('*').orderBy(`node.${input.sort} ${input.order}`);
    } else {
      query
        .match([
          node('node'),
          relation('out', '', input.sort),
          node('prop', 'Property', { active: true }),
        ])
        .with('*')
        .orderBy(`prop.value ${input.order}`);
    }
    query
      .skip(skip)
      .limit(input.count)
      .raw(
        `return collect(node.id) as ids, total, ${
          skip + input.count
        } < total as hasMore`
      );
    const result = await query.first();

    if (!result) {
      return {
        total: 0,
        hasMore: false,
        items: [],
      };
    }

    return {
      total: result.total,
      hasMore: result.hasMore,
      items: (await Promise.all(
        result.ids.map(async (projectIds: string) => {
          return await this.readOne(projectIds, session);
        })
      )) as ProjectMember[],
    };
  }

  protected filterByProject(
    query: Query,
    projectId: string,
    relationshipType: string,
    relationshipDirection: RelationDirection,
    label: string
  ) {
    query.match([
      node('project', 'Project', { active: true, id: projectId }),
      relation(relationshipDirection, '', relationshipType, { active: true }),
      node('node', label, { active: true }),
    ]);
  }
}
