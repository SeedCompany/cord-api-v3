import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, ListArg, Session } from '../../common';
import { Loader, LoaderOf } from '../../core';
import {
  PeriodicReportLoader,
  PeriodicReportService,
} from '../periodic-report';
import { IProject, Project } from '../project/dto';
import {
  PeriodicReportListInput,
  ReportType,
  SecuredPeriodicReport,
  SecuredPeriodicReportList,
} from './dto';

@Resolver(IProject)
export class PeriodicReportProjectConnectionResolver {
  constructor(private readonly service: PeriodicReportService) {}

  @ResolveField(() => SecuredPeriodicReportList)
  async financialReports(
    @AnonSession() session: Session,
    @Parent()
    project: Project,
    @ListArg(PeriodicReportListInput) input: PeriodicReportListInput,
    @Loader(PeriodicReportLoader)
    periodicReports: LoaderOf<PeriodicReportLoader>
  ): Promise<SecuredPeriodicReportList> {
    const list = await this.service.list(session, {
      ...input,
      parent: project.id,
      type: ReportType.Financial,
    });
    periodicReports.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredPeriodicReportList)
  async narrativeReports(
    @AnonSession() session: Session,
    @Parent() project: Project,
    @ListArg(PeriodicReportListInput) input: PeriodicReportListInput,
    @Loader(PeriodicReportLoader)
    periodicReports: LoaderOf<PeriodicReportLoader>
  ): Promise<SecuredPeriodicReportList> {
    const list = await this.service.list(session, {
      ...input,
      parent: project.id,
      type: ReportType.Narrative,
    });
    periodicReports.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredPeriodicReport, {
    description:
      'The financial report currently due. This is the period that most recently completed.',
  })
  async currentFinancialReportDue(
    @AnonSession() session: Session,
    @Parent() project: Project
  ): Promise<SecuredPeriodicReport> {
    const value = await this.service.getCurrentReportDue(
      project.id,
      ReportType.Financial,
      session
    );
    return {
      canRead: true,
      canEdit: false,
      value,
    };
  }

  @ResolveField(() => SecuredPeriodicReport, {
    description:
      'The narrative report currently due. This is the period that most recently completed.',
  })
  async currentNarrativeReportDue(
    @AnonSession() session: Session,
    @Parent() project: Project
  ): Promise<SecuredPeriodicReport> {
    const value = await this.service.getCurrentReportDue(
      project.id,
      ReportType.Narrative,
      session
    );
    return {
      canRead: true,
      canEdit: false,
      value,
    };
  }

  @ResolveField(() => SecuredPeriodicReport, {
    description:
      'The financial report due next. This is the period currently in progress.',
  })
  async nextFinancialReportDue(
    @AnonSession() session: Session,
    @Parent() project: Project
  ): Promise<SecuredPeriodicReport> {
    const value = await this.service.getNextReportDue(
      project.id,
      ReportType.Financial,
      session
    );
    return {
      canRead: true,
      canEdit: false,
      value,
    };
  }

  @ResolveField(() => SecuredPeriodicReport, {
    description:
      'The narrative report due next. This is the period currently in progress.',
  })
  async nextNarrativeReportDue(
    @AnonSession() session: Session,
    @Parent() project: Project
  ): Promise<SecuredPeriodicReport> {
    const value = await this.service.getNextReportDue(
      project.id,
      ReportType.Narrative,
      session
    );
    return {
      canRead: true,
      canEdit: false,
      value,
    };
  }
}
