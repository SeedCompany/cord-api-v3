import { isNull, node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '~/core/database';
import { ACTIVE } from '~/core/database/query';

@Migration('2025-02-06T12:00:04')
export class AddAiAssistFlagMigration extends BaseMigration {
  async up() {
    await this.db
      .query()
      .match([
        node('e', 'LanguageEngagement'),
        relation('out', '', 'usingAIAssistedTranslation', ACTIVE),
        node('p', 'Property'),
      ])
      .where({ 'p.value': isNull() })
      .setValues({ 'p.value': 'Unknown' })
      .executeAndLogStats();
    await this.db
      .query()
      .match([
        node('e', 'LanguageEngagement'),
        relation('out', '', 'usingAIAssistedTranslation', ACTIVE),
        node('p', 'Property', { value: true }),
      ])
      .setValues({ 'p.value': 'Unknown' })
      .executeAndLogStats();
    await this.db
      .query()
      .match([
        node('e', 'LanguageEngagement'),
        relation('out', '', 'usingAIAssistedTranslation', ACTIVE),
        node('p', 'Property', { value: false }),
      ])
      .setValues({ 'p.value': 'None' })
      .executeAndLogStats();
  }
}
