import { Injectable } from '@nestjs/common';
import { inArray, node, regexp, relation } from 'cypher-query-builder';
import { first, intersection } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import {
  InputException,
  ISession,
  NotFoundException,
  ServerException,
} from '../../common';
import {
  addAllMetaPropertiesOfChildBaseNodes,
  addAllSecureProperties,
  addPropertyCoalesceWithClause,
  addShapeForBaseNodeMetaProperty,
  addShapeForChildBaseNodeMetaProperty,
  ChildBaseNodeMetaProperty,
  ConfigService,
  DatabaseService,
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
  CreateRegion,
  CreateZone,
  Location,
  LocationListInput,
  LocationListOutput,
  Region,
  UpdateCountry,
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
    private readonly db: DatabaseService
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      // ZONE NODE
      'CREATE CONSTRAINT ON (n:Zone) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Zone) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:Zone) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:Zone) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:Zone) ASSERT EXISTS(n.owningOrgId)',

      // ZONE NAME REL
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      // ZONE NAME NODE
      'CREATE CONSTRAINT ON (n:LocationName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:LocationName) ASSERT n.value IS UNIQUE',

      // REGION NODE
      'CREATE CONSTRAINT ON (n:Region) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Region) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:Region) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:Region) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:Region) ASSERT EXISTS(n.owningOrgId)',

      // REGION NAME REL
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      // REGION NAME NODE
      'CREATE CONSTRAINT ON (n:LocationName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:LocationName) ASSERT n.value IS UNIQUE',

      // COUNTRY NODE
      'CREATE CONSTRAINT ON (n:Country) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Country) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:Country) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:Country) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:Country) ASSERT EXISTS(n.owningOrgId)',

      // COUNTRY NAME REL
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      // COUNTRY NAME NODE
      'CREATE CONSTRAINT ON (n:LocationName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:LocationName) ASSERT n.value IS UNIQUE',
    ];
  }
  // helper method for defining properties
  property = (prop: string, value: any, baseNode: string) => {
    if (!value) {
      return [];
    }
    const createdAt = DateTime.local();
    const propLabel = prop === 'name' ? 'Property:LocationName' : 'Property';
    return [
      [
        node(baseNode),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(prop, propLabel, {
          active: true,
          value,
        }),
      ],
    ];
  };

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
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ])
        .create([
          [
            node('newZone', ['Zone', 'BaseNode'], {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('name', input.name, 'newZone'),
          [
            node('adminSG', 'SecurityGroup', {
              id: generate(),
              active: true,
              createdAt,
              name: input.name + ' admin',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
              id: generate(),
              active: true,
              createdAt,
              name: input.name + ' users',
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
          ...this.permission('name', 'newZone'),
          ...this.permission('director', 'newZone'),
        ])
        .return('newZone.id as id');

      await createZone.first();

      // connect director User to zone
      if (directorId) {
        const query = `
      MATCH (director:User {id: $directorId, active: true}),
        (zone:Zone {id: $id, active: true})
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
          node('zone', 'Zone', { active: true }),
          relation('out', 'name', 'name', { active: true }),
          node('zoneName', 'Property', { active: true, value: input.name }),
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
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ])
        .create([
          [
            node('newRegion', ['Region', 'BaseNode'], {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('name', input.name, 'newRegion'),
          [
            node('adminSG', 'SecurityGroup', {
              id: generate(),
              active: true,
              createdAt,
              name: input.name + ' admin',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
              id: generate(),
              active: true,
              createdAt,
              name: input.name + ' users',
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
          MATCH (zone:Zone {id: $zoneId, active: true}),
            (region:Region {id: $id, active: true})
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
            (region:Region {id: $id, active: true}),
            (director:User {id: $directorId, active: true})
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
          node('region', 'Region', { active: true }),
          relation('out', 'name', 'name', { active: true }),
          node('regionName', 'Property', { active: true, value: input.name }),
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
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ])
        .create([
          [
            node('newCountry', ['Country', 'BaseNode'], {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('name', input.name, 'newCountry'),
          [
            node('adminSG', 'SecurityGroup', {
              id: generate(),
              active: true,
              createdAt,
              name: input.name + ' admin',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
              id: generate(),
              active: true,
              createdAt,
              name: input.name + ' users',
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
          ...this.permission('name', 'newCountry'),
          ...this.permission('region', 'newCountry'),
        ])
        .return('newCountry.id as id');
      await createCountry.first();

      this.logger.debug(`country created`);

      // connect the Region to Country
      if (regionId) {
        const query = `
          MATCH (region:Region {id: $regionId, active: true}),
            (country:Country {id: $id, active: true})
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
          node('country', 'Country', { active: true }),
          relation('out', 'name', 'name', { active: true }),
          node('countryName', 'Property', { active: true, value: input.name }),
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

  async readOne(id: string, session: ISession): Promise<Location> {
    const query = `
    MATCH (place {id: $id, active: true}) RETURN labels(place) as labels
    `;
    const results = await this.db.query().raw(query, { id }).first();
    // MATCH one of these labels.
    const label = first(
      intersection(results?.labels, ['Country', 'Region', 'Zone'])
    );

    this.logger.debug('Looking for ', {
      label,
      id,
      userId: session.userId,
    });
    switch (label) {
      case 'Zone': {
        return await this.readOneZone(id, session);
      }
      case 'Region': {
        return await this.readOneRegion(id, session);
      }
      case 'Country': {
        return await this.readOneCountry(id, session);
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
      .match([node('node', 'Zone', { active: true, id: id })])
      .call(matchPermList, 'requestingUser')
      .call(matchPropList, 'permList')
      .optionalMatch([
        node('node'),
        relation('out', '', 'director', { active: true }),
        node('director', 'User', { active: true }),
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
      .match([node('node', 'Region', { active: true, id: id })])
      .call(matchPermList, 'requestingUser')
      .call(matchPropList, 'permList')
      .optionalMatch([
        node('node'),
        relation('out', '', 'director', { active: true }),
        node('director', 'User', { active: true }),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'zone', { active: true }),
        node('zone', 'Zone', { active: true }),
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
        childBaseNodeLabel: 'Region',
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
            active: true,
            id: $requestingUserId,
            owningOrgId: $owningOrgId
          }),
          (newDirector:User {id: $directorId, active: true}),
          (zone:Zone {id: $id, active: true})-[rel:director {active: true}]->(oldDirector:User)
        DELETE rel
        CREATE (newDirector)<-[:director {active: true, createdAt: datetime()}]-(zone)
        RETURN  zone.id as id
      `;

      await this.db
        .query()
        .raw(query, {
          directorId: input.directorId,
          id: input.id,
          owningOrgId: session.owningOrgId,
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
      nodevar: 'zone',
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
              active: true,
              id: $requestingUserId,
              owningOrgId: $owningOrgId
            }),
            (newDirector:User {id: $directorId, active: true}),
            (region:Region {id: $id, active: true})-[rel:director {active: true}]->(oldDirector:User)
          DELETE rel
          CREATE (newDirector)<-[:director {active: true, createdAt: datetime()}]-(region)
          RETURN  region.id as id
        `;

      await this.db
        .query()
        .raw(query, {
          directorId: input.directorId,
          id: input.id,
          owningOrgId: session.owningOrgId,
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
              active: true,
              id: $requestingUserId,
              owningOrgId: $owningOrgId
            }),
            (newZone:Zone {id: $zoneId, active: true}),
            (region:Region {id: $id, active: true})-[rel:zone {active: true}]->(oldZone:Zone)
          DELETE rel
          CREATE (newZone)<-[:zone {active: true, createdAt: datetime()}]-(region)
          RETURN  region.id as id
        `;

      await this.db
        .query()
        .raw(query, {
          directorId: input.directorId,
          id: input.id,
          owningOrgId: session.owningOrgId,
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
      nodevar: 'region',
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
              active: true,
              id: $requestingUserId,
              owningOrgId: $owningOrgId
            }),
            (newRegion:Region {id: $regionId, active: true}),
            (country:Country {id: $id, active: true})-[rel:region {active: true}]->(oldZone:Region)
          DELETE rel
          CREATE (newRegion)<-[:region {active: true, createdAt: datetime()}]-(country)
          RETURN  country.id as id
        `;

      await this.db
        .query()
        .raw(query, {
          id: input.id,
          owningOrgId: session.owningOrgId,
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
          active: true,
          id: $requestingUserId,
          canDeleteLocation: true
        }),
        (place {
          active: true,
          id: $id
        })
        SET
          place.active = false
        RETURN
          place.id as id
        `,
          {
            id,
            owningOrgId: session.owningOrgId,
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
    const types = filter.types ?? ['Zone', 'Region', 'Country'];

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
        ...(filter.name
          ? { name: { value: regexp(`.*${filter.name}.*`, true) } }
          : {}),
        label: inArray(types),
      })
      .call(calculateTotalAndPaginateList, input, (q, sort, order) =>
        sort in this.securedProperties
          ? q
              .match([
                node('node'),
                relation('out', '', sort),
                node('prop', 'Property', { active: true }),
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
      .match([
        matchSession(session),
        [
          node('zone', 'Zone', {
            active: true,
          }),
        ],
      ])
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
      .match([
        matchSession(session),
        [
          node('region', 'Region', {
            active: true,
          }),
        ],
      ])
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
      .match([
        matchSession(session),
        [
          node('country', 'Country', {
            active: true,
          }),
        ],
      ])
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
