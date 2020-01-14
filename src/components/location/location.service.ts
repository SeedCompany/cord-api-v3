import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database.service';
import { generate } from 'shortid';
import {
  CreateLocationOutputDto,
  ReadLocationOutputDto,
  UpdateLocationOutputDto,
  DeleteLocationOutputDto,
  CreateLocationInput,
  ReadLocationInput,
  UpdateLocationInput,
  DeleteLocationInput,
} from './location.dto';

@Injectable()
export class LocationService {
  constructor(private readonly db: DatabaseService) {
  }

  async create(
    input: CreateLocationInput,
  ): Promise<CreateLocationOutputDto> {
    const response = new CreateLocationOutputDto();
    const session = this.db.driver.session();
    const id = generate();
    await session
      .run(
        'MERGE (location:Location {active: true, owningOrg: "seedcompany", name: $name}) ON CREATE SET location.id = $id, location.timestamp = datetime() RETURN location.id as id, location.name as name',
        {
          id,
          name: input.name,
        },
      )
      .then(result => {
        response.location.id = result.records[0].get('id');
        response.location.name = result.records[0].get('name');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async readOne(
    input: ReadLocationInput,
  ): Promise<ReadLocationOutputDto> {
    const response = new ReadLocationOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (location:Location {active: true, owningOrg: "seedcompany"}) WHERE location.id = $id RETURN location.id as id, location.name as name',
        {
          id: input.id,
        },
      )
      .then(result => {
        response.location.id = result.records[0].get('id');
        response.location.name = result.records[0].get('name');
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
        'MATCH (location:Location {active: true, owningOrg: "seedcompany", id: $id}) SET location.name = $name RETURN location.id as id, location.name as name',
        {
          id: input.id,
          name: input.name,
        },
      )
      .then(result => {
        if (result.records.length > 0) {

          response.location.id = result.records[0].get('id');
          response.location.name = result.records[0].get('name');
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
}
