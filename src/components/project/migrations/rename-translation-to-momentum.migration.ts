import { BaseMigration, Migration } from '~/core';

@Migration('2024-04-08T12:51:00')
export class RenameTranslationToMomentumMigration extends BaseMigration {
  async up() {
    await this.db
      .query()
      .matchNode('node', 'TranslationProject')
      .setValues({ 'node.type': 'MomentumTranslation' }, true)
      .setLabels({
        node: [
          'MomentumTranslationProject',
          'TranslationProject',
          'Project',
          'BaseNode',
        ],
      })
      .logIt()
      .executeAndLogStats();
  }
}
