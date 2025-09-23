import { BaseMigration, Migration } from '~/core/database';

@Migration('2025-09-23T09:00:00')
export class CreateUsedDeptIdListMigration extends BaseMigration {
  async up() {
    // Load external department IDs from CSV and create nodes for those not already used
    // The file is mounted to Neo4j's import directory via docker-compose.override.yml
    await this.db
      .query(
        `
        LOAD CSV FROM 'file:///All-Department-Ids-From-Intaact.csv' AS row
        WITH row[0] AS deptId, row[1] AS name
        WHERE deptId <> 'Department ID' 
          AND NOT EXISTS {
            MATCH ()-[:departmentId]->(prop:Property)
            WHERE prop.value = deptId
          }
        CREATE (:ExternalDepartmentId {
          id: apoc.create.uuid(),
          departmentId: deptId,
          name: name,
          createdAt: datetime()
        })
        `,
      )
      .executeAndLogStats();
  }
}
