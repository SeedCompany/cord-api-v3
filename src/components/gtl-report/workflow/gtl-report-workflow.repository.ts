import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { generateId, type ID } from '~/common';
import { DrizzleService } from '~/core/drizzle';
import {
  gtlReportWorkflowEvents,
  periodicReports,
} from '~/core/drizzle/schema';
import { type GtlReportStatus } from '../dto/gtl-report-status.enum';

@Injectable()
export class GtlReportWorkflowRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.client;
  }

  async currentStatus(reportId: ID): Promise<GtlReportStatus | null> {
    const [row] = await this.db
      .select({ status: periodicReports.gtlStatus })
      .from(periodicReports)
      .where(eq(periodicReports.id, reportId));
    return row?.status ?? null;
  }

  /**
   * Records the transition and moves the report in one transaction.
   *
   * No trigger syncs `periodic_reports.gtl_status` from the event table —
   * matching the Momentum workflow, the parent's status is written app-side
   * alongside the event.
   */
  async execute(input: {
    reportId: ID;
    to: GtlReportStatus;
    transitionKey: ID | null;
    who: ID;
    notes?: unknown;
  }) {
    const id = await generateId<ID<'GtlReportWorkflowEvent'>>();
    await this.db.transaction(async (tx) => {
      await tx.insert(gtlReportWorkflowEvents).values({
        id,
        reportId: input.reportId as ID<'GTLReport'>,
        who: input.who as ID<'User'>,
        status: input.to,
        transitionKey: input.transitionKey,
        notes: (input.notes ?? null) as never,
      });
      await tx
        .update(periodicReports)
        .set({ gtlStatus: input.to, updatedAt: new Date() })
        .where(eq(periodicReports.id, input.reportId));
    });
    return id;
  }

  async history(reportId: ID) {
    return await this.db
      .select()
      .from(gtlReportWorkflowEvents)
      .where(eq(gtlReportWorkflowEvents.reportId, reportId as ID<'GTLReport'>))
      .orderBy(asc(gtlReportWorkflowEvents.at));
  }
}
