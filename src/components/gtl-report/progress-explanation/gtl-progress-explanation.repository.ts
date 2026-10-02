import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { type ID, NotFoundException, type UnsecuredDto } from '~/common';
import { DrizzleService } from '~/core/drizzle';
import {
  gtlReportProgressExplanations as explanations,
  periodicReports,
} from '~/core/drizzle/schema';
import { LiveQueryStore } from '~/core/live-query';
import {
  type ExplainGtlProgress,
  type GtlProgressExplanation,
  GTLReport,
} from '../dto';

/**
 * At most one explanation per report — the table's PK is `report_id`, so a
 * write is a plain upsert rather than a read-then-branch. Mirrors
 * `progress_report_variance_explanations`.
 *
 * The resource has no identity of its own (the DTO carries `report`, `status`
 * and `context`, no `id`), which is why this does not extend
 * `DrizzleDtoRepository` — that base requires an `id` column.
 */
@Injectable()
export class GtlProgressExplanationRepository {
  @Inject() private readonly liveQueryStore: LiveQueryStore;

  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.client;
  }

  /**
   * Anchored on the report, LEFT JOINing the explanation: a live GTL report
   * with nothing written yet still yields a DTO with null status and context,
   * so the section can say "nothing yet" instead of failing. An id that is
   * not a live GTL report is "not found".
   */
  async readOne(reportId: ID): Promise<UnsecuredDto<GtlProgressExplanation>> {
    const [row] = await this.db
      .select({
        reportId: periodicReports.id,
        status: explanations.status,
        context: explanations.context,
      })
      .from(periodicReports)
      .leftJoin(explanations, eq(explanations.reportId, periodicReports.id))
      .where(
        and(
          eq(periodicReports.id, reportId),
          eq(periodicReports.type, 'GTL'),
          isNull(periodicReports.deletedAt),
        ),
      );
    if (!row) {
      throw new NotFoundException('Could not find GTL report', 'report');
    }
    const dto: unknown = {
      report: { id: row.reportId },
      status: row.status ?? null,
      context: row.context ?? null,
    };
    return dto as UnsecuredDto<GtlProgressExplanation>;
  }

  async upsert(input: ExplainGtlProgress): Promise<void> {
    const context = input.context ?? null;
    await this.db
      .insert(explanations)
      .values({ reportId: input.report, status: input.status, context })
      .onConflictDoUpdate({
        target: explanations.reportId,
        set: { status: input.status, context, updatedAt: new Date() },
      });
    // Hand-rolled write, so the live-query store is told here. The explanation
    // has no id of its own; the report whose section this is gets the notice.
    this.liveQueryStore.invalidate([GTLReport, input.report]);
  }
}
