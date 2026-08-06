import { type ID } from '~/common';
import { pins, users } from '~/core/drizzle/schema';
import {
  bulkInsert,
  cypher,
  keepLanded,
  liveTargetIds,
  one,
  resolveParentTypes,
  ts,
  warnIfRelTypeUnknown,
} from '../cutover.helpers';
import { type Extractor } from '../cutover.types';

/**
 * Pins — per-user bookmarks over arbitrary resources.
 *
 * Edge-stored, not node-stored: `(:User)-[:pinned { createdAt }]->(:BaseNode)`.
 * There is no `Pinned` label to enumerate, which is why this reads a raw edge and
 * guards the rel type explicitly ({@link warnIfRelTypeUnknown}) — a misspelled
 * type would return zero rows and reconcile ✓.
 *
 * `resource_id` is deliberately FK-less because `Pinnable` carries `@DbLabel(null)`
 * — literally any BaseNode can be pinned, so the targets span every table. That
 * has a consequence for the guard below: a pin whose target has not landed cannot
 * fail an insert, so dropping it would be *choosing* to lose a user's bookmark for
 * no constraint reason. Those are carried and counted instead. The `user_id` FK is
 * real, so a pin whose owner never landed must go.
 *
 * The edge has no `active` flag — unpinning DELETEs it (PinRepository.remove), so
 * every edge present is a live pin. Nothing to filter.
 */
export const pinExtractor: Extractor = {
  name: 'pin',
  targetTables: ['pins'],
  dependsOn: ['user'],
  async run(ctx) {
    const rows = await cypher<{
      userId: ID<'User'>;
      resourceId: ID;
      createdAt: string | null;
    }>(
      ctx,
      `MATCH (user:User)-[rel:pinned]->(target:BaseNode)
       RETURN user.id AS userId, target.id AS resourceId, toString(rel.createdAt) AS createdAt`,
    );
    if (rows.length === 0) {
      await warnIfRelTypeUnknown(ctx, 'pinned');
    }

    const landedUsers = await liveTargetIds(ctx, 'User', users);
    const kept = keepLanded(rows, [[landedUsers, (row) => row.userId]]);
    if (kept.skipped > 0) {
      ctx.log(
        `    ⚠ DROPPED ${kept.skipped} pin(s) whose owning user never landed (user_id FK)`,
      );
    }

    // Composite PK (user_id, resource_id). Neo4j's `merge` makes a duplicate edge
    // impossible, so this is belt-and-braces — but a dup would otherwise be
    // absorbed by onConflictDoNothing and show only as an unexplained count gap.
    const seen = new Set<string>();
    const undated: string[] = [];
    const values = kept.kept.flatMap((row) => {
      const key = `${row.userId}::${row.resourceId}`;
      if (seen.has(key)) return [];
      seen.add(key);
      // NOT NULL with a now() default. `add()` sets createdAt only ON CREATE, so
      // an edge predating that code could lack it.
      if (!row.createdAt) undated.push(key);
      return [
        {
          userId: row.userId,
          resourceId: row.resourceId,
          createdAt: ts(row.createdAt) ?? new Date(),
        },
      ];
    });
    if (undated.length > 0) {
      ctx.log(
        `    ⚠ ${undated.length} pin(s) had no createdAt under a NOT NULL column — stamped now()`,
      );
    }

    const inserted = await bulkInsert(ctx, pins, values);

    // Reported, never dropped — see the docblock. Worth surfacing because a large
    // count here means pins reference a domain the ETL has not reached yet, which
    // no constraint will ever tell us. Deliberately hedged: resolveParentTypes
    // covers the six migrated pinnable tables, not every possible Pinnable, so an
    // unresolved target is "not found among those" rather than proof of a dangling
    // pin.
    if (!ctx.dryRun && values.length > 0) {
      const resolved = await resolveParentTypes(
        ctx,
        values.map((row) => row.resourceId),
      );
      const unresolved = values.filter(
        (row) => !resolved.has(row.resourceId),
      ).length;
      if (unresolved > 0) {
        ctx.log(
          `    ⚠ ${unresolved} pin(s) target a resource not found among the migrated pinnable tables ` +
            `(user/language/partner/project/engagement/progress report). CARRIED, not dropped — ` +
            `resource_id is FK-less, so nothing fails; they are simply inert until that domain lands.`,
        );
      }
    }

    return one('pins', rows.length, inserted);
  },
};
