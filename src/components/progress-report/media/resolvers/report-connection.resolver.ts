import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import {
  AnonSession,
  IdOf,
  ListArg,
  NotFoundException,
  Session,
} from '~/common';
import { Loader, LoaderOf } from '~/core';
import { ProgressReport } from '../../dto';
import {
  ProgressReportMediaListInput as ListArgs,
  ProgressReportMedia as ReportMedia,
  ProgressReportMediaList as ReportMediaList,
} from '../media.dto';
import { ProgressReportFeaturedMediaLoader } from '../progress-report-featured-media.loader';
import { ProgressReportMediaService } from '../progress-report-media.service';

@Resolver(ProgressReport)
export class ProgressReportMediaProgressReportConnectionResolver {
  constructor(private readonly service: ProgressReportMediaService) {}

  @ResolveField(() => ReportMedia, {
    description: 'A shortcut to get the featured media for investors',
    nullable: true,
  })
  async featuredMedia(
    @Parent() report: ProgressReport,
    @Loader(() => ProgressReportFeaturedMediaLoader)
    loader: LoaderOf<ProgressReportFeaturedMediaLoader>,
  ): Promise<ReportMedia | null> {
    try {
      return await loader.load(report.id as IdOf<ProgressReport>);
    } catch (e) {
      if (e instanceof NotFoundException) {
        return null;
      }
      throw e;
    }
  }

  @ResolveField(() => ReportMediaList)
  async media(
    @Parent() report: ProgressReport,
    @ListArg(ListArgs) input: ListArgs,
    @AnonSession() session: Session,
  ): Promise<ReportMediaList> {
    return await this.service.listForReport(report, input, session);
  }
}
