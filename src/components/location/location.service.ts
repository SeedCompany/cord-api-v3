import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database.service';
import { generate } from 'shortid';
import { Location } from './location';
import {
  CreateLocationOutputDto,
  ReadLocationOutputDto,
  UpdateLocationOutputDto,
  DeleteLocationOutputDto,
  CreateLocationInput,
  ReadLocationInput,
  UpdateLocationInput,
  DeleteLocationInput,
  ListLocationsOutputDto,
  ListLocationsInputDto,
  ListLocationsInput,
} from './location.dto';

@Injectable()
export class LocationService {
  constructor(private readonly db: DatabaseService) {}

  async create(input: CreateLocationInput): Promise<CreateLocationOutputDto> {
    const response = new CreateLocationOutputDto();
    const session = this.db.driver.session();
    const id = generate();
    await session
      .run(
        'MERGE (location:Location {active: true, owningOrg: "seedcompany", country: $country, area: $area, editable: $editable}) ON CREATE SET location.id = $id, location.timestamp = datetime() RETURN location.id as id, location.country as country, location.area as area , location.editable as editable ',
        {
          id,
          country: input.country,
          area: input.area,
          editable: input.editable,
        },
      )
      .then(result => {
        response.location.id = result.records[0].get('id');
        response.location.country = result.records[0].get('country');
        response.location.area = result.records[0].get('area');
        response.location.editable = result.records[0].get('editable');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async readOne(input: ReadLocationInput): Promise<ReadLocationOutputDto> {
    const response = new ReadLocationOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (location:Location {active: true, owningOrg: "seedcompany"}) WHERE location.id = $id RETURN location.id as id, location.country as country, location.area as area , location.editable as editable ',
        {
          id: input.id,
        },
      )
      .then(result => {
        response.location.id = result.records[0].get('id');
        response.location.country = result.records[0].get('country');
        response.location.area = result.records[0].get('area');
        response.location.editable = result.records[0].get('editable');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async update(input: UpdateLocationInput): Promise<UpdateLocationOutputDto> {
    const response = new UpdateLocationOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (location:Location {active: true, owningOrg: "seedcompany", id: $id}) SET location.country = $country RETURN location.id as id,location.country as country,location.area as area , location.editable as editable',
        {
          id: input.id,
          country: input.country,
          area: input.area,
          editable: input.editable,
        },
      )
      .then(result => {
        if (result.records.length > 0) {
          response.location.id = result.records[0].get('id');
          response.location.country = result.records[0].get('country');
          response.location.area = result.records[0].get('area');
          response.location.editable = result.records[0].get('editable');
        } else {
          response.location = null;
        }
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async delete(input: DeleteLocationInput): Promise<DeleteLocationOutputDto> {
    const response = new DeleteLocationOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (location:Location {active: true, owningOrg: "seedcompany", id: $id}) SET location.active = false RETURN location.id as id',
        {
          id: input.id,
        },
      )
      .then(result => {
        response.location.id = result.records[0].get('id');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async queryLocations(
    query: ListLocationsInput,
  ): Promise<ListLocationsOutputDto> {
    const response = new ListLocationsOutputDto();
    const session = this.db.driver.session();
    const skipIt = query.page * query.count;

    const result = await session.run(
      `MATCH (location:Location {active: true}) WHERE location.country CONTAINS $filter RETURN location.id as id, location.country as country ORDER BY ${query.sort} ${query.order} SKIP $skip LIMIT $count`,
      {
        filter: query.filter,
        skip: skipIt,
        count: query.count,
        sort: query.sort,
        order: query.order,
      },
    );

    session.close();

    response.countries = result.records.map(record => {
      const location = new Location();
      location.id = record.get('id');
      location.country = record.get('country');
      return location;
    });

    return response;
  }
}
