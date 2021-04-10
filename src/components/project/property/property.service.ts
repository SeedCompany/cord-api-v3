import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  generateId,
  NotFoundException,
  ServerException,
  Session,
} from '../../../common';
import {
  ConfigService,
  createBaseNode,
  DatabaseService,
  IEventBus,
  ILogger,
  Logger,
  matchRequestingUser,
} from '../../../core';
import {
  calculateTotalAndPaginateList,
  defaultSorter,
  matchMemberRoles,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parsePropList,
  runListQuery,
  StandardReadResult,
} from '../../../core/database/results';
import { AuthorizationService } from '../../authorization/authorization.service';
import { Role } from '../../authorization/dto';
import {
  CreateProperty,
  Property,
  PropertyListInput,
  PropertyListOutput,
  UpdateProperty,
} from './dto';

@Injectable()
export class PropertyService {
  private readonly securedProperties = {
    user: true,
    roles: true,
  };

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly eventBus: IEventBus,
    @Logger('project:property:service') private readonly logger: ILogger,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService
  ) {}

  // @OnIndex()
  // async createIndexes() {
  //   return [
  //     'CREATE CONSTRAINT ON (n:Property) ASSERT EXISTS(n.id)',
  //     'CREATE CONSTRAINT ON (n:Property) ASSERT n.id IS UNIQUE',
  //   ];
  // }

  async create(
    { projectId, ...input }: CreateProperty,
    session: Session
  ): Promise<Property> {
    const propertyId = await generateId();
    const createdAt = DateTime.local();

    const secureProps = [
      {
        key: 'value',
        value: input.value,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    let result;
    try {
      const createProperty = this.db
        .query()
        .call(matchRequestingUser, session)
        .call(createBaseNode, propertyId, 'Property', secureProps)
        .return('node.id as id');

      try {
        result = await createProperty.first();
      } catch (e) {
        this.logger.error('e :>> ', e);
      }

      if (!result) {
        throw new ServerException('failed to create property');
      }

      // connect Property to Project
      await this.db
        .query()
        .match([
          [node('property', 'Property', { id: result.id })],
          [node('project', 'Project', { id: projectId })],
        ])
        .create([
          node('project'),
          relation('out', '', 'property', { active: false, createdAt }),
          node('property'),
        ])
        .return('property.id as id')
        .first();

      const property = await this.readOne(propertyId, session);

      return property;
    } catch (exception) {
      this.logger.warning('Failed to create property', {
        exception,
      });

      throw new ServerException('Failed to create property', exception);
    }
  }

  async readOne(id: string, session: Session): Promise<Property> {
    this.logger.debug(`read one`, {
      id,
      userId: session.userId,
    });
    if (!id) {
      throw new NotFoundException(
        'No property id to search for',
        'property.id'
      );
    }

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Property', { id })])
      .call(matchPropList)
      .match([
        node('project', 'Project'),
        relation('out', '', 'property', { active: false }),
        node('', 'Property', { id }),
      ])
      .with(['project', 'node', 'propList'])
      .call(matchMemberRoles, session.userId)
      .return('node, propList, memberRoles')
      .asResult<
        StandardReadResult<DbPropsOfDto<Property>> & {
          memberRoles: Role[][];
        }
      >();

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find property', 'property.id');
    }

    const props = parsePropList(result.propList);

    return {
      ...parseBaseNodeProperties(result.node),
      value: {
        value: props.value,
        canEdit: false,
        canRead: false,
      },
      canDelete: await this.db.checkDeletePermission(id, session), // TODO
    };
  }

  async list(
    { filter, ...input }: PropertyListInput,
    session: Session
  ): Promise<PropertyListOutput> {
    const label = 'Property';

    const query = this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.projectId
          ? [
              relation('in', '', 'property'),
              node('project', 'Project', {
                id: filter.projectId,
              }),
            ]
          : []),
      ])
      .call(
        calculateTotalAndPaginateList,
        input,
        this.securedProperties,
        defaultSorter
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }

  async update(input: UpdateProperty, session: Session): Promise<Property> {
    const object = await this.readOne(input.id, session);

    await this.db.sgUpdateProperties({
      session,
      object,
      props: ['value'],
      changes: {
        ...input,
      },
      nodevar: 'property',
    });
    return await this.readOne(input.id, session);
  }

  async delete(id: string, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find property', 'property.id');
    }

    try {
      await this.db.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (exception) {
      this.logger.warning('Failed to delete property', {
        exception,
      });

      throw new ServerException('Failed to delete property', exception);
    }
  }
}
