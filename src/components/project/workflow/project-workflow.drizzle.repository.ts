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
import { generateId, type ID, type UnsecuredDto } from '~/common';
import { Identity } from '~/core/authentication';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { projects, projectWorkflowEvents } from '~/core/drizzle/schema';
import { type ProjectStep } from '../dto';
import {
  type ExecuteProjectTransition,
  type ProjectWorkflowEvent as WorkflowEvent,
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
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly identity: Identity,
  ) {}

  protected get db() {
    return this.drizzle.client;
  }

  /**
   * Events, with their project, and only while that project is still live.
   *
   * The Neo4j repo gets the liveness from a label: `matchEvent()` requires
   * `node('project', 'Project')`, and soft delete relabels to `Deleted_Project`,
   * so an event under a removed project matches nothing. Migration 0010's
   * `ON DELETE CASCADE` is no substitute, because the project row never leaves.
   *
   * A plain join, not the relational `with:` plus an EXISTS. The first version of
   * this used a correlated EXISTS inside `db.query.…findMany`, and it returned
   * nothing at all: the relational builder aliases the table it is querying, so
   * the subquery's reference to the outer column did not bind to it. That is a
   * silent wrong answer rather than an error — the workflow-event list simply came
   * back empty — so the join is both correct and the shape whose behaviour is
   * obvious from reading it.
   */
  private eventsUnderLiveProject(...narrowing: SQL[]) {
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
      .where(and(isNull(projects.deletedAt), ...narrowing));
  }

  // migration-todo: the Neo4j repo also applies `privileges.filterToReadable()`
  // in both methods (project-workflow.neo4j.repository.ts:31 and :43) and this
  // class still does not. The sibling ProgressReport repo now does, so this is
  // the last of the pair.
  //
  // It is NOT a one-line addition here, which is why it is still open. Roles with
  // no read grant would be handled correctly for free — `applyReadFilter`
  // resolves those to plain false and never consults the condition. But roles
  // whose read is granted per-transition (Project Manager and Marketing on the
  // ProgressReport side; the same shape here) resolve to a TransitionCondition,
  // and `PolicyExecutor.drizzleFilter` THROWS on a condition with no
  // `asDrizzleCondition`. So adding the call without porting the condition would
  // replace a disclosure with a hard error on a page those roles use daily.
  //
  // The condition cannot be ported the way ProgressReport's was. That one is a
  // class local to its own workflow, so it can name its table directly. This one
  // is the shared generic `TransitionCondition<W>` in
  // src/components/workflow/workflow.granter.ts, used by the Project AND
  // Engagement workflows, and a generic condition has no way to reach its
  // Drizzle column: `AsDrizzleParams` carries the EnhancedResource, and there is
  // no resource -> table map anywhere in the codebase. Porting it means adding
  // one, or having each workflow definition carry its own transition column.
  // That is a design choice about shared authorization infrastructure and wants
  // its own change, not a hurried one bundled here.
  async readMany(
    ids: readonly ID[],
  ): Promise<Array<UnsecuredDto<WorkflowEvent>>> {
    if (ids.length === 0) return [];
    const rows = await this.eventsUnderLiveProject(
      inArray(projectWorkflowEvents.id, [...ids]),
    );
    return rows.map((row) => this.toDto(row));
  }

  async list(projectId: ID): Promise<Array<UnsecuredDto<WorkflowEvent>>> {
    const rows = await this.eventsUnderLiveProject(
      eq(projectWorkflowEvents.projectId, projectId),
    ).orderBy(asc(projectWorkflowEvents.at));
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
   * Which actor column this event belongs in.
   *
   * `identity.current.userId` holds a SystemAgent's id whenever the session
   * resolved to an agent rather than a person: an anonymous session (the Anonymous
   * agent) or Ghost impersonation. Both set `systemAgentName` in
   * `SessionManager.resumeSession`, which is what makes the discriminator below
   * work, and the audit writer discriminates on the same field.
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
   *
   * migration-todo: TWO session shapes slip past the discriminator, and in both the
   * failure is the foreign key to `users` — never the actor-shape CHECK, so that
   * constraint is not what protects this.
   *
   * 1. REACHABLE TODAY, over a request header. `resumeSession` resolves the Ghost
   *    agent only when the impersonatee id is the literal `'ghost'`; any other id
   *    passes straight through, and `systemAgentName` is set from `ghost?.name`.
   *    So a requester who sends a SystemAgent's REAL id as the impersonatee gets a
   *    session whose `userId` is that agent while `systemAgentName` stays
   *    undefined. The branch below reads it as a person, writes the agent id into
   *    `who`, fails the FK, and rolls the whole transition back. Nothing validates
   *    that the impersonatee is a live user. The underlying gap is pre-existing,
   *    engine-independent, and mirrored in the audit writer, so it is not this
   *    migration's to fix — but it is not hypothetical either.
   * 2. Unreachable today. `SessionManager.asRole` builds a session with the literal
   *    placeholder `userId: 'anonymous'`, `anonymous: false`, and no
   *    `systemAgentName`. Both call sites are read-only permission serializers
   *    (`policy-dumper.ts`, `permission.serializer.ts`), and `executeTransition`
   *    does no identity switching around `recordEvent`. The fix belongs in
   *    `asRole`.
   *
   * A safer shape for this method would be to treat an id that is not a live user
   * as an agent, or to fail with a domain error naming the session shape, rather
   * than handing an unresolvable id to the FK. Note this copy also omits the audit
   * writer's `session.anonymous ||` half — equivalent today, and it would catch
   * neither shape above (shape 2 sets `anonymous: false`; shape 1 has a real
   * logged-in requester).
   */
  private resolveActor(): {
    who: ID<'User'> | null;
    whoSystemAgentId: ID<'SystemAgent'> | null;
  } {
    const session = this.identity.current;
    return session.systemAgentName
      ? { who: null, whoSystemAgentId: session.userId as ID<'SystemAgent'> }
      : { who: session.userId as ID<'User'>, whoSystemAgentId: null };
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
