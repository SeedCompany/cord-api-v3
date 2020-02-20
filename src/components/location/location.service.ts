import { Injectable, NotFoundException } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { times } from 'lodash';
import { DateTime } from 'luxon';
import { ILogger, Logger, PropertyUpdaterService } from '../../core';
import { generate } from 'shortid';
import { ISession } from '../auth';
import { User } from '../user/dto';
import {
  Region,
  Country,
  CreateRegion,
  CreateCountry,
  CreateZone,
  Location,
  LocationListInput,
  LocationListOutput,
  Zone,
  UpdateRegion,
  UpdateCountry,
  UpdateZone,
} from './dto';

@Injectable()
export class LocationService {
  constructor(
    private readonly db: Connection,
    @Logger('LocationService:service') private readonly logger: ILogger,
    private readonly propertyUpdater: PropertyUpdaterService,
  ) {}

  async readOne(id: string, session: ISession): Promise<Location> {
    return this.randomLocation();
  }

  async list(
    { page, count, sort, order, filter }: LocationListInput,
    session: ISession,
  ): Promise<LocationListOutput> {
    const items = times(faker.random.number(), this.randomLocation);

    return {
      items,
      total: items.length,
      hasMore: false,
    };

    const result = await this.db
      .query()
      .raw(
        `
          MATCH (location:Location {active: true})
          WHERE location.country CONTAINS $filter
          RETURN location.id as id, location.country as country
          ORDER BY ${sort} ${order}
          SKIP $skip LIMIT $count
        `,
        {
          skip: (page - 1) * count,
          count,
        },
      )
      .run();
  }

  private randomLocation() {
    const id = () => faker.random.alphaNumeric(8);
    const inPast = () => DateTime.fromJSDate(faker.date.past());
    const ro = <T>(value: T) => ({
      value,
      canRead: true,
      canEdit: false,
    });

    const user = (): User => ({
      id: id(),
      createdAt: inPast(),
      bio: ro(''),
      displayFirstName: ro(faker.name.firstName()),
      displayLastName: ro(faker.name.lastName()),
      realFirstName: ro(faker.name.firstName()),
      realLastName: ro(faker.name.lastName()),
      email: ro(faker.internet.email()),
      phone: ro(faker.phone.phoneNumber()),
      timezone: ro(faker.lorem.words(2)),
    });

    const region: Zone = {
      id: id(),
      createdAt: inPast(),
      name: ro(faker.address.country()),
      director: ro(user()),
    };

    const area: Region = {
      id: id(),
      createdAt: inPast(),
      name: ro(faker.address.state()),
      zone: ro(region),
      director: ro(user()),
    };

    const country: Country = {
      id: id(),
      createdAt: inPast(),
      name: ro(faker.address.city()),
      region: ro(area),
    };

    return faker.random.arrayElement([area, region, country]);
  }

  async createZone(input: CreateZone, session: ISession): Promise<Zone> {
    throw new Error('Not implemented');
  }

  async createRegion(input: CreateRegion, session: ISession): Promise<Region> {
    throw new Error('Not implemented');
  }

  async createCountry(input: CreateCountry, session: ISession): Promise<Country> {
    throw new Error('Not implemented');
  }

  async updateZone(input: UpdateZone, session: ISession): Promise<Zone> {
    throw new Error('Not implemented');
  }

  async updateRegion(input: UpdateRegion, session: ISession): Promise<Region> {
    throw new Error('Not implemented');
  }

  async updateCountry(input: UpdateCountry, session: ISession): Promise<Country> {
    throw new Error('Not implemented');
  }

  async delete(id: string, session: ISession): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Location not found');
    }

    try {
      this.propertyUpdater.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      console.log(e);
      throw e;
    }
  }
}
