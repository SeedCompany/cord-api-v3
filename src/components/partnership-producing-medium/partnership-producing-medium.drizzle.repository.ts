import { Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import { type ID, NotFoundException } from '~/common';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import {
  partnershipProducingMediums,
  partnerships,
  productMediumEnum,
  products,
} from '~/core/drizzle/schema';
import { type ProductMedium } from '../product/dto';
import { type UpdatePartnershipProducingMedium } from './dto/partnership-producing-medium.dto';

/**
 * Postgres implementation of PartnershipProducingMediumRepository.
 *
 * Deliberately does NOT declare `implements PublicOf<…>`: the Neo4j repo extends
 * `CommonRepository`, so that type also demands `getBaseNode`/`getBaseNodes`/
 * `deleteNode`/`logger` — Neo4j-shaped members this repo has no use for. The
 * service only consumes `read` + `update`. Same approach as
 * AdminDrizzleRepository.
 */
@Injectable()
export class PartnershipProducingMediumDrizzleRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  /**
   * Every medium any of the engagement's products declares, mapped to the
   * partnership responsible for it (or null when unassigned).
   *
   * Mirrors the Neo4j query's `merge(allAvailable, defined)`: the available set
   * is derived from the products' `mediums` arrays, then assignments overlay it.
   * An assignment for a medium no longer declared by any product is still
   * returned, same as the Cypher merge.
   */
  async read(engagementId: ID): Promise<Record<ProductMedium, ID | null>> {
    const engagement = await this.drizzle.client.query.engagements.findFirst({
      columns: { id: true },
      where: (eng) => and(eq(eng.id, engagementId), isNull(eng.deletedAt)),
    });
    if (!engagement) {
      throw new NotFoundException('Engagement not found');
    }

    const [available, defined] = await Promise.all([
      this.drizzle.client
        .selectDistinct({
          medium: sql<ProductMedium>`unnest(${products.mediums})`,
        })
        .from(products)
        .where(
          and(
            eq(products.engagementId, engagementId),
            isNull(products.deletedAt),
          ),
        ),
      this.drizzle.client
        .select({
          medium: partnershipProducingMediums.medium,
          partnershipId: partnershipProducingMediums.partnershipId,
        })
        .from(partnershipProducingMediums)
        .where(eq(partnershipProducingMediums.engagementId, engagementId)),
    ]);

    // Enum declaration order, so the resulting list is stable across calls —
    // the Cypher version's key order came from apoc and was arbitrary.
    const availableSet = new Set(available.map((row) => row.medium));
    const definedByMedium = new Map(
      defined.map((row) => [row.medium, row.partnershipId]),
    );
    const ordered = [
      ...productMediumEnum.enumValues.filter(
        (medium) => availableSet.has(medium) || definedByMedium.has(medium),
      ),
    ] as ProductMedium[];

    return Object.fromEntries(
      ordered.map((medium) => [medium, definedByMedium.get(medium) ?? null]),
    ) as Record<ProductMedium, ID | null>;
  }

  /**
   * Assign/clear the partnership producing each given medium.
   *
   * Neo4j semantics preserved exactly: a null partnership clears the
   * assignment, and so does an id matching no live partnership — the Cypher
   * deactivates the existing relationship first and only then merges against a
   * real `Partnership` node, so an unmatched id leaves nothing behind.
   * Re-submitting the current partnership is a no-op that keeps `created_at`.
   */
  async update(
    engagementId: ID,
    input: readonly UpdatePartnershipProducingMedium[],
  ) {
    if (input.length === 0) return;

    const requested = input
      .map((pair) => pair.partnership)
      .filter((id): id is ID => !!id);
    const live = requested.length
      ? await this.drizzle.client
          .select({ id: partnerships.id })
          .from(partnerships)
          .where(
            and(
              inArray(partnerships.id, requested),
              isNull(partnerships.deletedAt),
            ),
          )
      : [];
    const liveIds = new Set(live.map((row) => row.id));

    const toSet = input.filter(
      (pair) => pair.partnership && liveIds.has(pair.partnership),
    );
    const toClear = input.filter(
      (pair) => !pair.partnership || !liveIds.has(pair.partnership),
    );

    if (toClear.length) {
      await this.drizzle.client.delete(partnershipProducingMediums).where(
        and(
          eq(partnershipProducingMediums.engagementId, engagementId),
          inArray(
            partnershipProducingMediums.medium,
            toClear.map((pair) => pair.medium),
          ),
        ),
      );
    }

    if (toSet.length) {
      await this.drizzle.client
        .insert(partnershipProducingMediums)
        .values(
          toSet.map((pair) => ({
            engagementId: engagementId as ID<'Engagement'>,
            medium: pair.medium,
            partnershipId: pair.partnership as ID<'Partnership'>,
          })),
        )
        // Reassignment keeps the original created_at, matching the Cypher's
        // `onCreate` — it only stamped createdAt when the rel was new.
        .onConflictDoUpdate({
          target: [
            partnershipProducingMediums.engagementId,
            partnershipProducingMediums.medium,
          ],
          set: {
            partnershipId: sql`excluded.${sql.raw(
              partnershipProducingMediums.partnershipId.name,
            )}`,
          },
        });
    }
  }
}
