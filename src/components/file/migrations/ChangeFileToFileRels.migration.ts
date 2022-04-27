import { node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '../../../core';

@Migration('2022-04-25T14:46:26')
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
      .subQuery('rel', (q) =>
        q
          .raw(`CALL apoc.refactor.invert(rel) yield input, output`)
          .return('input as inversionInput')
      )
      .subQuery('rel', (q) =>
        q
          .raw(
            `
          with collect(rel) AS rels
          CALL apoc.refactor.rename.type("parent", "child", rels )
          yield committedOperations`
          )
          .return('committedOpertions as relRenames')
      )
      .return<{ inversionInput: number; committedOperations: number }>(
        'committedOperations, inversionInput'
      )
      .first();
    this.logger.info(
      `Relationships inverted: ${
        res?.inversionInput ?? 0
      } \nRelationship Names Changed: ${res?.committedOperations ?? 0}`
    );
  }
}
