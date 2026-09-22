import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type ID } from '~/common';
import { DrizzleService } from '~/core/drizzle';
import { gtlReportProgressExplanations } from '~/core/drizzle/schema';
import { type ExplainGtlProgress } from '../dto';

/**
 * At most one explanation per report — the table's PK is `report_id`, so a
 * write is a plain upsert rather than a read-then-branch. Mirrors
 * `progress_report_variance_explanations`.
 */
@Injectable()
export class GtlProgressExplanationRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.client;
  }

  async readOne(reportId: ID) {
    const [row] = await this.db
      .select()
      .from(gtlReportProgressExplanations)
      .where(
        eq(gtlReportProgressExplanations.reportId, reportId as ID<'GTLReport'>),
      );
    return row ?? null;
  }

  async upsert(input: ExplainGtlProgress) {
    const values = {
      reportId: input.report as ID<'GTLReport'>,
      status: input.status,
      context: input.context ?? null,
    };
    await this.db
      .insert(gtlReportProgressExplanations)
      .values(values)
      .onConflictDoUpdate({
        target: gtlReportProgressExplanations.reportId,
        set: {
          status: values.status,
          context: values.context,
          updatedAt: new Date(),
        },
      });
    return (await this.readOne(input.report))!;
  }
}
