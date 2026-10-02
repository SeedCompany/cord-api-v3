import { Injectable } from '@nestjs/common';
import {
  generateId,
  type ID,
  InputException,
  NotImplementedException,
  type UnsecuredDto,
  type Variant,
} from '~/common';
import { type DbTypeOf } from '~/core/database';
import { Hooks } from '~/core/hooks';
import { ResourceLoader } from '~/core/resources';
import { ResourceMutatedHook } from '../../audit/resource-mutated.hook';
import { Privileges, withVariant } from '../../authorization';
import { FileService } from '../../file';
import { MediaLoader } from '../../file/media/media.loader';
import { MediaService } from '../../file/media/media.service';
import { type GTLReport } from '../../gtl-report/dto';
import { contextOf } from '../../gtl-report/privilege-context';
import { IPeriodicReport } from '../../periodic-report/dto/periodic-report.dto';
import {
  isEngagementParented,
  type EngagementParentedReportType as ReportKind,
} from '../../periodic-report/dto/report-type.enum';
import { type ProgressReport } from '../dto';
import {
  type ProgressReportMediaListInput as ListArgs,
  type MediaReportId,
  type MediaVariant,
  ProgressReportMedia as ReportMedia,
  type ProgressReportMediaList as ReportMediaList,
  type ReuseProgressReportMedia as ReuseMedia,
  type UpdateProgressReportMedia as UpdateMedia,
  type UploadProgressReportMedia as UploadMedia,
} from './dto';
import { ProgressReportMediaLoader } from './progress-report-media.loader';
import { ProgressReportMediaRepository } from './progress-report-media.repository';

/**
 * How many live media items a report may hold in the public ("Investor
 * Communications", key `published`) slot. The investor report shows a fixed
 * strip of images, so the slot is capped rather than open-ended. The other
 * variants are the team's working set and stay uncapped.
 */
const MAX_INVESTOR_MEDIA_PER_REPORT = 4;

const reportKindLabels: Record<ReportKind, string> = {
  Progress: 'progress',
  GTL: 'GTL',
};

/**
 * Media on engagement reports — ProgressReports and GTLReports alike. One
 * resource serves both kinds; each mutation names the kind it is for (its
 * GraphQL return type) so an id of the other kind is refused up front rather
 * than serialized through the wrong report type.
 */
@Injectable()
export class ProgressReportMediaService {
  constructor(
    private readonly privileges: Privileges,
    private readonly files: FileService,
    private readonly mediaService: MediaService,
    private readonly resources: ResourceLoader,
    private readonly repo: ProgressReportMediaRepository,
    private readonly hooks: Hooks,
  ) {}

  async listForReport(
    report: ProgressReport | GTLReport,
    args: ListArgs,
  ): Promise<ReportMediaList> {
    const privileges = this.privileges.for(ReportMedia);
    const rows = await this.repo.listForReport(report, args);
    return {
      report,
      ...rows,
      items: rows.items.map((row) => privileges.secure(this.dbRowToDto(row))),
    };
  }

  // TODO change to VGroup.id/items
  async listOfRelated(media: ReportMedia): Promise<readonly ReportMedia[]> {
    throw new NotImplementedException().with(media);
  }

  async readMany(ids: ReadonlyArray<ID<ReportMedia>>) {
    const row = await this.repo.readMany(ids);
    return row.map((row) =>
      this.privileges.for(ReportMedia).secure(this.dbRowToDto(row)),
    );
  }

  async readFeaturedOfReport(ids: readonly MediaReportId[]) {
    const rows = await this.repo.readFeaturedOfReport(ids);
    return rows.map((row) =>
      this.privileges.for(ReportMedia).secure(this.dbRowToDto(row)),
    );
  }

  /**
   * Attach an uploaded file to the report as a new media item.
   * Returns the report's id, for the resolver to hand back.
   */
  async upload(input: UploadMedia, kind: ReportKind): Promise<MediaReportId> {
    const report = await this.loadReportForMedia(input.report, kind);

    this.privileges
      .for(
        ReportMedia,
        withVariant(contextOf<ReportMedia>(report), input.variant),
      )
      .verifyCan('create');
    await this.verifyInvestorCap(report.id, input.variant);

    // Generate the file id up front so the repo can store the FK.
    const fileId = await generateId<ID<'File'>>();
    const initialDto = await this.repo.create(input, fileId);

    await this.files.createDefinedFile(
      fileId,
      input.file.name,
      initialDto.id,
      'file',
      input.file,
      ReportMedia.PublicVariants.has(input.variant.key),
    );

    await this.hooks.run(
      new ResourceMutatedHook('ProgressReportMedia', initialDto.id, 'Create'),
    );
    return report.id;
  }

  /**
   * Copy an existing media item into another variant of the SAME variant
   * group, on the same report: the file's bytes, its category and its
   * caption/alt text all carry over. The copy is a new item with its own
   * file, so editing one later never changes the other.
   *
   * Typical use: an image uploaded as a `draft` is picked for the investor
   * report, so Marketing reuses it into `published`.
   *
   * Returns the report's id, for the resolver to hand back.
   */
  async reuse(input: ReuseMedia, kind: ReportKind): Promise<MediaReportId> {
    const [mediaItems, mediaLoader] = await Promise.all([
      this.resources.getLoader(ProgressReportMediaLoader),
      this.resources.getLoader(MediaLoader),
    ]);
    const source = await mediaItems.load(input.id);
    this.privileges.for(ReportMedia, source).verifyCan('read');

    const report = await this.loadReportForMedia(source.report, kind);
    this.privileges
      .for(
        ReportMedia,
        withVariant(contextOf<ReportMedia>(report), input.variant),
      )
      .verifyCan('create');
    await this.verifyInvestorCap(report.id, input.variant);

    const [sourceFile, sourceMedia] = await Promise.all([
      this.files.getFile(source.file),
      mediaLoader.load(source.media),
    ]);
    const sourceVersion = await this.files.getFileVersion(
      sourceFile.latestVersionId,
    );

    const fileId = await generateId<ID<'File'>>();
    // Same variant group: the repository's "already has this variant" check
    // (and the unique index behind it) is what refuses a copy into a held slot.
    const created = await this.repo.create(
      {
        report: source.report,
        variant: input.variant,
        category: source.category,
        variantGroup: source.variantGroup,
      },
      fileId,
    );

    const copiedUpload = await this.files.copyFileVersion(sourceVersion.id);
    await this.files.createDefinedFile(
      fileId,
      sourceVersion.name,
      created.id,
      'file',
      {
        upload: copiedUpload,
        name: sourceVersion.name,
        mimeType: sourceVersion.mimeType,
        media: {
          altText: sourceMedia.altText,
          caption: sourceMedia.caption,
        },
      },
      ReportMedia.PublicVariants.has(input.variant.key),
    );

    await this.hooks.run(
      new ResourceMutatedHook('ProgressReportMedia', created.id, 'Create'),
    );
    return report.id;
  }

  async update(input: UpdateMedia): Promise<ReportMedia> {
    const { id, category, ...rest } = input;

    const loader = await this.resources.getLoader(ProgressReportMediaLoader);
    const existing = await loader.load(id);

    this.privileges.for(ReportMedia, existing).verifyCan('edit');

    await Promise.all([
      this.repo.update(input),
      this.mediaService.updateUserMetadata({
        id: existing.media,
        ...rest,
      }),
    ]);

    const updated = {
      ...existing,
      category: category !== undefined ? category : existing.category,
    };
    loader.prime(id, updated);

    await this.hooks.run(
      new ResourceMutatedHook(
        'ProgressReportMedia',
        input.id,
        'Update',
        category !== undefined ? { category } : undefined,
      ),
    );

    return updated;
  }

  /** Returns the report's id, for the resolver to hand back. */
  async delete(id: ID<ReportMedia>, kind: ReportKind): Promise<MediaReportId> {
    const media = await this.repo.readOne(id);
    this.privileges
      .for(ReportMedia, this.dbRowToDto(media))
      .verifyCan('delete');
    const report = await this.loadReportForMedia(media.report, kind);

    await this.repo.deleteNode(id);
    await this.repo.deleteVariantGroupIfEmpty(media.variantGroup);

    await this.hooks.run(
      new ResourceMutatedHook('ProgressReportMedia', id, 'Delete'),
    );

    return report.id;
  }

  /**
   * Load the report media is being attached to, refusing anything that is not
   * an engagement report (Financial/Narrative hang off a project and have no
   * media) and anything that is not the kind the calling mutation is for.
   * The loader applies no type check of its own, so this is where it happens.
   */
  private async loadReportForMedia(id: MediaReportId, kind: ReportKind) {
    const report = await this.resources.load(IPeriodicReport, id);
    if (!isEngagementParented(report.type)) {
      throw new InputException(
        'Media can only be attached to engagement reports',
        'report',
      );
    }
    if (report.type !== kind) {
      throw new InputException(
        `This is a ${reportKindLabels[report.type]} report; use the ${
          reportKindLabels[kind]
        } report media mutations`,
        'report',
      );
    }
    return report;
  }

  /**
   * The public slot holds at most {@link MAX_INVESTOR_MEDIA_PER_REPORT} live
   * items per report. Runs after the permission check, and only for a public
   * variant; locks the report row first so two concurrent placements cannot
   * both count under the cap and both land.
   */
  private async verifyInvestorCap(
    reportId: MediaReportId,
    variant: Variant<MediaVariant>,
  ) {
    if (!ReportMedia.PublicVariants.has(variant.key)) {
      return;
    }
    await this.repo.lockReport(reportId);
    const live = await this.repo.countLiveInVariant(reportId, variant.key);
    if (live >= MAX_INVESTOR_MEDIA_PER_REPORT) {
      throw new InputException(
        `A report may not have more than ${MAX_INVESTOR_MEDIA_PER_REPORT} media items in the Investor Communications slot`,
        'variant',
      );
    }
  }

  private dbRowToDto(row: DbTypeOf<ReportMedia>): UnsecuredDto<ReportMedia> {
    return {
      ...row,
      variant: ReportMedia.Variants.byKey(row.variant),
    };
  }
}
