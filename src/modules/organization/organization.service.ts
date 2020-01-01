import { Injectable } from '@nestjs/common';
import { Organization } from '../../model/organization';
import { DatabaseService } from '../../core/database.service';
import { generate } from 'shortid';

@Injectable()
export class OrganizationService {
  constructor(private readonly db: DatabaseService) {}

  async create(name: string) {
    const organization = new Organization();
    const session = this.db.driver.session();
    const id = generate();
    await session
      .run(
        'MERGE (org:Organization {name: $name, active: true}) ON CREATE SET org.id = $id RETURN org.id as id, org.name as name',
        {
          id,
          name,
        },
      )
      .then(result => {
        organization.id = result.records[0].get('id');
        organization.name = result.records[0].get('name');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return organization;
  }

  async readOne(id: string) {
    const organization = new Organization();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (org:Organization {active: true}) WHERE org.id = $id RETURN org.id as id, org.name as name',
        {
          id,
        },
      )
      .then(result => {
        organization.id = result.records[0].get('id');
        organization.name = result.records[0].get('name');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return organization;
  }

  async update(id: string, name: string) {
    const organization = new Organization();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (org:Organization {active: true, id: $id}) SET org.name = $name RETURN org.id as id, org.name as name',
        {
          id,
          name,
        },
      )
      .then(result => {
        organization.id = result.records[0].get('id');
        organization.name = result.records[0].get('name');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return organization;
  }


  async delete(id: string) {
    const organization = new Organization();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (org:Organization {active: true, id: $id}) SET org.active = false RETURN org.id as id',
        {
          id,
        },
      )
      .then(result => {
        organization.id = result.records[0].get('id');
      })
      .catch(error => {
        console.log(error);
      })
      .then(() => session.close());

    return organization;
  }
}
