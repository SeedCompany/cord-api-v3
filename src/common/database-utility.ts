import { DatabaseService } from 'src/core/database.service';

export class DatabaseUtility {
  constructor(private readonly db: DatabaseService) {}

  // add constraints and indexes today
  public async deleteAllData() {
    let cypher = 'MATCH (n)-[r]-() DELETE r,n WITH * MATCH (m) DELETE m';

    // console.log(cypher);

    const session = this.db.driver.session();

    await session.run(cypher, {}).then(result => {
      session.close();
      // console.log(result);
    });
  }

  // add constraints and indexes today
  public async prepareDatabase() {
    let cypher = '';

    cypher +=
      'CREATE CONSTRAINT ON (org:Organization) ASSERT org.name IS UNIQUE';

    // console.log(cypher);

    const session = this.db.driver.session();

    await session.run(cypher, {}).then(result => {
      session.close();
      // console.log(result);
    });
  }

  public async loadTestData() {
    // let's create one cypher query to load this thing
    let cypher = '';
    const users = 4;
    const groups = 3;
    const groupOfGroups = 1;
    const userInXGroups = 2;

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
