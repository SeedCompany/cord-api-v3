import { isNull } from 'cypher-query-builder';
import { BaseMigration, Migration } from '~/core';
import { ProgressReportVariantProgress as Progress } from '../dto';

@Migration('2022-11-18T18:53:48.113')
export class AddVariantToProgressMigration extends BaseMigration {
  async up() {
    await this.db
      .query()
      .matchNode('node', 'ProductProgress')
      .where({ 'node.variant': isNull() })
      .setValues({
        'node.variant': Progress.FallbackVariant.key,
      })
      .run();
  }
}
