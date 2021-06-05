import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  AnonSession,
  CalendarDate,
  DateInterval,
  ID,
  LoggedInSession,
  Session,
} from '../../common';
import { DatabaseService, ILogger, Logger } from '../../core';
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
    @Logger('periodic-report:migration') private readonly logger: ILogger,
    private readonly pnp: PnpExtractor
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
        this.logger.info(`project sync progress`, {
          count,
          total: projects.length,
        });
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
  // @Mutation(() => Boolean, {
  //   description: 'Move P&P files from old schema to new periodic report schema',
  // })
  // async migratePnps(@LoggedInSession() session: Session) {
  //   const migratePnp = async ({
  //     year: fileNameYear,
  //     quarter: fileNameQuarter,
  //     engagementId,
  //     pnpName,
  //   }: {
  //     year: number;
  //     quarter: number;
  //     engagementId: ID;
  //     pnpName: string;
  //   }) => {
  //     const getMostRecentFileVersionId = async (eId: ID) => {
  //       const { mostRecentPnpFileVersionId } = (await this.db
  //         .query()
  //         .raw(
  //           `
  //           match(e {id: $id})-[:pnpNode { active: true }]->()<-[:parent { active: true }]-(pnpFileVersion)
  //           return pnpFileVersion.id as mostRecentPnpFileVersionId
  //           order by pnpFileVersion.createdAt desc
  //           limit 1
  //           `,
  //           { id: eId }
  //         )
  //         .asResult<{ mostRecentPnpFileVersionId: ID }>()
  //         .first()) ?? { mostRecentPnpFileVersionId: null };
  //       return mostRecentPnpFileVersionId;
  //     };
  //     let extractedYear;
  //     let extractedQuarter;

  //     if (!fileNameYear || !fileNameQuarter) {
  //       const mostRecentId = await getMostRecentFileVersionId(engagementId);
  //       if (!mostRecentId) {
  //         this.logger.log({ message: 'no pnp version', engagementId });
  //         return;
  //       }
  //       // this goes into the file itself to see if it can find FY/Q if we're missing it in the file name
  //       const res = await this.pnp.extractFyAndQuarter(
  //         { uploadId: mostRecentId },
  //         session
  //       );
  //       extractedYear = res.extractedYear;
  //       extractedQuarter = res.extractedQuarter;
  //     }

  //     const year = fileNameYear || extractedYear;
  //     const quarter = fileNameQuarter || extractedQuarter;
  //     if (!year || !quarter) {
  //       this.logger.log({
  //         message: 'no year or quarter',
  //         engagementId,
  //         pnpName,
  //         year,
  //         quarter,
  //       });
  //       return;
  //     }
  //     // non-fiscal date
  //     const startDate = `${quarter === 1 ? year - 1 : year}-${
  //       quarter === 1
  //         ? '10'
  //         : quarter === 2
  //         ? '01'
  //         : quarter === 3
  //         ? '04'
  //         : '07'
  //     }-01`;

  //     const pnpDateMillis = CalendarDate.fromISO(startDate).toMillis();

  //     // if pnpDate is after end, then assign that pnp to the last reporting period
  //     let startToUse;

  //     const { matchingStart } = (await this.db
  //       .query()
  //       .raw(
  //         `match(e:Engagement {id: $id})-[:report { active: true }]->(pr:ProgressReport)-[:start { active: true }]->(start:Property {value: date($startDate)})`,
  //         { id: engagementId, startDate }
  //       )
  //       .return('start.value as matchingStart')
  //       .first()) ?? { matchingStart: null };

  //     if (!matchingStart) {
  //       // the start and end of the last reporting period –– if the pnp is from after the PR end
  //       // then we map the P&P to that (the last) reporting period
  //       const { latestPrStart, latestPrEnd } = (await this.db
  //         .query()
  //         .match([
  //           node('', 'Engagement', { id: engagementId }),
  //           relation('out', '', 'report', { active: true }),
  //           node('rn', 'PeriodicReport'),
  //           relation('out', '', 'start', { active: true }),
  //           node('sn', 'Property'),
  //         ])
  //         .match([
  //           node('rn'),
  //           relation('out', '', 'end', { active: true }),
  //           node('en', 'Property'),
  //         ])
  //         .return('sn.value as latestStart, en.value as latestEnd')
  //         .orderBy('sn.value', 'desc')
  //         .limit(1)
  //         .asResult<{
  //           latestPrStart?: CalendarDate;
  //           latestPrEnd?: CalendarDate;
  //         }>()
  //         .first()) ?? { latestPrStart: undefined, latestPrEnd: undefined };
  //       // if we can't match it, leave the P&P where it was and move on
  //       if (!latestPrStart || !latestPrEnd) return;

  //       startToUse =
  //         latestPrEnd.toMillis() < pnpDateMillis ? latestPrStart : null;
  //     } else {
  //       startToUse = matchingStart;
  //     }

  //     // we cannot match a P&P to a report period, so we leave it where it is
  //     if (!startToUse) {
  //       this.logger.log({ message: 'no start to match on', engagementId });
  //       return;
  //     }

  //     // move pnp node file versions to the matching periodic report file node
  //     // and remove the old parent relationships
  //     const { reportFileNodeId } = (await this.db
  //       .query()
  //       .raw(
  //         `
  //         match(e { id: $id })-[:pnpNode { active: true }]->()<-[pnpParentRel:parent { active: true }]-(pnpFileVersion)
  //         match(e)-[:report]->(rn)-[:start { active: true }]->({ value: date($startDate) })
  //         match(rn)-[:reportFileNode { active: true }]->(reportFileNode)
  //         create(pnpFileVersion)-[:parent { active: true, createdAt: pnpFileVersion.createdAt }]->(reportFileNode)
  //         delete pnpParentRel
  //         return reportFileNode.id as reportFileNodeId
  //         `,
  //         { id: engagementId, startDate: startToUse }
  //       )
  //       .first()) ?? { reportFileNodeId: null };

  //     // deactivate the default PR name node
  //     await this.db
  //       .query()
  //       .raw(
  //         `
  //         match(reportFileNode { id: $reportFileNodeId })-[nameRel:name { active: true }]->(name)
  //         set nameRel.active = false, name:Deleted_Property
  //         remove name:Property
  //         return *
  //         `,
  //         { reportFileNodeId }
  //       )
  //       .run();

  //     // move pnp node name properties to periodic report
  //     // this is the history of file version names
  //     await this.db
  //       .query()
  //       .raw(
  //         `
  //         match(e { id: $id })-[:pnpNode { active: true }]->()-[pnpNameRel:name]->(pnpName)
  //         match(reportFileNode { id: $reportFileNodeId })
  //         where not pnpName.value =~ "PNP"
  //         create(reportFileNode)-[:name { active: pnpNameRel.active, createdAt: pnpName.createdAt }]->(pnpName)
  //         delete pnpNameRel
  //         return *
  //         `,
  //         { id: engagementId, reportFileNodeId }
  //       )
  //       .run();

  //     // set default pnp name to active = true
  //     // it's the only name node left after the previous query
  //     await this.db
  //       .query()
  //       .raw(
  //         `
  //         match(e { id: $id })-[p:pnpNode { active: true }]->()-[pnpNameRel:name]->(pnpName)
  //         set pnpNameRel.active = true, pnpName:Property
  //         remove pnpName:Deleted_Property
  //         return *
  //         `,
  //         { id: engagementId }
  //       )
  //       .run();
  //   };

  //   // MATCH (e:Engagement)-[:pnpNode { active: true }]->(pn:FileNode)-[:name { active: true }]->(na:Property)
  //   // where (pn)<--(:FileVersion) and (e)-[:report { active: true }]->(:ProgressReport)
  //   // RETURN na.value as pnpName, e.id as engagementId
  //   // get all engagements with previously uploaded P&Ps in the former designated location

  //   // group P&P file versions by periodic report before moving
  //   const ress = this.db
  //     .query()
  //     .match([
  //       node('e', 'Engagement'),
  //       relation('out', '', 'pnpNode', { active: true }),
  //       node('pn', 'FileNode'),
  //       relation('out', '', 'name', { active: true }),
  //       node('na', 'Property'),
  //     ])
  //     // ensure the engagement has periodic reports generated
  //     // we didn't generate them if project is missing one of its dates (per Seth)
  //     .match([
  //       node('e'),
  //       relation('out', '', 'report', { active: true }),
  //       node('rn', 'ProgressReport'),
  //     ])
  //     // these are engagements that have a previously uploaded P&P
  //     .raw(`where (pn)<--(:FileVersion)`)
  //     .with(
  //       `
  //       {
  //         pnpName: na.value,
  //         engagementId: e.id
  //       } as engagementData
  //       `
  //     )
  //     .return('distinct(engagementData)')
  //     .asResult<{
  //       engagementData: {
  //         pnpName: string;
  //         engagementId: ID;
  //       };
  //     }>();

  //   const res = await ress.run();

  //   const mapped = res.map(({ engagementData }) => {
  //     const { year, quarter } = this.pnp.parseYearAndQuarter(
  //       engagementData.pnpName
  //     );
  //     return { ...engagementData, year, quarter };
  //   });

  //   await asyncPool(30, mapped, migratePnp);

  //   return true;
  // }

  @ResolveField(() => SecuredFile)
  async reportFile(
    @Parent() report: IPeriodicReport,
    @AnonSession() session: Session
  ): Promise<SecuredFile> {
    return await this.files.resolveDefinedFile(report.reportFile, session);
  }
}
