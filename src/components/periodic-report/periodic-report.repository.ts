import { Injectable } from '@nestjs/common';
import { inArray, node, Query, relation } from 'cypher-query-builder';
import {
  CalendarDate,
  generateId,
  ID,
  NotFoundException,
  Range,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { DtoRepository } from '../../core';
import {
  ACTIVE,
  createNode,
  createRelationships,
  deleteBaseNode,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  paginate,
  sorting,
  Variable,
} from '../../core/database/query';
import {
  CreatePeriodicReport,
  IPeriodicReport,
  PeriodicReport,
  PeriodicReportListInput,
  ReportType,
  resolveReportType,
} from './dto';

@Injectable()
export class PeriodicReportRepository extends DtoRepository(IPeriodicReport) {
  async create(input: CreatePeriodicReport) {
    const reportFileId = await generateId();

    const Report = resolveReportType(input);
    const initialProps = {
      type: input.type,
      start: input.start,
      end: input.end,
      skippedReason: input.skippedReason,
      receivedDate: null,
      reportFile: reportFileId,
    };
    const query = this.db
      .query()
      .apply(await createNode(Report, { initialProps }))
      .apply(
        createRelationships(Report, 'in', {
          report: ['BaseNode', input.projectOrEngagementId],
        })
      )
      .return<{ id: ID }>('node.id as id');
    const result = await query.first();
    if (!result) {
      throw new ServerException('Failed to create a periodic report');
    }
    return { id: result.id, reportFileId };
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .match([node('node', 'PeriodicReport', { id })])
      .apply(this.hydrate(session));

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find periodic report');
    }

    return result.dto;
  }

  async readMany(ids: readonly ID[], session: Session) {
    return await this.db
      .query()
      .matchNode('node', 'PeriodicReport')
      .where({ 'node.id': inArray(ids.slice()) })
      .apply(this.hydrate(session))
      .map('dto')
      .run();
  }

  async listReports(
    parentId: ID,
    type: ReportType,
    input: PeriodicReportListInput,
    session: Session
  ) {
    const result = await this.db
      .query()
      .match([
        node('parent', 'BaseNode', { id: parentId }),
        relation('out', '', 'report', ACTIVE),
        node('node', `${type}Report`),
      ])
      .apply(sorting(resolveReportType({ type }), input))
      .apply(paginate(input, this.hydrate(session)))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  matchCurrentDue(parentId: ID | Variable, reportType: ReportType) {
    return (query: Query) =>
      query.comment`matchCurrentDue()`
        .match([
          node('baseNode', 'BaseNode', { id: parentId }),
          relation('out', '', 'report', ACTIVE),
          node('node', `${reportType}Report`),
          relation('out', '', 'end', ACTIVE),
          node('end', 'Property'),
        ])
        .raw(`WHERE end.value < date()`)
        .with('node, end')
        .orderBy('end.value', 'desc')
        .limit(1);
  }

  async getCurrentDue(parentId: ID, reportType: ReportType, session: Session) {
    const res = await this.db
      .query()
      .apply(this.matchCurrentDue(parentId, reportType))
      .apply(this.hydrate(session))
      .first();
    return res?.dto;
  }

  async getNextDue(parentId: ID, reportType: ReportType, session: Session) {
    const res = await this.db
      .query()
      .match([
        node('baseNode', 'BaseNode', { id: parentId }),
        relation('out', '', 'report', ACTIVE),
        node('node', `${reportType}Report`),
        relation('out', '', 'end', ACTIVE),
        node('end', 'Property'),
      ])
      .raw(`WHERE end.value > date()`)
      .with('node, end')
      .orderBy('end.value', 'asc')
      .limit(1)
      .apply(this.hydrate(session))
      .first();
    return res?.dto;
  }

  async getLatestReportSubmitted(
    parentId: ID,
    type: ReportType,
    session: Session
  ) {
    const res = await this.db
      .query()
      .match([
        node('', 'BaseNode', { id: parentId }),
        relation('out', '', 'report', ACTIVE),
        node('node', `${type}Report`),
        relation('out', '', 'start', ACTIVE),
        node('sn', 'Property'),
      ])
      .raw(`where (node)-->(:FileNode)<--(:FileVersion)`)
      .with('node, sn')
      .orderBy('sn.value', 'desc')
      .limit(1)
      .apply(this.hydrate(session))
      .first();
    return res?.dto;
  }

  async getFinalReport(parentId: ID, type: ReportType, session: Session) {
    const res = await this.db
      .query()
      .match([
        node('', 'BaseNode', { id: parentId }),
        relation('out', '', 'report', ACTIVE),
        node('node', `${type}Report`),
      ])
      .match([
        node('node'),
        relation('out', '', 'start', ACTIVE),
        node('start', 'Property'),
      ])
      .match([
        node('node'),
        relation('out', '', 'end', ACTIVE),
        node('end', 'Property'),
      ])
      .raw(`where start.value = end.value`)
      .apply(this.hydrate(session))
      .first();
    return res?.dto;
  }

  /**
   * Deletes reports of type and under parent base node.
   * If an interval specifies both start and end then reports are matched with those specified dates.
   * If an interval omits start then all reports ending on or before given end are matched.
   * If an interval omits end then all reports starting on or after given start are matched.
   */
  async delete(
    baseNodeId: ID,
    type: ReportType,
    intervals: ReadonlyArray<Range<CalendarDate | null>>
  ) {
    return await this.db
      .query()
      .unwind(
        intervals.map((i) => ({ start: i.start, end: i.end })),
        'interval'
      )
      .match([
        [
          node('node', 'BaseNode', { id: baseNodeId }),
          relation('out', '', 'report', ACTIVE),
          node('report', `${type}Report`),
        ],
        [
          node('report'),
          relation('out', '', 'start', ACTIVE),
          node('start', 'Property'),
        ],
        [
          node('report'),
          relation('out', '', 'end', ACTIVE),
          node('end', 'Property'),
        ],
      ])
      .raw(
        `
          WHERE NOT (report)-[:reportFileNode]->(:File)<-[:parent { active: true }]-(:FileVersion)
            AND CASE
              WHEN interval.start is null
                  THEN end.value <= interval.end
              WHEN interval.end is null
                  THEN start.value >= interval.start
              ELSE interval.start = start.value AND interval.end = end.value
            END
        `
      )
      .subQuery('report', (sub) =>
        sub
          .apply(deleteBaseNode('report'))
          .return('node as somethingDeleted')
          .raw('LIMIT 1')
      )
      .return<{ count: number }>('count(report) as count')
      .first();
  }

  protected hydrate(session: Session) {
    return (query: Query) =>
      query
        .subQuery('node', (sub) =>
          sub
            .match([
              node('node'),
              relation('in', '', 'report', ACTIVE),
              node('project', 'Project'),
            ])
            .return('project')
            .union()
            .with('node')
            .match([
              node('node'),
              relation('in', '', 'report', ACTIVE),
              node('', 'Engagement'),
              relation('in', '', 'engagement', ACTIVE),
              node('project', 'Project'),
            ])
            .return('project')
        )
        .match([
          node('parent', 'BaseNode'),
          relation('out', '', 'report', ACTIVE),
          node('node'),
        ])
        .apply(matchPropsAndProjectSensAndScopedRoles(session))
        .return<{ dto: UnsecuredDto<PeriodicReport> }>(
          merge('props', { parent: 'parent' }).as('dto')
        );
  }
}
