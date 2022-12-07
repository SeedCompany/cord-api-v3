import { node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '~/core';
import { ACTIVE } from '~/core/database/query';
import { ProgressReportStatus as Status } from '../dto';

@Migration('2022-12-07T09:00:00')
export class AddProgressReportStatusMigration extends BaseMigration {
  async up() {
    // Drop old status migration that added "Draft" status
    await this.db
      .query()
      .match([
        node('node', 'ProgressReport'),
        relation('out', '', 'status', ACTIVE),
        node('statusProp', 'Property'),
      ])
      .detachDelete('statusProp')
      .run();

    // Drop workflow events mentioning "Draft" status
    await this.db
      .query()
      .match([
        node('node', 'ProgressReport'),
        relation('out', '', 'workflowEvent'),
        node('event', { status: 'Draft' }),
      ])
      .detachDelete('event')
      .run();

    // Add status to progress reports.
    // They are Approved if they have a received date or a file uploaded.
    // Otherwise NotStarted.
    const stats = await this.db
      .query()
      .raw(
        `
          call apoc.periodic.iterate('
            match (node:ProgressReport)
            where not (node)-[:status { active: true }]->(:Property)
            return node
          ', '
            optional match (node)-[:receivedDate { active: true }]->(receivedDateProp:Property)
            call { with node return exists((node)-[:reportFileNode]->(:File)<-[:parent { active: true }]-(:FileVersion)) as hasPnp }
            with node, case when receivedDateProp.value is null and not hasPnp
              then "${Status.NotStarted}"
              else "${Status.Approved}"
            end as initialStatus
            create (node)
              -[:status { active: true, createdAt: $version }]->
              (:Property { createdAt: $version, migration: $version, value: initialStatus })
          ', {
            batchSize: 1000,
            params: { version: $version }
          })
        `,
        {
          version: this.version,
        }
      )
      .first();
    this.logger.info('ProgressReport.status migration results', stats as any);
  }
}
