import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { first, intersection } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession } from '../../common';
import {
  DatabaseService,
  ILogger,
  Logger,
  matchSession,
  OnIndex,
} from '../../core';
import { RedactedUser, User, UserService } from '../user';
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
  constructor(
    @Logger('location:service') private readonly logger: ILogger,
    private readonly db: DatabaseService,
    private readonly userService: UserService
  ) {}

  @OnIndex()
  async createIndexes() {
    const constraints = [
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
    for (const query of constraints) {
      await this.db.query().raw(query).run();
    }
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

  async readOne(id: string, session: ISession): Promise<Location> {
    const query = `
    MATCH (place {id: $id, active: true}) RETURN labels(place) as labels
    `;
    const results = await this.db.query().raw(query, { id }).first();
    // MATCH one of these labels.
    const label = first(
      intersection(results?.labels, ['Country', 'Region', 'Zone'])
    );

    this.logger.info('Looking for ', {
      label,
      id,
      userId: session.userId,
    });
    switch (label) {
      case 'Zone': {
        return this.readOneZone(id, session);
      }
      case 'Region': {
        return this.readOneRegion(id, session);
      }
      case 'Country': {
        return this.readOneCountry(id, session);
      }
      default: {
        throw new BadRequestException('Not a location');
      }
    }
  }

  // TODO Filter types is irrelevant right now
  // TODO hasMore is not implemented
  async list(
    { page, count, sort, order, filter }: LocationListInput,
    session: ISession
  ): Promise<LocationListOutput> {
    const result = await this.db
      .query()
      .raw(
        `
          MATCH (location {active: true})-[:name {active:true }]->(name:Property {active: true})
          WHERE name.value CONTAINS $filter
          WITH COUNT(name) as total, name, location
          MATCH (location {active: true})-[:name {active:true }]->(name:Property {active: true})
          RETURN total, location.id as id, name.value as name
          ORDER BY ${sort} ${order}
          SKIP $skip LIMIT $count

        `,
        {
          skip: (page - 1) * count,
          count,
          filter: filter.name,
        }
      )
      .run();

    const items = await Promise.all(
      result.map((row) => this.readOne(row.id, session))
    );

    return {
      items,
      total: items.length,
      hasMore: false, // TODO
    };
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

  async readOneZone(id: string, session: ISession): Promise<Zone> {
    this.logger.info(`Query readOne Zone`, { id, userId: session.userId });

    const readZone = this.db
      .query()
      .match(matchSession(session))
      .match([node('zone', 'Zone', { active: true, id })])

      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canEditName', 'Permission', {
          property: 'name',
          active: true,
          edit: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('zone'),
        relation('out', '', 'name', { active: true }),
        node('zoneName', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canEditDirector', 'Permission', {
          property: 'director',
          active: true,
          edit: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('zone'),
        relation('out', '', 'director', { active: true }),
        node('director', 'User', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadName', 'Permission', {
          property: 'name',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('zone'),
        relation('out', '', 'name', { active: true }),
        node('zoneName', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadDirector', 'Permission', {
          property: 'director',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('zone'),
        relation('out', '', 'director', { active: true }),
        node('director', 'User', { active: true }),
      ])
      .return({
        zone: [{ id: 'id', createdAt: 'createdAt' }],
        zoneName: [{ value: 'name' }],
        requestingUser: [{ canReadZone: 'canReadZone' }],
        canReadName: [{ read: 'canReadName' }],
        canReadDirector: [{ read: 'canReadDirector' }],
        canEditName: [{ edit: 'canEditName' }],
        canEditDirector: [{ edit: 'canEditDirector' }],
        director: [{ id: 'directorId' }],
      });

    const result = await readZone.first();
    if (!result || !result.id) {
      this.logger.error(`Could not find zone`);
      throw new NotFoundException('Could not find zone');
    }

    if (!result.canReadZone) {
      throw new ForbiddenException(
        'User does not have permission to read this zone'
      );
    }

    let director: User = RedactedUser;
    if (result.canReadDirector) {
      director = await this.userService.readOne(result.directorId, session);
    }

    return {
      id: result.id,
      name: {
        value: result.name,
        canRead: !!result.canReadName,
        canEdit: !!result.canEditName,
      },
      director: {
        value: { ...director },
        canEdit: !!result.canEditDirector,
        canRead: !!result.canReadDirector,
      },
      createdAt: result.createdAt,
    };
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
        .match([node('rootuser', 'User', { active: true, id: 'rootadminid' })])
        .create([
          [
            node('newZone', 'Zone', {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('name', input.name, 'newZone'),
          [
            node('adminSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: input.name + ' admin',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
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
      throw new ServerException('Could not create zone');
    }
  }

  async readOneRegion(id: string, session: ISession): Promise<Region> {
    this.logger.info(`Query readOne Region`, { id, userId: session.userId });
    if (!id) {
      throw new BadRequestException('No region id to search for');
    }
    const readRegion = this.db
      .query()
      .match(matchSession(session))
      .match([node('region', 'Region', { active: true, id })])

      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canEditName', 'Permission', {
          property: 'name',
          active: true,
          edit: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('region'),
        relation('out', '', 'name', { active: true }),
        node('regionName', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canEditDirector', 'Permission', {
          property: 'director',
          active: true,
          edit: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('region'),
        relation('out', '', 'director', { active: true }),
        node('director', 'User', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canEditZone', 'Permission', {
          property: 'zone',
          active: true,
          edit: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('region'),
        relation('out', '', 'zone', { active: true }),
        node('zone', 'Zone', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadName', 'Permission', {
          property: 'name',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('region'),
        relation('out', '', 'name', { active: true }),
        node('regionName', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadDirector', 'Permission', {
          property: 'director',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('region'),
        relation('out', '', 'director', { active: true }),
        node('director', 'User', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadZone', 'Permission', {
          property: 'zone',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('region'),
        relation('out', '', 'zone', { active: true }),
        node('zone', 'Zone', { active: true }),
      ])
      .return({
        region: [{ id: 'id', createdAt: 'createdAt' }],
        regionName: [{ value: 'name' }],
        requestingUser: [{ canReadRegion: 'canReadRegion' }],
        canReadName: [{ read: 'canReadName' }],
        canReadZone: [{ read: 'canReadZone' }],
        canReadDirector: [{ read: 'canReadDirector' }],
        canEditName: [{ edit: 'canEditName' }],
        canEditZone: [{ edit: 'canEditZone' }],
        canEditDirector: [{ edit: 'canEditDirector' }],
        director: [{ id: 'directorId' }],
        zone: [{ id: 'zoneId' }],
      });

    const result = await readRegion.first();

    if (!result || !result.id) {
      this.logger.error(`Could not find region`);
      throw new NotFoundException('Could not find region');
    }

    if (!result.canReadRegion) {
      throw new ForbiddenException(
        'User does not have permission to read this region'
      );
    }
    // fill in the director info if you can read it
    let director: User = RedactedUser;
    if (result.canReadDirector) {
      director = await this.userService.readOne(result.directorId, session);
    }

    // fill in the zone id
    let zone: Zone = {
      id: '',
      createdAt: DateTime.fromSeconds(0),
      name: { value: '', canRead: false, canEdit: false },
      director: { value: RedactedUser, canRead: false, canEdit: false },
    };
    if (result.canReadZone) {
      zone = await this.readOneZone(result.zoneId, session);
    }

    return {
      id: result.id,
      name: {
        value: result.name,
        canRead: !!result.canReadName,
        canEdit: !!result.canEditName,
      },
      director: {
        value: {
          ...director,
        },
        canEdit: !!result.canEditDirector,
        canRead: !!result.canReadDirector,
      },
      zone: {
        value: {
          ...zone,
        },
        canRead: !!result.canReadZone,
        canEdit: !!result.canEditZone,
      },
      createdAt: result.createdAt,
    };
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
        .match([node('rootuser', 'User', { active: true, id: 'rootadminid' })])
        .create([
          [
            node('newRegion', 'Region', {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('name', input.name, 'newRegion'),
          [
            node('adminSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: input.name + ' admin',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
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

      this.logger.info(`Region created`, { input, userId: session.userId });

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
    } catch (e) {
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
          exception: e,
        });
        throw new ServerException('Could not create region');
      }
    }
    try {
      return await this.readOneRegion(id, session);
    } catch (e) {
      throw new ServerException('Could not create region');
    }
  }

  async readOneCountry(id: string, session: ISession): Promise<Country> {
    this.logger.info(`Query readOne Country`, { id, userId: session.userId });
    if (!id) {
      throw new BadRequestException('No country id to search for');
    }
    const readCountry = this.db
      .query()
      .match(matchSession(session))
      .match([node('country', 'Country', { active: true, id })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadName', 'Permission', {
          property: 'name',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('country'),
        relation('out', '', 'name', { active: true }),
        node('countryName', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadRegion', 'Permission', {
          property: 'region',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('country'),
        relation('out', '', 'region', { active: true }),
        node('region', 'Region', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canEditName', 'Permission', {
          property: 'name',
          active: true,
          edit: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('country'),
        relation('out', '', 'name', { active: true }),
        node('countryName', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canEditRegion', 'Permission', {
          property: 'region',
          active: true,
          edit: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('country'),
        relation('out', '', 'region', { active: true }),
        node('region', 'Region', { active: true }),
      ])
      .return({
        country: [{ id: 'id', createdAt: 'createdAt' }],
        countryName: [{ value: 'name' }],
        requestingUser: [{ canReadCountry: 'canReadCountry' }],
        canReadName: [{ read: 'canReadName' }],
        canReadRegion: [{ read: 'canReadRegion' }],
        canEditName: [{ edit: 'canEditName' }],
        canEditRegion: [{ edit: 'canEditRegion' }],
        region: [{ id: 'regionId' }],
      });

    const result = await readCountry.first();

    if (!result || !result.id) {
      this.logger.error(`Could not find country`);
      throw new NotFoundException('Could not find country');
    }

    if (!result.canReadCountry) {
      throw new ForbiddenException(
        'User does not have permission to read this country'
      );
    }

    let region: Region = {
      id: '',
      createdAt: DateTime.fromSeconds(0),
      name: { value: '', canRead: false, canEdit: false },
      director: { value: RedactedUser, canRead: false, canEdit: false },
      zone: {
        canRead: false,
        canEdit: false,
        value: {
          id: '',
          createdAt: DateTime.fromSeconds(0),
          name: { value: '', canRead: false, canEdit: false },
          director: { value: RedactedUser, canRead: false, canEdit: false },
        },
      },
    };
    if (result.canReadRegion) {
      region = await this.readOneRegion(result.regionId, session);
    }

    return {
      id: result.id,
      name: {
        value: result.name,
        canRead: !!result.canReadName,
        canEdit: !!result.canEditName,
      },
      region: {
        value: {
          ...region,
        },
        canRead: !!result.canReadRegion,
        canEdit: !!result.canEditRegion,
      },
      createdAt: result.createdAt,
    };
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
        .match([node('rootuser', 'User', { active: true, id: 'rootadminid' })])
        .create([
          [
            node('newCountry', 'Country', {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('name', input.name, 'newCountry'),
          [
            node('adminSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: input.name + ' admin',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
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

      this.logger.info(`country created`);

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
    } catch (e) {
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
          exception: e,
        });
        throw new ServerException('Could not create country');
      }
    }
    try {
      return await this.readOneCountry(id, session);
    } catch (e) {
      throw new ServerException('Could not create country');
    }
  }

  async updateZone(input: UpdateZone, session: ISession): Promise<Zone> {
    const zone = await this.readOneZone(input.id, session);

    // update director
    if (input.directorId && input.directorId !== zone.director.value?.id) {
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

    return this.readOneZone(input.id, session);
  }

  async updateRegion(input: UpdateRegion, session: ISession): Promise<Region> {
    const region = await this.readOneRegion(input.id, session);

    // update director
    if (input.directorId && input.directorId !== region.director.value?.id) {
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
    if (input.zoneId && input.zoneId !== region.zone.value?.id) {
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
    return this.readOneRegion(input.id, session);
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

    return this.readOneCountry(input.id, session);
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
    } catch (e) {
      this.logger.error('Could not delete location', { exception: e });
      throw new ServerException('Could not delete location');
    }
  }

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
            return this.db.isRelationshipUnique({
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
            return this.db.hasProperties({
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
            return this.db.isRelationshipUnique({
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
            return this.db.hasProperties({
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
            return this.db.isRelationshipUnique({
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
            return this.db.hasProperties({
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
