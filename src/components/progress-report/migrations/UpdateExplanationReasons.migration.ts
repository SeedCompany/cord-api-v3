import { node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '~/core';
import { ACTIVE } from '~/core/database/query';

@Migration('2023-03-10T17:00:00')
export class UpdateExplanationReasonsMigration extends BaseMigration {
  private async findAndReplaceReason(oldReason: string, newReason: string) {
    await this.db
      .query()
      .match([
        node('', 'ProgressReportVarianceExplanation'),
        relation('out', '', 'reasons', ACTIVE),
        node('reasons', 'Property'),
      ])
      .raw(
        `WHERE size(apoc.coll.intersection(reasons.value, $oldReasons)) > 0`,
        {
          oldReasons: [oldReason],
        },
      )
      .setValues({ 'reasons.value': [newReason] })
      .return('reasons.value as value')
      .run();
  }

  async up() {
    const oldReason1 = 'Partner organization issues: leadership/infrastructure';
    const newReason1 = 'Partner organization issues currently being addressed.';
    await this.findAndReplaceReason(oldReason1, newReason1);

    const oldReason2 =
      'Delayed activities/activities did not occur/slow start of project';
    const newReason2 =
      'Delayed activities; activities did not occur; slow start of project';
    await this.findAndReplaceReason(oldReason2, newReason2);
  }
}
