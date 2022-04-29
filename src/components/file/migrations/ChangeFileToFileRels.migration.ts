import { node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '../../../core';

@Migration('2022-04-29T17:46:26')
export class ChangeFileToFileRels extends BaseMigration {
  async up() {
    // first, invert the relationship from incoming to outgoing
    const res = await this.db
      .query()
      .match([
        node('parent', 'FileNode'),
        relation('in', 'rel', 'parent'),
        node('child'),
      ])
      .raw(
        `
        CALL apoc.periodic.iterate(
            'CALL apoc.refactor.setType(rel, 'child') YIELD output as setTypeOutput',
            'CALL apoc.refactor.invert(setTypeOutput) YIELD output as invertOutput',
            { batchSize: 5 }
        )`
      )
      .return<{ totalInverted: number; totalRenamed: number }>(
        'size(collect(invertOutput)) as totalInverted, size(collect(setTypeOutput)) as totalRenamed'
      )
      .first();
    this.logger.info(`${res?.totalInverted ?? 0} relationships inverted`);
    this.logger.info(
      `${res?.totalRenamed ?? 0} relationships renamed from 'parent' to 'child'`
    );
  }
}
