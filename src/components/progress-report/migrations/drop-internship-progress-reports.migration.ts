import { node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '~/core/database';
import { path } from '~/core/database/query';

@Migration('2024-09-23T00:00:00')
export class DropInternshipProgressReportsMigration extends BaseMigration {
  async up() {
    await this.db
      .query()
      .match(node('report', 'ProgressReport'))
      .where(
        path([
          node('report'),
          relation('either'),
          node('', 'InternshipEngagement'),
        ]),
      )
      .detachDelete('report')
      .executeAndLogStats();
  }
}
