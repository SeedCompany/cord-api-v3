import { node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '~/core/database';
import { collect, variable } from '~/core/database/query';
import { LanguageEngagement } from '../dto';

@Migration('2025-10-10T10:23:00')
export class RenameMilestoneReachedToMilestonePlannedMigration extends BaseMigration {
  async up() {
    await this.db
      .query()
      .match([
        node('', 'LanguageEngagement'),
        relation('out', 'rel', 'milestoneReached'),
        node('', 'Property'),
      ])
      .with(collect('rel').as('rels'))
      .call('apoc.refactor.rename.type', [
        variable('"milestoneReached"'),
        variable('"milestonePlanned"'),
        variable('rels'),
      ])
      .yield('total')
      .return('total')
      .executeAndLogStats();

    await this.db
      .query()
      .match(node('node', 'MilestoneReached'))
      .setLabels({ node: 'MilestonePlanned' })
      .removeLabels({ node: 'MilestoneReached' })
      .executeAndLogStats();

    await this.addProperty(LanguageEngagement, 'milestoneReached', null);
  }
}
