import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database.service';
import { generate } from 'shortid';
import {
  CreateAreaOutputDto,
  ReadAreaOutputDto,
  UpdateAreaOutputDto,
  DeleteAreaOutputDto,
  CreateAreaInput,
  ReadAreaInput,
  UpdateAreaInput,
  DeleteAreaInput,
} from './area.dto';

@Injectable()
export class AreaService {
  constructor(private readonly db: DatabaseService) {
  }

  async create(
    input: CreateAreaInput,
  ): Promise<CreateAreaOutputDto> {
    const response = new CreateAreaOutputDto();
    const session = this.db.driver.session();
    const id = generate();
    await session
      .run(
        'MERGE (area:Area {active: true, owningArea: "seedcompany", name: $name}) ON CREATE SET area.id = $id, area.timestamp = datetime() RETURN area.id as id, area.name as name',
        {
          id,
          name: input.name,
        },
      )
      .then(result => {
        response.area.id = result.records[0].get('id');
        response.area.name = result.records[0].get('name');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async readOne(
    input: ReadAreaInput,
  ): Promise<ReadAreaOutputDto> {
    const response = new ReadAreaOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (area:Area {active: true, owningArea: "seedcompany"}) WHERE area.id = $id RETURN area.id as id, area.name as name',
        {
          id: input.id,
        },
      )
      .then(result => {
        response.area.id = result.records[0].get('id');
        response.area.name = result.records[0].get('name');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async update(input: UpdateAreaInput): Promise<UpdateAreaOutputDto> {
    const response = new UpdateAreaOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (area:Area {active: true, owningArea: "seedcompany", id: $id}) SET area.name = $name RETURN area.id as id, area.name as name',
        {
          id: input.id,
          name: input.name,
        },
      )
      .then(result => {
        if (result.records.length > 0) {
          response.area.id = result.records[0].get('id');
          response.area.name = result.records[0].get('name');
        } else {
          response.area = null;
        }
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async delete(input: DeleteAreaInput): Promise<DeleteAreaOutputDto> {
    const response = new DeleteAreaOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (area:Area {active: true, owningArea: "seedcompany", id: $id}) SET area.active = false RETURN area.id as id',
        {
          id: input.id,
        },
      )
      .then(result => {
        response.area.id = result.records[0].get('id');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }
}
