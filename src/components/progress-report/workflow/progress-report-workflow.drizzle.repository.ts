import { Injectable } from '@nestjs/common';
import {
  and,
  asc,
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  isNull,
  type SQL,
} from 'drizzle-orm';
import { DateTime } from 'luxon';
import { type SetRequired } from 'type-fest';
import {
  EnhancedResource,
  generateId,
  type ID,
  NotFoundException,
  type Role,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import {
  engagements,
  languages,
  periodicReports,
  projectMembers,
  projects,
  users,
  progressReportWorkflowEvents as workflowEvents,
} from '~/core/drizzle/schema';
import { PolicyExecutor } from '../../authorization/policy/executor/policy-executor';
import { type ProgressReportStatus as Status } from '../dto';
import { type ExecuteProgressReportTransition } from './dto/execute-progress-report-transition.input';
import { ProgressReportWorkflowEvent as WorkflowEvent } from './dto/workflow-event.dto';

/**
 * Postgres implementation of `ProgressReportWorkflowRepository`.
 *
 * Events are append-only facts in `progress_report_workflow_events`; the
 * report's current status lives on `periodic_reports.status` and is written by
 * `changeStatus`. That split is deliberate and differs from both siblings:
 * Neo4j stores status as a Property node updated in place, and Gel *computes* it
 * from the event history (hence its `changeStatus` being a no-op). Keeping an
 * explicit column write is the faithful-to-Neo4j choice for the migration; the
 * trigger-maintained alternative (as `project_workflow_events` does for
 * `projects.step`) is noted in migration 0036 as a DB-invariants-pass candidate.
 */
// migration-todo: no `implements PublicOf<Neo4jRepository>` — that base widens to
// DtoRepository's privileges/getBaseNode/etc. Same trade as every other Drizzle
// repo; collapses at Phase 7 cutover.
@Injectable()
export class ProgressReportWorkflowDrizzleRepository {
  private readonly resource = EnhancedResource.of(WorkflowEvent);

  constructor(
    private readonly drizzle: DrizzleService,
    private readonly identity: Identity,
    private readonly executor: PolicyExecutor,
  ) {}

  protected get db() {
    return this.drizzle.client;
  }

  /**
   * What the reader is allowed to see, plus the ancestry Neo4j requires.
   *
   * Two separate rules, both of which the Neo4j repo gets and this one used to
   * skip.
   *
   * Permission: `filterToReadable()` there, `applyReadFilter` here. Read
   * resolves to a plain boolean, not to the per-transition condition: an action
   * getter captures whatever condition is staged *at that moment*
   * (`perm-granter.ts` `[action]`, `stagedCondition ?? true`), and every policy
   * writes `.read` before staging, so the condition it stages governs the
   * following `execute` instead. Read is therefore granted outright to a handful
   * of roles and absent for Field Partner and Translator, who get execute only —
   * Neo4j resolves their read to false and returns nothing. Securing the DTO does
   * not stand in for this: only `who` and `notes` are secured, so
   * `id`, `at`, `status` and `transition` would pass through untouched and hand a
   * report's whole internal review-and-reject history to anyone who can read the
   * report. Returns false when the reader has no read grant, and then we return
   * nothing rather than asking the database.
   *
   * Ancestry: Neo4j's `matchEvent()` is a required match up through
   * `:ProgressReport` ← `:Engagement` ← `:Project`, and its soft delete relabels
   * to `Deleted_*`, so an event under any removed ancestor matches nothing. The
   * join chain here is the same walk `getProjectMemberInfoByReportId` below
   * already does. Migration 0036's `ON DELETE CASCADE` is no substitute: 0035
   * made the report soft-delete, so the constraint never fires.
   */
  private readableEvents(...narrowing: SQL[]) {
    const conditions: SQL[] = [
      isNull(periodicReports.deletedAt),
      isNull(engagements.deletedAt),
      isNull(projects.deletedAt),
      // The author too. Neo4j's `hydrate()` opens with a REQUIRED match on
      // `(node)-[:who]->(who:User)`, and soft-deleting a user relabels it to
      // `Deleted_User`, so the event simply does not come back there — one fewer
      // event, no error. Postgres keeps the row (the delete is soft, so the FK
      // never fires), and `mapSecuredValue` now degrades a missing `who` to a
      // null field rather than throwing — so without this filter the event
      // would still render, just with an authorless `who`. That's a new shape
      // Neo4j never produces. Hiding the event matches Neo4j rather than
      // inventing a contract.
      isNull(users.deletedAt),
      ...narrowing,
    ];
    // The caller's own conditions go in this ONE array with everything else.
    // Chaining a second `.where()` onto the built query would REPLACE this
    // clause, not add to it — silently dropping the read filter.
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return null;
    }
    // Select the event's own columns so the row stays flat and `toDto` takes it
    // unchanged; a bare `.select()` over joins nests each table under its name.
    return this.db
      .select(getTableColumns(workflowEvents))
      .from(workflowEvents)
      .innerJoin(
        periodicReports,
        eq(periodicReports.id, workflowEvents.reportId),
      )
      .innerJoin(engagements, eq(engagements.id, periodicReports.engagementId))
      .innerJoin(projects, eq(projects.id, engagements.projectId))
      .innerJoin(users, eq(users.id, workflowEvents.who))
      .where(and(...conditions));
  }

  async readMany(
    ids: readonly ID[],
  ): Promise<Array<UnsecuredDto<WorkflowEvent>>> {
    if (ids.length === 0) return [];
    const query = this.readableEvents(
      inArray(workflowEvents.id, [...ids] as Array<
        ID<'ProgressReportWorkflowEvent'>
      >),
    );
    if (!query) return [];
    return (await query).map((row) => this.toDto(row));
  }

  async list(reportId: ID): Promise<Array<UnsecuredDto<WorkflowEvent>>> {
    const query = this.readableEvents(
      eq(workflowEvents.reportId, reportId as ID<'ProgressReport'>),
    );
    if (!query) return [];
    const rows = await query
      // Neo4j sorts by createdAt ASC; `at` is this table's createdAt.
      .orderBy(asc(workflowEvents.at), asc(workflowEvents.id));
    return rows.map((row) => this.toDto(row));
  }

  async recordEvent({
    report,
    ...props
  }: SetRequired<ExecuteProgressReportTransition, 'status'>): Promise<
    UnsecuredDto<WorkflowEvent>
  > {
    const id = await generateId<ID<'ProgressReportWorkflowEvent'>>();
    const who = this.identity.current.userId;
    const at = new Date();

    const row = {
      id,
      reportId: report as ID<'ProgressReport'>,
      who,
      status: props.status,
      transitionKey: props.transition ?? null,
      notes: props.notes ?? null,
      at,
    };
    await this.db.insert(workflowEvents).values(row);
    return this.toDto(row);
  }

  async currentStatus(reportId: ID): Promise<Status> {
    const [row] = await this.db
      .select({ status: periodicReports.status })
      .from(periodicReports)
      .where(
        and(
          eq(periodicReports.id, reportId),
          eq(periodicReports.type, 'Progress'),
          // A soft-deleted report loses its `:ProgressReport` label in Neo4j
          // (migration 0035), so it reads as missing — same here.
          isNull(periodicReports.deletedAt),
        ),
      )
      .limit(1);
    // Split exactly as the Neo4j repo does: a missing report and a report with
    // no status are different failures, and callers surface them differently.
    if (!row) {
      throw new NotFoundException('Could not find report', 'report');
    }
    if (!row.status) {
      throw new NotFoundException('Could not find report status');
    }
    return row.status;
  }

  async changeStatus(report: ID, status: Status) {
    await this.db
      .update(periodicReports)
      .set({ status, updatedAt: new Date() })
      .where(
        and(eq(periodicReports.id, report), isNull(periodicReports.deletedAt)),
      );
  }

  /**
   * Notification recipients: users on the report's project who are still active
   * members and have an email.
   *
   * The active-member filter is load-bearing and is kept from the Neo4j repo
   * (`inactiveAt IS NULL`) — the Gel repo omits it, which would widen the
   * recipient set. Given the 2026-07-09 duplicate-email incident, widening who
   * gets mailed is not a divergence to inherit silently.
   */
  async getProjectMemberInfoByReportId(
    reportId: ID,
  ): Promise<Array<{ id: ID<'User'>; email: string; roles: readonly Role[] }>> {
    const rows = await this.db
      .select({
        id: users.id,
        email: users.email,
        roles: projectMembers.roles,
      })
      .from(periodicReports)
      .innerJoin(engagements, eq(engagements.id, periodicReports.engagementId))
      .innerJoin(projects, eq(projects.id, engagements.projectId))
      .innerJoin(projectMembers, eq(projectMembers.projectId, projects.id))
      .innerJoin(users, eq(users.id, projectMembers.userId))
      .where(
        and(
          eq(periodicReports.id, reportId),
          isNull(periodicReports.deletedAt),
          // Liveness the Neo4j query gets for free from its `:Engagement` /
          // `:Project` labels (soft delete relabels to `Deleted_*`). Omitting
          // these is the S3 class the audit flagged repeatedly — an archived
          // project would keep mailing its members.
          isNull(engagements.deletedAt),
          isNull(projects.deletedAt),
          isNull(projectMembers.inactiveAt),
          isNull(projectMembers.deletedAt),
          isNull(users.deletedAt),
          isNotNull(users.email),
        ),
      );
    // `isNotNull` above guarantees the email, but the column type stays
    // nullable — narrow in TS rather than assert.
    return rows.flatMap((row) =>
      row.email
        ? [{ id: row.id, email: row.email, roles: row.roles ?? [] }]
        : [],
    );
  }

  async getUserIdByEmails(
    emails: readonly string[],
  ): Promise<Array<{ id: ID<'User'>; email: string }>> {
    if (emails.length === 0) return [];
    const rows = await this.db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(and(inArray(users.email, [...emails]), isNull(users.deletedAt)));
    return rows.flatMap((row) =>
      row.email ? [{ id: row.id, email: row.email }] : [],
    );
  }

  async getProjectInfoByReportId(reportId: ID) {
    const [row] = await this.db
      .select({
        projectId: projects.id,
        languageId: languages.id,
      })
      .from(periodicReports)
      .innerJoin(engagements, eq(engagements.id, periodicReports.engagementId))
      .innerJoin(projects, eq(projects.id, engagements.projectId))
      .innerJoin(languages, eq(languages.id, engagements.languageId))
      .where(
        and(
          eq(periodicReports.id, reportId),
          isNull(periodicReports.deletedAt),
          isNull(engagements.deletedAt),
          isNull(projects.deletedAt),
          isNull(languages.deletedAt),
        ),
      )
      .limit(1);
    if (!row) {
      throw new ServerException(
        `Unable to retrieve project and language information for reportId ${reportId}`,
      );
    }
    return row;
  }

  protected toDto(
    row: typeof workflowEvents.$inferSelect,
  ): UnsecuredDto<WorkflowEvent> {
    const dto: unknown = {
      id: row.id,
      __typename: 'ProgressReportWorkflowEvent',
      createdAt: DateTime.fromJSDate(row.at),
      at: DateTime.fromJSDate(row.at),
      who: { id: row.who },
      // The transition *key*; the service resolves it to a WorkflowTransition
      // object. Null means the workflow was bypassed.
      transition: row.transitionKey ?? null,
      status: row.status,
      notes: row.notes ?? null,
    };
    return dto as UnsecuredDto<WorkflowEvent>;
  }
}
