import { Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import { type ID } from '~/common';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { promptVariantResponses } from '~/core/drizzle/schema';
import { LiveQueryStore } from '~/core/live-query';

/**
 * The `featured` flag on prompt responses: at most one live response per
 * (parent, section) holds it, enforced by the
 * `prompt_variant_responses_one_featured` partial unique index.
 *
 * Kept apart from {@link PromptVariantResponseRepository} because that one is a
 * class factory bound to a single section, while the featured place is a
 * per-report decision that only some sections offer (the Progress Report's
 * community stories today).
 *
 * Live queries are invalidated with the `PromptVariantResponse:<id>` key: every
 * section subtype is `@RegisterResource` only and resolves as the GraphQL type
 * `PromptVariantResponse`, so that is the name live queries index rows under.
 */
@Injectable()
export class PromptVariantResponseFeaturedRepository {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly liveQueryStore: LiveQueryStore,
  ) {}

  private get db() {
    return this.drizzle.client;
  }

  /**
   * Make `id` the featured response among its section's siblings on the same
   * parent, clearing whichever held the place before, in one transaction so the
   * unique index never sees two at once.
   *
   * @returns the ids whose `featured` changed: `id` first, then any displaced.
   */
  async feature(id: ID, parentId: ID, resourceType: string): Promise<ID[]> {
    return await this.drizzle.inTx(async () => {
      const now = new Date();
      const displaced = (
        await this.db
          .select({ id: promptVariantResponses.id })
          .from(promptVariantResponses)
          .where(
            and(
              eq(promptVariantResponses.parentId, parentId),
              eq(promptVariantResponses.resourceType, resourceType),
              eq(promptVariantResponses.featured, true),
              isNull(promptVariantResponses.deletedAt),
              ne(promptVariantResponses.id, id),
            ),
          )
      ).map((row) => row.id);
      if (displaced.length > 0) {
        await this.db
          .update(promptVariantResponses)
          .set({ featured: false, updatedAt: now })
          .where(inArray(promptVariantResponses.id, displaced));
      }
      await this.db
        .update(promptVariantResponses)
        .set({ featured: true, updatedAt: now })
        .where(eq(promptVariantResponses.id, id));

      const changed = [id, ...displaced];
      this.liveQueryStore.invalidateAll(
        changed.map((changedId) => `PromptVariantResponse:${changedId}`),
      );
      return changed;
    });
  }

  /** Clear the featured place from `id`; a no-op if it did not hold it. */
  async unfeature(id: ID): Promise<void> {
    await this.db
      .update(promptVariantResponses)
      .set({ featured: false, updatedAt: new Date() })
      .where(eq(promptVariantResponses.id, id));
    this.liveQueryStore.invalidateAll([`PromptVariantResponse:${id}`]);
  }
}
