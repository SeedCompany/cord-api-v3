import { BaseMigration, Migration } from '~/core/database';

@Migration('2024-06-07T12:00:00')
export class AddActorLabelMigration extends BaseMigration {
  async up() {
    await this.db.query().raw`
      match (n)
      where n:User or n:SystemAgent
      set n:Actor
      return count(n)
    `.executeAndLogStats();
  }
}
