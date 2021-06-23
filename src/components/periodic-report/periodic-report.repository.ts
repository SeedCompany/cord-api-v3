import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime, Interval } from 'luxon';
import {
  generateId,
  ID,
  NotFoundException,
  ServerException,
} from '../../common';
import { DtoRepository, property } from '../../core';
import {
  deleteBaseNode,
  paginate,
  sorting,
  Variable,
} from '../../core/database/query';
import {
  CreatePeriodicReport,
  FinancialReport,
  IPeriodicReport,
  NarrativeReport,
  PeriodicReportListInput,
  ProgressReport,
  ReportType,
} from './dto';

@Injectable()
export class PeriodicReportRepository extends DtoRepository(IPeriodicReport) {
  async create(input: CreatePeriodicReport) {
    const id = await generateId();
    const createdAt = DateTime.local();
    const reportFileId = await generateId();

    const query = this.db
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
        ...property('receivedDate', null, 'newPeriodicReport'),
        ...property('reportFile', reportFileId, 'newPeriodicReport'),
      ])
      .with('newPeriodicReport')
      .match(node('parent', 'BaseNode', { id: input.projectOrEngagementId }))
      .create([
        node('parent'),
        relation('out', '', 'report', {
          active: true,
          createdAt,
        }),
        node('newPeriodicReport'),
      ])
      .return('newPeriodicReport.id as id');
    const result = await query.first();
    if (!result) {
      throw new ServerException('Failed to create a periodic report');
    }
    return { id, reportFileId };
  }

  async readOne(id: ID) {
    const query = this.db
      .query()
      .match([node('node', 'PeriodicReport', { id })])
      .apply(this.hydrate());

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find periodic report');
    }

    return result.dto;
  }

  async listProjectReports(
    projectId: string,
    reportType: ReportType,
    input: PeriodicReportListInput
  ) {
    const result = await this.db
      .query()
      .match([
        node('project', 'Project', { id: projectId }),
        relation('out', '', 'report', { active: true }),
        node('node', ['PeriodicReport', `${reportType}Report`]),
      ])
      .apply(
        sorting(
          reportType === 'Financial' ? FinancialReport : NarrativeReport,
          input
        )
      )
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  matchCurrentDue(parentId: ID | Variable, reportType: ReportType) {
    return (query: Query) =>
      query.comment`matchCurrentDue()`
        .match([
          node('baseNode', 'BaseNode', { id: parentId }),
          relation('out', '', 'report', { active: true }),
          node('node', `${reportType}Report`),
          relation('out', '', 'end', { active: true }),
          node('end', 'Property'),
        ])
        .raw(`WHERE end.value < date()`)
        .with('node, end')
        .orderBy('end.value', 'desc')
        .limit(1);
  }

  async getCurrentDue(parentId: ID, reportType: ReportType) {
    const res = await this.db
      .query()
      .apply(this.matchCurrentDue(parentId, reportType))
      .apply(this.hydrate())
      .first();
    return res?.dto;
  }

  async getNextDue(parentId: ID, reportType: ReportType) {
    const res = await this.db
      .query()
      .match([
        node('baseNode', 'BaseNode', { id: parentId }),
        relation('out', '', 'report', { active: true }),
        node('node', `${reportType}Report`),
        relation('out', '', 'end', { active: true }),
        node('end', 'Property'),
      ])
      .raw(`WHERE end.value > date()`)
      .with('node, end')
      .orderBy('end.value', 'asc')
      .limit(1)
      .apply(this.hydrate())
      .first();
    return res?.dto;
  }

  async getLatestReportSubmitted(parentId: ID, type: ReportType) {
    const res = await this.db
      .query()
      .match([
        node('', 'BaseNode', { id: parentId }),
        relation('out', '', 'report', { active: true }),
        node('node', `${type}Report`),
        relation('out', '', 'start', { active: true }),
        node('sn', 'Property'),
      ])
      .raw(`where (node)-->(:FileNode)<--(:FileVersion)`)
      .with('node, sn')
      .orderBy('sn.value', 'desc')
      .limit(1)
      .apply(this.hydrate())
      .first();
    return res?.dto;
  }

  async listEngagementReports(
    engagementId: string,
    input: PeriodicReportListInput
  ) {
    const result = await this.db
      .query()
      .match([
        node('engagement', 'Engagement', { id: engagementId }),
        relation('out', '', 'report', { active: true }),
        node('node', 'ProgressReport'),
      ])
      .apply(sorting(ProgressReport, input))
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
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
        `
          WHERE NOT (report)-[:reportFileNode]->(:File)<-[:parent { active: true }]-(:FileVersion)
            AND start.value IN $startDates
        `,
        {
          startDates: intervals.map((interval) => interval.start),
        }
      )
      .apply(deleteBaseNode('report'))
      .return<{ count: number }>('count(node) as count')
      .first();
  }
}
