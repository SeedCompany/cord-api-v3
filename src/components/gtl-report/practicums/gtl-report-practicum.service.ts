import { Injectable } from '@nestjs/common';
import {
  type ID,
  InputException,
  NotFoundException,
  type UnsecuredDto,
} from '~/common';
import { Privileges } from '../../authorization';
import {
  type CreateGtlReportPracticum,
  GtlReportPracticum,
  type UpdateGtlReportPracticum,
} from '../dto';
import { contextOf } from '../privilege-context';
import { GtlReportPracticumRepository } from './gtl-report-practicum.repository';

@Injectable()
export class GtlReportPracticumService {
  constructor(
    private readonly repo: GtlReportPracticumRepository,
    private readonly privileges: Privileges,
  ) {}

  secure(dto: UnsecuredDto<GtlReportPracticum>): GtlReportPracticum {
    // The DTO carries its own `scope` and `sensitivity`, so it is its own
    // privilege context.
    return this.privileges.for(GtlReportPracticum).secure(dto);
  }

  async readOne(id: ID): Promise<GtlReportPracticum> {
    return this.secure(await this.repo.readOne(id));
  }

  async readMany(ids: readonly ID[]): Promise<GtlReportPracticum[]> {
    const dtos = await this.repo.readMany(ids);
    return dtos.map((dto) => this.secure(dto));
  }

  async listForReport(reportId: ID): Promise<GtlReportPracticum[]> {
    const dtos = await this.repo.listForReport(reportId);
    return dtos.map((dto) => this.secure(dto));
  }

  async create(input: CreateGtlReportPracticum): Promise<GtlReportPracticum> {
    // Loaded unfiltered, so a non-member is answered with the permission error
    // below rather than "not found". Only live GTL reports qualify.
    const report = await this.repo.readReportContext(input.report);
    if (!report) {
      throw new NotFoundException('Could not find GTL report', 'report');
    }
    this.privileges
      .for(GtlReportPracticum, contextOf<GtlReportPracticum>(report))
      .verifyCan('create');
    await this.verifyMentor(input.mentor);

    const practicum = await this.repo.create(input);
    return this.secure(practicum);
  }

  async update(input: UpdateGtlReportPracticum): Promise<GtlReportPracticum> {
    const existing = await this.repo.readOne(input.id);
    this.privileges.for(GtlReportPracticum, existing).verifyCan('edit');
    await this.verifyMentor(input.mentor);

    const updated = await this.repo.update(input, existing.report.id);
    return this.secure(updated);
  }

  async delete(id: ID): Promise<void> {
    const existing = await this.repo.readOne(id);
    this.privileges.for(GtlReportPracticum, existing).verifyCan('delete');
    await this.repo.delete(id, existing.report.id);
  }

  /**
   * The mentor has to be a real, live user. Checked here so the answer names
   * the field instead of surfacing as a foreign-key violation.
   */
  private async verifyMentor(mentor: ID<'User'> | null | undefined) {
    if (!mentor) return;
    if (!(await this.repo.userExists(mentor))) {
      throw new InputException('Could not find mentor', 'mentor');
    }
  }
}
