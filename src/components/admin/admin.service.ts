import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core';
import { AdminOutputDto } from './admin.dto';
import { OrganizationService } from '../organization';
import { UserService } from '../user';
import { generate } from 'shortid';

@Injectable()
export class AdminService {
  constructor(
    private readonly db: DatabaseService,
    private readonly orgService: OrganizationService,
    private readonly userService: UserService,
  ) {}
  async prepareDatabaseConstraintsAndIndexes(): Promise<AdminOutputDto> {
    const response = new AdminOutputDto();

    const session = this.db.driver.session();
    const wait = [];

    // ORGANIZATION
    wait.push(
      session.run(
        'CREATE CONSTRAINT ON (org:Organization) ASSERT org.name IS UNIQUE',
      ),
    );
    wait.push(
      session.run(
        'CREATE CONSTRAINT ON (org:Organization) ASSERT org.id IS UNIQUE',
      ),
    );
    wait.push(
      session.run(
        'CREATE CONSTRAINT ON (org:Organization) ASSERT exists(org.id)',
      ),
    );
    wait.push(
      session.run(
        'CREATE CONSTRAINT ON (org:Organization) ASSERT exists(org.name)',
      ),
    );
    wait.push(
      session.run(
        'CREATE CONSTRAINT ON (org:Organization) ASSERT exists(org.active)',
      ),
    );

    // LOCATION
    wait.push(
      session.run(
        'CREATE CONSTRAINT ON (loc:Location) ASSERT loc.name IS UNIQUE',
      ),
    );
    wait.push(
      session.run(
        'CREATE CONSTRAINT ON (loc:Location) ASSERT loc.id IS UNIQUE',
      ),
    );
    wait.push(
      session.run('CREATE CONSTRAINT ON (loc:Location) ASSERT exists(loc.id)'),
    );
    wait.push(
      session.run(
        'CREATE CONSTRAINT ON (loc:Location) ASSERT exists(loc.name)',
      ),
    );
    wait.push(
      session.run(
        'CREATE CONSTRAINT ON (loc:Location) ASSERT exists(loc.active)',
      ),
    );

    // AREA
    wait.push(
      session.run(
        'CREATE CONSTRAINT ON (area:Area) ASSERT area.name IS UNIQUE',
      ),
    );
    wait.push(
      session.run('CREATE CONSTRAINT ON (area:Area) ASSERT area.id IS UNIQUE'),
    );
    wait.push(
      session.run('CREATE CONSTRAINT ON (area:Area) ASSERT exists(area.id)'),
    );
    wait.push(
      session.run('CREATE CONSTRAINT ON (area:Area) ASSERT exists(area.name)'),
    );
    wait.push(
      session.run(
        'CREATE CONSTRAINT ON (area:Area) ASSERT exists(area.active)',
      ),
    );

    await Promise.all(wait);
    session.close();

    response.success = true;

    return response;
  }

  async loadFakeData(): Promise<AdminOutputDto> {
    const response = new AdminOutputDto();

    const totalUsers = 50;
    const totalOrgs = 50;

    // ORGS
    for (let i = 0; i < totalOrgs; i++) {
      // this.orgService.create({
      //   name: 'org_' + generate(),
      // });
    }

    // USERS
    // for (let i = 0; i < totalUsers; i++) {
    //   const s = 'user_' + generate();
    //   await this.userService.create(
    //     {
    //       displayFirstName: s,
    //       displayLastName: s,
    //       email: s,
    //       realFirstName: s,
    //       realLastName: s,
    //     },
    //     'token - replace me later',
    //   );
    // }

    response.success = true;

    return response;
  }

  async consistencyCheck(): Promise<AdminOutputDto> {
    const response = new AdminOutputDto();
    let totalNodes = 0;
    const session = this.db.driver.session();
    const result = await session.run('MATCH (n) RETURN count(n) as count', {});
    totalNodes = result.records[0].get('count');
    for (let i = 0; i < totalNodes; i++) {
      // todo
    }
    session.close();
    response.success = true;
    return response;
  }
  async deleteAllData(): Promise<AdminOutputDto> {
    const response = new AdminOutputDto();
    const session = this.db.driver.session();
    await session.run('MATCH (n) DETACH DELETE n');
    session.close();
    response.success = true;
    return response;
  }

  async removeAllConstraintsAndIndexes(): Promise<AdminOutputDto> {
    const response = new AdminOutputDto();
    const session = this.db.driver.session();
    await session.run('CALL apoc.schema.assert({}, {})');
    session.close();
    response.success = true;
    return response;
  }
}
