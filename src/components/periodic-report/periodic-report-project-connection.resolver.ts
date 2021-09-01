import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, Session } from '../../common';
import { IProject, Project } from '../project/dto';
import {
  PeriodicReportListInput,
  ReportType,
  SecuredPeriodicReport,
  SecuredPeriodicReportList,
} from './dto';
import { PeriodicReportService } from './periodic-report.service';

@Resolver(IProject)
export class PeriodicReportProjectConnectionResolver {
  constructor(private readonly service: PeriodicReportService) {}

  @ResolveField(() => SecuredPeriodicReportList)
  async financialReports(
    @AnonSession() session: Session,
    @Parent() project: Project,
    @Args({
      name: 'input',
      type: () => PeriodicReportListInput,
      defaultValue: PeriodicReportListInput.defaultVal,
    })
    input: PeriodicReportListInput
  ): Promise<SecuredPeriodicReportList> {
    return this.service.list(project.id, ReportType.Financial, input, session);
  }

  @ResolveField(() => SecuredPeriodicReportList)
  async narrativeReports(
    @AnonSession() session: Session,
    @Parent() project: Project,
    @Args({
      name: 'input',
      type: () => PeriodicReportListInput,
      defaultValue: PeriodicReportListInput.defaultVal,
    })
    input: PeriodicReportListInput
  ): Promise<SecuredPeriodicReportList> {
    return this.service.list(project.id, ReportType.Narrative, input, session);
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
