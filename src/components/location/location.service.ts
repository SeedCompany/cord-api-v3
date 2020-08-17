import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { inArray, node, relation } from 'cypher-query-builder';
import { first, intersection } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import {
  DuplicateException,
  InputException,
  ISession,
  NotFoundException,
  Sensitivity,
  ServerException,
} from '../../common';
import {
  addAllMetaPropertiesOfChildBaseNodes,
  addAllSecureProperties,
  addPropertyCoalesceWithClause,
  addShapeForBaseNodeMetaProperty,
  addShapeForChildBaseNodeMetaProperty,
  addUserToSG,
  ChildBaseNodeMetaProperty,
  ConfigService,
  createBaseNode,
  DatabaseService,
  permission as dbPermission,
  ILogger,
  Logger,
  matchRequestingUser,
  matchSession,
  matchUserPermissions,
  OnIndex,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPermList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parseSecuredProperties,
  runListQuery,
  StandardReadResult,
} from '../../core/database/results';
import {
  Country,
  CreateCountry,
  CreatePrivateLocation,
  CreatePublicLocation,
  CreateRegion,
  CreateZone,
  Location,
  LocationListInput,
  LocationListOutput,
  PrivateLocation,
  PublicLocation,
  Region,
  UpdateCountry,
  UpdatePrivateLocation,
  UpdateRegion,
  UpdateZone,
  Zone,
} from './dto';

@Injectable()
export class LocationService {
  private readonly securedProperties = {
    name: true,
  };

  constructor(
    @Logger('location:service') private readonly logger: ILogger,
    private readonly config: ConfigService,
    private readonly db: DatabaseService,
    private readonly userService: UserService,
    private readonly marketingLocationService: MarketingLocationService,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
    private readonly fundingAccountService: FundingAccountService,
    private readonly registryOfGeographyService: RegistryOfGeographyService
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      // ZONE NODE
      'CREATE CONSTRAINT ON (n:FieldZone) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:FieldZone) ASSERT n.id IS UNIQUE',

      'CREATE CONSTRAINT ON (n:FieldZone) ASSERT EXISTS(n.createdAt)',

      // ZONE NAME REL
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      // ZONE NAME NODE
      'CREATE CONSTRAINT ON (n:FieldZoneName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:FieldZoneName) ASSERT n.value IS UNIQUE',

      // REGION NODE
      'CREATE CONSTRAINT ON (n:FieldRegion) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:FieldRegion) ASSERT n.id IS UNIQUE',

      'CREATE CONSTRAINT ON (n:FieldRegion) ASSERT EXISTS(n.createdAt)',

      // REGION NAME REL
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      // REGION NAME NODE
      'CREATE CONSTRAINT ON (n:FieldRegionName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:FieldRegionName) ASSERT n.value IS UNIQUE',

      // COUNTRY NODE
      'CREATE CONSTRAINT ON (n:Country) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Country) ASSERT n.id IS UNIQUE',

      'CREATE CONSTRAINT ON (n:Country) ASSERT EXISTS(n.createdAt)',

      // COUNTRY NAME REL
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      // COUNTRY NAME NODE
      'CREATE CONSTRAINT ON (n:LocationName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:LocationName) ASSERT n.value IS UNIQUE',

      // PUBLICLOCATION NODE
      'CREATE CONSTRAINT ON (n:PublicLocation) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:PublicLocation) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:PublicLocation) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:PublicLocation) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:PublicLocation) ASSERT EXISTS(n.owningOrgId)',

      //PRIVATELOCATION NODE
      'CREATE CONSTRAINT ON (n:PrivateLocation) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:PrivateLocation) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:PrivateLocation) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:PrivateLocation) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:PrivateLocation) ASSERT EXISTS(n.owningOrgId)',

      'CREATE CONSTRAINT ON ()-[r:publicName]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:publicName]-() ASSERT EXISTS(r.createdAt)',
    ];
  }
  // helper method for defining properties
  property = (
    prop: string,
    value: any,
    baseNode: string,
    extraLabels?: string[]
  ) => {
    if (!value) {
      return [];
    }
    const createdAt = DateTime.local();
    const propLabel = ['Property', ...(extraLabels || [])];

    return [
      [
        node(baseNode),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(prop, propLabel, {
          value,
        }),
      ],
    ];
  };

  permission = dbPermission;

  async createZone(
    { directorId, ...input }: CreateZone,
    session: ISession
  ): Promise<Zone> {
    let id = generate();
    const createdAt = DateTime.local();

    try {
      const createZone = this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreateZone' }))
        .match([
          node('rootuser', 'User', {
            id: this.config.rootAdmin.id,
          }),
        ])
        .create([
          [
            node('newZone', ['FieldZone', 'BaseNode'], {
              createdAt,
              id,
            }),
          ],
          ...this.property('name', input.name, 'newZone', ['FieldZoneName']),
          [
            node('adminSG', 'SecurityGroup', {
              id: generate(),

              name: input.name + ' admin',
            }),
            relation('out', '', 'member'),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
              id: generate(),

              name: input.name + ' users',
            }),
            relation('out', '', 'member'),
            node('requestingUser'),
          ],
          [node('adminSG'), relation('out', '', 'member'), node('rootuser')],
          [node('readerSG'), relation('out', '', 'member'), node('rootuser')],
          ...this.permission('name', 'newZone'),
          ...this.permission('director', 'newZone'),
        ])
        .return('newZone.id as id');

      await createZone.first();

      // connect director User to zone
      if (directorId) {
        const query = `
      MATCH (director:User {id: $directorId}),
        (zone:FieldZone {id: $id})
      CREATE (director)<-[:director {active: true, createdAt: datetime()}]-(zone)
      RETURN  zone.id as id
      `;
        const addDirector = await this.db
          .query()
          .raw(query, {
            userId: session.userId,
            directorId,
            id,
          })
          .first();
        if (!addDirector) {
          throw new Error('already exists, try finding it');
        }
      }
    } catch {
      // creating this node may fail because the node exists.  Looking up the node by name
      const lookup = this.db
        .query()
        .match([
          node('zone', 'FieldZone'),
          relation('out', 'name', 'name', { active: true }),
          node('zoneName', 'Property', { value: input.name }),
        ])
        .return({
          zone: [{ id: 'zoneId' }],
        });
      const zone = await lookup.first();
      if (zone) {
        id = zone.zoneId;
      } else {
        throw new ServerException(
          'Cannot create Zone, cannot find matching name'
        );
      }
    }

    try {
      return await this.readOneZone(id, session);
    } catch (e) {
      throw new ServerException('Could not create zone', e);
    }
  }

  async createRegion(
    { zoneId, directorId, ...input }: CreateRegion,
    session: ISession
  ): Promise<Region> {
    let id = generate();
    const createdAt = DateTime.local();

    try {
      const createRegion = this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreateRegion' }))
        .match([
          node('rootuser', 'User', {
            id: this.config.rootAdmin.id,
          }),
        ])
        .create([
          [
            node('newRegion', ['FieldRegion', 'BaseNode'], {
              createdAt,
              id,
            }),
          ],
          ...this.property('name', input.name, 'newRegion', [
            'FieldRegionName',
          ]),
          [
            node('adminSG', 'SecurityGroup', {
              id: generate(),

              name: input.name + ' admin',
            }),
            relation('out', '', 'member'),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
              id: generate(),

              name: input.name + ' users',
            }),
            relation('out', '', 'member'),
            node('requestingUser'),
          ],
          [node('adminSG'), relation('out', '', 'member'), node('rootuser')],
          [node('readerSG'), relation('out', '', 'member'), node('rootuser')],
          ...this.permission('name', 'newRegion'),
          ...this.permission('director', 'newRegion'),
          ...this.permission('zone', 'newRegion'),
        ])
        .return('newRegion.id as id');

      await createRegion.first();

      this.logger.debug(`Region created`, { input, userId: session.userId });

      // connect the Zone to Region

      if (zoneId) {
        const query = `
          MATCH (zone:FieldZone {id: $zoneId}),
            (region:FieldRegion {id: $id})
          CREATE (zone)<-[:zone { active: true, createdAt: datetime() }]-(region)
          RETURN region.id as id
        `;

        await this.db
          .query()
          .raw(query, {
            zoneId,
            id,
          })
          .first();
      }
      // and region to director

      if (directorId) {
        const query = `
          MATCH
            (region:FieldRegion {id: $id}),
            (director:User {id: $directorId})
          CREATE (director)<-[:director { active: true, createdAt: datetime() }]-(region)
          RETURN region.id as id
        `;

        await this.db
          .query()
          .raw(query, {
            id,
            directorId,
          })
          .first();
      }
    } catch (exception) {
      // creating this region may have failed because the name already exists.  Looking up the Region
      const lookup = this.db
        .query()
        .match([
          node('region', 'FieldRegion'),
          relation('out', 'name', 'name', { active: true }),
          node('regionName', 'Property', { value: input.name }),
        ])
        .return({ region: [{ id: 'regionId' }] });
      const region = await lookup.first();
      if (region) {
        id = region.regionId;
      } else {
        this.logger.warning(`Could not create region`, {
          exception,
        });
        throw new ServerException('Could not create region', exception);
      }
    }
    try {
      return await this.readOneRegion(id, session);
    } catch (e) {
      throw new ServerException('Could not create region', e);
    }
  }

  async createCountry(
    { regionId, ...input }: CreateCountry,
    session: ISession
  ): Promise<Country> {
    let id = generate();
    const createdAt = DateTime.local();

    try {
      const createCountry = this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreateCountry' }))
        .match([
          node('rootuser', 'User', {
            id: this.config.rootAdmin.id,
          }),
        ])
        .create([
          [
            node('newCountry', ['Country', 'BaseNode'], {
              createdAt,
              id,
            }),
          ],
          ...this.property('name', input.name, 'newCountry', ['LocationName']),
          [
            node('adminSG', 'SecurityGroup', {
              id: generate(),

              name: input.name + ' admin',
            }),
            relation('out', '', 'member'),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
              id: generate(),

              name: input.name + ' users',
            }),
            relation('out', '', 'member'),
            node('requestingUser'),
          ],
          [node('adminSG'), relation('out', '', 'member'), node('rootuser')],
          [node('readerSG'), relation('out', '', 'member'), node('rootuser')],
          ...this.permission('name', 'newCountry'),
          ...this.permission('region', 'newCountry'),
        ])
        .return('newCountry.id as id');
      await createCountry.first();

      this.logger.debug(`country created`);

      // connect the Region to Country
      if (regionId) {
        const query = `
          MATCH (region:FieldRegion {id: $regionId}),
            (country:Country {id: $id})
          CREATE (country)-[:region { active: true, createdAt: datetime()}]->(region)
          RETURN country.id as id
        `;

        await this.db
          .query()
          .raw(query, {
            regionId,
            id,
          })
          .first();
      }
    } catch (exception) {
      // creating this region may have failed because the name already exists.  Looking up the Region
      const lookup = this.db
        .query()
        .match([
          node('country', 'Country'),
          relation('out', 'name', 'name', { active: true }),
          node('countryName', 'Property', { value: input.name }),
        ])
        .return({ country: [{ id: 'countryId' }] });
      const country = await lookup.first();
      if (country) {
        id = country.countryId;
      } else {
        this.logger.warning(`Could not create country`, {
          exception,
        });
        throw new ServerException('Could not create country', exception);
      }
    }
    try {
      return await this.readOneCountry(id, session);
    } catch (e) {
      throw new ServerException('Could not create country', e);
    }
  }

  async createPublicLocation(
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
      if (input.projectId) {
        query.match([
          node('project', 'Project', {
            active: true,
            id: input.projectId,
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
      if (input.projectId) {
        query.create([
          [
            node('node'),
            relation('in', '', 'locations', { active: true, createdAt }),
            node('project'),
          ],
        ]);
      }

      query
        .create([
          ...this.permission('marketingLocation', 'node'),
          ...this.permission('privateLocation', 'node'),
          ...this.permission('fundingAccount', 'node'),
          ...this.permission('registryOfGeography', 'node'),
          ...this.permission('project', 'node'),
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

      return await this.readOnePublicLocation(result.id, session);
    } catch (err) {
      this.logger.error(
        `Could not create public location for user ${session.userId}`
      );
      throw new ServerException('Could not create public location');
    }
  }

  async createPrivateLocation(
    input: CreatePrivateLocation,
    session: ISession
  ): Promise<PrivateLocation> {
    const checkPrivateLocation = await this.db
      .query()
      .match([node('PrivateLocation', 'LanguageName', { value: input.name })])
      .return('PrivateLocation')
      .first();

    if (checkPrivateLocation) {
      throw new DuplicateException(
        'privateLocation.name',
        'PrivateLocation with this name already exists.'
      );
    }

    const secureProps = [
      {
        key: 'name',
        value: input.name,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
        label: 'LanguageName',
      },
      {
        key: 'publicName',
        value: input.publicName,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
        label: 'LanguagePublicName',
      },
      {
        key: 'type',
        value: input.type,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
        label: 'PrivateLocationType',
      },
      {
        key: 'sensitivity',
        value: input.sensitivity,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

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
        .call(createBaseNode, ['PrivateLocation', 'BaseNode'], secureProps, {
          owningOrgId: session.owningOrgId,
        })
        .call(addUserToSG, 'rootUser', 'adminSG')
        .call(addUserToSG, 'rootUser', 'readerSG')
        .return('node.id as id');

      const result = await query.first();
      if (!result) {
        throw new ServerException('failed to create a private location');
      }

      const id = result.id;

      // add root admin to new private location as an admin
      await this.db.addRootAdminToBaseNodeAsAdmin(id, 'PrivateLocation');

      this.logger.info(`private location created`, { id: result.id });

      return await this.readOnePrivateLocation(result.id, session);
    } catch (err) {
      this.logger.error(
        `Could not create private location for user ${session.userId}`
      );
      throw new ServerException('Could not create private location');
    }
  }

  async readOne(id: string, session: ISession): Promise<Location> {
    const query = `
    MATCH (place {id: $id}) RETURN labels(place) as labels
    `;
    const results = await this.db.query().raw(query, { id }).first();
    // MATCH one of these labels.
    const label = first(
      intersection(results?.labels, ['FieldRegion', 'FieldZone'])
    );

    this.logger.debug('Looking for ', {
      label,
      id,
      userId: session.userId,
    });
    switch (label) {
      case 'FieldZone': {
        return this.readOneZone(id, session);
      }
      case 'FieldRegion': {
        return this.readOneRegion(id, session);
      }
      default: {
        throw new InputException('Not a location', 'location.id');
      }
    }
  }

  async readOneZone(id: string, session: ISession): Promise<Zone> {
    this.logger.debug(`Read Zone`, { id, userId: session.userId });

    if (!id) {
      throw new NotFoundException('no id given', 'zone.id');
    }

    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Zone', { id: id })])
      .call(matchPermList, 'requestingUser')
      .call(matchPropList, 'permList')
      .optionalMatch([
        node('node'),
        relation('out', '', 'director', { active: true }),
        node('director', 'User'),
      ])
      .return('propList, permList, node, director.id as directorId')
      .asResult<
        StandardReadResult<DbPropsOfDto<Zone>> & { directorId: string }
      >();

    const result = await query.first();
    if (!result) {
      this.logger.error(`Could not find zone`);
      throw new NotFoundException('Could not find zone', 'zone.id');
    }

    const secured = parseSecuredProperties(result.propList, result.permList, {
      name: true,
      director: true,
    });

    return {
      ...parseBaseNodeProperties(result.node),
      ...secured,
      director: {
        ...secured.director,
        value: result.directorId,
      },
    };
  }

  async readOneRegion(id: string, session: ISession): Promise<Region> {
    this.logger.debug(`Read Region`, { id, userId: session.userId });

    if (!id) {
      throw new NotFoundException('no id given', 'region.id');
    }

    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Region', { id: id })])
      .call(matchPermList, 'requestingUser')
      .call(matchPropList, 'permList')
      .optionalMatch([
        node('node'),
        relation('out', '', 'director', { active: true }),
        node('director', 'User'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'zone', { active: true }),
        node('zone', 'Zone'),
      ])
      .return([
        'propList, permList, node',
        'director.id as directorId',
        'zone.id as zoneId',
      ])
      .asResult<
        StandardReadResult<DbPropsOfDto<Region>> & {
          directorId: string;
          zoneId: string;
        }
      >();

    const result = await query.first();
    if (!result) {
      this.logger.error(`Could not find region`);
      throw new NotFoundException('Could not find region', 'region.id');
    }

    const secured = parseSecuredProperties(result.propList, result.permList, {
      name: true,
      director: true,
      zone: true,
    });

    return {
      ...parseBaseNodeProperties(result.node),
      ...secured,
      director: {
        ...secured.director,
        value: result.directorId,
      },
      zone: {
        ...secured.zone,
        value: result.zoneId,
      },
    };
  }

  async readOneCountry(id: string, session: ISession): Promise<Country> {
    this.logger.debug(`Query readOne Country`, { id, userId: session.userId });

    if (!id) {
      throw new InputException('No country id to search for', 'country.id');
    }

    const props = ['name'];
    const baseNodeMetaProps = ['id', 'createdAt'];

    const childBaseNodeMetaProps: ChildBaseNodeMetaProperty[] = [
      {
        parentBaseNodePropertyKey: 'region',
        parentRelationDirection: 'out',
        childBaseNodeLabel: 'FieldRegion',
        childBaseNodeMetaPropertyKey: 'id',
        returnIdentifier: 'regionId',
      },
    ];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, 'Country', id)
      .call(addAllSecureProperties, ...props)
      .call(addAllMetaPropertiesOfChildBaseNodes, ...childBaseNodeMetaProps)
      .with([
        ...props.map(addPropertyCoalesceWithClause),
        ...childBaseNodeMetaProps.map(addShapeForChildBaseNodeMetaProperty),
        ...baseNodeMetaProps.map(addShapeForBaseNodeMetaProperty),
        'node',
        'coalesce(regionReadPerm.read, false) as canReadRegion',
        'coalesce(regionEditPerm.edit, false) as canEditRegion',
      ])
      .returnDistinct([
        ...props,
        ...baseNodeMetaProps,
        ...childBaseNodeMetaProps.map((x) => x.returnIdentifier),
        'canReadRegion',
        'canEditRegion',
        'labels(node) as labels',
      ]);

    const result = await query.first();
    if (!result) {
      this.logger.error(`Could not find country`);
      throw new NotFoundException('Could not find country', 'country.id');
    }

    const response: any = {
      ...result,
      region: {
        value: await this.readOneRegion(result.regionId, session),
        canRead: !!result.canReadRegion,
        canEdit: !!result.canEditRegion,
      },
    };

    return (response as unknown) as Country;
  }

  async readOnePublicLocation(
    id: string,
    session: ISession
  ): Promise<PublicLocation> {
    this.logger.info(`Query readOne PublicLocation`, {
      id,
      userId: session.userId,
    });

    const baseNodeMetaProps = ['id', 'createdAt'];

    const childBaseNodeMetaProps: ChildBaseNodeMetaProperty[] = [
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
      {
        parentBaseNodePropertyKey: 'project',
        parentRelationDirection: 'in',
        childBaseNodeLabel: 'Project',
        childBaseNodeMetaPropertyKey: 'id',
        returnIdentifier: 'projectId',
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
        `
        {
          value: project.id,
          canRead: coalesce(projectReadPerm.read, false),
          canEdit: coalesce(projectEditPerm.edit, false)
        } as project
        `,
        'node',
      ])
      .returnDistinct([
        ...baseNodeMetaProps,
        ...childBaseNodeMetaProps.map((x) => x.returnIdentifier),
        'fundingAccount',
        'marketingLocation',
        'registryOfGeography',
        'privateLocation',
        'project',
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
        value: result.fundingAccount.value
          ? await this.fundingAccountService.readOne(
              result.fundingAccount.value,
              session
            )
          : null,
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
        value: result.registryOfGeography.value
          ? await this.registryOfGeographyService.readOne(
              result.registryOfGeography.value,
              session
            )
          : null,
      },
      privateLocation: {
        canRead: !!result.privateLocation.canRead,
        canEdit: !!result.privateLocation.canEdit,
        value: await this.readOnePrivateLocation(
          result.privateLocation.value,
          session
        ),
      },
      project: {
        canRead: !!result.project.canRead,
        canEdit: !!result.project.canEdit,
        value: result.project.value
          ? await this.projectService.readOne(result.project.value, session)
          : null,
      },
    };

    return (response as unknown) as PublicLocation;
  }

  async readOnePrivateLocation(
    id: string,
    session: ISession
  ): Promise<PrivateLocation> {
    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    const secureProps = ['name', 'publicName', 'type', 'sensitivity'];

    const readPrivateLocation = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, 'PrivateLocation', id)
      .call(addAllSecureProperties, ...secureProps)
      .with([
        ...secureProps.map(addPropertyCoalesceWithClause),
        'coalesce(node.id) as id',
        'coalesce(node.createdAt) as createdAt',
      ])
      .returnDistinct([...secureProps, 'id', 'createdAt']);

    const result = await readPrivateLocation.first();
    if (!result) {
      throw new NotFoundException('Could not find private location');
    }

    const response: any = {
      ...result,
      sensitivity: result.sensitivity.value || Sensitivity.Low,
      type: result.type.value,
    };

    return (response as unknown) as PrivateLocation;
  }

  async updateZone(input: UpdateZone, session: ISession): Promise<Zone> {
    const zone = await this.readOneZone(input.id, session);

    // update director
    if (input.directorId && input.directorId !== zone.director.value) {
      const query = `
        MATCH
          (token:Token {
            active: true,
            value: $token
          })<-[:token {active: true}]-
          (requestingUser:User {

            id: $requestingUserId
          }),
          (newDirector:User {id: $directorId}),
          (zone:FieldZone {id: $id})-[rel:director {active: true}]->(oldDirector:User)
        DELETE rel
        CREATE (newDirector)<-[:director {active: true, createdAt: datetime()}]-(zone)
        RETURN  zone.id as id
      `;

      await this.db
        .query()
        .raw(query, {
          directorId: input.directorId,
          id: input.id,

          requestingUserId: session.userId,
          token: session.token,
          userId: session.userId,
        })
        .first();
    }

    await this.db.sgUpdateProperties({
      session,
      object: zone,
      props: ['name'],
      changes: input,
      nodevar: 'fieldZone',
    });

    return await this.readOneZone(input.id, session);
  }

  async updateRegion(input: UpdateRegion, session: ISession): Promise<Region> {
    const region = await this.readOneRegion(input.id, session);

    // update director
    if (input.directorId && input.directorId !== region.director.value) {
      const query = `
          MATCH
            (token:Token {
              active: true,
              value: $token
            })<-[:token {active: true}]-
            (requestingUser:User {

              id: $requestingUserId
            }),
            (newDirector:User {id: $directorId}),
            (region:FieldRegion {id: $id})-[rel:director {active: true}]->(oldDirector:User)
          DELETE rel
          CREATE (newDirector)<-[:director {active: true, createdAt: datetime()}]-(region)
          RETURN  region.id as id
        `;

      await this.db
        .query()
        .raw(query, {
          directorId: input.directorId,
          id: input.id,

          requestingUserId: session.userId,
          token: session.token,
          userId: session.userId,
        })
        .first();
    }

    // update zone
    if (input.zoneId && input.zoneId !== region.zone.value) {
      const query = `
          MATCH
            (token:Token {
              active: true,
              value: $token
            })<-[:token {active: true}]-
            (requestingUser:User {

              id: $requestingUserId
            }),
            (newZone:FieldZone {id: $zoneId}),
            (region:FieldRegion {id: $id})-[rel:zone {active: true}]->(oldZone:FieldZone)
          DELETE rel
          CREATE (newZone)<-[:zone {active: true, createdAt: datetime()}]-(region)
          RETURN  region.id as id
        `;

      await this.db
        .query()
        .raw(query, {
          directorId: input.directorId,
          id: input.id,

          requestingUserId: session.userId,
          token: session.token,
          userId: session.userId,
          zoneId: input.zoneId,
        })
        .first();
    }

    await this.db.sgUpdateProperties({
      session,
      object: region,
      props: ['name'],
      changes: input,
      nodevar: 'fieldRegion',
    });
    return await this.readOneRegion(input.id, session);
  }

  async updateCountry(
    input: UpdateCountry,
    session: ISession
  ): Promise<Country> {
    const country = await this.readOneCountry(input.id, session);

    // update region
    if (input.regionId && input.regionId !== country.region.value?.id) {
      const query = `
          MATCH
            (token:Token {
              active: true,
              value: $token
            })<-[:token {active: true}]-
            (requestingUser:User {

              id: $requestingUserId
            }),
            (newRegion:FieldRegion {id: $regionId}),
            (country:Country {id: $id})-[rel:region {active: true}]->(oldZone:FieldRegion)
          DELETE rel
          CREATE (newRegion)<-[:region {active: true, createdAt: datetime()}]-(country)
          RETURN  country.id as id
        `;

      await this.db
        .query()
        .raw(query, {
          id: input.id,

          regionId: input.regionId,
          requestingUserId: session.userId,
          token: session.token,
          userId: session.userId,
        })
        .first();
    }

    await this.db.sgUpdateProperties({
      session,
      object: country,
      props: ['name'],
      changes: input,
      nodevar: 'country',
    });

    return await this.readOneCountry(input.id, session);
  }

  async updatePrivateLocation(
    input: UpdatePrivateLocation,
    session: ISession
  ): Promise<PrivateLocation> {
    const PrivateLocation = await this.readOnePrivateLocation(
      input.id,
      session
    );

    return this.db.sgUpdateProperties({
      session,
      object: PrivateLocation,
      props: ['name', 'publicName'],
      changes: input,
      nodevar: 'PrivateLocation',
    });
  }

  async delete(id: string, session: ISession): Promise<void> {
    try {
      await this.db
        .query()
        .raw(
          `
        MATCH
        (token:Token {
          active: true,
          value: $token
        })
        <-[:token {active: true}]-
        (requestingUser:User {

          id: $requestingUserId,
          canDeleteLocation: true
        }),
        (place {

          id: $id
        })
        DETACH DELETE place
        `,
          {
            id,

            requestingUserId: session.userId,
            token: session.token,
          }
        )
        .run();

      // if (!object) {
      //   throw new NotFoundException('Location not found');
      // }
    } catch (exception) {
      this.logger.error('Could not delete location', { exception });
      throw new ServerException('Could not delete location', exception);
    }
  }

  async list(
    { filter, ...input }: LocationListInput,
    session: ISession
  ): Promise<LocationListOutput> {
    const types = filter.types ?? ['Zone', 'Region'];

    const query = this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode()])
      .match([
        node('name', ['Property', 'LocationName']),
        relation('in', '', 'name'),
        node('node'),
      ])
      .with(
        'name, node, head([x IN labels(node) WHERE x <> "BaseNode"]) as label'
      )
      .where({
        label: inArray(types),
      })
      .call(calculateTotalAndPaginateList, input, (q, sort, order) =>
        sort in this.securedProperties
          ? q
              .match([
                node('node'),
                relation('out', '', sort),
                node('prop', 'Property'),
              ])
              .with('*')
              .orderBy('prop.value', order)
          : q.with('*').orderBy(`node.${sort}`, order)
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }

  // private randomLocation() {
  //   const id = () => faker.random.alphaNumeric(8);
  //   const inPast = () => DateTime.fromJSDate(faker.date.past());
  //   const ro = <T>(value: T) => ({
  //     value,
  //     canRead: true,
  //     canEdit: false,
  //   });

  //   const user = (): User => ({
  //     id: id(),
  //     createdAt: inPast(),
  //     bio: ro(''),
  //     displayFirstName: ro(faker.name.firstName()),
  //     displayLastName: ro(faker.name.lastName()),
  //     realFirstName: ro(faker.name.firstName()),
  //     realLastName: ro(faker.name.lastName()),
  //     email: ro(faker.internet.email()),
  //     phone: ro(faker.phone.phoneNumber()),
  //     timezone: ro(faker.lorem.words(2)),
  //   });

  //   const region: Zone = {
  //     id: id(),
  //     createdAt: inPast(),
  //     name: ro(faker.address.country()),
  //     director: ro(user()),
  //   };

  //   const area: Region = {
  //     id: id(),
  //     createdAt: inPast(),
  //     name: ro(faker.address.state()),
  //     zone: ro(region),
  //     director: ro(user()),
  //   };

  //   const country: Country = {
  //     id: id(),
  //     createdAt: inPast(),
  //     name: ro(faker.address.city()),
  //     region: ro(area),
  //   };

  //   return faker.random.arrayElement([area, region, country]);
  // }

  async checkZoneConsistency(session: ISession): Promise<boolean> {
    const zones = await this.db
      .query()
      .match([matchSession(session), [node('zone', 'Zone')]])
      .return('zone.id as id')
      .run();

    return (
      (
        await Promise.all(
          zones.map(async (zone) => {
            return await this.db.isRelationshipUnique({
              session,
              id: zone.id,
              relName: 'director',
              srcNodeLabel: 'Zone',
            });
          })
        )
      ).every((n) => n) &&
      (
        await Promise.all(
          zones.map(async (zone) => {
            return await this.db.hasProperties({
              session,
              id: zone.id,
              props: ['name'],
              nodevar: 'zone',
            });
          })
        )
      ).every((n) => n)
    );
  }

  async checkRegionConsistency(session: ISession): Promise<boolean> {
    const regions = await this.db
      .query()
      .match([matchSession(session), [node('region', 'Region')]])
      .return('region.id as id')
      .run();

    return (
      (
        await Promise.all(
          regions.map(async (region) => {
            return await this.db.isRelationshipUnique({
              session,
              id: region.id,
              relName: 'zone',
              srcNodeLabel: 'Region',
            });
          })
        )
      ).every((n) => n) &&
      (
        await Promise.all(
          regions.map(async (region) => {
            return await this.db.hasProperties({
              session,
              id: region.id,
              props: ['name'],
              nodevar: 'region',
            });
          })
        )
      ).every((n) => n)
    );
  }

  async checkCountryConsistency(session: ISession): Promise<boolean> {
    const countries = await this.db
      .query()
      .match([matchSession(session), [node('country', 'Country')]])
      .return('country.id as id')
      .run();

    return (
      (
        await Promise.all(
          countries.map(async (country) => {
            return await this.db.isRelationshipUnique({
              session,
              id: country.id,
              relName: 'region',
              srcNodeLabel: 'Country',
            });
          })
        )
      ).every((n) => n) &&
      (
        await Promise.all(
          countries.map(async (country) => {
            return await this.db.hasProperties({
              session,
              id: country.id,
              props: ['name'],
              nodevar: 'country',
            });
          })
        )
      ).every((n) => n)
    );
  }

  async checkLocationConsistency(session: ISession): Promise<boolean> {
    return (
      (await this.checkCountryConsistency(session)) &&
      (await this.checkRegionConsistency(session)) &&
      (await this.checkZoneConsistency(session))
    );

    return true;
  }
}
