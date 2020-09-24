import { Injectable } from '@nestjs/common';
import { inArray, node, relation } from 'cypher-query-builder';
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
  permission,
  property,
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

      'CREATE CONSTRAINT ON (n:Zone) ASSERT EXISTS(n.createdAt)',

      // ZONE NAME REL
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      // ZONE NAME NODE
      'CREATE CONSTRAINT ON (n:LocationName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:LocationName) ASSERT n.value IS UNIQUE',

      // REGION NODE
      'CREATE CONSTRAINT ON (n:Region) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Region) ASSERT n.id IS UNIQUE',

      'CREATE CONSTRAINT ON (n:Region) ASSERT EXISTS(n.createdAt)',

      // REGION NAME REL
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      // REGION NAME NODE
      'CREATE CONSTRAINT ON (n:LocationName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:LocationName) ASSERT n.value IS UNIQUE',

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
    ];
  }

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
            node('newZone', ['Zone', 'BaseNode'], {
              createdAt,
              id,
            }),
          ],
          ...property('name', input.name, 'newZone', 'name', 'LocationName'),
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
          ...permission('name', 'newZone'),
          ...permission('director', 'newZone'),
        ])
        .return('newZone.id as id');

      await createZone.first();

      // connect director User to zone
      if (directorId) {
        const query = `
      MATCH (director:User {id: $directorId}),
        (zone:Zone {id: $id})
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
          node('zone', 'Zone'),
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
            node('newRegion', ['Region', 'BaseNode'], {
              createdAt,
              id,
            }),
          ],
          ...property('name', input.name, 'newRegion', 'name', 'LocationName'),
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
          ...permission('name', 'newRegion'),
          ...permission('director', 'newRegion'),
          ...permission('zone', 'newRegion'),
        ])
        .return('newRegion.id as id');

      await createRegion.first();

      this.logger.debug(`Region created`, { input, userId: session.userId });

      // connect the Zone to Region

      if (zoneId) {
        const query = `
          MATCH (zone:Zone {id: $zoneId}),
            (region:Region {id: $id})
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
            (region:Region {id: $id}),
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
          node('region', 'Region'),
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
          ...property('name', input.name, 'newCountry', 'name', 'LocationName'),
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
          ...permission('name', 'newCountry'),
          ...permission('region', 'newCountry'),
        ])
        .return('newCountry.id as id');
      await createCountry.first();

      this.logger.debug(`country created`);

      // connect the Region to Country
      if (regionId) {
        const query = `
          MATCH (region:Region {id: $regionId}),
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

  async readOne(id: string, session: ISession): Promise<Location> {
    const query = `
    MATCH (place {id: $id}) RETURN labels(place) as labels
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

            id: $requestingUserId
          }),
          (newDirector:User {id: $directorId}),
          (zone:Zone {id: $id})-[rel:director {active: true}]->(oldDirector:User)
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

              id: $requestingUserId
            }),
            (newDirector:User {id: $directorId}),
            (region:Region {id: $id})-[rel:director {active: true}]->(oldDirector:User)
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
            (newZone:Zone {id: $zoneId}),
            (region:Region {id: $id})-[rel:zone {active: true}]->(oldZone:Zone)
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

              id: $requestingUserId
            }),
            (newRegion:Region {id: $regionId}),
            (country:Country {id: $id})-[rel:region {active: true}]->(oldZone:Region)
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
  //     about: ro(''),
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
