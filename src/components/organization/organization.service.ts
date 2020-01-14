import { Injectable } from '@nestjs/common';
import { Organization } from './organization';
import { DatabaseService } from '../../core/database.service';
import { generate } from 'shortid';
import {
  CreateOrganizationOutputDto,
  ReadOrganizationOutputDto,
  UpdateOrganizationOutputDto,
  DeleteOrganizationOutputDto,
  CreateOrganizationInputDto,
  CreateOrganizationInput,
  ReadOrganizationInput,
  UpdateOrganizationInput,
  DeleteOrganizationInput,
  ListOrganizationsInput,
  ListOrganizationsOutputDto,
} from './organization.dto';

@Injectable()
export class OrganizationService {
  constructor(private readonly db: DatabaseService) {}

  async create(
    input: CreateOrganizationInput,
  ): Promise<CreateOrganizationOutputDto> {
    const response = new CreateOrganizationOutputDto();
    const session = this.db.driver.session();
    const id = generate();
    await session
      .run(
        'MERGE (org:Organization {active: true, owningOrg: "seedcompany", name: $name}) ON CREATE SET org.id = $id, org.timestamp = datetime() RETURN org.id as id, org.name as name',
        {
          id,
          name: input.name,
        },
      )
      .then(result => {
        response.organization.id = result.records[0].get('id');
        response.organization.name = result.records[0].get('name');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async readOne(
    input: ReadOrganizationInput,
  ): Promise<ReadOrganizationOutputDto> {
    const response = new ReadOrganizationOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (org:Organization {active: true, owningOrg: "seedcompany"}) WHERE org.id = $id RETURN org.id as id, org.name as name',
        {
          id: input.id,
        },
      )
      .then(result => {
        response.organization.id = result.records[0].get('id');
        response.organization.name = result.records[0].get('name');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async update(
    input: UpdateOrganizationInput,
  ): Promise<UpdateOrganizationOutputDto> {
    const response = new UpdateOrganizationOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (org:Organization {active: true, owningOrg: "seedcompany", id: $id}) SET org.name = $name RETURN org.id as id, org.name as name',
        {
          id: input.id,
          name: input.name,
        },
      )
      .then(result => {
        if (result.records.length > 0) {
          response.organization.id = result.records[0].get('id');
          response.organization.name = result.records[0].get('name');
        } else {
          response.organization = null;
        }
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async delete(
    input: DeleteOrganizationInput,
  ): Promise<DeleteOrganizationOutputDto> {
    const response = new DeleteOrganizationOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (org:Organization {active: true, owningOrg: "seedcompany", id: $id}) SET org.active = false RETURN org.id as id',
        {
          id: input.id,
        },
      )
      .then(result => {
        response.organization.id = result.records[0].get('id');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }

  async queryOrganizations(
    query: ListOrganizationsInput,
  ): Promise<ListOrganizationsOutputDto> {
    const response = new ListOrganizationsOutputDto();
    const session = this.db.driver.session();
    const skipIt = query.page * query.count;

    console.log(query);

    await session
      .run(
        'MATCH (org:Organization {active: true}) WHERE org.name CONTAINS $filter RETURN   org.id as id, org.name as name ORDER BY $order SKIP $skip LIMIT $count',
        {
          filter: query.filter,
          skip: skipIt,
          count: query.count,
          order: query.order,
          sort: query.sort,
        },
      )
      .then(result => {
        result.records.forEach(record => {
          const org = new Organization();
          org.id = record.get('id');
          org.name = record.get('name');
          response.organizations.push(org);
        });
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return response;
  }
}
