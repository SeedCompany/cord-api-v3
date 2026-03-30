import { BaseMigration, Migration } from '~/core/neo4j';

/**
 * Removes duplicate ProgressReport nodes for multiplication project engagements.
 *
 * These duplicates share the same parent (LanguageEngagement) and the same
 * start/end dates. They were created by a race condition when engagements were
 * first set up (two concurrent merge() calls both passed the dedup check before
 * either committed). All duplicates are NotStarted with no uploaded file.
 *
 * Strategy: for each (parent, start, end) group with more than one report,
 * keep the first (by sort order) and detach-delete the rest along with their
 * empty placeholder File nodes.
 */
@Migration('2026-03-30T12:00:00')
export class DropDuplicateMultiplicationProgressReportsMigration extends BaseMigration {
  async up() {
    await this.db.query().raw`
      MATCH (parent:BaseNode)-[:report { active: true }]->(report:ProgressReport)
      WHERE
        EXISTS {
          MATCH (:Project { type: "MultiplicationTranslation" })-[:engagement { active: true }]->(parent)
        }
      MATCH (report)-[:start { active: true }]->(startProp:Property)
      MATCH (report)-[:end { active: true }]->(endProp:Property)
      WITH parent, startProp.value AS start, endProp.value AS end, collect(report) AS reports
      WHERE size(reports) > 1
      UNWIND reports[1..] AS duplicate
      OPTIONAL MATCH (duplicate)-[:reportFileNode]->(file:File)
      DETACH DELETE duplicate, file
      RETURN count(duplicate) AS deleted
    `.executeAndLogStats();
  }
}
