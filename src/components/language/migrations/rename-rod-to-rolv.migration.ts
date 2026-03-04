import { node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '~/core/neo4j';
import { collect, variable } from '~/core/neo4j/query';

@Migration('2024-07-30T13:02:07')
export class RegistryOfDialectToRegistryOfLanguageVarietiesMigration extends BaseMigration {
  async up() {
    await this.db
      .query()
      .match([
        node('', 'Language'),
        relation('out', 'rel', 'registryOfDialectsCode'),
        node('', 'Property'),
      ])
      .with(collect('rel').as('rels'))
      .call('apoc.refactor.rename.type', [
        variable('"registryOfDialectsCode"'),
        variable('"registryOfLanguageVarietiesCode"'),
        variable('rels'),
      ])
      .yield('total')
      .return('total')
      .executeAndLogStats();

    await this.db
      .query()
      .match(node('node', 'RegistryOfDialectsCode'))
      .setLabels({ node: 'RegistryOfLanguageVarietiesCode' })
      .removeLabels({ node: 'RegistryOfDialectsCode' })
      .executeAndLogStats();
  }
}
