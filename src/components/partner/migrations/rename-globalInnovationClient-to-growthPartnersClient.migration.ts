import { node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '~/core/database';
import { collect, variable } from '~/core/database/query';

@Migration('2024-07-10T13:02:04')
export class MigrateGlobalInnovationClientToGrowthPartnersClient extends BaseMigration {
  async up() {
    await this.db
      .query()
      .match([
        node('', 'Partner'),
        relation('out', 'rel', 'globalInnovationsClient'),
        node('', 'Property'),
      ])
      .with(collect('rel').as('rels'))
      .call('apoc.refactor.rename.type', [
        variable('"globalInnovationsClient"'),
        variable('"growthPartnersClient"'),
        variable('rels'),
      ])
      .yield('total')
      .return('total')
      .executeAndLogStats();
  }
}
