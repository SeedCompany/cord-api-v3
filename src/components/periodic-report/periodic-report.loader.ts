import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { OrderedNestDataLoader } from '../../core';
import { PeriodicReport } from './dto';
import { PeriodicReportService } from './periodic-report.service';

@Injectable({ scope: Scope.REQUEST })
export class PeriodicReportLoader extends OrderedNestDataLoader<PeriodicReport> {
  constructor(private readonly periodicReports: PeriodicReportService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.periodicReports.readMany(ids, this.session);
  }
}
