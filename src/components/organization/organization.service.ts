import { Injectable } from '@nestjs/common';
import { Organization } from './organization';
import { DatabaseService } from '../../core/database.service';
import { generate } from 'shortid';
import {
  CreateOrganizationOutputDto,
  ReadOrganizationOutputDto,
  UpdateOrganizationOutputDto,
  DeleteOrganizationOutputDto,
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
    token: string,
  ): Promise<CreateOrganizationOutputDto> {
    const response = new CreateOrganizationOutputDto();
    const id = generate();
    const session = this.db.driver.session();
    const result = await session.run(
      `
        MATCH
          (token:Token {
            active: true,
            value: $token
          })
          <-[:token {active: true}]-
          (user:User {
            active: true,
            canCreateOrg: true
          })
        MERGE
          (org:Organization {
            active: true
          })-[nameRel:name {active: true}]->
          (name:OrgName:Property {
            active: true,
            value: $name
          })
        ON CREATE SET
          org.id = $id,
          org.createdAt = datetime(),
          org.createdById = user.id,
          nameRel.createdAt = datetime()
        RETURN
          org.id as id,
          name.value as name
        `,
      {
        id,
        token,
        name: input.name,
      },
    );

    session.close();

    if (result.records.length === 0) {
      return response;
    }

    response.organization.id = result.records[0].get('id');
    response.organization.name = result.records[0].get('name');

    return response;
  }

  async readOne(
    input: ReadOrganizationInput,
    token: string,
  ): Promise<ReadOrganizationOutputDto> {
    const response = new ReadOrganizationOutputDto();
    const session = this.db.driver.session();
    
    await session
      .run(
        `
        MATCH
          (token:Token {active: true, value: $token})
          <-[:token {active: true}]-
          (user:User {
            canReadOrgs: true
          }),
          (org:Organization {
            active: true,
            id: $id
          })
          -[:name {active: true}]->
          (name:OrgName {active: true})
        RETURN
          org.id as id,
          name.value as name
        `,
        {
          id: input.id,
          token,
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
    token: string,
  ): Promise<UpdateOrganizationOutputDto> {
    const response = new UpdateOrganizationOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        `
        MATCH
          (token:Token {active: true, value: $token})
          <-[:token {active: true}]-
          (user:User {
            canCreateOrg: true
          }),
          (org:Organization {
            active: true,
            id: $id
          })
          -[:name {active: true}]->
          (name:OrgName {active: true})
        SET
          name.value = $name
        RETURN
          org.id as id,
          name.value as name
        `,
        {
          id: input.id,
          name: input.name,
          token,
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
    token: string,
  ): Promise<DeleteOrganizationOutputDto> {
    const response = new DeleteOrganizationOutputDto();
    const session = this.db.driver.session();
    await session
      .run(
        `
        MATCH
          (token:Token {active: true, value: $token})
          <-[:token {active: true}]-
          (user:User {
            canCreateOrg: true
          }),
          (org:Organization {
            active: true,
            id: $id
          })
        SET
          org.active = false
        RETURN
          org.id as id
        `,
        {
          id: input.id,
          token,
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
    token: string,
  ): Promise<ListOrganizationsOutputDto> {
    const response = new ListOrganizationsOutputDto();
    const session = this.db.driver.session();
    const skipIt = query.page * query.count;

    const result = await session.run(
      `
      MATCH
        (org:Organization {
          active: true
        })
      WHERE
        org.name CONTAINS $filter
      RETURN
        org.id as id,
        org.name as name
      ORDER BY ${query.sort} ${query.order}
      SKIP $skip
      LIMIT $count
      `,
      {
        filter: query.filter,
        skip: skipIt,
        count: query.count,
        sort: query.sort,
        order: query.order,
        token,
      },
    );

    session.close();

    response.organizations = result.records.map(record => {
      const org = new Organization();
      org.id = record.get('id');
      org.name = record.get('name');
      return org;
    });

    return response;
  }
}
