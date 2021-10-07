import { node, not, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '../../../core';
import { ACTIVE, createProperty, path } from '../../../core/database/query';
import { Product, ProgressMeasurement } from '../dto';

@Migration('2021-10-06T19:14:00')
export class AddProgressMeasurementsMigration extends BaseMigration {
  async up() {
    const res = await this.db
      .query()
      .matchNode('node', 'Product')
      .where(
        not(
          path([
            node('node'),
            relation('out', '', 'progressStepMeasurement', ACTIVE),
            node('', 'Property'),
          ])
        )
      )
      .apply(
        createProperty({
          resource: Product,
          key: 'progressStepMeasurement',
          value: ProgressMeasurement.Percent,
          numCreatedVar: 'numPsmCreated',
        })
      )
      .apply(
        createProperty({
          resource: Product,
          key: 'progressTarget',
          value: 100,
          numCreatedVar: 'numPtCreated',
        })
      )
      .return<{ numPsmCreated: number; numPtCreated: number }>([
        'sum(numPsmCreated) as numPsmCreated',
        'sum(numPtCreated) as numPtCreated',
      ])
      .first();
    this.logger.info(`Ran product progress measurements migration`, {
      'number of step measurement props created': res?.numPsmCreated ?? 0,
      'number of progress target props created': res?.numPtCreated ?? 0,
    });
  }
}
