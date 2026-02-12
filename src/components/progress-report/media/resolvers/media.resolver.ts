import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { type ID, IdArg } from '~/common';
import { Loader, type LoaderOf } from '~/core';
import { Privileges } from '../../../authorization';
import { Media } from '../../../file/media/media.dto';
import { MediaLoader } from '../../../file/media/media.loader';
import { PeriodicReportLoader } from '../../../periodic-report';
import { ProgressReport } from '../../dto';
import {
  ProgressReportMedia as ReportMedia,
  UpdateProgressReportMedia as UpdateMedia,
  UploadProgressReportMedia as UploadMedia,
} from '../dto';
import { ProgressReportMediaService } from '../progress-report-media.service';

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
  async related(@Parent() media: ReportMedia): Promise<readonly ReportMedia[]> {
    return await this.service.listOfRelated(media);
  }

  @ResolveField(() => Boolean)
  canEdit(@Parent() media: ReportMedia): boolean {
    return this.privileges.for(ReportMedia, media).can('edit');
  }

  @Mutation(() => ProgressReport)
  async uploadProgressReportMedia(
    @Args('input') input: UploadMedia,
    @Loader(() => PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ) {
    await this.service.upload(input);
    return await reports.load(input.report);
  }

  @Mutation(() => ReportMedia)
  async updateProgressReportMedia(
    @Args('input') input: UpdateMedia,
  ): Promise<ReportMedia> {
    return await this.service.update(input);
  }

  @Mutation(() => ProgressReport)
  async deleteProgressReportMedia(
    @IdArg() id: ID<ReportMedia>,
    @Loader(() => PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ) {
    const reportId = await this.service.delete(id);
    return await reports.load(reportId);
  }
}
