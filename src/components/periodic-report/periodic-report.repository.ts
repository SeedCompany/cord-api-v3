import { Injectable } from '@nestjs/common';
import {
  and,
  greaterEqualTo,
  hasLabel,
  lessEqualTo,
  node,
  not,
  Query,
  relation,
} from 'cypher-query-builder';
import { AndConditions } from 'cypher-query-builder/src/clauses/where-utils';
import {
  CalendarDate,
  generateId,
  ID,
  Range,
  Session,
  UnsecuredDto,
} from '../../common';
import { DatabaseService, DtoRepository } from '../../core';
import {
  ACTIVE,
  createNode,
  createRelationships,
  deleteBaseNode,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  paginate,
  path,
  sorting,
  variable,
  Variable,
} from '../../core/database/query';
import { File } from '../file';
import { ProgressReportStatus as ProgressStatus } from '../progress-report/dto';
import { ProgressReportExtraForPeriodicInterfaceRepository } from '../progress-report/progress-report-extra-for-periodic-interface.repository';
import {
  IPeriodicReport,
  MergePeriodicReports,
  PeriodicReport,
  PeriodicReportListInput,
  ReportType,
  resolveReportType,
} from './dto';

@Injectable()
export class PeriodicReportRepository extends DtoRepository<
  typeof IPeriodicReport,
  [session: Session],
  PeriodicReport
>(IPeriodicReport) {
  constructor(
    private readonly progressRepo: ProgressReportExtraForPeriodicInterfaceRepository,
    db: DatabaseService,
  ) {
    super(db);
  }

  async merge(input: MergePeriodicReports) {
    const Report = resolveReportType(input);

    // Create IDs here that will feed into the reports that are new.
    // If only neo4j had a nanoid generator natively.
    const intervals = await Promise.all(
      input.intervals.map(async (interval) => ({
        tempId: await generateId(),
        start: interval.start,
        end: interval.end,
        tempFileId: await generateId(),
      })),
    );

    const isProgress = input.type === ReportType.Progress;
    const extraCreateOptions = isProgress
      ? this.progressRepo.getCreateOptions(input)
      : {};

    const query = this.db
      .query()
      // before interval list, so it's the same time across reports
      .with('datetime() as now')
      .matchNode('parent', 'BaseNode', { id: input.parent })
      .unwind(intervals, 'interval')
      .comment('Stop processing this row if the report already exists')
      .subQuery('parent, interval', (sub) =>
        sub
          .match([
            [
              node('parent'),
              relation('out', '', 'report', ACTIVE),
              node('node', `${input.type}Report`),
            ],
            [
              node('node'),
              relation('out', '', 'start', ACTIVE),
              node('', 'Property', { value: variable('interval.start') }),
            ],
            [
              node('node'),
              relation('out', '', 'end', ACTIVE),
              node('', 'Property', { value: variable('interval.end') }),
            ],
          ])
          // Invert zero rows into one row
          // We want to continue out of this sub-query having 1 row when
          // the report doesn't exist.
          // However, the match above gives us zero rows in this case.
          // Use count() to get us back to 1 row, and to create a temp list
          // of how many rows we want (0 if report exists, 1 if it doesn't).
          // Then use UNWIND to convert this list into rows.
          .with('CASE WHEN count(node) = 0 THEN [true] ELSE [] END as rows')
          .raw('UNWIND rows as row')
          // nonsense value, the 1 row returned is what is important, not this column
          .return('true as itIsNew'),
      )
      .apply(
        await createNode(Report as typeof IPeriodicReport, {
          baseNodeProps: {
            id: variable('interval.tempId'),
            createdAt: variable('now'),
            ...extraCreateOptions.baseNodeProps,
          },
          initialProps: {
            type: input.type,
            start: variable('interval.start'),
            end: variable('interval.end'),
            skippedReason: null,
            receivedDate: null,
            reportFile: variable('interval.tempFileId'),
            ...extraCreateOptions.initialProps,
          },
        }),
      )
      .apply(
        createRelationships(Report, 'in', {
          report: variable('parent'),
        }),
      )
      .apply(isProgress ? this.progressRepo.amendAfterCreateNode() : undefined)
      // rename node to report, so we can call create node again for the file
      .with('now, interval, node as report')
      .apply(
        await createNode(File, {
          initialProps: {
            name: variable('apoc.temporal.format(interval.end, "date")'),
          },
          baseNodeProps: {
            id: variable('interval.tempFileId'),
            createdAt: variable('now'),
          },
        }),
      )
      .apply(
        createRelationships(File, {
          in: { reportFileNode: variable('report') },
          out: { createdBy: ['User', input.session.userId] },
        }),
      )
      .return<{ id: ID; interval: Range<CalendarDate> }>(
        'report.id as id, interval',
      );
    return await query.run();
  }

  async list(input: PeriodicReportListInput, session: Session) {
    const resource = input.type
      ? resolveReportType({ type: input.type })
      : IPeriodicReport;
    const result = await this.db
      .query()
      .matchNode('node', 'PeriodicReport')
      .apply((q) => {
        const conditions: AndConditions = {};

        if (input.type) {
          conditions.node = hasLabel(`${input.type}Report`);
        }
        if (input.parent) {
          conditions.parent = path([
            node('', 'BaseNode', { id: input.parent }),
            relation('out', '', 'report', ACTIVE),
            node('node'),
          ]);
        }

        if (Object.keys(conditions).length > 0) {
          q.where(conditions);
        }
      })
      .apply(sorting(resource, input))
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

  async getByDate(
    parentId: ID,
    date: CalendarDate,
    reportType: ReportType,
    session: Session,
  ) {
    const res = await this.db
      .query()
      .match([
        [
          node('', 'BaseNode', { id: parentId }),
          relation('out', '', 'report', ACTIVE),
          node('node', `${reportType}Report`),
        ],
        [
          node('node'),
          relation('out', '', 'start', ACTIVE),
          node('start', 'Property'),
        ],
        [
          node('node'),
          relation('out', '', 'end', ACTIVE),
          node('end', 'Property'),
        ],
      ])
      .where(
        and({
          'start.value': lessEqualTo(date),
          'end.value': greaterEqualTo(date),
        }),
      )
      .apply(this.hydrate(session))
      .first();
    return res?.dto;
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
    session: Session,
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
    intervals: ReadonlyArray<Range<CalendarDate | null>>,
  ) {
    return await this.db
      .query()
      .unwind(
        intervals.map((i) => ({ start: i.start, end: i.end })),
        'interval',
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
          WHERE
            CASE
              WHEN interval.start is null
                  THEN end.value <= interval.end
              WHEN interval.end is null
                  THEN start.value >= interval.start
              ELSE interval.start = start.value AND interval.end = end.value
            END
            AND (
              (
                NOT report:ProgressReport
                AND NOT (report)-[:reportFileNode]->(:File)<-[:parent { active: true }]-(:FileVersion)
              ) OR (
                report:ProgressReport
                AND (report)-[:status { active: true }]->(:Property { value: "${ProgressStatus.NotStarted}" })
              )
            )
        `,
      )
      .subQuery('report', (sub) =>
        sub
          .apply(deleteBaseNode('report'))
          .return('node as somethingDeleted')
          .raw('LIMIT 1'),
      )
      .return<{ count: number }>('count(report) as count')
      .first();
  }

  protected hydrate(session: Session) {
    return (query: Query) =>
      query
        .subQuery((sub) =>
          sub
            .with('node')
            .with('node')
            .where({ node: hasLabel('ProgressReport') })
            .apply(this.progressRepo.extraHydrate())
            .union()
            .with('node')
            .with('node')
            .where({ node: not(hasLabel('ProgressReport')) })
            .return('{} as extra'),
        )
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
            .return('project'),
        )
        .match([
          node('parent', 'BaseNode'),
          relation('out', '', 'report', ACTIVE),
          node('node'),
        ])
        .apply(matchPropsAndProjectSensAndScopedRoles(session))
        .return<{ dto: UnsecuredDto<PeriodicReport> }>(
          merge('props', { parent: 'parent' }, 'extra').as('dto'),
        );
  }
}
