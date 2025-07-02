import { BaseMigration, Migration } from '~/core/database';
import { UserStatus } from '../dto';

@Migration('2025-07-02T08:00:00')
export class DefaultUserStatusMigration extends BaseMigration {
  async up() {
    await this.db.query().raw`
      match (:User)-[:status]->(prop)
      where prop.value is null
      set prop.value = ${UserStatus.Active}
      return count(prop)
    `.executeAndLogStats();
  }
}
