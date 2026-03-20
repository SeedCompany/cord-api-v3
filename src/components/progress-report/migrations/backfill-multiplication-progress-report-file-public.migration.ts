import { BaseMigration, Migration } from '~/core/neo4j';

@Migration('2026-03-20T12:00:00')
export class BackfillMultiplicationProgressReportFilePublicMigration extends BaseMigration {
  async up() {
    // Backfill legacy Multiplication progress report files to be anonymous.
    await this.db.query().raw`
      MATCH (report:ProgressReport)-[:reportFileNode { active: true }]->(:File)-[:public { active: true }]->(publicProp:Property)
      WHERE
        EXISTS {
          MATCH (:Project { type: "MultiplicationTranslation" })-[:report { active: true }]->(report)
        }
        OR EXISTS {
          MATCH (:Project { type: "MultiplicationTranslation" })-[:engagement { active: true }]->(:Engagement)-[:report { active: true }]->(report)
        }
      SET publicProp.value = true
      RETURN count(publicProp)
    `.executeAndLogStats();

    await this.db.query().raw`
      MATCH (report:ProgressReport)-[:reportFileNode { active: true }]->(file:File)
      WHERE
        (
          EXISTS {
            MATCH (:Project { type: "MultiplicationTranslation" })-[:report { active: true }]->(report)
          }
          OR EXISTS {
            MATCH (:Project { type: "MultiplicationTranslation" })-[:engagement { active: true }]->(:Engagement)-[:report { active: true }]->(report)
          }
        )
        AND NOT EXISTS {
          MATCH (file)-[:public { active: true }]->(:Property)
        }
      CREATE (file)-[:public { active: true, createdAt: datetime() }]->(:Property {
        createdAt: datetime(),
        value: true
      })
      RETURN count(file)
    `.executeAndLogStats();
  }
}
