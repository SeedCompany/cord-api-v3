import { BaseMigration, Migration } from '../../../core';

@Migration('2022-04-21T15:30:05')
export class DeleteSecurityGroups extends BaseMigration {
  async up() {
    await this.deleteNode('SecurityGroup');
    await this.deleteNode('Permission');
  }
  async deleteNode(nodeName: string) {
    const beforeDelete = await this.getTotalNodes(nodeName);
    this.logger.info(`Total ${nodeName} nodes before delete: ${beforeDelete}`);
    await this.db
      .query()
      .raw(
        `
        MATCH (n:${nodeName})
        WITH collect(n) AS nn
        CALL apoc.periodic.commit("
        UNWIND $nodes AS n
        WITH sum(size((n)--())) AS count_remaining,
            collect(n) AS nn
        UNWIND nn AS n
        MATCH (n)-[r]-()
        WITH n, r, count_remaining
        LIMIT $limit
        DELETE r
        RETURN count_remaining
        ",{limit:100, nodes:nn}) yield updates, executions, runtime, batches, failedBatches, batchErrors, failedCommits, commitErrors
        UNWIND nn AS n
        DELETE n   
    `
      )
      .return('updates, executions, runtime, batches')
      .run();
    const afterDelete = await this.getTotalNodes(nodeName);
    this.logger.info(`Total ${nodeName} nodes after delete: ${afterDelete}`);
  }

  async getTotalNodes(nodeName: string) {
    const result = await this.db
      .query()
      .matchNode('nodes', nodeName)
      .return<{ totalNodes: number }>('count(nodes) as totalNodes')
      .first();
    return result?.totalNodes ?? 0;
  }
}
