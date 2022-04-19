import { node, not, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '../../../core';
import { ACTIVE, path } from '../../../core/database/query';

@Migration('2022-05-19T15:43:26')
export class AddOtherFiles extends BaseMigration {
  async up() {
    const res = await this.db
      .query()
      .matchNode('report', 'PeriodicReport')
      .where(
        not(
          path([
            node('report'),
            relation('out', '', 'otherFiles', ACTIVE),
            node('', 'Directory'),
          ])
        )
      )
      .with('collect(report) as reports')
      .subQuery('reports', (sub) =>
        sub
          .with('reports')
          .raw('UNWIND reports as report')
          .raw(
            `
        // createNode(Directory)
        CALL {
            CREATE (node:Directory:FileNode:BaseNode { createdAt: datetime(), id: apoc.create.uuid() }),
                (node)-[:name { active: true, createdAt: datetime() }]->(:Property { createdAt: datetime(), value: 'Other Directory' }),
                (node)-[:canDelete { active: true, createdAt: datetime() }]->(:Property { createdAt: datetime(), value: true })
            RETURN node
          }
          // createRelationships(Directory)
        CALL {
          WITH node
          MATCH (createdBy:RootUser)
          CREATE (node)-[:createdBy { active: true, createdAt: datetime() }]->(createdBy)
          RETURN createdBy
        } 
        `
          )
          .create([
            node('report'),
            relation('out', '', 'otherFiles', ACTIVE),
            node('node'),
          ])
          .return('node as directory, report')
      )
      .return<{ numDirsCreated: number }>('count(directory) as numDirsCreated')
      .first();
    this.logger.info(`${res?.numDirsCreated ?? 0} directories created`);
  }
}
