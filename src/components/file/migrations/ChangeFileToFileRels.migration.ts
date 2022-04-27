import { node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '../../../core';

@Migration('2022-04-28T14:46:26')
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
      .match([
        node('parent2', 'FileNode'),
        relation('out', 'rel2', 'parent2'),
        node('child2'),
      ])
      .subQuery('rel2', (q) =>
        q
          .raw(
            `
          with collect(rel2) AS rels
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
