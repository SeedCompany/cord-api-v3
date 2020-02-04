import { Injectable } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { times } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
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
  constructor(private readonly db: Connection) {}

  async readOne(id: string, token: string): Promise<Location> {
    return this.randomLocation();
  }

  async list(
    { page, count, sort, order, filter }: LocationListInput,
    token: string,
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

  async createZone(input: CreateZone, token: string): Promise<Zone> {
    throw new Error('Not implemented');
  }

  async createRegion(input: CreateRegion, token: string): Promise<Region> {
    throw new Error('Not implemented');
  }

  async createCountry(input: CreateCountry, token: string): Promise<Country> {
    throw new Error('Not implemented');
  }

  async updateZone(input: UpdateZone, token: string): Promise<Zone> {
    throw new Error('Not implemented');
  }

  async updateRegion(input: UpdateRegion, token: string): Promise<Region> {
    throw new Error('Not implemented');
  }

  async updateCountry(input: UpdateCountry, token: string): Promise<Country> {
    throw new Error('Not implemented');
  }

  async delete(id: string, token: string): Promise<void> {
    await this.db
      .query()
      .raw(
        'MATCH (location:Location {active: true, owningOrg: "seedcompany", id: $id}) SET location.active = false RETURN location.id as id',
        {
          id,
        },
      )
      .run();
  }
}
