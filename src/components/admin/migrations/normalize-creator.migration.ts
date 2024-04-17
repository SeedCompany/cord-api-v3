import { BaseMigration, Migration } from '~/core/database';

@Migration('2024-04-16T19:00:00')
export class NormalizeCreatorMigration extends BaseMigration {
  async up() {
    // Handle RootUser first specially.
    // Since denormalized creator IDs for RootUser currently reference a non-existent user ID
    await this.db.query().raw`
      match (user:RootUser)
      match (bn)-[r:creator { active: true }]->(oldCreatorProp:Property)
      where not exists { (:User { id: oldCreatorProp.value }) }
      create (bn)-[:creator { active: true, createdAt: r.createdAt }]->(user)
      detach delete oldCreatorProp
    `.executeAndLogStats();

    await this.db.query().raw`
      match (bn)-[r:creator { active: true }]->(oldCreatorProp:Property)
      with bn, r, oldCreatorProp
      match (user:User { id: oldCreatorProp.value })
      create (bn)-[:creator { active: true, createdAt: r.createdAt }]->(user)
      detach delete oldCreatorProp
    `.executeAndLogStats();
  }
}
