import { Injectable } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { type ID } from '~/common';
import { DrizzleService } from '~/core/drizzle';
import { promptVariantResponses } from '~/core/drizzle/schema';
import { LiveQueryStore } from '~/core/live-query';

/**
 * Claims exclusivity for `PromptVariantResponse.featured` within one parent.
 *
 * Deliberately NOT behind `splitDb`. `featured` exists only for subtypes that
 * can hold several items and need exactly one singled out — today, a report's
 * community stories — and that selection is Postgres-only, so there is no
 * Neo4j counterpart to split against. Same shape as
 * `PostModerationDrizzleRepository`: a small dedicated repository injected
 * directly, rather than teaching the shared Neo4j factory a method it would
 * never use.
 */
@Injectable()
export class PromptVariantResponseFeaturedDrizzleRepository {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly liveQueryStore: LiveQueryStore,
  ) {}

  private get db() {
    return this.drizzle.client;
  }

  /**
   * Marks `id` featured and clears every other item sharing its `parentId`
   * and `resourceType`. `resourceType` matters here specifically: a report's
   * team news and community stories share one `parentId` (the report), so
   * clearing on `parentId` alone would also touch team news rows that happen
   * to live alongside — harmless today since nothing reads their `featured`,
   * but wrong to rely on.
   *
   * Clear-then-set in one transaction, mirroring how
   * `PartnershipDrizzleRepository` claims `primary` — the ordinary case is
   * sequential, not a race, so this is a transaction for atomicity, not a
   * savepoint for conflict recovery.
   *
   * Returns every id whose `featured` value actually changed — `id` itself,
   * plus whichever other row held it before (almost always at most one, given
   * this method is the only writer, but not assumed). The caller needs these
   * to tell the client about the demotion: a mutation response that only
   * describes `id` leaves the previously-featured item's cached `featured`
   * stuck at `true` on the client, which is indistinguishable from the
   * exclusivity constraint not existing at all.
   */
  async feature(id: ID, parentId: ID, resourceType: string): Promise<ID[]> {
    return await this.drizzle.inTx(async () => {
      const previouslyFeatured = await this.db
        .select({ id: promptVariantResponses.id })
        .from(promptVariantResponses)
        .where(
          and(
            eq(promptVariantResponses.parentId, parentId),
            eq(promptVariantResponses.resourceType, resourceType),
            eq(promptVariantResponses.featured, true),
            ne(promptVariantResponses.id, id),
          ),
        );

      await this.db
        .update(promptVariantResponses)
        .set({ featured: false })
        .where(
          and(
            eq(promptVariantResponses.parentId, parentId),
            eq(promptVariantResponses.resourceType, resourceType),
            ne(promptVariantResponses.id, id),
          ),
        );
      await this.db
        .update(promptVariantResponses)
        .set({ featured: true })
        .where(eq(promptVariantResponses.id, id));

      const changedIds = [id, ...previouslyFeatured.map((row) => row.id)];
      // Hand-rolled writes, so — unlike updateColumns()/softDelete() on the
      // base repository — this has to invalidate itself. Every changed row,
      // not just `id`: a live report page watching the demoted story needs
      // to hear about that too, not only the one that gained `featured`.
      this.liveQueryStore.invalidateAll(
        changedIds.map((changedId) => [resourceType, changedId] as const),
      );

      return changedIds;
    });
  }
}
