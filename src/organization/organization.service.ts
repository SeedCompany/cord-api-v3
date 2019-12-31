import { Injectable } from '@nestjs/common';
import { Organization } from '../model/organization';
import { DatabaseService } from '../core/database.service';

@Injectable()
export class OrganizationService {
  constructor(private readonly db: DatabaseService) {}

  async readOne(id: string) {
    const organization = new Organization();
    const session = this.db.driver.session();
    await session
      .run(
        'MATCH (org:Organization) WHERE org.id = $id RETURN org.id as id, org.name as name',
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
}
