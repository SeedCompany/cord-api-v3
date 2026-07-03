import { type ID } from '~/common';
import {
  organizationLocations,
  organizationReachEnum,
  organizations,
  organizationTypeEnum,
  userOrganizations,
} from '~/core/drizzle/schema';
import { type Organization } from '../../../components/organization/dto';
import { OrganizationRepository } from '../../../components/organization/organization.repository';
import {
  bulkInsert,
  cypher,
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
    if (droppedEnums.size) {
      ctx.log(
        `    ⚠ dropped unknown organization enum value(s): ${[...droppedEnums].join(', ')} — migration-todo: map, don't drop`,
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
    out.organization_locations = stat(
      orgLocs.length,
      await bulkInsert(
        ctx,
        organizationLocations,
        orgLocs.map((r) => ({ organizationId: r.orgId, locationId: r.locId })),
      ),
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
    out.user_organizations = stat(
      userOrgs.length,
      await bulkInsert(
        ctx,
        userOrganizations,
        userOrgs.map((r) => ({
          userId: r.userId,
          organizationId: r.orgId,
          primary: r.primary,
        })),
      ),
    );

    return out;
  },
};
