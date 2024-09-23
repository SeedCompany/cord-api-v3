import { Injectable } from '@nestjs/common';
import { Session, UnsecuredDto } from '~/common';
import { Privileges } from '../authorization';
import { ProgressReport, ProgressReportListInput } from './dto';
import { ProgressReportRepository } from './progress-report.repository';

@Injectable()
export class ProgressReportService {
  constructor(
    private readonly repo: ProgressReportRepository,
    private readonly privileges: Privileges,
  ) {}

  async list(input: ProgressReportListInput, session: Session) {
    const results = await this.repo.list(input, session);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto, session)),
      canRead: true,
      canCreate: false,
    };
  }

  private secure(
    dto: UnsecuredDto<ProgressReport>,
    session: Session,
  ): ProgressReport {
    return this.privileges.for(session, ProgressReport).secure(dto);
  }
}
