import { node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '../../../core';

@Migration('2022-04-25T14:46:26')
export class ChangeFileToFileRels extends BaseMigration {
  async up() {
    const res = await this.db
      .query()
      .match([
        node('parent', 'FileNode'),
        relation('in', 'rel', 'parent'),
        node('child'),
      ])
      .raw(`CALL apoc.refactor.invert(rel) yield input, output`)
      .return<{ input: number }>('input')
      .first();
    this.logger.info(
      `${res?.input ?? 0} FileNodes' parent relationships inverted`
    );
    const relNameChangeRes = await this.db
      .query()
      .match([
        node('parent', 'FileNode'),
        relation('out', 'p', 'parent'),
        node('child'),
      ])
      .raw(
        `
        with collect(p) AS rels
        CALL apoc.refactor.rename.type("parent", "child", rels )
        yield committedOperations`
      )
      .return<{ committedOperations: number }>('committedOperations')
      .first();
    this.logger.info(
      `${
        relNameChangeRes?.committedOperations ?? 0
      } relationships renamed from 'parent' to 'child'`
    );
  }
}
