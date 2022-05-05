import { node, not, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '../../../core';
import { ACTIVE, createProperty, path } from '../../../core/database/query';
import { ProgressReport } from '../dto';

@Migration('2022-05-05T14:46:26')
export class AddProgressExplanation extends BaseMigration {
  async up() {
    const res = await this.db
      .query()
      .matchNode('node', 'ProgressReport')
      .where([
        not(
          path([
            node('node'),
            relation('out', '', 'varianceExplanation', ACTIVE),
            node('', 'Property'),
          ])
        ),
        not(
          path([
            node('node'),
            relation('out', '', 'varianceReasons'),
            node('', 'Property'),
          ])
        ),
      ])
      .apply(
        createProperty({
          resource: ProgressReport,
          key: 'varianceExplanation',
          value: null,
        })
      )
      .with('numPropsCreated as numExplanationPropsCreated, node')
      .apply(
        createProperty({
          resource: ProgressReport,
          key: 'varianceReasons',
          value: [],
        })
      )
      .return<{
        numReasonPropsCreated: number;
        numExplanationPropsCreated: number;
      }>(
        'sum(numPropsCreated) as numReasonPropsCreated, sum(numExplanationPropsCreated) as numExplanationPropsCreated'
      )
      .first();
    this.logger.info(
      `Created ${
        res?.numReasonPropsCreated ?? 0
      } varianceReason default props and ${
        res?.numExplanationPropsCreated ?? 0
      } varianceExplanation default props `
    );
  }
}
