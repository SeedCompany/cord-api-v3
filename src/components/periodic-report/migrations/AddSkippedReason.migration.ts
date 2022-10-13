import { BaseMigration, Migration } from '~/core';
import { IPeriodicReport } from '../dto';

@Migration('2021-09-28T14:46:26')
export class AddSkippedReason extends BaseMigration {
  async up() {
    await this.addProperty(IPeriodicReport, 'skippedReason', null);
  }
}
