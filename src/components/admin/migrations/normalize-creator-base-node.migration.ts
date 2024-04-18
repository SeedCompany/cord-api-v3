import { BaseMigration, Migration } from '~/core/database';

@Migration('2024-04-18T09:00:00')
export class NormalizeCreatorBaseNodeMigration extends BaseMigration {
  async up() {
    // Handle RootUser first specially.
    // Since denormalized creator IDs for RootUser currently reference a non-existent user ID
    await this.db.query().raw`
      match (user:RootUser)
      match (bn:BaseNode)
      where bn.creator is not null and not exists { (:User { id: bn.creator }) }
      create (bn)-[:creator { active: true, createdAt: bn.createdAt }]->(user)
      set bn.creator = null
    `.executeAndLogStats();

    await this.db.query().raw`
      match (bn:BaseNode)
      where bn.creator is not null
      match (user:User { id: bn.creator })
      create (bn)-[:creator { active: true, createdAt: bn.createdAt }]->(user)
      set bn.creator = null
    `.executeAndLogStats();
  }
}
