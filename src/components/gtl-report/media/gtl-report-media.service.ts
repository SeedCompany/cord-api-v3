import { Injectable } from '@nestjs/common';
import { generateId, type ID, type UnsecuredDto } from '~/common';
import { Privileges } from '../../authorization';
import { FileService } from '../../file';
import {
  GtlReportMedia,
  type UpdateGtlReportMedia,
  type UploadGtlReportMedia,
} from '../dto';
import { GtlReportMediaDrizzleRepository } from './gtl-report-media.drizzle.repository';

@Injectable()
export class GtlReportMediaService {
  constructor(
    private readonly repo: GtlReportMediaDrizzleRepository,
    private readonly privileges: Privileges,
    private readonly files: FileService,
  ) {}

  secure(dto: UnsecuredDto<GtlReportMedia>): GtlReportMedia {
    return this.privileges.for(GtlReportMedia, dto).secure(dto);
  }

  async readMany(ids: ReadonlyArray<ID<'GtlReportMedia'>>) {
    return (await this.repo.readMany(ids)).map((dto) =>
      this.secure(dto as UnsecuredDto<GtlReportMedia>),
    );
  }

  async listForReport(reportId: ID<'GTLReport'>) {
    return (await this.repo.listForReport(reportId)).map((dto) =>
      this.secure(dto as UnsecuredDto<GtlReportMedia>),
    );
  }

  async upload(input: UploadGtlReportMedia) {
    this.privileges.for(GtlReportMedia).verifyCan('create');

    // The file id is generated first so the row can carry it: the DefinedFile
    // is created afterwards and hangs off this media row, so the row has to
    // exist to be its holder. Same order as ProgressReportMediaService.
    const fileId = await generateId<ID<'File'>>();
    const id = await this.repo.create(input, fileId);

    await this.files.createDefinedFile(
      fileId,
      input.file.name,
      id,
      'file',
      input.file,
      // GTL media is not variant-scoped, so there is no "published variant" to
      // gate on. Nothing here is public until the report itself is.
      false,
    );

    return id;
  }

  async update(input: UpdateGtlReportMedia) {
    const existing = await this.repo.readOne(input.id);
    this.privileges
      .for(GtlReportMedia, existing as UnsecuredDto<GtlReportMedia>)
      .verifyCan('edit');
    return this.secure(
      (await this.repo.update(input)) as UnsecuredDto<GtlReportMedia>,
    );
  }

  async delete(id: ID<'GtlReportMedia'>) {
    const existing = await this.repo.readOne(id);
    this.privileges
      .for(GtlReportMedia, existing as UnsecuredDto<GtlReportMedia>)
      .verifyCan('delete');
    await this.repo.delete(id);
    return existing.report.id;
  }
}
