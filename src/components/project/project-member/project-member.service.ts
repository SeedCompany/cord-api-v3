import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { RelationDirection } from 'cypher-query-builder/dist/typings/clauses/relation-pattern';
import { upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { DuplicateException, ISession } from '../../../common';
import {
  addAllMetaPropertiesOfChildBaseNodes,
  addAllSecureProperties,
  addBaseNodeMetaPropsWithClause,
  addPropertyCoalesceWithClause,
  addShapeForBaseNodeMetaProperty,
  addShapeForChildBaseNodeMetaProperty,
  ChildBaseNodeMetaProperty,
  ConfigService,
  DatabaseService,
  filterByArray,
  filterByBaseNodeId,
  ILogger,
  listWithSecureObject,
  Logger,
  matchRequestingUser,
  matchSession,
  matchUserPermissions,
  runListQuery,
} from '../../../core';
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
        node('projectMember'),
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
    } catch (e) {
      this.logger.warning('Failed to create project member', {
        exception: e,
      });

      throw new InternalServerErrorException('Could not create project member');
    }
  }

  async readOne(id: string, session: ISession): Promise<ProjectMember> {
    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    const props = ['roles', 'modifiedAt'];

    const baseNodeMetaProps = ['id', 'createdAt'];

    const childBaseNodeMetaProps: ChildBaseNodeMetaProperty[] = [
      {
        parentBaseNodePropertyKey: 'user',
        parentRelationDirection: 'out',
        childBaseNodeLabel: 'User',
        childBaseNodeMetaPropertyKey: 'id',
        returnIdentifier: 'userId',
      },
    ];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, 'ProjectMember', id)
      .call(addAllSecureProperties, ...props)
      .call(addAllMetaPropertiesOfChildBaseNodes, ...childBaseNodeMetaProps)
      .with([
        ...props.map(addPropertyCoalesceWithClause),
        ...childBaseNodeMetaProps.map(addShapeForChildBaseNodeMetaProperty),
        ...baseNodeMetaProps.map(addShapeForBaseNodeMetaProperty),
        'node',
      ])
      .returnDistinct([
        ...props,
        ...baseNodeMetaProps,
        ...childBaseNodeMetaProps.map((x) => x.returnIdentifier),
        'labels(node) as labels',
      ]);

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find project memeber');
    }

    const response: any = {
      ...result,
      roles: {
        value: result.roles.value || [],
        canRead: result.roles.canRead,
        canEdit: result.roles.canEdit,
      },
      modifiedAt: result.modifiedAt.value,
      user: {
        value: await this.userService.readOne(result.userId, session),
        canRead: !!result.canReadUser,
        canEdit: !!result.canEditUser,
      },
    };

    return (response as unknown) as ProjectMember;
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

  async list(
    { filter, ...input }: ProjectMemberListInput,
    session: ISession
  ): Promise<ProjectMemberListOutput> {
    const label = 'ProjectMember';
    const baseNodeMetaProps = ['id', 'createdAt'];
    // const unsecureProps = [''];
    const secureProps = ['roles', 'modifiedAt'];

    const childBaseNodeMetaProps: ChildBaseNodeMetaProperty[] = [
      {
        parentBaseNodePropertyKey: 'user',
        parentRelationDirection: 'out',
        childBaseNodeLabel: 'User',
        childBaseNodeMetaPropertyKey: 'id',
        returnIdentifier: 'userId',
      },
    ];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, 'ProjectMember');

    if (filter.roles) {
      query.call(filterByArray, label, 'roles', filter.roles);
    } else if (filter.projectId) {
      query.call(
        filterByBaseNodeId,
        filter.projectId,
        'member',
        'in',
        'Project',
        label
      );
    }

    // match on the rest of the properties of the object requested
    query
      .call(
        addAllSecureProperties,
        ...secureProps
        //...unsecureProps
      )
      .call(addAllMetaPropertiesOfChildBaseNodes, ...childBaseNodeMetaProps)
      // form return object
      // ${listWithUnsecureObject(unsecureProps)}, // removed from a few lines down
      .with(
        `
          {
            ${addBaseNodeMetaPropsWithClause(baseNodeMetaProps)},
            ${listWithSecureObject(secureProps)}
          } as node
        `
      );

    const result: ProjectMemberListOutput = await runListQuery(
      query,
      input,
      secureProps.includes(input.sort)
    );

    const items = await Promise.all(
      result.items.map((row: any) => this.readOne(row.id, session))
    );

    return {
      items,
      hasMore: result.hasMore,
      total: result.total,
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
