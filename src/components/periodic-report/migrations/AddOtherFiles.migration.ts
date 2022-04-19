import { node, not, relation } from 'cypher-query-builder';
import { initial } from 'lodash';
import { DateTime } from 'luxon';
import { BaseMigration, DatabaseService, Migration } from '../../../core';
import {
  ACTIVE,
  path,
} from '../../../core/database/query';
import { Directory } from '../../file';
import { IPeriodicReport, PeriodicReport } from '../dto';

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
      .subQuery('collect(report) as reports', (sub) => sub.with('reports')
        .raw('UNWIND reports as report')
        .create(node(['Directory'], { initialProps: { name: 'Other Directory' } }))
          .match(node('user', 'RootUser'))
          .create([node('node'), relation('out', '', 'createdBy', {
            createdAt: DateTime.local(), active: true,
          }), node('user')])
          .create([node('report'), relation('out', '', 'otherFiles', ACTIVE), node('node')])
          .return('node as directory')
        )
      .return<{report: IPeriodicReport, directory: Directory}>(
        'report, directory'
      ).run();
    this.logger.info(
      `Created ${res}`
    );
  }
}
  