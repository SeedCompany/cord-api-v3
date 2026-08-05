import { type ID } from '~/common';
import {
  locations,
  organizationLocations,
  organizationReachEnum,
  organizations,
  organizationTypeEnum,
  userOrganizations,
  users,
} from '~/core/drizzle/schema';
import { type Organization } from '../../../components/organization/dto';
import { OrganizationRepository } from '../../../components/organization/organization.repository';
import {
  bulkInsert,
  cypher,
  keepLanded,
  liveTargetIds,
  readAllViaRepo,
  sanitizeEnum,
  stat,
  tsReq,
} from '../cutover.helpers';
import { type Extractor, type TableStat } from '../cutover.types';

/**
 * Organization + its two junctions.
 *  - organization_locations: (Organization)-[:locations]->(Location)
 *  - user_organizations: (User)-[:organization]->(Organization); `primary` is
 *    a SECOND rel (`primaryOrganization`) to the same org.
 *
 * migration-todo: the `one primary org per user` partial-unique index will
 * reject dirty data (a user flagged primary on two orgs). Verify on a live
 * Neo4j; onConflictDoNothing does not cover unique-index violations.
 */
export const organizationExtractor: Extractor = {
  name: 'organization',
  targetTables: [
    'organizations',
    'organization_locations',
    'user_organizations',
  ],
  dependsOn: ['user', 'location'],
  async run(ctx) {
    const out: Record<string, TableStat> = {};

    const dtos = await readAllViaRepo<Organization>(
      ctx,
      'Organization',
      OrganizationRepository,
    );
    const droppedEnums = new Set<string>();
    const rows = dtos.map((o) => {
      const types = sanitizeEnum([...o.types], organizationTypeEnum.enumValues);
      const reach = sanitizeEnum(
        [...o.reach],
        organizationReachEnum.enumValues,
      );
      [...types.dropped, ...reach.dropped].forEach((d) => droppedEnums.add(d));
      return {
        id: o.id,
        name: o.name,
        acronym: o.acronym ?? null,
        address: o.address ?? null,
        types: types.kept,
        reach: reach.kept,
        // migration-todo: sensitivity is denormalized from linked projects;
        // reads 'High' until Project migrates + a recompute pass runs.
        sensitivity: o.sensitivity,
        createdAt: tsReq(o.createdAt),
        updatedAt: tsReq(o.createdAt),
        deletedAt: null,
      };
    });
    // Kept as a guard, not as an outstanding task: production carries no value
    // that either enum rejects (checked against the source before the real
    // load). A hit here means data this check has not seen, so it is worth
    // saying out loud — the organization row still lands, only the value is
    // lost, which no row count can show.
    if (droppedEnums.size) {
      ctx.log(
        `    ⚠ dropped unknown organization type/reach value(s): ${[
          ...droppedEnums,
        ].join(', ')} — the org row still landed WITHOUT them`,
      );
    }
    out.organizations = stat(
      dtos.length,
      await bulkInsert(ctx, organizations, rows),
    );

    const orgLocs = await cypher<{ orgId: ID; locId: ID }>(
      ctx,
      `MATCH (o:Organization)-[:locations { active: true }]->(l:Location)
       RETURN o.id AS orgId, l.id AS locId`,
    );
    // Both junctions below FK to parents that can be absent — see keepLanded.
    const landedOrgs = await liveTargetIds(ctx, 'Organization', organizations);
    const landedLocs = await liveTargetIds(ctx, 'Location', locations);
    const landedUsers = await liveTargetIds(ctx, 'User', users);

    const orgLocRows = keepLanded(
      orgLocs.map((r) => ({ organizationId: r.orgId, locationId: r.locId })),
      [
        [landedOrgs, (row) => row.organizationId],
        [landedLocs, (row) => row.locationId],
      ],
    );
    if (orgLocRows.skipped > 0) {
      ctx.log(
        `    ⚠ skipped ${orgLocRows.skipped} organization_locations row(s) — org or location never landed`,
      );
    }
    out.organization_locations = stat(
      orgLocs.length,
      await bulkInsert(ctx, organizationLocations, orgLocRows.kept),
    );

    const userOrgs = await cypher<{
      userId: ID;
      orgId: ID;
      primary: boolean;
    }>(
      ctx,
      `MATCH (u:User)-[:organization { active: true }]->(o:Organization)
       RETURN u.id AS userId, o.id AS orgId,
              exists((u)-[:primaryOrganization { active: true }]->(o)) AS primary`,
    );
    const userOrgRows = keepLanded(
      userOrgs.map((r) => ({
        userId: r.userId,
        organizationId: r.orgId,
        primary: r.primary,
      })),
      [
        [landedUsers, (row) => row.userId],
        [landedOrgs, (row) => row.organizationId],
      ],
    );
    if (userOrgRows.skipped > 0) {
      ctx.log(
        `    ⚠ skipped ${userOrgRows.skipped} user_organizations row(s) — user or org never landed`,
      );
    }
    out.user_organizations = stat(
      userOrgs.length,
      await bulkInsert(ctx, userOrganizations, userOrgRows.kept),
    );

    return out;
  },
};
