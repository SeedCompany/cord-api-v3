import { BaseMigration, Migration } from '~/core/database';

@Migration('2024-06-21T09:00:00')
export class AddUserNameLabelMigration extends BaseMigration {
  async up() {
    await this.db.query().raw`
      call {
        match ()-[:realFirstName { active: true }]->(node:Property) return node
        union
        match ()-[:realLastName { active: true }]->(node:Property) return node
        union
        match ()-[:displayFirstName { active: true }]->(node:Property) return node
        union
        match ()-[:displayLastName { active: true }]->(node:Property) return node
      }
      set node:UserName
    `.executeAndLogStats();
  }
}
