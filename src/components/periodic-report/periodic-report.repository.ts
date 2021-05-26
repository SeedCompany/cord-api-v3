import { Injectable } from '@nestjs/common';
import { stripIndent } from 'common-tags';
import { node, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { DateTime, Interval } from 'luxon';
import { CalendarDate, ID, Session } from '../../common';
import { DtoRepository, matchRequestingUser, property } from '../../core';
import {
  calculateTotalAndPaginateList,
  deleteBaseNode,
  matchPropList,
} from '../../core/database/query';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
import {
  CreatePeriodicReport,
  FinancialReport,
  IPeriodicReport,
  NarrativeReport,
  PeriodicReport,
  PeriodicReportListInput,
  ProgressReport,
  ReportType,
} from './dto';

@Injectable()
export class PeriodicReportRepository extends DtoRepository(IPeriodicReport) {
  async create(
    input: CreatePeriodicReport,
    createdAt: DateTime,
    id: ID,
    reportFileId: ID
  ) {
    const createPeriodicReport = this.db
      .query()
      .create([
        [
          node(
            'newPeriodicReport',
            ['PeriodicReport', 'BaseNode', `${input.type}Report`],
            {
              createdAt,
              id,
            }
          ),
        ],
        ...property('type', input.type, 'newPeriodicReport'),
        ...property('start', input.start, 'newPeriodicReport'),
        ...property('end', input.end, 'newPeriodicReport'),
        ...property('reportFile', reportFileId, 'newPeriodicReport'),
      ])
      .return('newPeriodicReport.id as id');
    return await createPeriodicReport.first();
  }

  async createProperties(input: CreatePeriodicReport, result: Dictionary<any>) {
    await this.db
      .query()
      .match(
        node(
          'node',
          input.type === ReportType.Progress ? 'Engagement' : 'Project',
          { id: input.projectOrEngagementId }
        )
      )
      .match(node('periodicReport', 'PeriodicReport', { id: result.id }))
      .create([
        node('node'),
        relation('out', '', 'report', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('periodicReport'),
      ])
      .run();
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'PeriodicReport', { id })])
      .apply(matchPropList)
      .optionalMatch([
        node('node'),
        relation('out', '', 'reportFile', { active: true }),
        node('reportFile', 'File'),
      ])
      .return('node, propList')
      .asResult<StandardReadResult<DbPropsOfDto<PeriodicReport>>>();

    return await query.first();
  }

  listProjectReports(
    projectId: string,
    reportType: ReportType,
    { filter, ...input }: PeriodicReportListInput
  ) {
    return this.db
      .query()
      .match([
        node('project', 'Project', { id: projectId }),
        relation('out', '', 'report', { active: true }),
        node('node', ['PeriodicReport', `${reportType}Report`]),
      ])
      .apply(
        calculateTotalAndPaginateList(
          reportType === 'Financial' ? FinancialReport : NarrativeReport,
          input
        )
      );
  }

  listEngagementReports(
    engagementId: string,
    reportType: ReportType,
    { filter, ...input }: PeriodicReportListInput
  ) {
    return this.db
      .query()
      .match([
        node('engagement', 'Engagement', { id: engagementId }),
        relation('out', '', 'report', { active: true }),
        node('node', `PeriodicReport:${reportType}Report`),
      ])
      .apply(calculateTotalAndPaginateList(ProgressReport, input));
  }

  async getMostRecentReportWithFiles(reportId: ID) {
    const { id, start } = (await this.db
      .query()
      .match([
        node('', 'PeriodicReport', { id: reportId }),
        relation('in', '', 'report', { active: true }),
        node('', 'BaseNode'), // project or engagement
        relation('out', '', 'report', { active: true }),
        node('rn', 'PeriodicReport'),
        relation('out', '', 'start', { active: true }),
        node('sn', 'Property'),
      ])
      .match([
        node('rn'),
        relation('out', '', 'reportFileNode'),
        node('', 'FileNode'),
        relation('in', '', 'parent', { active: true }),
        node('', 'FileVersion'),
      ])
      .return('rn.id as id, sn.value as start')
      .orderBy('sn.value', 'desc')
      .limit(1)
      .asResult<{ id?: ID; start?: CalendarDate }>()
      .first()) ?? { id: undefined, start: undefined };

    return { id, start };
  }

  async delete(baseNodeId: ID, type: ReportType, intervals: Interval[]) {
    return await this.db
      .query()
      .match([
        node('node', 'BaseNode', { id: baseNodeId }),
        relation('out', '', 'report', { active: true }),
        node('report', `${type}Report`),
      ])
      .optionalMatch([
        node('report'),
        relation('out', '', 'start', { active: true }),
        node('start', 'Property'),
      ])
      .with('report, start')
      .raw(
        stripIndent`
        WHERE NOT (report)-[:reportFileNode]->(:File)<-[:parent { active: true }]-(:FileVersion)
          AND start.value IN $startDates
    `,
        {
          startDates: intervals.map((interval) => interval.start),
        }
      )
      .with('report as baseNode')
      .apply(deleteBaseNode)
      .return('count(node) as count')
      .asResult<{ count: number }>()
      .first();
  }
}
