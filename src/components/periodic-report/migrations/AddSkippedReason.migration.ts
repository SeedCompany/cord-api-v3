import { node, not, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '../../../core';
import { ACTIVE, createProperty, path } from '../../../core/database/query';
import { IPeriodicReport } from '../dto';

@Migration('2021-09-28T14:46:26')
export class AddSkippedReason extends BaseMigration {
  async up() {
    const res = await this.db
      .query()
      .matchNode('node', 'PeriodicReport')
      .where(
        not(
          path([
            node('node'),
            relation('out', '', 'skippedReason', ACTIVE),
            node('', 'Property'),
          ])
        )
      )
      .apply(
        createProperty({
          resource: IPeriodicReport,
          key: 'skippedReason',
          value: null,
        })
      )
      .return<{ numPropsCreated: number }>(
        'sum(numPropsCreated) as numPropsCreated'
      )
      .first();
    this.logger.info(
      `Created ${res?.numPropsCreated ?? 0} skippedReason default props`
    );
  }
}
