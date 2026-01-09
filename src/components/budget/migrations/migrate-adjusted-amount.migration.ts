import { isNull, node, not, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '~/core/database';
import { ACTIVE, variable } from '~/core/database/query';
import { BudgetRecord } from '../dto';

@Migration('2026-01-07T12:05:00')
export class MigrateAdjustedAmountMigration extends BaseMigration {
  async up() {
    // First create the adjustedAmount property for all Budget Records
    await this.addProperty(BudgetRecord, 'adjustedAmount', null);

    // Then set adjustedAmount to the amount value for records where amount has a value
    await this.db
      .query()
      .match([
        node('record', 'BudgetRecord'),
        relation('out', '', 'amount', ACTIVE),
        node('amountProp', 'Property'),
      ])
      .match([
        node('record'),
        relation('out', '', 'adjustedAmount', ACTIVE),
        node('adjustedProp', 'Property'),
      ])
      .where({
        'amountProp.value': not(isNull()),
      })
      .with([
        'record',
        'amountProp',
        'adjustedProp',
        'amountProp.value as amountValue',
      ])
      .setValues({
        'adjustedProp.value': variable('amountValue'),
      })
      .return('count(adjustedProp)')
      .executeAndLogStats();
  }
}
