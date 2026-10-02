import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { type ID, IdArg } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { Privileges } from '../../../authorization';
import { Media } from '../../../file/media/media.dto';
import { MediaLoader } from '../../../file/media/media.loader';
import { GTLReport } from '../../../gtl-report/dto';
import { PeriodicReportLoader } from '../../../periodic-report';
import { ProgressReport } from '../../dto';
import {
  ProgressReportMedia as ReportMedia,
  ReuseProgressReportMedia as ReuseMedia,
  UpdateProgressReportMedia as UpdateMedia,
  UploadProgressReportMedia as UploadMedia,
} from '../dto';
import { ProgressReportMediaService } from '../progress-report-media.service';

const reuseDescription = stripIndent`
  Copy an existing media item into another variant of its variant group.

  The file, category, caption and alt text are copied; the copy is a new item
  with its own file. Fails if the group already has that variant.
`;

/**
 * The mutations come in two sets that differ only in the report kind they
 * return: \`…ProgressReportMedia\` for ProgressReports and \`…GtlReportMedia\`
 * for GTLReports. Each refuses an id of the other kind, so a GTL report is
 * never serialized as a ProgressReport (or the reverse). The inputs are shared.
 */
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

  // ─── Progress reports ──────────────────────────────────────────────────────

  @Mutation(() => ProgressReport)
  async uploadProgressReportMedia(
    @Args('input') input: UploadMedia,
    @Loader(() => PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ) {
    const reportId = await this.service.upload(input, 'Progress');
    return await reports.load(reportId);
  }

  @Mutation(() => ProgressReport, { description: reuseDescription })
  async reuseProgressReportMedia(
    @Args('input') input: ReuseMedia,
    @Loader(() => PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ) {
    const reportId = await this.service.reuse(input, 'Progress');
    return await reports.load(reportId);
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
    const reportId = await this.service.delete(id, 'Progress');
    return await reports.load(reportId);
  }

  // ─── GTL reports ───────────────────────────────────────────────────────────

  @Mutation(() => GTLReport)
  async uploadGtlReportMedia(
    @Args('input') input: UploadMedia,
    @Loader(() => PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ) {
    const reportId = await this.service.upload(input, 'GTL');
    return await reports.load(reportId);
  }

  @Mutation(() => GTLReport, { description: reuseDescription })
  async reuseGtlReportMedia(
    @Args('input') input: ReuseMedia,
    @Loader(() => PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ) {
    const reportId = await this.service.reuse(input, 'GTL');
    return await reports.load(reportId);
  }

  @Mutation(() => GTLReport)
  async deleteGtlReportMedia(
    @IdArg() id: ID<ReportMedia>,
    @Loader(() => PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ) {
    const reportId = await this.service.delete(id, 'GTL');
    return await reports.load(reportId);
  }
}
