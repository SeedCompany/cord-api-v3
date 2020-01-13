import { DatabaseService } from '../core/database.service';
import { OrganizationService } from '../components/organization/organization.service';
import { CreateOrganizationInput } from '../components/organization/organization.dto';
import { isValid } from 'shortid';
import { LanguageService } from '../components/language/language.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DatabaseUtility {
  constructor(
    private readonly db: DatabaseService,
    private readonly orgService: OrganizationService,
    private readonly langService: LanguageService,
  ) {}

  public async resetDatabaseForTesting() {
    await this.deleteAllData();
    // await this.deleteAllConstraintsAndIndexes();
    await this.prepareDatabase();
    await this.loadTestData();
  }

  // add constraints and indexes today
  public async deleteAllData() {
    const cypher = 'MATCH (n) DETACH DELETE n';

    // console.log(cypher);

    const session = this.db.driver.session();

    await session.run(cypher, {}).then(result => {
      session.close();
      // console.log(result);
    });
  }

  public async deleteAllConstraintsAndIndexes() {
    const cypher = 'CALL apoc.schema.assert({}, {})';

    // console.log(cypher);

    const session = this.db.driver.session();

    await session.run(cypher, {}).then(result => {
      session.close();
      // console.log(result);
    });
  }

  // add constraints and indexes on database
  public async prepareDatabase() {
    const session = this.db.driver.session();
    const wait = [];
    // await session.run(
    //   'CREATE CONSTRAINT ON (org:Organization) ASSERT org.name IS UNIQUE',
    // );
    wait.push( session.run(
      'CREATE CONSTRAINT ON (org:Organization) ASSERT org.id IS UNIQUE',
    ));
    wait.push(session.run(
      'CREATE CONSTRAINT ON (org:Organization) ASSERT exists(org.id)',
    ));
    // wait.push( session.run(
    //   'CREATE CONSTRAINT ON (org:Organization) ASSERT exists(org.name)',
    // ));
    wait.push(session.run(
      'CREATE CONSTRAINT ON (org:Organization) ASSERT exists(org.active)',
    ));
    // wait.push(session.run('CREATE INDEX ON :Organization(id)'));
    await Promise.all(wait);
    session.close();
  }

  public async loadTestData() {
    // create organizations
    const orgsToCreate = 3;
    for (let i = 0; i < orgsToCreate; i++) {
      const org = new CreateOrganizationInput();
      org.name = 'org' + i;
      const orgResponse = await this.orgService.create(org);
      if (!isValid(orgResponse.organization.id)) {
        throw new Error('Org failed to create');
      }
    }

    // let's create one cypher query to load this thing
    let cypher = '';
    const users = 20;
    const groups = 10;
    const groupOfGroups = 7;
    const userInXGroups = 5;

    // create users, inclusive of max number. so users = 5 will create 6 users.
    for (let i = 0; i <= users; i++) {
      cypher += `
      MERGE (user${i}:User {
        username: "user${i}",
        emailAddress: "email${i}@tsco.org",
        password: "password"
      })
      ON CREATE SET user${i}.createdOn = datetime()
      `;
    }

    // create groups, inclusive of max groups number.
    for (let i = 0; i <= groups; i++) {
      cypher += `
      MERGE (group${i}:Group {
        name: "group${i}"
      })
      ON CREATE SET group${i}.createdOn = datetime()
      `;
    }

    // create group of groups
    for (let i = 0; i < groupOfGroups; i++) {
      const from = this.getRndInteger(0, groups);
      const to = this.getRndInteger(0, groups);
      if (from === to) {
        continue;
      }
      cypher += `
      MERGE (group${from})-[rel1${i}:ToGroup]->(group${to})
      ON CREATE SET rel1${i}.createdOn = datetime()
      `;
    }

    // user->group
    for (let i = 0; i < users; i++) {
      const to = this.getRndInteger(0, groups);
      for (let j = 0; j < userInXGroups; j++) {
        const relString = i.toString() + j.toString();
        cypher += `
        MERGE (user${i})-[rel2${relString}:ToGroup]->(group${to})
        ON CREATE SET rel2${relString}.createdOn = datetime()
        `;
      }
    }

    // console.log(cypher);

    const session = this.db.driver.session();

    await session.run(cypher, {}).then(result => {
      session.close();
      // console.log(result);
    });
  }

  getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
