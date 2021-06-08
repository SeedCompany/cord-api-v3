import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Node, node, relation } from 'cypher-query-builder';
import { first, orderBy, uniqWith } from 'lodash';
import { DateTime } from 'luxon';
import {
  AnonSession,
  CalendarDate,
  DateInterval,
  ID,
  LoggedInSession,
  Session,
} from '../../common';
import { DatabaseService, ILogger, Logger, Transactional } from '../../core';
import { EngagementService, LanguageEngagement, PnpData } from '../engagement';
import { FileService, FileVersion, SecuredFile } from '../file';
import { ProgressExtractor } from '../progress-summary/progress-extractor.service';
import { ProgressSummaryRepository } from '../progress-summary/progress-summary.repository';
import { ProjectService } from '../project';
import {
  IPeriodicReport,
  ProgressReport,
  ReportType,
  UploadPeriodicReportInput,
} from './dto';
import { PeriodicReportService } from './periodic-report.service';
// eslint-disable-next-line @typescript-eslint/no-require-imports
import asyncPool = require('tiny-async-pool');

@Resolver(IPeriodicReport)
export class PeriodicReportResolver {
  constructor(
    private readonly service: PeriodicReportService,
    private readonly projects: ProjectService,
    private readonly engagements: EngagementService,
    private readonly files: FileService,
    private readonly db: DatabaseService,
    @Logger('periodic-report:migration') private readonly logger: ILogger,
    private readonly extractor: ProgressExtractor,
    private readonly summaryRepo: ProgressSummaryRepository
  ) {}

  @ResolveField(() => CalendarDate, {
    description: 'When this report is due',
  })
  due(@Parent() report: IPeriodicReport) {
    return report.end.plus({ month: 1 }).endOf('month');
  }

  @Mutation(() => IPeriodicReport, {
    description: 'Update a report file',
  })
  async uploadPeriodicReport(
    @LoggedInSession() session: Session,
    @Args('input') input: UploadPeriodicReportInput
  ): Promise<IPeriodicReport> {
    const report = await this.service.uploadFile(
      input.reportId,
      input.file,
      session
    );
    return report;
  }
  // Remove after periodic report migration
  @Mutation(() => Boolean, {
    description: 'Create periodic reports for projects and engagements',
  })
  async syncAllReports(@LoggedInSession() session: Session) {
    void this.doSync(session);
    return true;
  }

  async doSync(session: Session) {
    await this.syncProjectReports(session);
    await this.syncEngagementReports(session);
  }

  // Remove after periodic report migration
  @Mutation(() => Boolean, {
    description: 'Create project report files for existing projects',
  })
  async syncProjectReports(@LoggedInSession() session: Session) {
    let count = 1;
    const projects = await this.projects.listProjectsWithDateRange();

    const syncProject = async ({
      projectId,
      mouStart,
      mouEnd,
    }: {
      projectId: ID;
      mouStart?: CalendarDate;
      mouEnd?: CalendarDate;
    }) => {
      count++;
      if (count % 100 === 0) {
        this.logger.info(`project sync progress`, {
          count,
          total: projects.length,
        });
      }
      // can't generate reports with no dates
      if (!mouStart || !mouEnd) return;
      let narrativeIntervals = [] as any[];
      let financialIntervals = [] as any[];
      try {
        narrativeIntervals = DateInterval.tryFrom(mouStart, mouEnd)
          .expandToFull('quarters')
          .splitBy({ quarters: 1 });
      } catch (exception) {
        this.logger.error('Error creating narrative intervals', {
          exception,
          projectId,
        });
      }

      try {
        financialIntervals = DateInterval.tryFrom(mouStart, mouEnd)
          .expandToFull('months')
          .splitBy({ months: 1 });
      } catch (exception) {
        this.logger.error('Error creating financial intervals', {
          exception,
          projectId,
        });
      }

      for (const interval of financialIntervals) {
        try {
          await this.service.create(
            {
              start: interval.start,
              end: interval.end,
              type: ReportType.Financial,
              projectOrEngagementId: projectId,
            },
            session
          );
        } catch (exception) {
          this.logger.error('Error creating financial report', {
            exception,
            projectId,
          });
        }
      }

      for (const interval of narrativeIntervals) {
        try {
          await this.service.create(
            {
              start: interval.start,
              end: interval.end,
              type: ReportType.Narrative,
              projectOrEngagementId: projectId,
            },
            session
          );
        } catch (exception) {
          this.logger.error('Error creating narrative report', {
            exception,
            projectId,
          });
        }
      }
    };
    this.logger.info(`starting project sync`);
    await asyncPool(20, projects, syncProject);
    this.logger.info(`project sync finished`);
    return true;
  }
  // Remove after periodic report migration
  @Mutation(() => Boolean, {
    description: 'Create engagement progress reports for existing engagements',
  })
  async syncEngagementReports(@LoggedInSession() session: Session) {
    let count = 0;
    const syncEngagement = async ({
      engagementId,
      startDate,
      endDate,
      startDateOverride,
      endDateOverride,
    }: {
      engagementId: ID;
      startDate?: CalendarDate;
      endDate?: CalendarDate;
      startDateOverride?: CalendarDate;
      endDateOverride?: CalendarDate;
    }) => {
      count++;
      if (count % 100 === 0) {
        this.logger.info(`engagements sync progress`, {
          count,
          total: engagements.length,
        });
      }
      // if we're missing either project date, don't generate reports
      if (!startDate || !endDate) return;

      const useStartOverride =
        startDateOverride &&
        // override must come after the project start
        startDateOverride.toMillis() > startDate.toMillis() &&
        // can't have an override outside of the limits of the project dates
        startDateOverride.toMillis() < endDate.toMillis();

      const useEndOverride =
        endDateOverride &&
        // override must come before the project end
        endDateOverride.toMillis() < endDate.toMillis() &&
        // there's some bad data where we have end overrides
        // that are before either the project start or the override start
        // it must come after the project start
        endDateOverride.toMillis() > startDate.toMillis();

      const deleteStartOverride = startDateOverride && !useStartOverride;
      const deleteEndOverride = endDateOverride && !useEndOverride;
      const deleteBothOverrides =
        startDateOverride &&
        endDateOverride &&
        // invalid end override in relation to the start override
        endDateOverride.toMillis() < startDateOverride.toMillis();

      if (deleteStartOverride || deleteEndOverride || deleteBothOverrides) {
        try {
          await this.db.updateProperties({
            type: LanguageEngagement,
            object: { id: engagementId },
            changes: {
              ...(deleteStartOverride || deleteBothOverrides
                ? { startDateOverride: null }
                : {}),
              ...(deleteEndOverride || deleteBothOverrides
                ? { endDateOverride: null }
                : {}),
            },
          });
        } catch (exception) {
          this.logger.error('Error updating engagement dates', {
            exception,
            engagementId,
          });
        }
      }

      // the start date to use to generate the periodic reports
      const start =
        useStartOverride && !deleteBothOverrides
          ? startDateOverride
          : startDate;

      const end =
        useEndOverride && !deleteBothOverrides ? endDateOverride : endDate;
      let intervals = [] as any[];
      try {
        // dependant booleans of start, end check for non-nullishness already
        intervals = DateInterval.tryFrom(start!, end!)
          .expandToFull('quarters')
          .splitBy({ quarters: 1 });
      } catch (exception) {
        this.logger.error('Error creating progress intervals', {
          exception,
          engagementId,
        });
      }

      for (const interval of intervals) {
        try {
          await this.service.create(
            {
              start: interval.start,
              end: interval.end,
              type: ReportType.Progress,
              projectOrEngagementId: engagementId,
            },
            session
          );
        } catch (exception) {
          this.logger.error('Error creating progress report', {
            exception,
            engagementId,
          });
        }
      }
    };

    const engagements = await this.engagements.listEngagementsWithDateRange();
    this.logger.info(`starting engagement sync`);
    await asyncPool(20, engagements, syncEngagement);
    this.logger.info(`finished engagement sync`);

    return true;
  }
  // Remove after periodic report migration
  @Mutation(() => Boolean, {
    description: 'Move P&P files from old schema to new periodic report schema',
  })
  async migratePnps() {
    const res = await this.db
      .query()
      .match([
        node('e', 'Engagement'),
        relation('out', '', 'pnpData', { active: true }),
        node('pn', 'PnpData'),
      ])
      // ensure engagement has progress reports
      .raw(`where (e)-->(:ProgressReport)`)
      .with('e, collect(pn) as pnpDataNodes')
      .subQuery((sub) =>
        sub
          .with('e')
          .match([
            node('e'),
            relation('out', '', 'pnpNode', { active: true }),
            node('', 'FileNode'),
            relation('in', '', 'parent', { active: true }),
            node('fv', 'FileVersion'),
          ])
          .return('fv.id as latestPnpVersionId')
          .orderBy('fv.createdAt', 'desc')
          .limit(1)
      )
      .return('pnpDataNodes, e.id as engagementId, latestPnpVersionId')
      .asResult<{
        engagementId: ID;
        latestPnpVersionId: ID;
        pnpDataNodes: Array<Node<PnpData>>;
      }>()
      .run();
    const mapped = res.map(({ pnpDataNodes, ...rest }) => {
      const pnpProps = pnpDataNodes.map((n) => n.properties);

      const dups = uniqWith(
        pnpProps,
        (a, b) => a.year === b.year && a.quarter === b.quarter
      );

      const latestPnpData = first(
        orderBy(pnpProps, ['year', 'quarter'], ['desc', 'desc'])
      )!;

      return {
        planned: latestPnpData.progressPlanned,
        actual: latestPnpData.progressActual,
        extract: dups.length !== pnpProps.length,
        ...latestPnpData,
        ...rest,
      };
    });

    this.logger.info(`starting pnp migration`);
    let count = 1;
    await asyncPool(5, mapped, async (...args) => {
      count++;
      if (count % 100 === 0) {
        this.logger.info(`${count} of ${mapped.length} pnps synced`);
      }
      await this.migratePnp(...args);
    });
    this.logger.info(`finished pnp migration`);

    return true;
  }

  @Transactional()
  private async migratePnp({
    year,
    quarter,
    planned,
    actual,
    variance,
    latestPnpVersionId,
    engagementId,
    extract,
  }: {
    year: number;
    quarter: number;
    planned: number;
    actual: number;
    variance: number;
    latestPnpVersionId: ID;
    engagementId: ID;
    extract: boolean;
  }) {
    if (!year || !quarter) {
      this.logger.info({
        message: 'no year or quarter',
        engagementId,
        year,
        quarter,
      });
      return;
    }

    if (!planned && !actual) {
      this.logger.info({
        message: 'no progress data',
        engagementId,
        planned,
        actual,
        variance,
      });
      return;
    }
    // non-fiscal date
    const startDate = `${quarter === 1 ? year - 1 : year}-${
      quarter === 1 ? '10' : quarter === 2 ? '01' : quarter === 3 ? '04' : '07'
    }-01`;

    const pnpDate = CalendarDate.fromISO(startDate);

    // if pnpDate is after end, then assign that pnp to the last reporting period
    let startToUse;

    const { matchingStart } = (await this.db
      .query()
      .raw(
        `match(e:Engagement {id: $id})-[:report { active: true }]->(pr:ProgressReport)-[:start { active: true }]->(start:Property {value: date($startDate)})`,
        { id: engagementId, startDate }
      )
      .return('start.value as matchingStart')
      .first()) ?? { matchingStart: null };

    if (!matchingStart) {
      // the start and end of the last reporting period –– if the pnp is from after the PR end
      // then we map the P&P to that (the last) reporting period
      const { latestPrStart, latestPrEnd } = (await this.db
        .query()
        .match([
          node('', 'Engagement', { id: engagementId }),
          relation('out', '', 'report', { active: true }),
          node('rn', 'PeriodicReport'),
          relation('out', '', 'start', { active: true }),
          node('sn', 'Property'),
        ])
        .match([
          node('rn'),
          relation('out', '', 'end', { active: true }),
          node('en', 'Property'),
        ])
        .return('sn.value as latestStart, en.value as latestEnd')
        .orderBy('sn.value', 'desc')
        .limit(1)
        .asResult<{
          latestPrStart?: CalendarDate;
          latestPrEnd?: CalendarDate;
        }>()
        .first()) ?? { latestPrStart: undefined, latestPrEnd: undefined };
      // if we can't match it, leave the P&P where it was and move on
      if (!latestPrStart || !latestPrEnd) return;

      startToUse = latestPrEnd < pnpDate ? latestPrStart : null;
    } else {
      startToUse = matchingStart;
    }

    // we cannot match a P&P to a report period, so we leave it where it is
    if (!startToUse) {
      this.logger.info({ message: 'no start to match on', engagementId });
      return;
    }

    const existing = await this.db
      .query()
      .raw(
        `
          match(e {id: $id})-[:report]->(rn)-[:start { active: true }]->({ value: date($startDate) })
          where (rn)-->(:FileNode)<--(:FileVersion)
          return rn
          `,
        {
          id: engagementId,
          startDate: startToUse,
        }
      )
      .first();
    // if a file has been uploaded to this periodic report, don't move the pnp there, but extract later
    if (existing) {
      return;
    }

    // move latest pnp node file version to the matching periodic report file node
    // and remove the old parent relationship
    const { reportFileNodeId, periodicReportId } = (await this.db
      .query()
      .raw(
        `
          match(e { id: $id })-[:pnpNode { active: true }]->(file)<-[pnpParentRel:parent { active: true }]-(pnpFileVersion {id: $latestPnpVersionId})
          match(e)-[:report]->(rn)-[:start { active: true }]->({ value: date($startDate) })
          match(rn)-[:reportFileNode { active: true }]->(reportFileNode)
          create(pnpFileVersion)-[:parent { active: true, createdAt: pnpFileVersion.createdAt }]->(reportFileNode)
          set pnpFileVersion.originalParentId = file.id
          delete pnpParentRel
          return reportFileNode.id as reportFileNodeId, rn.id as periodicReportId
          `,
        { id: engagementId, startDate: startToUse, latestPnpVersionId }
      )
      .first()) ?? { reportFileNodeId: null, periodicReportId: null };

    // deactivate the default PR name node
    await this.db
      .query()
      .raw(
        `
          match(reportFileNode { id: $reportFileNodeId })-[nameRel:name { active: true }]->(name)
          set nameRel.active = false, name:Deleted_Property
          remove name:Property
          return *
          `,
        { reportFileNodeId }
      )
      .run();

    // move most recent (active) pnp node name property to periodic report file node
    await this.db
      .query()
      .raw(
        `
          match(e { id: $id })-[:pnpNode { active: true }]->(file)-[pnpNameRel:name {active: true}]->(pnpName)
          match(reportFileNode { id: $reportFileNodeId })
          create(reportFileNode)-[:name { active: pnpNameRel.active, createdAt: pnpName.createdAt }]->(pnpName)
          set pnpName.originalParentId = file.id
          delete pnpNameRel
          return *
          `,

        { id: engagementId, reportFileNodeId }
      )
      .run();

    // set next most recent pnp name to active
    await this.db
      .query()
      .raw(
        `
          match(e { id: $id })-[p:pnpNode { active: true }]->()-[pnpNameRel:name]->(pnpName)
          with e, pnpNameRel, pnpName
          order by pnpName.createdAt desc limit 1
          set pnpNameRel.active = true, pnpName:Property
          remove pnpName:Deleted_Property
          return *
          `,
        { id: engagementId }
      )
      .run();

    // we create this after the fact if we have more than one pnp data node with the same year and quarter
    if (!extract) {
      const createdAt = DateTime.local();

      // write pnp data to new progress node
      await this.db
        .query()
        .raw(
          `
        match(pr{id:$periodicReportId})
        create(pr)-[:summary{active: true, createdAt: $createdAt}]->(:ProgressSummary{planned: $planned, actual: $actual, variance: $variance})
      `,
          {
            periodicReportId,
            createdAt,
            planned: planned,
            actual: actual,
            variance,
          }
        )
        .run();
    }

    // delete old pnp data node
    await this.db
      .query()
      .match([
        node('e', 'Engagement', { id: engagementId }),
        relation('out', 'pdr', 'pnpData', { active: true }),
        node('pd'),
      ])
      .raw(
        `
          set pdr.active = false, pd:Deleted_PnpData
          remove pd:PnpData
        `
      )
      .run();

    // steps to reverse pnp migration
    // 1. Move migrated file version nodes back to original parent using originalParentId on file version node
    // 2. Deactivate active name on pnpNode (this would be the previous version when the migrated file version was present before)
    // 3. Move migrated name to original parent using same method as 1
    // 4. Reactivate default report file node name property
    // 5. Detach/Delete all (:ProgressSummary) nodes
    // 6. Restore all pnpData nodes that were marked with label (:Deleted_PnpData) and set pnpData relationships to active
  }

  // Remove after periodic report migration
  @Mutation(() => Boolean, {
    description:
      'Extract progress from P&Ps attached to reports that have no Progress Summary',
  })
  async extractProgress() {
    const pnpsToExtract = await this.db
      .query()
      .match([
        node('e', 'Engagement'),
        relation('out', '', 'report', { active: true }),
        node('pr', 'ProgressReport'),
      ])
      .raw(
        `where (pr)-->(:FileNode)<--(:FileVersion) and not (pr)-->(:ProgressSummary)`
      )
      .subQuery((sub) =>
        sub
          .with('pr')
          .match([
            node('pr'),
            relation('out', '', 'reportFileNode', { active: true }),
            node('', 'FileNode'),
            relation('in', '', 'parent', { active: true }),
            node('fv', 'FileVersion'),
          ])
          .return('fv.id as latestFileVersionId')
          .orderBy('fv.createdAt', 'desc')
          .limit(1)
      )
      .return('pr.id as reportId, latestFileVersionId')
      .asResult<{ reportId: ID; latestFileVersionId: ID }>()
      .run();

    for (const pnp of pnpsToExtract) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const extracted = await this.extractor.extract({
        id: pnp.latestFileVersionId,
        // the extracting only requires the id
      } as FileVersion);
      // do nothing
      if (!extracted) {
        return;
      }

      await this.summaryRepo.save(
        // as above, we only need the id to save the data
        { id: pnp.reportId } as unknown as ProgressReport,
        extracted
      );
    }

    return true;
  }

  @ResolveField(() => SecuredFile)
  async reportFile(
    @Parent() report: IPeriodicReport,
    @AnonSession() session: Session
  ): Promise<SecuredFile> {
    return await this.files.resolveDefinedFile(report.reportFile, session);
  }
}
