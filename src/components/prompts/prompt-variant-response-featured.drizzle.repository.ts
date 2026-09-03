import { Injectable } from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';
import { type ID } from '~/common';
import { DrizzleService } from '~/core/drizzle';
import { promptVariantResponses } from '~/core/drizzle/schema';

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
  constructor(private readonly drizzle: DrizzleService) {}

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
   */
  async feature(id: ID, parentId: ID, resourceType: string): Promise<void> {
    await this.drizzle.inTx(async () => {
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
    });
  }
}
