import { node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '~/core/database';
import { ACTIVE, apoc, variable } from '~/core/database/query';

@Migration('2025-03-28T15:15:00')
export class FundingAccountAddDeptIdBlockMigration extends BaseMigration {
  async up() {
    await this.db
      .query()
      .match([
        node('node', 'FundingAccount'),
        relation('out', '', 'accountNumber', ACTIVE),
        node('accountNumberProp'),
      ])
      .with(['node', 'accountNumberProp.value as account'])
      .create([
        node('node'),
        relation('out', '', 'departmentIdBlock', ACTIVE),
        node('', 'DepartmentIdBlock:Property', {
          id: variable(apoc.create.uuid()),
          value: variable(
            apoc.convert.toJson([
              {
                start: 'account * 10000 + 11',
                end: '(account + 1) * 10000 - 1',
              },
            ]),
          ),
        }),
      ])
      .return('node.id as id')
      .executeAndLogStats();
  }
}
