import { Injectable } from '@nestjs/common';
import { type UnsecuredDto } from '~/common';
import { Privileges } from '../authorization';
import { ProgressReport, type ProgressReportListInput } from './dto';
import { ProgressReportRepository } from './progress-report.repository';

@Injectable()
export class ProgressReportService {
  constructor(
    private readonly repo: ProgressReportRepository,
    private readonly privileges: Privileges,
  ) {}

  async list(input: ProgressReportListInput) {
    const results = await this.repo.list(input);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto)),
      canRead: true,
      canCreate: false,
    };
  }

  private secure(dto: UnsecuredDto<ProgressReport>): ProgressReport {
    return this.privileges.for(ProgressReport).secure(dto);
  }
}
