import { BaseMigration, Migration } from '~/core/database';

@Migration('2022-04-21T15:30:05')
export class DeleteSecurityGroups extends BaseMigration {
  async up() {
    await this.deleteAllNodesByLabel('SecurityGroup');
    await this.deleteAllNodesByLabel('Permission');
  }

  async deleteAllNodesByLabel(nodeName: string) {
    const beforeDelete = await this.getTotalNodes(nodeName);
    this.logger.info(`Total ${nodeName} nodes before delete: ${beforeDelete}`);

    const stats = await this.db
      .query<Record<string, any>>(
        `
          CALL apoc.periodic.iterate(
            'MATCH (n:${nodeName}) RETURN n',
            'DETACH DELETE n',
            { batchSize: 1000 }
          )
        `
      )
      .first();
    this.logger.info('Stats', stats);

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
