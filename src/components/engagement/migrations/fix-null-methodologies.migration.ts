import { isNull, node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '~/core/database';
import { ACTIVE } from '~/core/database/query';

@Migration('2023-08-15T15:00:00')
export class FixNullMethodologiesMigration extends BaseMigration {
  async up() {
    await this.db
      .query()
      .match([
        node('e', 'InternshipEngagement'),
        relation('out', '', 'methodologies', ACTIVE),
        node('p', 'Property'),
      ])
      .where({ 'p.value': isNull() })
      .setVariables({ 'p.value': '[]' })
      .return('count(p)')
      .executeAndLogStats();
  }
}
