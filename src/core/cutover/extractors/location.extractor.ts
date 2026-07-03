import { eq } from 'drizzle-orm';
import { locations } from '~/core/drizzle/schema';
import { type Location } from '../../../components/location/dto';
import { LocationRepository } from '../../../components/location/location.repository';
import {
  bulkInsert,
  linkId,
  readAllViaRepo,
  stat,
  tsReq,
} from '../cutover.helpers';
import { type Extractor } from '../cutover.types';

/**
 * Location — (name, type, isoAlpha3, fundingAccount, defaultFieldRegion,
 * defaultMarketingRegion→self, mapImage). `mapImageId` is plain text (no FK).
 *
 * `defaultMarketingRegionId` is a self-FK, so it's set in a second UPDATE pass
 * after all rows exist (avoids insert-order violations).
 */
export const locationExtractor: Extractor = {
  name: 'location',
  targetTables: ['locations'],
  dependsOn: ['fundingAccount', 'fieldRegion'],
  async run(ctx) {
    const dtos = await readAllViaRepo<Location>(
      ctx,
      'Location',
      LocationRepository,
    );
    const rows = dtos.map((l) => ({
      id: l.id,
      name: l.name,
      type: l.type,
      isoAlpha3: l.isoAlpha3 ?? null,
      fundingAccountId: linkId(l.fundingAccount),
      defaultFieldRegionId: linkId(l.defaultFieldRegion),
      defaultMarketingRegionId: null,
      mapImageId: linkId(l.mapImage),
      createdAt: tsReq(l.createdAt),
      updatedAt: tsReq(l.createdAt),
      deletedAt: null,
    }));
    const inserted = await bulkInsert(ctx, locations, rows);

    // Pass 2: self-ref marketing region. Guard against targets that aren't
    // actually in the table — a live location can point at a soft-deleted
    // marketing region, OR its row was dropped by onConflictDoNothing on a
    // UNIQUE (dup name/iso) conflict. Query the present ids, not the read set.
    // See README "Dangling references & dropped rows".
    if (!ctx.dryRun) {
      const migrated = new Set(
        (await ctx.db.select({ id: locations.id }).from(locations)).map(
          (r) => r.id,
        ),
      );
      let dangling = 0;
      for (const l of dtos) {
        const mkt = linkId(l.defaultMarketingRegion);
        if (!mkt) continue;
        if (!migrated.has(mkt)) {
          dangling++;
          continue;
        }
        await ctx.db
          .update(locations)
          .set({ defaultMarketingRegionId: mkt })
          .where(eq(locations.id, l.id));
      }
      if (dangling > 0) {
        ctx.log(
          `    ⚠ ${dangling} location(s) had a dangling defaultMarketingRegion — left null`,
        );
      }
    }
    return { locations: stat(dtos.length, inserted) };
  },
};
