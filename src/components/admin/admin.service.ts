import { Injectable } from '@nestjs/common';
import { AdminOutputDto } from './admin.dto';
import { OrganizationService } from '../organization/organization.service';
import { UserService } from '../user/user.service';
import { CreateUserInput } from '../user/user.dto';
import { CreateOrganizationInput } from '../organization/organization.dto';
import { generate } from 'shortid';
import { DatabaseService } from 'src/core/database.service';

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
      const org = new CreateOrganizationInput();
      org.name = 'org_' + generate();
      // this.orgService.create(org );
    }

    // USERS
    for (let i = 0; i < totalUsers; i++) {
      const user = new CreateUserInput();
      const s = 'user_' + generate();
      user.displayFirstName = s;
      user.displayLastName = s;
      user.email = s;
      user.realFirstName = s;
      user.realLastName = s;
      this.userService.create(user, 'token - replace me later');
    }

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
