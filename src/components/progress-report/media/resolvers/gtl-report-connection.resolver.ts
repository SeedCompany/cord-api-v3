import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ListArg, NotFoundException } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { GTLReport } from '../../../gtl-report/dto';
import {
  ProgressReportMediaListInput as ListArgs,
  ProgressReportMedia as ReportMedia,
  ProgressReportMediaList as ReportMediaList,
} from '../dto';
import { ProgressReportFeaturedMediaLoader } from '../progress-report-featured-media.loader';
import { ProgressReportMediaService } from '../progress-report-media.service';

/**
 * `GTLReport.media` / `GTLReport.featuredMedia` — the same fields a
 * ProgressReport has, backed by the same loader and service. Declared on the
 * concrete type, not on `IPeriodicReport`, so Financial/Narrative reports
 * (which hang off a project, not an engagement) do not grow a media field.
 */
@Resolver(GTLReport)
export class ProgressReportMediaGtlReportConnectionResolver {
  constructor(private readonly service: ProgressReportMediaService) {}

  @ResolveField(() => ReportMedia, {
    description: 'A shortcut to get the featured media for investors',
    nullable: true,
  })
  async featuredMedia(
    @Parent() report: GTLReport,
    @Loader(() => ProgressReportFeaturedMediaLoader)
    loader: LoaderOf<ProgressReportFeaturedMediaLoader>,
  ): Promise<ReportMedia | null> {
    try {
      return await loader.load(report.id);
    } catch (e) {
      if (e instanceof NotFoundException) {
        return null;
      }
      throw e;
    }
  }

  @ResolveField(() => ReportMediaList)
  async media(
    @Parent() report: GTLReport,
    @ListArg(ListArgs) input: ListArgs,
  ): Promise<ReportMediaList> {
    return await this.service.listForReport(report, input);
  }
}
