import { type ID } from '~/common';
import { locations, userLocations, users } from '~/core/drizzle/schema';
import {
  bulkInsert,
  cypher,
  keepLanded,
  liveTargetIds,
  one,
} from '../cutover.helpers';
import { type Extractor } from '../cutover.types';

/**
 * user_locations — the (User)-[:locations]->(Location) junction, kept as its
 * OWN extractor rather than folded into `user`. `user` sits UPSTREAM of
 * `location` in the dependency graph (user → fieldZone → fieldRegion →
 * location), so `user` itself cannot declare a dependency on `location`
 * without creating a cycle. This extractor runs after both instead.
 *
 * Mirrors organization.extractor.ts's `organization_locations` junction —
 * same relationship name (`locations`), same landed-both-sides guard.
 */
export const userLocationExtractor: Extractor = {
  name: 'userLocation',
  targetTables: ['user_locations'],
  dependsOn: ['user', 'location'],
  async run(ctx) {
    const pairs = await cypher<{ userId: ID; locationId: ID }>(
      ctx,
      `MATCH (u:User)-[:locations { active: true }]->(l:Location)
       RETURN u.id AS userId, l.id AS locationId`,
    );

    const landedUsers = await liveTargetIds(ctx, 'User', users);
    const landedLocations = await liveTargetIds(ctx, 'Location', locations);
    const { kept, skipped } = keepLanded(pairs, [
      [landedUsers, (row) => row.userId],
      [landedLocations, (row) => row.locationId],
    ]);
    if (skipped > 0) {
      ctx.log(
        `    ⚠ skipped ${skipped} user_locations row(s) — user or location never landed`,
      );
    }

    return one(
      'user_locations',
      pairs.length,
      await bulkInsert(ctx, userLocations, kept),
    );
  },
};
