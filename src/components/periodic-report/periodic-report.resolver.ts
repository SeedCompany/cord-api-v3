import { Logger } from '@nestjs/common';
import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { node, relation } from 'cypher-query-builder';
import { uniqBy } from 'lodash';
import { DateTime } from 'luxon';
import {
  AnonSession,
  CalendarDate,
  DateInterval,
  ID,
  LoggedInSession,
  Session,
} from '../../common';
import { DatabaseService } from '../../core';
import { EngagementService, LanguageEngagement } from '../engagement';
import { PnpExtractor } from '../engagement/pnp-extractor.service';
import { FileService, SecuredFile } from '../file';
import { ProjectService } from '../project';
import { IPeriodicReport, ReportType, UploadPeriodicReportInput } from './dto';
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
    private readonly pnp: PnpExtractor
  ) {}

  private readonly logger = new Logger();

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
    await this.syncProjectReports(session);
    await this.syncEngagementReports(session);
    return true;
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
        this.logger.log(`${count} of ${projects.length} projects synced`);
      }
      // can't generate reports with no dates
      if (!mouStart || !mouEnd) return;

      const narrativeIntervals = DateInterval.tryFrom(mouStart, mouEnd)
        .expandToFull('quarters')
        .splitBy({ quarters: 1 });

      const financialIntervals = DateInterval.tryFrom(mouStart, mouEnd)
        .expandToFull('months')
        .splitBy({ months: 1 });
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
        } catch (e) {
          this.logger.log(e, projectId);
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
        } catch (e) {
          this.logger.log(e, projectId);
        }
      }
    };
    this.logger.log(`starting project sync`);
    await asyncPool(20, projects, syncProject);
    this.logger.log(`project sync finished`);
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
        this.logger.log(`${count} of ${engagements.length} engagements synced`);
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
        } catch (error) {
          this.logger.log({ error, engagementId });
        }
      }

      // the start date to use to generate the periodic reports
      const start =
        useStartOverride && !deleteBothOverrides
          ? startDateOverride
          : startDate;

      const end =
        useEndOverride && !deleteBothOverrides ? endDateOverride : endDate;

      // dependant booleans of start, end check for non-nullishness already
      const intervals = DateInterval.tryFrom(start!, end!)
        .expandToFull('quarters')
        .splitBy({ quarters: 1 });

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
        } catch (e) {
          this.logger.log(e, engagementId);
        }
      }
    };

    const engagements = await this.engagements.listEngagementsWithDateRange();
    this.logger.log(`starting engagement sync`);
    await asyncPool(20, engagements, syncEngagement);
    this.logger.log(`finished engagement sync`);

    return true;
  }
  // Remove after periodic report migration
  @Mutation(() => Boolean, {
    description: 'Move P&P files from old schema to new periodic report schema',
  })
  async migratePnps() {
    let count = 1;
    const migratePnp = async ({
      year,
      quarter,
      planned,
      actual,
      variance,
      latestPnpVersionId,
      engagementId,
    }: {
      year: number;
      quarter: number;
      planned: number;
      actual: number;
      variance: number;
      latestPnpVersionId: ID;
      engagementId: ID;
    }) => {
      count++;
      if (count % 100 === 0) {
        this.logger.log(`${count} of ${unique.length} pnps synced`);
      }
      if (!year || !quarter) {
        this.logger.log({
          message: 'no year or quarter',
          engagementId,
          year,
          quarter,
        });
        return;
      }
      // non-fiscal date
      const startDate = `${quarter === 1 ? year - 1 : year}-${
        quarter === 1
          ? '10'
          : quarter === 2
          ? '01'
          : quarter === 3
          ? '04'
          : '07'
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
        this.logger.log({ message: 'no start to match on', engagementId });
        return;
      }

      // move latest pnp node file version to the matching periodic report file node
      // and remove the old parent relationship
      const { reportFileNodeId, periodicReportId } = (await this.db
        .query()
        .raw(
          `
            match(e { id: $id })-[:pnpNode { active: true }]->()<-[pnpParentRel:parent { active: true }]-(pnpFileVersion {id: $latestPnpVersionId})
            match(e)-[:report]->(rn)-[:start { active: true }]->({ value: date($startDate) })
            match(rn)-[:reportFileNode { active: true }]->(reportFileNode)
            create(pnpFileVersion)-[:parent { active: true, createdAt: pnpFileVersion.createdAt }]->(reportFileNode)
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

      const createdAt = DateTime.local();

      // write pnp data to new progress node
      await this.db
        .query()
        .raw(
          `
          match(pr{id:$periodicReportId})
          create(pr)-[:progressSummary{active: true, createdAt: $createdAt}]->(:ProgressSummary{planned: $planned, actual: $actual, variance: $variance})
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

      // delete old pnp data node
      await this.db
        .query()
        .match([
          node('e', 'Engagement', { id: engagementId }),
          relation('out', '', 'pnpData', { active: true }),
          node('pd'),
        ])
        .detachDelete('pd')
        .run();
    };

    const res = await this.db
      .query()
      .match([
        node('e', 'Engagement'),
        relation('out', '', 'pnpData', { active: true }),
        node('pn', 'PnpData'),
      ])
      // ensure engagement has progress reports
      .raw(`where (e)-->(:ProgressReport)`)
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
      .return(
        'pn.progressPlanned as planned, pn.progressActual as actual, pn.variance as variance, pn.year as year, pn.quarter as quarter, e.id as engagementId, latestPnpVersionId'
      )
      .asResult<{
        engagementId: ID;
        latestPnpVersionId: ID;
        planned: number;
        actual: number;
        variance: number;
        year: number;
        quarter: number;
      }>()
      .run();

    // this could be better, but it works
    const unique = uniqBy(res, 'engagementId');
    this.logger.log(`starting pnp migration`);
    await asyncPool(20, unique, migratePnp);
    this.logger.log(`finished pnp migration`);

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
