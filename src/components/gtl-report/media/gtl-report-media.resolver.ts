import {
  Args,
  Mutation,
  Parent,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { type ID, IdArg } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { FileNodeLoader, resolveDefinedFile } from '../../file';
import { SecuredFile } from '../../file/dto';
import { Media } from '../../file/media/media.dto';
import { MediaLoader } from '../../file/media/media.loader';
import { PeriodicReportLoader } from '../../periodic-report';
import {
  GTLReport,
  GtlReportMedia,
  UpdateGtlReportMedia,
  UploadGtlReportMedia,
} from '../dto';
import { GtlReportMediaService } from './gtl-report-media.service';

/**
 * Photos, video and audio on a GTL quarterly report.
 *
 * The mutations return the report rather than the media so the client's cached
 * list refreshes from one round trip — the same shape Momentum's media
 * mutations use.
 */
@Resolver(GTLReport)
export class GtlReportMediaConnectionResolver {
  constructor(private readonly service: GtlReportMediaService) {}

  @ResolveField(() => [GtlReportMedia], {
    description: 'Photos, video and audio uploaded for this quarter.',
  })
  async media(@Parent() report: GTLReport): Promise<GtlReportMedia[]> {
    return await this.service.listForReport(report.id as ID<'GTLReport'>);
  }

  @Mutation(() => GTLReport)
  async uploadGtlReportMedia(
    @Args('input') input: UploadGtlReportMedia,
    @Loader(() => PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ) {
    await this.service.upload(input);
    return await reports.load(input.report);
  }

  @Mutation(() => GtlReportMedia)
  async updateGtlReportMedia(@Args('input') input: UpdateGtlReportMedia) {
    return await this.service.update(input);
  }

  @Mutation(() => GTLReport)
  async deleteGtlReportMedia(
    @IdArg() id: ID<'GtlReportMedia'>,
    @Loader(() => PeriodicReportLoader) reports: LoaderOf<PeriodicReportLoader>,
  ) {
    const reportId = await this.service.delete(id);
    return await reports.load(reportId);
  }
}

@Resolver(GtlReportMedia)
export class GtlReportMediaResolver {
  @ResolveField(() => Media, { nullable: true })
  async media(
    @Parent() media: GtlReportMedia,
    @Loader(() => MediaLoader) mediaLoader: LoaderOf<MediaLoader>,
  ): Promise<Media | null> {
    // Null until the upload's first FileVersion lands and the media sidecar is
    // detected — an audio file with no waveform yet is not an error.
    return media.media ? await mediaLoader.load(media.media) : null;
  }

  @ResolveField(() => SecuredFile)
  async file(
    @Parent() media: GtlReportMedia,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>,
  ): Promise<SecuredFile> {
    // The shared helper, rather than a direct load: it narrows the FileNode
    // union to a File, and returns undefined for a DefinedFile that has no
    // version yet — which a direct load throws on.
    return await resolveDefinedFile(files, {
      canRead: true,
      canEdit: true,
      value: media.file,
    });
  }
}
