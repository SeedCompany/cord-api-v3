import { Injectable } from '@nestjs/common';
import {
  and,
  greaterEqualTo,
  hasLabel,
  lessEqualTo,
  node,
  not,
  type Query,
  relation,
} from 'cypher-query-builder';
import {
  type CalendarDate,
  CreationFailed,
  DateInterval,
  generateId,
  type ID,
  NotFoundException,
  type Range,
  type UnsecuredDto,
} from '~/common';
import { DtoRepository } from '~/core/database';
import {
  ACTIVE,
  createNode,
  createRelationships,
  currentUser,
  defineSorters,
  deleteBaseNode,
  filter,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  paginate,
  sorting,
  variable,
  type Variable,
} from '~/core/database/query';
import { ILogger, Logger } from '../../core';
import { File } from '../file/dto';
import {
  ProgressReport,
  ProgressReportStatus as ProgressStatus,
} from '../progress-report/dto';
import {
  ProgressReportExtraForPeriodicInterfaceRepository,
  progressReportExtrasSorters,
} from '../progress-report/progress-report-extra-for-periodic-interface.repository';
import {
  IPeriodicReport,
  type MergePeriodicReports,
  type PeriodicReport,
  type PeriodicReportListInput,
  ReportType,
  resolveReportType,
  type UpdatePeriodicReportInput,
} from './dto';

@Injectable()
export class PeriodicReportRepository extends DtoRepository<
  typeof IPeriodicReport,
  [],
  PeriodicReport
>(IPeriodicReport) {
  constructor(
    private readonly progressRepo: ProgressReportExtraForPeriodicInterfaceRepository,
    @Logger('periodic:report:service') private readonly logger: ILogger,
  ) {
    super();
  }

  async merge(input: MergePeriodicReports) {
    if (input.intervals.length === 0) {
      return;
    }

    try {
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
        .apply(
          isProgress ? this.progressRepo.amendAfterCreateNode() : undefined,
        )
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
            out: { createdBy: currentUser },
          }),
        )
        .return<{ id: ID; interval: Range<CalendarDate> }>(
          'report.id as id, interval',
        );

      const result = await query.run();

      this.logger.info(`Merged ${input.type.toLowerCase()} reports`, {
        existing: input.intervals.length - result.length,
        new: result.length,
        parent: input.parent,
        newIntervals: result.map(({ interval }) =>
          DateInterval.fromObject(interval).toISO(),
        ),
      });
    } catch (exception) {
      const Report = resolveReportType({ type: input.type });
      throw new CreationFailed(Report, exception);
    }
  }

  async mergeFinalReport(
    parentId: ID,
    type: ReportType,
    at: CalendarDate,
  ): Promise<void> {
    const report = await this.getFinalReport(parentId, type);

    if (report) {
      if (+report.start === +at) {
        // no change
        return;
      }
      await this.update({ id: report.id, start: at, end: at });
    } else {
      await this.merge({
        intervals: [{ start: at, end: at }],
        type,
        parent: parentId,
      });
    }
  }

  async update(
    changes: Omit<UpdatePeriodicReportInput, 'reportFile'> &
      Pick<PeriodicReport, 'start' | 'end'>,
  ) {
    const { id, ...simpleChanges } = changes;

    await this.updateProperties({ id }, simpleChanges);

    return await this.readOne(id);
  }

  async readOne(id: ID) {
    if (!id) {
      throw new NotFoundException(
        'No periodic report id to search for',
        'periodicReport.id',
      );
    }

    return await super.readOne(id);
  }

  async list(input: PeriodicReportListInput) {
    const resource = input.type
      ? resolveReportType({ type: input.type })
      : IPeriodicReport;
    const { type, parent, start, end } = input;
    const filters = { type, parent, start, end };
    const result = await this.db
      .query()
      .matchNode('node', 'PeriodicReport')
      .apply(periodicReportFilters(filters))
      .apply(sorting(resource, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  matchCurrentDue(parentId: ID | Variable, reportType: ReportType) {
    return matchCurrentDue(parentId, reportType);
  }

  async getByDate(parentId: ID, date: CalendarDate, reportType: ReportType) {
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
      .apply(this.hydrate())
      .first();
    return res?.dto;
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
        node('parent', 'BaseNode', { id: parentId }),
        relation('out', '', 'report', ACTIVE),
        node('node', `${reportType}Report`),
        relation('out', '', 'end', ACTIVE),
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
        relation('out', '', 'report', ACTIVE),
        node('node', `${type}Report`),
        relation('out', '', 'start', ACTIVE),
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

  async getFinalReport(parentId: ID, type: ReportType) {
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
      .apply(this.hydrate())
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
    intervals = intervals.filter((i) => i.start || i.end);
    if (intervals.length === 0) {
      return;
    }

    const result = await this.db
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

    this.logger.info('Deleted reports', { baseNodeId, type, ...result });
  }

  protected hydrate() {
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
        .apply(matchPropsAndProjectSensAndScopedRoles())
        .return<{ dto: UnsecuredDto<PeriodicReport> }>(
          merge('props', { parent: 'parent' }, 'extra').as('dto'),
        );
  }
}

export const matchCurrentDue =
  (parentId: ID | Variable | undefined, reportType: ReportType) =>
  (query: Query) =>
    query.comment`matchCurrentDue()`
      .match([
        [
          node('parent', 'BaseNode', parentId ? { id: parentId } : undefined),
          relation('out', '', 'report', ACTIVE),
          node('node', `${reportType}Report`),
          relation('out', '', 'end', ACTIVE),
          node('end', 'Property'),
        ],
        [
          node('node'),
          relation('out', '', 'start', ACTIVE),
          node('start', 'Property'),
        ],
      ])
      .raw(`WHERE end.value < date()`)
      .with('node, start')
      .orderBy([
        ['end.value', 'desc'],
        ['start.value', 'asc'],
      ])
      .limit(1);

export const periodicReportFilters = filter.define<
  Pick<PeriodicReportListInput, 'type' | 'start' | 'end' | 'parent'>
>(() => undefined as any, {
  type: ({ value }) => ({ node: hasLabel(`${value}Report`) }),
  parent: filter.pathExists((id) => [
    node('', 'BaseNode', { id }),
    relation('out', '', 'report', ACTIVE),
    node('node'),
  ]),
  start: filter.dateTimeProp(),
  end: filter.dateTimeProp(),
});

export const periodicReportSorters = defineSorters(IPeriodicReport, {});

export const progressReportSorters = defineSorters(ProgressReport, {
  ...periodicReportSorters.matchers,
  ...progressReportExtrasSorters.matchers,
});
