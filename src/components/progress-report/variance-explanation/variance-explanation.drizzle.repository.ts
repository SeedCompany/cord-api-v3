import { Injectable } from '@nestjs/common';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { type ID, type UnsecuredDto } from '~/common';
import { getChanges } from '~/core/database/changes';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import {
  periodicReports,
  progressReportVarianceExplanations as varianceExplanations,
} from '~/core/drizzle/schema';
import {
  type ExplainProgressVariance as ExplainVariance,
  ProgressReportVarianceExplanation as VarianceExplanation,
} from './variance-explanation.dto';

/**
 * Postgres implementation of `ProgressReportVarianceExplanationRepository`.
 *
 * This resource has no identity of its own — it's keyed entirely by its report
 * (the DTO carries `report`, `reasons`, `comments` and no `id`), which is why
 * the table's PK *is* `report_id` and why this class doesn't extend
 * `DrizzleDtoRepository` (that base requires an `id` column). `getActualChanges`
 * is wired from the same shared `getChanges` helper the base uses, so the
 * service's diff call behaves identically across engines.
 *
 * Faithfulness notes vs the Neo4j repo:
 *  - `readMany` takes *report* ids and anchors on the report, LEFT JOINing the
 *    explanation. A report with no explanation still yields a dto with empty
 *    reasons and null comments — that's Cypher's `optionalMatch` + `merge` over
 *    defaults, and the service relies on it (`update` reads the existing row
 *    first and 404s if absent, so every Progress report must resolve to one).
 *  - Anchoring also means an id that isn't a live Progress report yields
 *    nothing, matching `matchNode('report', 'ProgressReport')`.
 */
// migration-todo: no `implements PublicOf<Neo4jRepository>` — that base extends
// DtoRepository and so demands privileges/getBaseNode/deleteNode members this
// class has no reason to reproduce. Same trade as every other Drizzle repo;
// collapses at Phase 7 cutover.
@Injectable()
export class ProgressReportVarianceExplanationDrizzleRepository {
  /** @see DrizzleDtoRepository.getActualChanges */
  readonly getActualChanges = getChanges(VarianceExplanation);

  constructor(private readonly drizzle: DrizzleService) {}

  protected get db() {
    return this.drizzle.client;
  }

  async readMany(
    reportIds: readonly ID[],
  ): Promise<Array<UnsecuredDto<VarianceExplanation>>> {
    if (reportIds.length === 0) return [];
    const rows = await this.db
      .select({
        reportId: periodicReports.id,
        reasons: varianceExplanations.reasons,
        comments: varianceExplanations.comments,
      })
      .from(periodicReports)
      .leftJoin(
        varianceExplanations,
        eq(varianceExplanations.reportId, periodicReports.id),
      )
      .where(
        and(
          inArray(periodicReports.id, [...reportIds]),
          eq(periodicReports.type, 'Progress'),
          // Neo4j anchors on the `:ProgressReport` label, which a soft-deleted
          // report loses (migration 0034).
          isNull(periodicReports.deletedAt),
        ),
      );
    return rows.map((row) => this.toDto(row));
  }

  /**
   * Upsert — Neo4j MERGEs the `varianceExplanation` relationship, so a report
   * can never accumulate two and a first write is indistinguishable from an
   * edit. The PK on `report_id` lets that be one statement.
   *
   * Only keys present in `changes` are written: the service passes the output of
   * `getActualChanges`, so a comments-only edit must leave reasons untouched.
   */
  async update(input: { id: ID } & Omit<ExplainVariance, 'report'>) {
    const { id, ...changes } = input;
    const reasons = changes.reasons ? [...changes.reasons] : undefined;
    const comments = changes.comments;

    await this.db
      .insert(varianceExplanations)
      .values({
        reportId: id,
        ...(reasons !== undefined && { reasons }),
        ...(comments !== undefined && { comments }),
      })
      .onConflictDoUpdate({
        target: varianceExplanations.reportId,
        set: {
          ...(reasons !== undefined && { reasons }),
          ...(comments !== undefined && { comments }),
          updatedAt: new Date(),
        },
      });

    // The Neo4j repo returns nothing meaningful; the service re-reads through
    // the loader. Kept identical so the service stays engine-agnostic.
    return undefined as unknown;
  }

  protected toDto(row: {
    reportId: ID;
    reasons: string[] | null;
    comments: unknown;
  }): UnsecuredDto<VarianceExplanation> {
    const dto: unknown = {
      report: { id: row.reportId },
      reasons: row.reasons ?? [],
      comments: row.comments ?? null,
    };
    return dto as UnsecuredDto<VarianceExplanation>;
  }
}
