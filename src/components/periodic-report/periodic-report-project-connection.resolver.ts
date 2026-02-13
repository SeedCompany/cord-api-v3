import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ListArg } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import {
  PeriodicReportLoader,
  PeriodicReportService,
} from '../periodic-report';
import { IProject, type Project } from '../project/dto';
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
    @Parent()
    project: Project,
    @ListArg(PeriodicReportListInput) input: PeriodicReportListInput,
    @Loader(PeriodicReportLoader)
    periodicReports: LoaderOf<PeriodicReportLoader>,
  ): Promise<SecuredPeriodicReportList> {
    const list = await this.service.list({
      ...input,
      parent: project.id,
      type: ReportType.Financial,
    });
    periodicReports.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredPeriodicReportList)
  async narrativeReports(
    @Parent() project: Project,
    @ListArg(PeriodicReportListInput) input: PeriodicReportListInput,
    @Loader(PeriodicReportLoader)
    periodicReports: LoaderOf<PeriodicReportLoader>,
  ): Promise<SecuredPeriodicReportList> {
    const list = await this.service.list({
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
    @Parent() project: Project,
  ): Promise<SecuredPeriodicReport> {
    const value = await this.service.getCurrentReportDue(
      project.id,
      ReportType.Financial,
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
    @Parent() project: Project,
  ): Promise<SecuredPeriodicReport> {
    const value = await this.service.getCurrentReportDue(
      project.id,
      ReportType.Narrative,
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
    @Parent() project: Project,
  ): Promise<SecuredPeriodicReport> {
    const value = await this.service.getNextReportDue(
      project.id,
      ReportType.Financial,
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
    @Parent() project: Project,
  ): Promise<SecuredPeriodicReport> {
    const value = await this.service.getNextReportDue(
      project.id,
      ReportType.Narrative,
    );
    return {
      canRead: true,
      canEdit: false,
      value,
    };
  }
}
