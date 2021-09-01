import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { Interval } from 'luxon';
import {
  generateId,
  ID,
  NotFoundException,
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

  async delete(baseNodeId: ID, type: ReportType, intervals: Interval[]) {
    return await this.db
      .query()
      .match([
        node('node', 'BaseNode', { id: baseNodeId }),
        relation('out', '', 'report', ACTIVE),
        node('report', `${type}Report`),
      ])
      .optionalMatch([
        node('report'),
        relation('out', '', 'start', ACTIVE),
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
        .apply(matchPropsAndProjectSensAndScopedRoles(session))
        .return<{ dto: UnsecuredDto<PeriodicReport> }>('props as dto');
  }
}
