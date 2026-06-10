import { Injectable } from '@nestjs/common';
import { generateId, type ID } from '~/common';
import { BaseMigration, Migration } from '~/core/neo4j';
import { IPeriodicReport } from '../dto';

@Injectable()
@Migration('2026-05-19T15:00:00')
export class BackfillPeriodicReportNarrativeFileMigration extends BaseMigration {
  async up() {
    await this.backfillNarrativeFile();
    await this.addProperty(IPeriodicReport, 'narrativeReceivedDate', null);
  }

  private async backfillNarrativeFile() {
    const result = (await this.db.query().raw`
      MATCH (report:PeriodicReport)
      WHERE NOT EXISTS {
        MATCH (report)-[:narrativeFileNode { active: true }]->(:File)
      }
      RETURN report.id AS id
    `.run()) as Array<{ id: ID }>;

    const reportIds: ID[] = result.map((r) => r.id);

    if (reportIds.length === 0) {
      this.logger.info('No periodic reports need narrativeFile backfill');
      return;
    }

    this.logger.info(
      `Backfilling narrativeFile placeholders for ${reportIds.length} periodic reports`,
    );

    const batchSize = 500;
    const batches = Array.from(
      { length: Math.ceil(reportIds.length / batchSize) },
      (_, i) => reportIds.slice(i * batchSize, (i + 1) * batchSize),
    );
    for (const batch of batches) {
      const items = await Promise.all(
        batch.map(async (reportId) => ({
          reportId,
          fileId: await generateId(),
        })),
      );

      await this.db.query().unwind(items, 'item').raw`
          MATCH (report:PeriodicReport { id: item.reportId })
          OPTIONAL MATCH (report)-[:end { active: true }]->(endProp:Property)
          MATCH (report)-[:reportFileNode { active: true }]->(rfFile:File)
          OPTIONAL MATCH (rfFile)-[:public { active: true }]->(publicProp:Property)
          MATCH (rfFile)-[:createdBy { active: true }]->(reportCreator:User)
          WITH
            report,
            item,
            endProp,
            reportCreator,
            COALESCE(publicProp.value, false) AS isPublic,
            datetime() AS now
          CREATE (file:BaseNode:FileNode:File {
            id: item.fileId,
            createdAt: now
          })
          CREATE (report)-[:narrativeFileNode { active: true, createdAt: now }]->(file)
          CREATE (file)-[:createdBy { active: true, createdAt: now }]->(reportCreator)
          CREATE (file)-[:name { active: true, createdAt: now }]->(:Property {
            createdAt: now,
            value: CASE
              WHEN endProp IS NULL THEN ''
              ELSE apoc.temporal.format(endProp.value, 'date')
            END
          })
          CREATE (file)-[:public { active: true, createdAt: now }]->(:Property {
            createdAt: now,
            value: isPublic
          })
          CREATE (report)-[:narrativeFile { active: true, createdAt: now }]->(:Property {
            createdAt: now,
            value: item.fileId
          })
        `.executeAndLogStats();
    }
  }
}
