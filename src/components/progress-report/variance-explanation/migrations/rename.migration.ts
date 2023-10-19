import { node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '~/core';
import { ACTIVE } from '~/core/database/query';

@Migration('2023-10-12T11:00:00')
export class RenameReasonOptionMigration extends BaseMigration {
  async up() {
    await this.db
      .query()
      .match([
        node('', 'ProgressReportVarianceExplanation'),
        relation('out', '', 'reasons', ACTIVE),
        node('reason', 'Property'),
      ])
      .raw('where any(x in reason.value where x = $old)', {
        old: 'Partner organization issues currently being addressed.',
      })
      .setValues({
        'reason.value': [
          'Partner organization issues currently being addressed',
        ],
      })
      .return('count(reason) as count')
      .executeAndLogStats();
  }
}
