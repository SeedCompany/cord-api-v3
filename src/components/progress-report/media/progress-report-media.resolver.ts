import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  AnonSession,
  IdArg,
  IdOf,
  ListArg,
  LoggedInSession,
  NotFoundException,
  Session,
  Variant,
} from '~/common';
import { Loader, LoaderOf } from '~/core';
import { Privileges, withVariant } from '../../authorization';
import { Media } from '../../file';
import { MediaLoader } from '../../file/media/media.loader';
import { PeriodicReportLoader } from '../../periodic-report';
import { ProgressReport } from '../dto';
import {
  ProgressReportMediaListInput as ListArgs,
  ProgressReportMedia as ReportMedia,
  ProgressReportMediaList as ReportMediaList,
  UpdateProgressReportMedia as UpdateMedia,
  UploadProgressReportMedia as UploadMedia,
} from './media.dto';
import { ProgressReportFeaturedMediaLoader } from './progress-report-featured-media.loader';
import { ProgressReportMediaService } from './progress-report-media.service';

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

@Resolver(ReportMediaList)
export class ProgressReportMediaListResolver {
  constructor(private readonly privileges: Privileges) {}

  @ResolveField(() => [Variant], {
    description: 'The variants the requester has access to upload',
  })
  uploadableVariants(
    @Parent() { report }: ReportMediaList,
    @AnonSession() session: Session,
  ): ReadonlyArray<ReportMedia['variant']> {
    const context = report as any; // the report is fine for condition context
    const privileges = this.privileges.for(session, ReportMedia);
    return ReportMedia.Variants.filter((variant) =>
      privileges.forContext(withVariant(context, variant)).can('create'),
    );
  }
}

@Resolver(ReportMedia)
export class ProgressReportMediaResolver {
  constructor(
    private readonly service: ProgressReportMediaService,
    private readonly privileges: Privileges,
  ) {}

  @ResolveField(() => Media)
  async media(
    @Parent() media: ReportMedia,
    @Loader(() => MediaLoader) mediaLoader: LoaderOf<MediaLoader>,
  ): Promise<Media> {
    return await mediaLoader.load(media.media);
  }

  @ResolveField(() => [ReportMedia], {
    description: 'The other media within the variant group',
  })
  async related(
    @Parent() media: ReportMedia,
    @AnonSession() session: Session,
  ): Promise<readonly ReportMedia[]> {
    return await this.service.listOfRelated(media, session);
  }

  @ResolveField(() => Boolean)
  canEdit(
    @Parent() media: ReportMedia,
    @AnonSession() session: Session,
  ): boolean {
    return this.privileges.for(session, ReportMedia, media).can('edit');
  }
}

@Resolver()
export class ProgressReportMediaActionsResolver {
  constructor(private readonly service: ProgressReportMediaService) {}

  @Mutation(() => ProgressReport)
  async uploadProgressReportMedia(
    @Args({ name: 'input' }) input: UploadMedia,
    @LoggedInSession() session: Session,
    @Loader(() => PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ) {
    await this.service.upload(input, session);
    return await reports.load(input.reportId);
  }

  @Mutation(() => ReportMedia)
  async updateProgressReportMedia(
    @Args({ name: 'input' }) input: UpdateMedia,
    @LoggedInSession() session: Session,
  ): Promise<ReportMedia> {
    return await this.service.update(input, session);
  }

  @Mutation(() => ProgressReport)
  async deleteProgressReportMedia(
    @IdArg() id: IdOf<ReportMedia>,
    @LoggedInSession() session: Session,
    @Loader(() => PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ) {
    const reportId = await this.service.delete(id, session);
    return await reports.load(reportId);
  }
}
