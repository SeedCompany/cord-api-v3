import { Injectable } from '@nestjs/common';
import { type ID, type UnsecuredDto } from '~/common';
import { Privileges } from '../../authorization';
import {
  type CreateGtlReportPracticum,
  GtlReportPracticum,
  type UpdateGtlReportPracticum,
} from '../dto';
import { GtlReportPracticumDrizzleRepository } from './gtl-report-practicum.drizzle.repository';

@Injectable()
export class GtlReportPracticumService {
  constructor(
    private readonly repo: GtlReportPracticumDrizzleRepository,
    private readonly privileges: Privileges,
  ) {}

  secure(dto: UnsecuredDto<GtlReportPracticum>): GtlReportPracticum {
    return this.privileges.for(GtlReportPracticum, dto).secure(dto);
  }

  async readOne(id: ID) {
    return this.secure(await this.repo.readOne(id));
  }

  async readMany(ids: readonly ID[]) {
    return (await this.repo.readMany(ids)).map((dto) => this.secure(dto));
  }

  async listForReport(reportId: ID) {
    return (await this.repo.listForReport(reportId)).map((dto) =>
      this.secure(dto),
    );
  }

  async create(input: CreateGtlReportPracticum) {
    this.privileges.for(GtlReportPracticum).verifyCan('create');
    return this.secure(await this.repo.create(input));
  }

  async update(input: UpdateGtlReportPracticum) {
    const existing = await this.repo.readOne(input.id);
    this.privileges.for(GtlReportPracticum, existing).verifyCan('edit');
    return this.secure(await this.repo.update(input));
  }

  async delete(id: ID) {
    const existing = await this.repo.readOne(id);
    this.privileges.for(GtlReportPracticum, existing).verifyCan('delete');
    await this.repo.delete(id);
  }
}
