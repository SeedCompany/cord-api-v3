import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { generate } from 'shortid';
import { DatabaseService, ILogger, Logger } from '../../core';
import { ISession } from '../auth';
import { UserService } from '../user';
import { User } from '../user/dto';
import { RedactedUser } from '../user/dto/user.dto';
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
    @Logger('LocationService:service') private readonly logger: ILogger,
    private readonly db: DatabaseService,
    private readonly userService: UserService
  ) {}

  async readOne(id: string, session: ISession): Promise<Location> {
    const query = `
    MATCH (place {id: $id, active: true}) RETURN labels(place) as labels
    `;

    const results = await this.db
      .query()
      .raw(query, { id })
      .first();
    const label: string = results?.labels?.[0] ?? '';

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
      result.map(row => this.readOne(row.id, session))
    );

    return {
      items,
      total: items.length,
      hasMore: false, // later
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
    this.logger.info(`Query readOne Zone`);

    // canReadZoneName: true,
    // canEditZoneName: true,
    // canReadZoneDirector: true,
    // canEditZoneDirector: true,
    const result = await this.db
      .query()
      .raw(
        `
        MATCH
        // (token:Token {
        //   active: true,
        //   value: $token
        // })<-[:token {active: true}]-
        // (requestingUser:User {
        //   active: true,
        //   id: $requestingUserId,
        //   owningOrgId: $owningOrgId
        // }),
        (zone:Zone {active: true, id: $id})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadName:ACL {canReadName: true})-[:toNode]->(zone)-[:name {active: true}]->(name:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditName:ACL {canEditName: true})-[:toNode]->(zone)-[:name {active: true}]->(name:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadDirector:ACL {canReadDirector: true})-[:toNode]->(zone)-[:director {active: true}]->(director:User { active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditDirector:ACL {canEditDirector: true})-[:toNode]->(zone)-[:director {active: true}]->(director:User {active: true})
        RETURN
          zone.id as id,
          zone.createdAt as createdAt,
          name.value as name,
          requestingUser.canReadZone as canReadZone,
          director.id as directorId,
          canReadName.canReadName as canReadName,
          canEditName.canEditName as canEditName,
          canReadDirector.canReadDirector as canReadDirector,
          canEditDirector.canEditDirector as canEditDirector
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
      this.logger.error(`Could not find zone`);
      throw new NotFoundException('Could not find zone');
    }

    let director: User = RedactedUser;
    if (result.canReadDirector) {
      director = await this.userService.readOne(result.directorId, session);
    }

    if (!result.canReadZone) {
      throw new Error('User does not have permission to read this zone');
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

  async createZone(input: CreateZone, session: ISession): Promise<Zone> {
    const id = generate();
    const acls = {
      canReadZone: true,
      canEditZone: true,
      canReadName: true,
      canEditName: true,
      canReadDirector: true,
      canEditDirector: true,
    };

    try {
      await this.db.createNode({
        session,
        input: { id, ...input },
        acls,
        baseNodeLabel: 'Zone',
        aclEditProp: 'canCreateZone',
      });

      // connect director User to zone
      const query = `
      MATCH (director:User {id: $directorId, active: true}),
        (zone:Zone {id: $id, active: true})
      CREATE (director)<-[:director {active: true, createdAt: datetime()}]-(zone)
      RETURN  zone.id as id
      `;

      await this.db
        .query()
        .raw(query, {
          userId: session.userId,
          directorId: input.directorId,
          id,
        })
        .first();

      const result = await this.readOneZone(id, session);
      return result;
    } catch (e) {
      console.log(e);
      this.logger.error(`Could not create zone`);
      throw new Error('Could not create zone');
    }
  }

  async readOneRegion(id: string, session: ISession): Promise<Region> {
    this.logger.info(`Query readOne Region`);
    if (!id) {
      throw new Error('No region id to search for');
    }
    const result = await this.db
      .query()
      .raw(
        `
        MATCH
        // (token:Token {
        //   active: true,
        //   value: $token
        // })<-[:token {active: true}]-
        (requestingUser:User {
          active: true,
          id: $requestingUserId,
          owningOrgId: $owningOrgId
        })<-[:member]-(acl:ACL)-[:toNode]->
        (region:Region {active: true, id: $id})-[:zone {active: true}]->(zone:Zone {active: true, owningOrgId: $owningOrgId}),
        (region)-[:director {active: true}]->(director:User {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl {canReadName: true})-[:toNode]->(region)-[:name {active: true}]->(name:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl {canReadDirector: true})-[:toNode]->(region)-[:director {active: true}]->(director)
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(acl {canReadZone: true})-[:toNode]->(region)-[:zone {active: true}]->(zone)
        RETURN
          region.id as id,
          region.createdAt as createdAt,
          requestingUser.canReadRegion as canReadRegion,
          name.value as name,
          director.id as directorId,
          zone.id as zoneId,
          acl.canReadName as canReadName,
          acl.canEditName as canEditName,
          acl.canReadDirector as canReadDirector,
          acl.canEditDirector as canEditDirector,
          acl.canReadZone as canReadZone,
          acl.canEditZone as canEditZone
        `,
        {
          id,
          owningOrgId: session.owningOrgId,
          requestingUserId: session.userId,
          token: session.token,
        }
      )
      .first();

    if (!result) {
      this.logger.error(`Could not find region ${id}`);
      throw new NotFoundException('Could not find region');
    }

    if (!result.canReadRegion) {
      throw new Error('User does not have permission to read this region');
    }
    // fill in the director info if you can read it
    let director: User = RedactedUser;
    if (result.canReadDirector) {
      director = await this.userService.readOne(result.directorId, session);
    }

    // fill in the zone id
    const zone = await this.readOneZone(result.zoneId, session);

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
    { zoneId, ...input }: CreateRegion,
    session: ISession
  ): Promise<Region> {
    const id = generate();
    const acls = {
      canReadRegion: true,
      canEditRegion: true,
      canReadName: true,
      canEditName: true,
      canReadDirector: true,
      canEditDirector: true,
      canReadZone: true,
      canEditZone: true,
    };

    try {
      await this.db.createNode({
        session,
        input: { id, ...input },
        acls,
        baseNodeLabel: 'Region',
        aclEditProp: 'canCreateRegion',
      });

      this.logger.info(`region created`);

      // connect the Zone to Region
      // and region to director

      if (zoneId) {
        const query = `
          MATCH (zone:Zone {id: $zoneId, active: true}),
            (region:Region {id: $id, active: true}),
            (director:User {id: $directorId, active: true})
          CREATE (director)<-[:director { active: true, createdAt: datetime() }]-(region)-[:zone { active: true, createdAt: datetime() }]->(zone)
          RETURN region.id as id
        `;

        await this.db
          .query()
          .raw(query, {
            zoneId,
            id,
            directorId: input.directorId,
          })
          .first();
      }

      this.logger.info(`region`);

      return this.readOneRegion(id, session);
    } catch (e) {
      this.logger.warning(`Could not create region`, {
        exception: e,
      });
      throw new Error('Could not create region');
    }
  }

  async readOneCountry(id: string, session: ISession): Promise<Country> {
    this.logger.info(`Query readOne Country`);

    // canReadCountryName: true,
    // canEditCountryName: true,
    // canReadCountryDirector: true,
    // canEditCountryDirector: true,

    const result = await this.db
      .query()
      .raw(
        `
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
        (country:Country {active: true, id: $id})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadName:ACL {canReadName: true})-[:toNode]->(country)-[:name {active: true}]->(name:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditName:ACL {canEditName: true})-[:toNode]->(country)-[:name {active: true}]->(name:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canReadRegion:ACL {canReadRegion: true})-[:toNode]->(country)-[:region {active: true}]->(region:Region {active: true})-[:name {active: true}]->(regionName:Property {active: true})
        WITH * OPTIONAL MATCH (requestingUser)<-[:member]-(canEditRegion:ACL {canEditRegion: true})-[:toNode]->(country)-[:region {active: true}]->(region:Region {active: true})-[:name {active: true}]->(regionName:Property {active: true})
        RETURN
          country.id as id,
          country.createdAt as createdAt,
          name.value as name,
          canReadName.canReadName as canReadName,
          canEditName.canEditName as canEditName,
          canReadRegion.canReadRegion as canReadRegion,
          canEditRegion.canEditRegion as canEditRegion,
          requestingUser.canReadCountry as canReadCountry,
          regionName.value as regionName,
          region.id as regionId
        `,
        {
          id,
          owningOrgId: session.owningOrgId,
          requestingUserId: session.userId,
          token: session.token,
        }
      )
      .first();

    if (!result) {
      this.logger.error(`Could not find country`);
      throw new NotFoundException('Could not find country');
    }

    if (!result.canReadCountry) {
      throw new Error('User does not have permission to read this country');
    }

    const region = await this.readOneRegion(result.regionId, session);

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
    const id = generate();
    const acls = {
      canReadName: true,
      canEditName: true,
      canReadRegion: true,
      canEditRegion: true,
    };

    try {
      await this.db.createNode({
        session,
        input: { id, ...input },
        acls,
        baseNodeLabel: 'Country',
        aclEditProp: 'canCreateCountry',
      });

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

      return this.readOneCountry(id, session);
    } catch (e) {
      this.logger.warning(`Could not create country`, {
        exception: e,
      });
      throw new Error('Could not create country');
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

    await this.db.updateProperties({
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
          CREATE (newZone)<-[:zone {active: true, createdAt: datetime()}]-(region)
          DELETE rel
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

    await this.db.updateProperties({
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

    await this.db.updateProperties({
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
        (object {
          active: true,
          id: $id
        })
        SET
          object.active = false
        RETURN
          object.id as id
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
      throw e;
    }
  }
}
