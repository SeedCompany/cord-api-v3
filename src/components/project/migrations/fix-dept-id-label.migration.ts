import { BaseMigration, Migration } from '~/core/database';

@Migration('2025-04-02T11:00:01')
export class FixDeptIdLabelMigration extends BaseMigration {
  async up() {
    await this.db.query().raw`
      match ()-[:departmentId { active: false }]-(node:Property)
      remove node:Property:DepartmentId
      set node:Deleted_Property:Deleted_DepartmentId
      return count(node)
    `.executeAndLogStats();
    await this.db.query().raw`
      match ()-[:departmentId { active: true }]-(node:Property)
      set node:DepartmentId
      return count(node)
    `.executeAndLogStats();
  }
}
