import { Injectable, NotFoundException } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ISession, ServerException } from '../../common';
import {
  addAllMetaPropertiesOfChildBaseNodes,
  addShapeForBaseNodeMetaProperty,
  addShapeForChildBaseNodeMetaProperty,
  addUserToSG,
  ChildBaseNodeMetaProperty,
  ConfigService,
  createBaseNode,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  matchUserPermissions,
  OnIndex,
  runListQuery,
} from '../../core';
import { FundingAccountService } from '../funding-account';
import { LocationService } from '../location';
import { MarketingLocationService } from '../marketing-location';
import { PrivateLocationService } from '../private-location';
import { RegistryOfGeographyService } from '../registry-of-geography';
import {
  CreatePublicLocation,
  PublicLocation,
  PublicLocationListInput,
  PublicLocationListOutput,
} from './dto';

@Injectable()
export class PublicLocationService {
  constructor(
    @Logger('publicLocation:service') private readonly logger: ILogger,
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly fundingAccountService: FundingAccountService,
    private readonly locationService: LocationService,
    private readonly marketingLocationService: MarketingLocationService,
    private readonly registryOfGeographyService: RegistryOfGeographyService,
    private readonly privateLocationService: PrivateLocationService
  ) {}

  @OnIndex()
  async createIndexes() {
    const constraints = [
      'CREATE CONSTRAINT ON (n:PublicLocation) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:PublicLocation) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:PublicLocation) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:PublicLocation) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:PublicLocation) ASSERT EXISTS(n.owningOrgId)',
    ];
    for (const query of constraints) {
      await this.db.query().raw(query).run();
    }
  }

  // helper method for defining permissions
  permission = (property: string, baseNode: string) => {
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
        node(baseNode),
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
        node(baseNode),
      ],
    ];
  };

  async create(
    input: CreatePublicLocation,
    session: ISession
  ): Promise<PublicLocation> {
    const createdAt = DateTime.local();

    try {
      const query = this.db
        .query()
        .call(matchRequestingUser, session)
        .match([
          node('rootUser', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ])
        .match([
          node('fieldRegion', 'FieldRegion', {
            active: true,
            id: input.fieldRegionId,
          }),
        ])
        .match([
          node('marketingLocation', 'MarketingLocation', {
            active: true,
            id: input.marketingLocationId,
          }),
        ])
        .match([
          node('privateLocation', 'PrivateLocation', {
            active: true,
            id: input.privateLocationId,
          }),
        ]);

      if (input.fundingAccountId) {
        query.match([
          node('fundingAccount', 'FundingAccount', {
            active: true,
            id: input.fundingAccountId,
          }),
        ]);
      }
      if (input.registryOfGeographyId) {
        query.match([
          node('registryOfGeography', 'RegistryOfGeography', {
            active: true,
            id: input.registryOfGeographyId,
          }),
        ]);
      }

      query
        .call(createBaseNode, ['PublicLocation'], [], {
          owningOrgId: session.owningOrgId,
        })
        .create([
          [
            node('node'),
            relation('out', '', 'fieldRegion', { active: true, createdAt }),
            node('fieldRegion'),
          ],
        ])
        .create([
          [
            node('node'),
            relation('out', '', 'marketingLocation', {
              active: true,
              createdAt,
            }),
            node('marketingLocation'),
          ],
        ])
        .create([
          [
            node('node'),
            relation('out', '', 'privateLocation', { active: true, createdAt }),
            node('privateLocation'),
          ],
        ]);

      if (input.fundingAccountId) {
        query.create([
          [
            node('node'),
            relation('out', '', 'fundingAccount', { active: true, createdAt }),
            node('fundingAccount'),
          ],
        ]);
      }
      if (input.registryOfGeographyId) {
        query.create([
          [
            node('node'),
            relation('out', '', 'registryOfGeography', {
              active: true,
              createdAt,
            }),
            node('registryOfGeography'),
          ],
        ]);
      }

      query
        .create([
          ...this.permission('fieldRegion', 'node'),
          ...this.permission('marketingLocation', 'node'),
          ...this.permission('privateLocation', 'node'),
          ...this.permission('fundingAccount', 'node'),
          ...this.permission('registryOfGeography', 'node'),
        ])
        .call(addUserToSG, 'rootUser', 'adminSG')
        .call(addUserToSG, 'rootUser', 'readerSG')
        .return('node.id as id');

      const result = await query.first();
      if (!result) {
        throw new ServerException('failed to create a public location');
      }

      const id = result.id;

      // add root admin to new public location as an admin
      await this.db.addRootAdminToBaseNodeAsAdmin(id, 'PublicLocation');

      this.logger.info(`public location created`, { id: result.id });

      return await this.readOne(result.id, session);
    } catch (err) {
      this.logger.error(
        `Could not create public location for user ${session.userId}`
      );
      throw new ServerException('Could not create public location');
    }
  }

  async readOne(id: string, session: ISession): Promise<PublicLocation> {
    this.logger.info(`Query readOne PublicLocation`, {
      id,
      userId: session.userId,
    });

    const baseNodeMetaProps = ['id', 'createdAt'];

    const childBaseNodeMetaProps: ChildBaseNodeMetaProperty[] = [
      {
        parentBaseNodePropertyKey: 'fundingAccount',
        parentRelationDirection: 'out',
        childBaseNodeLabel: 'FundingAccount',
        childBaseNodeMetaPropertyKey: 'id',
        returnIdentifier: 'fundingAccountId',
      },
      {
        parentBaseNodePropertyKey: 'fieldRegion',
        parentRelationDirection: 'out',
        childBaseNodeLabel: 'FieldRegion',
        childBaseNodeMetaPropertyKey: 'id',
        returnIdentifier: 'fieldRegionId',
      },
      {
        parentBaseNodePropertyKey: 'marketingLocation',
        parentRelationDirection: 'out',
        childBaseNodeLabel: 'MarketingLocation',
        childBaseNodeMetaPropertyKey: 'id',
        returnIdentifier: 'marketingLocationId',
      },
      {
        parentBaseNodePropertyKey: 'privateLocation',
        parentRelationDirection: 'out',
        childBaseNodeLabel: 'PrivateLocation',
        childBaseNodeMetaPropertyKey: 'id',
        returnIdentifier: 'privateLocationId',
      },
      {
        parentBaseNodePropertyKey: 'registryOfGeography',
        parentRelationDirection: 'out',
        childBaseNodeLabel: 'RegistryOfGeography',
        childBaseNodeMetaPropertyKey: 'id',
        returnIdentifier: 'registryOfGeographyId',
      },
    ];
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, 'PublicLocation', id)
      .call(addAllMetaPropertiesOfChildBaseNodes, ...childBaseNodeMetaProps)
      .with([
        ...childBaseNodeMetaProps.map(addShapeForChildBaseNodeMetaProperty),
        ...baseNodeMetaProps.map(addShapeForBaseNodeMetaProperty),
        `
        {
          value: fundingAccount.id,
          canRead: coalesce(fundingAccountReadPerm.read, false),
          canEdit: coalesce(fundingAccountReadPerm.edit, false)
        } as fundingAccount
        `,
        `
        {
          value: fieldRegion.id,
          canRead: coalesce(fieldRegionReadPerm.read, false),
          canEdit: coalesce(fieldRegionEditPerm.edit, false)
        } as fieldRegion
        `,
        `
        {
          value: marketingLocation.id,
          canRead: coalesce(marketingLocationReadPerm.read, false),
          canEdit: coalesce(marketingLocationEditPerm.edit, false)
        } as marketingLocation
        `,
        `
        {
          value: registryOfGeography.id,
          canRead: coalesce(registryOfGeographyReadPerm.read, false),
          canEdit: coalesce(registryOfGeographyEditPerm.edit, false)
        } as registryOfGeography
        `,
        `
        {
          value: privateLocation.id,
          canRead: coalesce(privateLocationReadPerm.read, false),
          canEdit: coalesce(privateLocationEditPerm.edit, false)
        } as privateLocation
        `,
        'node',
      ])
      .returnDistinct([
        ...baseNodeMetaProps,
        ...childBaseNodeMetaProps.map((x) => x.returnIdentifier),
        'fundingAccount',
        'fieldRegion',
        'marketingLocation',
        'registryOfGeography',
        'privateLocation',
        'labels(node) as labels',
      ]);

    const result = await query.first();
    if (!result) {
      this.logger.error(`Could not public location`);
      throw new NotFoundException('Could not public location');
    }

    const response: any = {
      ...result,
      fundingAccount: {
        canRead: !!result.fundingAccount.canRead,
        canEdit: !!result.fundingAccount.canEdit,
        value: null,
      },
      fieldRegion: {
        canRead: !!result.fieldRegion.canRead,
        canEdit: !!result.fieldRegion.canEdit,
        value: await this.locationService.readOneRegion(
          result.fieldRegion.value,
          session
        ),
      },
      marketingLocation: {
        canRead: !!result.marketingLocation.canRead,
        canEdit: !!result.marketingLocation.canEdit,
        value: await this.marketingLocationService.readOne(
          result.marketingLocation.value,
          session
        ),
      },
      registryOfGeography: {
        canRead: !!result.registryOfGeography.canRead,
        canEdit: !!result.registryOfGeography.canEdit,
        value: null,
      },
      privateLocation: {
        canRead: !!result.privateLocation.canRead,
        canEdit: !!result.privateLocation.canEdit,
        value: await this.privateLocationService.readOne(
          result.privateLocation.value,
          session
        ),
      },
    };

    return (response as unknown) as PublicLocation;
  }

  // TODO
  // async update(
  //   __input: UpdatePublicLocation,
  //   __session: ISession
  // ): Promise<PublicLocation> {
  // }

  async delete(id: string, session: ISession): Promise<void> {
    const PublicLocation = await this.readOne(id, session);
    try {
      await this.db.deleteNode({
        session,
        object: PublicLocation,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.error('Failed to delete', { id, exception: e });
      throw new ServerException('Failed to delete');
    }

    this.logger.info(`deleted public location with id`, { id });
  }

  async list(
    { filter, ...input }: PublicLocationListInput,
    session: ISession
  ): Promise<PublicLocationListOutput> {
    const label = 'PublicLocation';

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, label);

    const result: PublicLocationListOutput = await runListQuery(query, input);

    const items = await Promise.all(
      result.items.map((row: any) => this.readOne(row.properties.id, session))
    );

    return {
      items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }
}
