import { isNull, node, not, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '~/core/database';
import { ACTIVE, variable } from '~/core/database/query';
import { BudgetRecord } from '../dto';

@Migration('2026-01-07T12:06:00')
export class MigrateInitialAmountMigration extends BaseMigration {
  async up() {
    // First create the initialAmount property for all Budget Records
    await this.addProperty(BudgetRecord, 'initialAmount', null);

    // Then set initialAmount to the amount value for records where amount has a value
    await this.db
      .query()
      .match([
        node('record', 'BudgetRecord'),
        relation('out', '', 'amount', ACTIVE),
        node('amountProp', 'Property'),
      ])
      .match([
        node('record'),
        relation('out', '', 'initialAmount', ACTIVE),
        node('initialProp', 'Property'),
      ])
      .where({
        'amountProp.value': not(isNull()),
      })
      .with([
        'record',
        'amountProp',
        'initialProp',
        'amountProp.value as amountValue',
      ])
      .setValues({
        'initialProp.value': variable('amountValue'),
      })
      .return('count(initialProp)')
      .executeAndLogStats();
  }
}
