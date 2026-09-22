import { Injectable } from '@nestjs/common';
import {
  generateId,
  type ID,
  InputException,
  NotImplementedException,
  type UnsecuredDto,
} from '~/common';
import { type DbTypeOf } from '~/core/database';
import { Hooks } from '~/core/hooks';
import { ResourceLoader } from '~/core/resources';
import { ResourceMutatedHook } from '../../audit/resource-mutated.hook';
import { Privileges, withVariant } from '../../authorization';
import { FileService } from '../../file';
import { MediaService } from '../../file/media/media.service';
import { ProgressReport as Report } from '../dto';
import {
  type ProgressReportMediaListInput as ListArgs,
  type MediaVariant,
  ProgressReportMedia as ReportMedia,
  type ProgressReportMediaList as ReportMediaList,
  type ReuseProgressReportMedia as ReuseMedia,
  type UpdateProgressReportMedia as UpdateMedia,
  type UploadProgressReportMedia as UploadMedia,
} from './dto';
import { ProgressReportMediaDrizzleRepository } from './progress-report-media.drizzle.repository';
import { ProgressReportMediaLoader } from './progress-report-media.loader';
import { ProgressReportMediaRepository } from './progress-report-media.repository';

// A product decision, not a data invariant — see countByVariant's doc comment
// on the repository. Change this to change the cap; nothing else models it.
const MAX_FEATURED_MEDIA_PER_REPORT = 4;

@Injectable()
export class ProgressReportMediaService {
  constructor(
    private readonly privileges: Privileges,
    private readonly files: FileService,
    private readonly mediaService: MediaService,
    private readonly resources: ResourceLoader,
    private readonly repo: ProgressReportMediaRepository,
    private readonly drizzleRepo: ProgressReportMediaDrizzleRepository,
    private readonly hooks: Hooks,
  ) {}

  /**
   * `upload()` and `reuse()` both call this before creating a row in the
   * published variant — the only variant that reaches investors (see
   * `readFeaturedOfReport`) — so the cap applies the same way regardless of
   * how the item got there.
   */
  private async verifyInvestorReportCap(
    reportId: ID<Report>,
    variantKey: MediaVariant,
  ) {
    // `PublicVariants` is the same "only the last variant reaches an outside
    // audience" fact this file already tests with on upload/reuse — reuse it
    // rather than re-deriving `Variants.at(-1)` a second time here.
    if (!ReportMedia.PublicVariants.has(variantKey)) {
      return;
    }
    const existing = await this.drizzleRepo.countByVariant(
      reportId,
      variantKey,
    );
    if (existing >= MAX_FEATURED_MEDIA_PER_REPORT) {
      throw new InputException(
        `Up to ${MAX_FEATURED_MEDIA_PER_REPORT} media items can be included in the Investor Report`,
        'variant',
      );
    }
  }

  async listForReport(
    report: Report,
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

  async readFeaturedOfReport(ids: ReadonlyArray<ID<Report>>) {
    const rows = await this.repo.readFeaturedOfReport(ids);
    return rows.map((row) =>
      this.privileges.for(ReportMedia).secure(this.dbRowToDto(row)),
    );
  }

  async upload(input: UploadMedia) {
    const report = await this.resources.load(Report, input.report);

    const context = report as any; // the report is fine for condition context
    this.privileges
      .for(ReportMedia, withVariant(context, input.variant))
      .verifyCan('create');
    await this.verifyInvestorReportCap(input.report, input.variant.key);

    // Generate the file id up front so the repo can store the FK (Postgres);
    // the Neo4j repo ignores it and links via the createDefinedFile edge.
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
  }

  /**
   * Duplicate an already-uploaded item into another variant, rather than
   * requiring a fresh upload of the same photo. The copy gets its own
   * File/FileVersion/Media chain (see `FileService.copyFileVersion`), so its
   * caption & category start blank and are editable independently of the
   * source from then on via the normal `update` mutation.
   *
   * Returns the report id, matching `upload()`'s shape: the resolver reloads
   * the report so the client can refresh the whole media list in one round
   * trip, the same way it already does after a fresh upload — this is a new
   * row, not an edit to one already in the list, so the client has nothing
   * to merge it into otherwise.
   */
  async reuse(input: ReuseMedia): Promise<ID<Report>> {
    const loader = await this.resources.getLoader(ProgressReportMediaLoader);
    const source = await loader.load(input.id);
    this.privileges.for(ReportMedia, source).verifyCan('read');

    const report = await this.resources.load(Report, source.report);
    const context = report as any; // the report is fine for condition context
    this.privileges
      .for(ReportMedia, withVariant(context, input.variant))
      .verifyCan('create');
    await this.verifyInvestorReportCap(source.report, input.variant.key);

    const sourceFile = await this.files.getFile(source.file);
    const sourceVersion = await this.files.getFileVersion(
      sourceFile.latestVersionId,
    );

    const fileId = await generateId<ID<'File'>>();
    const initialDto = await this.repo.create(
      {
        report: source.report,
        variant: input.variant,
        category: source.category,
        variantGroup: source.variantGroup,
      },
      fileId,
    );

    const newVersionId = await this.files.copyFileVersion(sourceVersion.id);
    await this.files.createDefinedFile(
      fileId,
      sourceVersion.name,
      initialDto.id,
      'file',
      { upload: newVersionId, mimeType: sourceVersion.mimeType },
      ReportMedia.PublicVariants.has(input.variant.key),
    );

    await this.hooks.run(
      new ResourceMutatedHook('ProgressReportMedia', initialDto.id, 'Create'),
    );

    return source.report;
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

  async delete(id: ID<ReportMedia>) {
    const media = await this.repo.readOne(id);
    this.privileges
      .for(ReportMedia, this.dbRowToDto(media))
      .verifyCan('delete');

    await this.repo.deleteNode(id);
    await this.repo.deleteVariantGroupIfEmpty(media.variantGroup);

    await this.hooks.run(
      new ResourceMutatedHook('ProgressReportMedia', id, 'Delete'),
    );

    return media.report;
  }

  private dbRowToDto(row: DbTypeOf<ReportMedia>): UnsecuredDto<ReportMedia> {
    return {
      ...row,
      variant: ReportMedia.Variants.byKey(row.variant),
    };
  }
}
