import { node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '../../../core';

type ChildOrParentLabel = 'child' | 'parent';

@Migration('2022-04-29T12:46:26')
export class ChangeFileToFileRels extends BaseMigration {
  async up() {
    const parentBeforeRefactor = await this.getTotalFileNodeRelsByLabel(
      'parent'
    );
    this.logger.info(
      `Total :parent rels before refactor: ${parentBeforeRefactor}`
    );
    // first, invert the relationship from incoming to outgoing
    const stats = await this.db
      .query<Record<string, any>>(
        `
        CALL apoc.periodic.iterate(
            'MATCH (parent:FileNode)<-[rel:parent]-(child) RETURN rel',
            'CALL apoc.refactor.setType(rel, "child") YIELD output as setTypeOutput
             CALL apoc.refactor.invert(setTypeOutput) YIELD output as invertOutput
             RETURN *',
            { batchSize: 1000 }
        )`
      )
      .first();
    this.logger.info('Stats', stats);
    const parentAfterRefactor = await this.getTotalFileNodeRelsByLabel(
      'parent'
    );
    const childAfterRefactor = await this.getTotalFileNodeRelsByLabel('child');
    this.logger.info(
      `Total :parent rels before refactor: ${parentAfterRefactor}`
    );
    this.logger.info(`Total :child rels after refactor: ${childAfterRefactor}`);
  }
  async getTotalFileNodeRelsByLabel(relLabel: ChildOrParentLabel) {
    const direction = relLabel === 'child' ? 'out' : 'in';
    const result = await this.db
      .query()
      .match([
        node('parent', 'FileNode'),
        relation(direction, 'rel', relLabel),
        node('child'),
      ])
      .return<{ totalRels: number }>('count(rel) as totalRels')
      .first();
    return result?.totalRels ?? 0;
  }
}
