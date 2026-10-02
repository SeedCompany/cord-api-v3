import { Injectable } from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNull,
  type SQL,
} from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  EnhancedResource,
  generateId,
  type ID,
  type RichTextDocument,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import {
  engagements,
  periodicReports,
  projects,
  users,
  gtlReportWorkflowEvents as workflowEvents,
} from '~/core/drizzle/schema';
import { LiveQueryStore } from '~/core/live-query';
import { type ScopedRole } from '../../authorization/dto/role.dto';
import { PolicyExecutor } from '../../authorization/policy/executor/policy-executor';
import { requesterScopeByProject } from '../../project/project-member/membership-scope';
import { GTLReport, type GtlReportStatus as Status } from '../dto';
import { GtlReportWorkflowEvent as WorkflowEvent } from './dto';

type EventRow = typeof workflowEvents.$inferSelect;

/**
 * Events are append-only facts in `gtl_report_workflow_events`; the report's
 * current status lives on `periodic_reports.gtl_status` and is written by
 * `changeStatus`. The same split as the Progress Report sibling, and unlike
 * the Project workflow, where a trigger keeps the parent in step.
 */
@Injectable()
export class GtlReportWorkflowRepository {
  private readonly resource = EnhancedResource.of(WorkflowEvent);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly identity: Identity,
    private readonly executor: PolicyExecutor,
    private readonly liveQueryStore: LiveQueryStore,
  ) {}

  protected get db() {
    return this.drizzle.client;
  }

  /**
   * What the reader is allowed to see, plus the ancestry it requires.
   *
   * Permission: `applyReadFilter`. Read on these events is member-conditioned
   * for Field Partner and Project Manager and global for the oversight roles,
   * so for a non-member the filter is the membership SQL (see
   * `member.condition.ts`), and for a role with no grant at all it is false and
   * nothing is asked of the database. Securing the DTO is not a substitute:
   * only `who` and `notes` are secured, so `id`, `at`, `to` and `transition`
   * would otherwise hand over the report's whole review history.
   *
   * Ancestry: the report, its engagement and its project must all be live —
   * soft-deleting any of them leaves the event rows untouched. The author too:
   * a soft-deleted user keeps the row (the FK never fires), so without the
   * filter the event would render with an authorless `who`. LEFT join on users
   * because an agent-actored event has no user row and must still come back.
   *
   * One WHERE array for everything; chaining a second `.where()` would REPLACE
   * this clause and silently drop the read filter.
   */
  private readableEvents(...narrowing: SQL[]) {
    const conditions: SQL[] = [
      eq(periodicReports.type, 'GTL'),
      isNull(periodicReports.deletedAt),
      isNull(engagements.deletedAt),
      isNull(projects.deletedAt),
      isNull(users.deletedAt),
      ...narrowing,
    ];
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return null;
    }
    return this.db
      .select({
        ...getTableColumns(workflowEvents),
        // For the requester's membership scope, attached in `hydrate`.
        projectId: projects.id,
      })
      .from(workflowEvents)
      .innerJoin(
        periodicReports,
        eq(periodicReports.id, workflowEvents.reportId),
      )
      .innerJoin(engagements, eq(engagements.id, periodicReports.engagementId))
      .innerJoin(projects, eq(projects.id, engagements.projectId))
      .leftJoin(users, eq(users.id, workflowEvents.who))
      .where(and(...conditions));
  }

  async readMany(
    ids: readonly ID[],
  ): Promise<Array<UnsecuredDto<WorkflowEvent>>> {
    if (ids.length === 0) return [];
    const query = this.readableEvents(
      inArray(workflowEvents.id, [...ids] as Array<
        ID<'GtlReportWorkflowEvent'>
      >),
    );
    if (!query) return [];
    return await this.hydrate(await query);
  }

  /** Oldest first, with the random id as the tiebreaker for same-instant rows. */
  async list(reportId: ID): Promise<Array<UnsecuredDto<WorkflowEvent>>> {
    const query = this.readableEvents(
      eq(workflowEvents.reportId, reportId as ID<'GTLReport'>),
    );
    if (!query) return [];
    const rows = await query.orderBy(
      asc(workflowEvents.at),
      asc(workflowEvents.id),
    );
    return await this.hydrate(rows);
  }

  /**
   * Attach the requester's membership scope for each event's project, so the
   * member-conditioned read on `who` and `notes` can be answered when the DTO
   * is secured.
   */
  private async hydrate(rows: Array<EventRow & { projectId: ID<'Project'> }>) {
    const scopeByProject = await requesterScopeByProject(
      this.db,
      this.identity.current.userId,
      rows.map((row) => row.projectId),
    );
    return rows.map((row) =>
      this.toDto(row, scopeByProject.get(row.projectId) ?? []),
    );
  }

  /**
   * Record one transition (or bypass) of this report. The report is passed
   * whole rather than by id so the returned event carries its scope, the same
   * way a read would.
   */
  async recordEvent(
    report: UnsecuredDto<GTLReport>,
    input: {
      to: Status;
      /** null = the workflow was bypassed */
      transition?: ID | null;
      notes?: RichTextDocument | null;
    },
  ): Promise<UnsecuredDto<WorkflowEvent>> {
    const id = await generateId<ID<'GtlReportWorkflowEvent'>>();
    const actor = this.resolveActor();
    const at = new Date();

    const row: EventRow = {
      id,
      reportId: report.id as ID<'GTLReport'>,
      ...actor,
      status: input.to,
      transitionKey: input.transition ?? null,
      notes: input.notes ?? null,
      at,
    };
    await this.db.insert(workflowEvents).values(row);
    return this.toDto(row, report.scope);
  }

  /**
   * Which actor column this event belongs in. `Session.actor` owns the
   * user-vs-agent discrimination; this only maps it to the two columns.
   * Exactly one is non-null, satisfying the actor-shape CHECK (migration 0004).
   */
  private resolveActor(): {
    who: ID<'User'> | null;
    whoSystemAgentId: ID<'SystemAgent'> | null;
  } {
    const actor = this.identity.current.actor;
    return actor.type === 'agent'
      ? { who: null, whoSystemAgentId: actor.id }
      : { who: actor.id, whoSystemAgentId: null };
  }

  /**
   * Move the report. Guarded on type and liveness: `gtl_status` is only legal
   * on a GTL row (the status-shape CHECK), and a removed report stays where it
   * was.
   */
  async changeStatus(report: ID, status: Status) {
    await this.db
      .update(periodicReports)
      .set({ gtlStatus: status, updatedAt: new Date() })
      .where(
        and(
          eq(periodicReports.id, report),
          eq(periodicReports.type, 'GTL'),
          isNull(periodicReports.deletedAt),
        ),
      );
    // A hand-rolled write, so the live-query store is told here — the base
    // repository helpers do this on their own; this is not one of them. A
    // status change is exactly what an open report page needs to pick up.
    this.liveQueryStore.invalidate([GTLReport, report]);
  }

  /**
   * Who last moved this report into PendingSupervisorSignOff, for the
   * `NotTheSender` condition. Keyed on the status reached rather than the
   * transition taken, so a bypass into that state counts. Null when the report
   * has never been there or the mover was a system agent.
   */
  async lastSentToSupervisorBy(reportId: ID): Promise<ID<'User'> | null> {
    const [row] = await this.db
      .select({ who: workflowEvents.who })
      .from(workflowEvents)
      .where(
        and(
          eq(workflowEvents.reportId, reportId as ID<'GTLReport'>),
          eq(workflowEvents.status, 'PendingSupervisorSignOff'),
        ),
      )
      .orderBy(desc(workflowEvents.at), desc(workflowEvents.id))
      .limit(1);
    return row?.who ?? null;
  }

  protected toDto(
    row: EventRow,
    scope: readonly ScopedRole[],
  ): UnsecuredDto<WorkflowEvent> {
    const dto: unknown = {
      id: row.id,
      __typename: 'GtlReportWorkflowEvent',
      createdAt: DateTime.fromJSDate(row.at),
      at: DateTime.fromJSDate(row.at),
      // Exactly one actor column is set. `ActorLoader` resolves users and
      // system agents alike, so downstream only needs the one id.
      who: { id: (row.who ?? row.whoSystemAgentId)! },
      // The transition KEY; the service resolves it to the transition object.
      // Null means the workflow was bypassed.
      transition: row.transitionKey ?? null,
      to: row.status,
      notes: row.notes ?? null,
      report: { id: row.reportId },
      scope,
    };
    return dto as UnsecuredDto<WorkflowEvent>;
  }
}
