import { Injectable } from '@nestjs/common';
import {
  generateId,
  IdOf,
  NotImplementedException,
  Session,
  UnsecuredDto,
} from '~/common';
import { DbTypeOf, ResourceLoader } from '~/core';
import { Privileges } from '../../authorization';
import { FileService } from '../../file';
import { MediaService } from '../../file/media/media.service';
import { ProgressReport as Report } from '../dto';
import {
  ProgressReportMediaListArgs as ListArgs,
  ProgressReportMedia as ReportMedia,
  ProgressReportMediaList as ReportMediaList,
  UpdateProgressReportMedia as UpdateMedia,
  UploadProgressReportMedia as UploadMedia,
} from './media.dto';
import { ProgressReportMediaLoader } from './progress-report-media.loader';
import { ProgressReportMediaRepository } from './progress-report-media.repository';

@Injectable()
export class ProgressReportMediaService {
  constructor(
    private readonly privileges: Privileges,
    private readonly files: FileService,
    private readonly mediaService: MediaService,
    private readonly resources: ResourceLoader,
    private readonly repo: ProgressReportMediaRepository,
  ) {}

  async listForReport(
    report: Report,
    args: ListArgs,
    session: Session,
  ): Promise<ReportMediaList> {
    const privileges = this.privileges.for(session, ReportMedia);
    const rows = await this.repo.listForReport(report, args, session);
    return {
      report,
      ...rows,
      items: rows.items.map((row) => privileges.secure(this.dbRowToDto(row))),
    };
  }

  // TODO change to VGroup.id/items
  async listOfRelated(
    media: ReportMedia,
    session: Session,
  ): Promise<readonly ReportMedia[]> {
    throw new NotImplementedException().with(media, session);
  }

  async readMany(ids: ReadonlyArray<IdOf<ReportMedia>>, session: Session) {
    const row = await this.repo.readMany(ids, session);
    return row.map((row) =>
      this.privileges.for(session, ReportMedia).secure(this.dbRowToDto(row)),
    );
  }

  async upload(input: UploadMedia, session: Session) {
    const report = await this.resources.load(Report, input.reportId);

    this.privileges.for(session, Report, report).verifyCan('create', 'media');

    const initialDto = await this.repo.create(input, session);

    const fileId = await generateId();
    await this.files.createDefinedFile(
      fileId,
      input.file.name,
      session,
      initialDto.id,
      'file', // relation name
      input.file,
      'file', // input path for exceptions
      ReportMedia.PublicVariants.has(input.variant.key),
    );
  }

  async update(input: UpdateMedia, session: Session): Promise<ReportMedia> {
    const { id, category, ...rest } = input;

    const loader = await this.resources.getLoader(ProgressReportMediaLoader);
    const existing = await loader.load(id);

    this.privileges.for(session, ReportMedia, existing).verifyCan('edit');

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

    return updated;
  }

  async delete(id: IdOf<ReportMedia>, session: Session) {
    const media = await this.repo.readOne(id, session);
    this.privileges
      .for(session, ReportMedia, this.dbRowToDto(media))
      .verifyCan('delete');

    await this.repo.deleteNode(id);
    if (await this.repo.isVariantGroupEmpty(media.variantGroup)) {
      await this.repo.deleteNode(media.variantGroup);
    }

    return media.report;
  }

  private dbRowToDto(row: DbTypeOf<ReportMedia>): UnsecuredDto<ReportMedia> {
    return {
      ...row,
      variant: ReportMedia.Variants.byKey(row.variant),
    };
  }
}
