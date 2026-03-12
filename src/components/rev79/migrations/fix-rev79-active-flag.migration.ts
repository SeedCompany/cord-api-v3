import { BaseMigration, Migration } from '~/core/neo4j';

/**
 * Fixes existing rev79ProjectId and rev79CommunityId relationships that were
 * written with `active: null` instead of `active: true`. The ACTIVE filter
 * requires `active: true`, so these records were invisible to the repository
 * queries. Future writes through the Cord API mutations set active correctly.
 */
@Migration('2026-03-05T12:00:00')
export class FixRev79ActiveFlagMigration extends BaseMigration {
  async up() {
    await this.db.query().raw`
      MATCH ()-[r:rev79ProjectId]->(:Property)
      WHERE r.active IS NULL
      SET r.active = true
      RETURN count(r)
    `.executeAndLogStats();

    await this.db.query().raw`
      MATCH ()-[r:rev79CommunityId]->(:Property)
      WHERE r.active IS NULL
      SET r.active = true
      RETURN count(r)
    `.executeAndLogStats();
  }
}
