import { node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '../../../core';

@Migration('2022-04-27T14:46:26')
export class ChangeFileToFileRels extends BaseMigration {
  async up() {
    // first, invert the relationship from incoming to outgoing
    const res = await this.db
      .query()
      .subQuery((q) =>
        q
          .match([
            node('parent', 'FileNode'),
            relation('in', 'rel', 'parent'),
            node('child'),
          ])
          .raw(`CALL apoc.refactor.invert(rel) yield input, output`)
          .return('input as inversionInput')
      )
      .subQuery((q) =>
        q
          .match([
            node('parent', 'FileNode'),
            relation('out', 'rel', 'parent'),
            node('child'),
          ])
          .raw(
            `
          with collect(rel) AS rels
          CALL apoc.refactor.rename.type("parent", "child", rels )
          yield committedOperations`
          )
          .return('committedOperations as relRenames')
      )
      .return<{ inversionInput: number; relRenames: number }>(
        'relRenames, inversionInput'
      )
      .first();
    this.logger.info(
      `Relationships inverted: ${
        res?.inversionInput ?? 0
      } \nRelationship Names Changed: ${res?.relRenames ?? 0}`
    );
  }
}
