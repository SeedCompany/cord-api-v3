import { node, not, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '../../../core';
import {
  ACTIVE,
  createRelationships,
  path,
} from '../../../core/database/query';
import { FileService } from '../../file';
import { IPeriodicReport } from '../dto';

@Migration('2022-04-18T14:46:26')
export class AddOtherFiles extends BaseMigration {
  constructor(private readonly files: FileService) {
    super();
  }
  async up() {
    const res = await this.db
      .query()
      .matchNode('node', 'PeriodicReport')
      .where(
        not(
          path([
            node('node'),
            relation('out', '', 'otherFiles', ACTIVE),
            node('', 'Directory'),
          ])
        )
      )
      .apply(
        createRelationships(IPeriodicReport, 'out', {
          otherFiles: [
            'Directory',
            (
              await this.files.createDirectory(
                undefined,
                `Other Files`,
                this.fakeAdminSession
              )
            ).id,
          ],
        })
      )
      .return<{ numPropsCreated: number }>(
        'sum(numPropsCreated) as numPropsCreated'
      )
      .first();
    this.logger.info(
      `Created ${res?.numPropsCreated ?? 0} skippedReason default props`
    );
  }
}
