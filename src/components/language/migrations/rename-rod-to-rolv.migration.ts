import { node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '~/core/database';
import { collect, variable } from '~/core/database/query';

@Migration('2024-07-30T13:02:04')
export class MigrateRegistryOfDialectToRegistryOfLanguageVarieties extends BaseMigration {
  async up() {
    await this.db
      .query()
      .match([
        node('', 'Language'),
        relation('out', 'rel', 'registryOfDialectCode'),
        node('', 'Property'),
      ])
      .with(collect('rel').as('rels'))
      .call('apoc.refactor.rename.type', [
        variable('"registryOfDialectCode"'),
        variable('"registryOfLanguageVarietiesCode"'),
        variable('rels'),
      ])
      .yield('total')
      .return('total')
      .executeAndLogStats();
  }
}
