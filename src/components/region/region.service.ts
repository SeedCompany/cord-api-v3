import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core/database.service';
import { generate } from 'shortid';
import {
  CreateRegionOutputDto,
  ReadRegionOutputDto,
  UpdateRegionOutputDto,
  DeleteRegionOutputDto,
  CreateRegionInput,
  ReadRegionInput,
  UpdateRegionInput,
  DeleteRegionInput,
} from './region.dto';

@Injectable()
export class RegionService {
  constructor(private readonly db: DatabaseService) {
  }

  async create(
    input: CreateRegionInput,
  ): Promise<CreateRegionOutputDto> {
    const response = new CreateRegionOutputDto();
    const session = this.db.driver.session();
    const id = generate();
    await session
      .run(
        'MERGE (region:Region {active: true, owningOrg: "seedcompany", name: $name}) ON CREATE SET region.id = $id, region.timestamp = datetime() RETURN region.id as id, region.name as name',
        {
          id,
          name: input.name,
        },
      )
      .then(result => {
        response.region.id = result.records[0].get('id');
        response.region.name = result.records[0].get('name');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async readOne(
    input: ReadRegionInput,
  ): Promise<ReadRegionOutputDto> {
    const response = new ReadRegionOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (region:Region {active: true, owningOrg: "seedcompany"}) WHERE region.id = $id RETURN region.id as id, region.name as name',
        {
          id: input.id,
        },
      )
      .then(result => {
        response.region.id = result.records[0].get('id');
        response.region.name = result.records[0].get('name');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async update(input: UpdateRegionInput): Promise<UpdateRegionOutputDto> {
    const response = new UpdateRegionOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (region:Region {active: true, owningOrg: "seedcompany", id: $id}) SET region.name = $name RETURN region.id as id, region.name as name',
        {
          id: input.id,
          name: input.name,
        },
      )
      .then(result => {
        if (result.records.length > 0) {
          response.region.id = result.records[0].get('id');
          response.region.name = result.records[0].get('name');
        } else {
          response.region = null;
        }
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async delete(input: DeleteRegionInput): Promise<DeleteRegionOutputDto> {
    const response = new DeleteRegionOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (region:Region {active: true, owningOrg: "seedcompany", id: $id}) SET region.active = false RETURN region.id as id',
        {
          id: input.id,
        },
      )
      .then(result => {
        response.region.id = result.records[0].get('id');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }
}
