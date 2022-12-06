import { BaseMigration, Migration } from '~/core';
import { ProgressReport, ProgressReportStatus as Status } from '../dto';

@Migration('2022-10-13T11:09:18')
export class AddProgressReportStatusMigration extends BaseMigration {
  async up() {
    // TODO infer starting status based on...end time?
    await this.addProperty(ProgressReport, 'status', Status.NotStarted);
  }
}
