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
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { projects, projectWorkflowEvents } from '~/core/drizzle/schema';
import { PolicyExecutor } from '../../authorization/policy/executor/policy-executor';
import { type ProjectStep } from '../dto';
import {
  type ExecuteProjectTransition,
  ProjectWorkflowEvent as WorkflowEvent,
} from './dto';

/**
 * PostgreSQL implementation of the canonical `ProjectWorkflowRepository`.
 *
 * `projects.step` is kept in sync by an `AFTER INSERT` trigger on
 * `project_workflow_events` (see migration 0010 — `sync_project_step_from_event`).
 * App code never writes to `projects.step` directly; insert an event and the
 * trigger does the rest. `modified_at` is bumped in the same trigger.
 *
 * `status` is a `GENERATED ALWAYS AS (CASE step ... END) STORED` column, so it
 * follows step automatically — no extra write needed.
 *
 * `stepChangedAt` derives from the event's `at` timestamp at read time on the
 * Project resolver; nothing is stored on `projects` for it.
 */
// migration-todo: `PublicOf<ProjectWorkflowRepository>` widens to every
// public/protected member of the Gel base (privileges, getActualChanges,
// isUnique, etc.) which this class doesn't reproduce. Same trade as every
// other Drizzle repo — we rely on the `as any` cast at splitDb registration
// time and lose compile-time enforcement here. Collapses at Phase 7 cutover.
@Injectable()
export class ProjectWorkflowDrizzleRepository {
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
   * Permission: `filterToReadable()` there, `applyReadFilter` here. Read on a
   * project workflow event is granted outright to some roles and not at all to
   * others — Marketing, Fundraising and StaffMember can read a project but hold
   * no grant on its events, so Neo4j resolves their permission to false and
   * returns nothing. Securing the DTO is not a substitute: only `who` and `notes`
   * are secured, so `id`, `at`, `to` and `transition` would pass through
   * untouched and hand over the project's whole approval-and-rejection history,
   * timestamps included. Returns null when the reader has no grant, and the
   * callers answer with an empty list rather than asking the database.
   *
   * Ancestry: `matchEvent()` there requires `node('project', 'Project')`, and
   * soft delete relabels to `Deleted_Project`, so an event under a removed
   * project matches nothing. Migration 0010's `ON DELETE CASCADE` is no
   * substitute, because the project row never leaves.
   *
   * A plain join, not the relational `with:` plus an EXISTS. The first version of
   * this used a correlated EXISTS inside `db.query.…findMany`, and it returned
   * nothing at all: the relational builder aliases the table it is querying, so
   * the subquery's reference to the outer column did not bind to it. That is a
   * silent wrong answer rather than an error — the workflow-event list simply came
   * back empty — so the join is both correct and the shape whose behaviour is
   * obvious from reading it.
   */
  private readableEventsUnderLiveProject(...narrowing: SQL[]) {
    const conditions: SQL[] = [isNull(projects.deletedAt), ...narrowing];
    // The caller's own conditions go in this ONE array with everything else.
    // Chaining a second `.where()` onto the built query would REPLACE this
    // clause, not add to it — silently dropping the read filter.
    if (!this.executor.applyReadFilter(this.resource, conditions)) {
      return null;
    }
    return this.db
      .select({
        ...getTableColumns(projectWorkflowEvents),
        // Exactly the three columns the DTO reads off the parent.
        project: {
          id: projects.id,
          type: projects.type,
          step: projects.step,
        },
      })
      .from(projectWorkflowEvents)
      .innerJoin(projects, eq(projects.id, projectWorkflowEvents.projectId))
      .where(and(...conditions));
  }

  // migration-todo: the actor's liveness is still missing, the same gap the
  // sibling ProgressReport repo closed. Neo4j's `hydrate()` requires
  // `node('who', 'Actor')`, and soft delete prefixes every label including
  // `Actor`, so an event whose actor was deleted does not come back there. Here
  // the row survives and the actor cannot be loaded, which nulls the event and
  // then the whole list. NOT the identical one-liner the sibling used: `who` is
  // nullable on this table because an event can be attributed to a system agent
  // instead (`who_system_agent_id`, migration 0031), so it has to allow a live
  // user OR an agent rather than inner-joining users. Left open deliberately —
  // it needs a Neo4j-side fact checked first (whether a SystemAgent node carries
  // the `Actor` label, which decides whether Neo4j keeps agent-actored events at
  // all), and that question is independent of the read filter above.
  async readMany(
    ids: readonly ID[],
  ): Promise<Array<UnsecuredDto<WorkflowEvent>>> {
    if (ids.length === 0) return [];
    const query = this.readableEventsUnderLiveProject(
      inArray(projectWorkflowEvents.id, [...ids]),
    );
    if (!query) return [];
    const rows = await query;
    return rows.map((row) => this.toDto(row));
  }

  async list(projectId: ID): Promise<Array<UnsecuredDto<WorkflowEvent>>> {
    const query = this.readableEventsUnderLiveProject(
      eq(projectWorkflowEvents.projectId, projectId),
    );
    if (!query) return [];
    const rows = await query.orderBy(asc(projectWorkflowEvents.at));
    return rows.map((row) => this.toDto(row));
  }

  /**
   * Insert a workflow event. The trigger handles `projects.step` /
   * `modified_at` sync. We capture the project's current step *before* insert
   * so the returned dto can carry `project.previousStep` — same surface as the
   * Neo4j repo, where `previousStep` is read from the pre-update Property
   * node within the same transaction.
   */
  async recordEvent(
    input: Omit<ExecuteProjectTransition, 'bypassTo'> & { to: ProjectStep },
  ): Promise<UnsecuredDto<WorkflowEvent>> {
    const [projectRow] = await this.db
      .select({ step: projects.step, type: projects.type })
      .from(projects)
      .where(eq(projects.id, input.project))
      .limit(1);
    const fromStep: ProjectStep | null = projectRow?.step ?? null;

    const id = await generateId<ID<'ProjectWorkflowEvent'>>();
    const actor = this.resolveActor();
    const at = new Date();

    await this.db.insert(projectWorkflowEvents).values({
      id,
      projectId: input.project,
      ...actor,
      fromStep,
      toStep: input.to,
      transitionKey: input.transition ?? null,
      notes: input.notes ?? null,
      at,
    });

    return this.toDto({
      id,
      projectId: input.project,
      ...actor,
      fromStep,
      toStep: input.to,
      transitionKey: input.transition ?? null,
      notes: input.notes ?? null,
      at,
      project: {
        id: input.project,
        type: projectRow!.type,
        step: fromStep ?? input.to,
      },
    });
  }

  /**
   * Which actor column this event belongs in. `Session.actor` owns the
   * user-vs-agent discrimination — including the migration-todo documenting the
   * two session shapes that defeat it (whose failure is the `users` FK, never
   * the actor-shape CHECK) — this only maps that to this table's columns.
   *
   * Do NOT read a population claim from this method. The agent-actored events
   * already in the data did not arrive through here — they came from the
   * step-history backfill, which writes directly and never calls `recordEvent`.
   * Migration 0031's header is the single source for that. (The Neo4j writer
   * cannot produce one at all: it builds the `who` relationship against the `User`
   * label, which system agents never carry.)
   *
   * Exactly one column is returned non-null, satisfying
   * `project_workflow_events_actor_shape_chk` (migration 0031).
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
   * Walk this project's event history and return the most recent `to_step`
   * matching any of `steps`. Drives the `BackToActive` dynamic step in
   * `project-workflow.ts` (and any future dynamic-state resolver). Returns
   * null when the project has never reached one of those steps.
   */
  async mostRecentStep(
    projectId: ID<'Project'>,
    steps: readonly ProjectStep[],
  ): Promise<ProjectStep | null> {
    if (steps.length === 0) return null;
    const rows = await this.db
      .select({ step: projectWorkflowEvents.toStep })
      .from(projectWorkflowEvents)
      .where(
        and(
          eq(projectWorkflowEvents.projectId, projectId),
          inArray(projectWorkflowEvents.toStep, [...steps]),
        ),
      )
      .orderBy(desc(projectWorkflowEvents.at))
      .limit(1);
    return rows[0]?.step ?? null;
  }

  protected toDto(
    row: typeof projectWorkflowEvents.$inferSelect & {
      project?: { id: ID<'Project'>; type: string; step: ProjectStep } | null;
    },
  ): UnsecuredDto<WorkflowEvent> & {
    project: { id: ID<'Project'>; type: string; previousStep: ProjectStep };
  } {
    if (!row.project) {
      // Schema FK is NOT NULL → the relational findMany typing widens to nullable
      // but the row always exists. Loud failure beats silent NaN.
      throw new Error(
        `ProjectWorkflowEvent ${row.id} missing parent project row — FK invariant violated`,
      );
    }
    const dto: unknown = {
      id: row.id,
      __typename: 'ProjectWorkflowEvent',
      createdAt: DateTime.fromJSDate(row.at),
      at: DateTime.fromJSDate(row.at),
      // Exactly one actor column is set (CHECK, migration 0031). The resolver
      // hydrates whichever id through `ActorLoader`, which resolves users and
      // system agents alike and returns `SecuredActor` — so nothing downstream
      // needs to know which of the two it got.
      who: { id: (row.who ?? row.whoSystemAgentId)! },
      // `transition` is the transition key (a string id resolved to a
      // WorkflowTransition object at the resolver layer). null when the
      // transition was bypassed or dynamic.
      transition: row.transitionKey ?? null,
      to: row.toStep,
      notes: row.notes ?? null,
      project: {
        id: row.project.id,
        type: row.project.type,
        // `previousStep` = the project's step at the time the event was
        // observed (post-trigger, this *is* the previous step from the
        // event's POV because the trigger has already moved the project to
        // `to_step`). `recordEvent` overrides this with the captured
        // `fromStep` so its caller sees the correct value.
        previousStep: row.fromStep ?? row.project.step,
      },
    };
    return dto as UnsecuredDto<WorkflowEvent> & {
      project: { id: ID<'Project'>; type: string; previousStep: ProjectStep };
    };
  }
}
