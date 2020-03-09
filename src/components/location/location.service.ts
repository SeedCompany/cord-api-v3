import { Injectable, NotFoundException } from '@nestjs/common';
import { Connection } from 'cypher-query-builder';
import * as faker from 'faker';
import { times } from 'lodash';
import { DateTime } from 'luxon';
import { ILogger, Logger, PropertyUpdaterService } from '../../core';
import { ISession } from '../auth';
import { User } from '../user/dto';
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
    private readonly db: Connection,
    @Logger('LocationService:service') private readonly logger: ILogger,
    private readonly propertyUpdater: PropertyUpdaterService
  ) {}

  async readOne(_id: string, _session: ISession): Promise<Location> {
    return this.randomLocation();
  }

  async list(
    { page, count, sort, order }: LocationListInput,
    _session: ISession
  ): Promise<LocationListOutput> {
    const items = times(faker.random.number(), () => this.randomLocation());

    return {
      items,
      total: items.length,
      hasMore: false,
    };

    await this.db
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
        }
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

  async createZone(_input: CreateZone, _session: ISession): Promise<Zone> {
    throw new Error('Not implemented');
  }

  async createRegion(
    _input: CreateRegion,
    _session: ISession
  ): Promise<Region> {
    throw new Error('Not implemented');
  }

  async createCountry(
    _input: CreateCountry,
    _session: ISession
  ): Promise<Country> {
    throw new Error('Not implemented');
  }

  async updateZone(_input: UpdateZone, _session: ISession): Promise<Zone> {
    throw new Error('Not implemented');
  }

  async updateRegion(
    _input: UpdateRegion,
    _session: ISession
  ): Promise<Region> {
    throw new Error('Not implemented');
  }

  async updateCountry(
    _input: UpdateCountry,
    _session: ISession
  ): Promise<Country> {
    throw new Error('Not implemented');
  }

  async delete(id: string, session: ISession): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Location not found');
    }

    try {
      await this.propertyUpdater.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.error('Could not delete location', { exception: e });
      throw e;
    }
  }
}
