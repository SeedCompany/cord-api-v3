import { Injectable } from '@nestjs/common';
import { and, desc, eq, inArray } from 'drizzle-orm';
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
 * `project_workflow_events` (see migration 0009 — `sync_project_step_from_event`).
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

  async readMany(
    ids: readonly ID[],
  ): Promise<Array<UnsecuredDto<WorkflowEvent>>> {
    if (ids.length === 0) return [];
    const rows = await this.db.query.projectWorkflowEvents.findMany({
      where: (e) => inArray(e.id, [...ids]),
      with: { project: { columns: { id: true, type: true, step: true } } },
    });
    return rows.map((row) => this.toDto(row));
  }

  async list(projectId: ID): Promise<Array<UnsecuredDto<WorkflowEvent>>> {
    const rows = await this.db.query.projectWorkflowEvents.findMany({
      where: (e) => eq(e.projectId, projectId),
      with: { project: { columns: { id: true, type: true, step: true } } },
      orderBy: (e, { asc }) => [asc(e.at)],
    });
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
    const who = this.identity.current.userId;
    const at = new Date();

    await this.db.insert(projectWorkflowEvents).values({
      id,
      projectId: input.project,
      who,
      fromStep,
      toStep: input.to,
      transitionKey: input.transition ?? null,
      notes: input.notes ?? null,
      at,
    });

    return this.toDto({
      id,
      projectId: input.project,
      who,
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
      who: { id: row.who },
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
