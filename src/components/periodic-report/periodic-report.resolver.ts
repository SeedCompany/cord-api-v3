import { Logger } from '@nestjs/common';
import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { node, relation } from 'cypher-query-builder';
import {
  AnonSession,
  CalendarDate,
  DateInterval,
  ID,
  LoggedInSession,
  Session,
} from '../../common';
import { DatabaseService } from '../../core';
import { EngagementService } from '../engagement';
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

  @Mutation(() => Boolean, {
    description: 'Create project report files for existing projects',
  })
  async syncProjectReports(@LoggedInSession() session: Session) {
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
      // can't generate reports with no dates
      if (!mouStart || !mouEnd) return;

      const narrativeIntervals = DateInterval.tryFrom(mouStart, mouEnd)
        .expandToFull('quarters')
        .difference()
        .flatMap((r) => r.splitBy({ quarters: 1 }));

      const financialIntervals = DateInterval.tryFrom(mouStart, mouEnd)
        .expandToFull('months')
        .difference()
        .flatMap((r) => r.splitBy({ months: 1 }));
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
    await asyncPool(20, projects, syncProject);

    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Create engagement progress reports for existing engagements',
  })
  async syncEngagementReports(@LoggedInSession() session: Session) {
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

      // the start date to use to generate the periodic reports
      const start =
        useStartOverride && !deleteBothOverrides
          ? startDateOverride
          : startDate;

      const end =
        useEndOverride && !deleteBothOverrides ? endDateOverride : endDate;

      if (deleteStartOverride || deleteEndOverride || deleteBothOverrides) {
        try {
          await this.engagements.updateLanguageEngagement(
            {
              id: engagementId,
              // these fields are nullable in fact, but since it's not coming through gql TS is complaining
              ...(deleteStartOverride || deleteBothOverrides
                ? { startDateOverride: null as any }
                : {}),
              ...(deleteEndOverride || deleteBothOverrides
                ? { endDateOverride: null as any }
                : {}),
            },
            session
          );
        } catch (error) {
          this.logger.log({ error, engagementId });
        }
      }

      // dependant booleans of start, end check for non-nullishness already
      const intervals = DateInterval.tryFrom(start!, end!)
        .expandToFull('quarters')
        .difference()
        .flatMap((r) => r.splitBy({ quarters: 1 }));

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
    await asyncPool(20, engagements, syncEngagement);

    return true;
  }

  @Mutation(() => Boolean, {
    description: 'Move P&P files from old schema to new periodic report schema',
  })
  async migratePnps(@LoggedInSession() session: Session) {
    const res = await this.db
      .query()
      .match([
        node('p', 'Project'),
        relation('out', '', 'engagement', { active: true }),
        node('e', 'Engagement', { id: '5cdaf7131c6585554b8af8cb' }),
        relation('out', '', 'pnpNode', { active: true }),
        node('pn', 'FileNode'),
        relation('out', '', 'name', { active: true }),
        node('na', 'Property'),
      ])
      .match([
        node('pn'),
        relation('in', '', 'parent', { active: true }),
        node('fv', 'FileVersion'),
      ])
      .match([
        node('p'),
        relation('out', '', 'mouStart', { active: true }),
        node('ms', 'Property'),
      ])
      .match([
        node('p'),
        relation('out', '', 'mouEnd', { active: true }),
        node('me', 'Property'),
      ])
      .match([
        node('p'),
        relation('out', '', 'step', { active: true }),
        node('s', 'Property'),
      ])
      .match([
        node('e'),
        relation('out', '', 'startDateOverride', { active: true }),
        node('so', 'Property'),
      ])
      .match([
        node('e'),
        relation('out', '', 'endDateOverride', { active: true }),
        node('eo', 'Property'),
      ])
      .match([
        node('e'),
        relation('out', '', 'report', { active: true }),
        node('rn', 'ProgressReport'),
      ])
      .raw(`where not na.value =~ "PNP"`)
      .return(
        'na.value as pnpName, e.id as engagementId, p.id as projectId, ms.value as mouStart, me.value as mouEnd, so.value as startDateOverride, eo.value as endDateOverride, s.value as step, fv.id as fileVersionId'
      )
      .orderBy('fv.createdAt', 'DESC')
      .limit(1)
      .asResult<{
        pnpName: string;
        engagementId: ID;
        projectId: ID;
        mouStart: any;
        mouEnd: any;
        startDateOverride: any;
        endDateOverride: any;
        step: string;
        fileVersionId: ID;
      }>()
      .run();

    const mapped = res.map((i) => {
      const { year, quarter } = this.pnp.parseYearAndQuarter(i.pnpName);
      return { ...i, year, quarter };
    });

    for (const {
      year: fileNameYear,
      quarter: fileNameQuarter,
      engagementId,
      pnpName,
      projectId,
      mouStart,
      mouEnd,
      startDateOverride,
      endDateOverride,
      step,
      fileVersionId,
    } of mapped) {
      const { extractedYear, extractedQuarter } =
        !fileNameYear || !fileNameQuarter
          ? await this.pnp.extractFyAndQuarter(
              { uploadId: fileVersionId },
              session
            )
          : { extractedYear: 0, extractedQuarter: 0 };

      const year = fileNameYear || extractedYear;
      const quarter = fileNameQuarter || extractedQuarter;
      if (!year || !quarter) {
        this.logger.log({
          message: 'no year or quarter',
          engagementId,
          projectId,
          step,
          pnpName,
          year,
          quarter,
        });
        continue;
      }

      const startDate = `${quarter === 1 ? year - 1 : year}-${
        quarter === 1
          ? '10'
          : quarter === 2
          ? '01'
          : quarter === 3
          ? '04'
          : '07'
      }-01`;

      const {
        neo4jStart,
      } = (await this.db
        .query()
        .raw(
          `match(:Engagement {id: $id})-[:report]->(:ProgressReport)-[:start]->(st:Property {value: date($startDate)})`,
          { id: engagementId, startDate }
        )
        .return('st.value as neo4jStart')
        .first()) ?? { neo4jStart: null };
      if (!neo4jStart) {
        this.logger.log({
          message: 'no matching report period',
          engagementId,
          projectId,
          mouStart,
          mouEnd,
          startDateOverride,
          endDateOverride,
          step,
          pnpName,
          year,
          quarter,
          startDate,
        });
      }
    }

    // if we have a P&P that matches a reporting period, move it. otherwise just keep it where it is.

    // sometimes P&Ps are brought over from other projects–– like project3 ––> project4. in these cases, we should put them on the planning card (the defined place where P&Ps were uploaded previously)
    // other times they are submitted late for the last reporting period when a project is completed (per Sue). in these cases we need to add them for that last period

    // const mapped = pnpNames.map((n: string) => {
    //   return this.pnp.parseYearAndQuarter(n);
    // });

    // this.logger.log(res);
    // just need to grab the main file node and replace that, then you don't worry about individual versions
    // 1. grab pnp file version nodes, detach from pnp file node and attach them to correct periodic report file node
    // -- use pnp extract code to grab FY/Q from file name to determine correct periodic report file node
    // 2. grab most recent pnp data and attach it to
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
