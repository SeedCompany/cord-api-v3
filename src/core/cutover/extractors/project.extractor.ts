import { inArray } from 'drizzle-orm';
import { type ID } from '~/common';
import {
  fieldRegions,
  locations,
  organizations,
  projects,
  projectStepEnum,
  projectWorkflowEvents,
  reportPeriodEnum,
  systemAgents,
  users,
} from '~/core/drizzle/schema';
import {
  type Project,
  type ProjectStep,
} from '../../../components/project/dto';
import { ProjectRepository } from '../../../components/project/project.repository';
import {
  bulkInsert,
  cypher,
  dateStr,
  linkId,
  liveTargetIds,
  orDefault,
  readAllViaRepo,
  richText,
  stat,
  ts,
  tsReq,
} from '../cutover.helpers';
import { type Extractor, type TableStat } from '../cutover.types';

/**
 * Project + its workflow-event stream.
 *
 * Order matters twice over:
 *  - `projects` rows carry their current `step` (status is GENERATED from it).
 *  - `project_workflow_events` INSERTs fire the step-sync trigger, so events
 *    are inserted in chronological order per project; the last event's `to`
 *    should equal the row's step. A post-pass re-asserts the Neo4j step where
 *    history disagrees (legacy projects stepped outside the workflow).
 *
 * `root_directory_id` stays NULL — file_nodes isn't ETL'd yet; the File wave
 * backfills it (same IDs carry over). `department_id_block_id` has no Neo4j
 * source (the PG handler doesn't write it either) — NULL.
 */
export const projectExtractor: Extractor = {
  name: 'project',
  targetTables: ['projects', 'project_workflow_events'],
  dependsOn: [
    'user',
    'location',
    'fieldRegion',
    'organization',
    'departmentIdBlock',
  ],
  async run(ctx) {
    const out: Record<string, TableStat> = {};

    const dtos = await readAllViaRepo<Project>(
      ctx,
      'Project',
      ProjectRepository,
    );

    // Prod-finding #2 guard (dangling live→deleted refs): a live project can
    // reference a location/region/org that Neo4j soft-deleted (relabelled), so
    // the target row never migrates. Nullable FKs → null + log.
    const liveLocations = await liveTargetIds(ctx, 'Location', locations);
    const liveRegions = await liveTargetIds(ctx, 'FieldRegion', fieldRegions);
    const liveOrgs = await liveTargetIds(ctx, 'Organization', organizations);
    let danglingRefs = 0;
    const liveOrNull = <T extends string>(
      id: T | null,
      live: ReadonlySet<string>,
    ): T | null => {
      if (id && !live.has(id)) {
        danglingRefs++;
        return null;
      }
      return id;
    };

    const droppedValues = new Set<string>();
    const rows = dtos.map((p) => {
      const financialReportPeriod =
        p.financialReportPeriod &&
        (reportPeriodEnum.enumValues as readonly string[]).includes(
          p.financialReportPeriod,
        )
          ? p.financialReportPeriod
          : null;
      if (p.financialReportPeriod && !financialReportPeriod) {
        droppedValues.add(p.financialReportPeriod);
      }
      return {
        id: p.id,
        type: p.type,
        name: p.name,
        step: p.step,
        // Effective sensitivity from Neo4j is the real (engagement-derived)
        // value for translation projects — better than the schema default.
        sensitivity: orDefault(p.sensitivity, 'High' as const),
        // Writable only for Internship; translation rows derive theirs.
        ownSensitivity:
          p.type === 'Internship' ? (p.sensitivity ?? null) : null,
        rev79ProjectId: p.rev79ProjectId ?? null,
        departmentId: p.departmentId ?? null,
        // No Neo4j source; the PG SetDepartmentId path resolves blocks via
        // funding accounts, not this column.
        departmentIdBlockId: null,
        primaryLocationId: liveOrNull(linkId(p.primaryLocation), liveLocations),
        marketingLocationId: liveOrNull(
          linkId(p.marketingLocation),
          liveLocations,
        ),
        marketingRegionOverrideId: liveOrNull(
          linkId(p.marketingRegionOverride),
          liveLocations,
        ),
        fieldRegionId: liveOrNull(linkId(p.fieldRegion), liveRegions),
        owningOrganizationId: liveOrNull(
          linkId(p.owningOrganization),
          liveOrgs,
        ),
        // migration-todo(cutover): backfill from file_nodes in the File wave.
        rootDirectoryId: null,
        mouStart: dateStr(p.mouStart),
        mouEnd: dateStr(p.mouEnd),
        initialMouEnd: dateStr(p.initialMouEnd),
        estimatedSubmission: dateStr(p.estimatedSubmission),
        financialReportReceivedAt: ts(p.financialReportReceivedAt),
        financialReportPeriod,
        tags: [...orDefault(p.tags, [])],
        presetInventory: orDefault(p.presetInventory, false),
        createdAt: tsReq(p.createdAt),
        modifiedAt: tsReq(p.modifiedAt),
        updatedAt: tsReq(p.modifiedAt),
        deletedAt: null,
      };
    });
    if (droppedValues.size) {
      ctx.log(
        `    ⚠ dropped unknown project enum value(s): ${[...droppedValues].join(', ')} — migration-todo: map, don't drop`,
      );
    }
    if (danglingRefs) {
      ctx.log(
        `    ⚠ nulled ${danglingRefs} dangling project ref(s) to soft-deleted locations/regions/orgs (prod-finding #2)`,
      );
    }
    out.projects = stat(dtos.length, await bulkInsert(ctx, projects, rows));

    // ── Workflow events ────────────────────────────────────────────────────
    // Neo4j's `who` edge points at an :Actor, which is a User OR a SystemAgent —
    // and in production the agents are the MAJORITY: 18,054 of 27,244 events.
    // Migration 0031 gave the table one column per kind with a CHECK that
    // exactly one is set, so each actor is routed to the column matching what it
    // actually is. Before that, `who` was a NOT NULL FK to users and every
    // agent-driven event was dropped — two thirds of each project's step
    // history, silently, since a dropped row raises nothing.
    //
    // `system_agents` is loaded by the `user` extractor, which is already a
    // declared dependency, so both id sets are populated by the time we read.
    const userIds = await liveTargetIds(ctx, 'User', users);
    const agentIds = await liveTargetIds(ctx, 'SystemAgent', systemAgents);

    const events = await cypher<{
      projectId: ID;
      id: ID;
      at: string;
      transitionKey: string | null;
      toStep: string;
      // NOT `string`: the read transformer turns the stored `'\0RichText\0'`
      // form into a RichTextDocument object. Typing it as a string is what
      // invited JSON.parse and silently emptied every note.
      notes: unknown;
      who: ID | null;
    }>(
      ctx,
      `MATCH (p:Project)-[:workflowEvent { active: true }]->(e:ProjectWorkflowEvent)
       OPTIONAL MATCH (e)-[:who]->(w)
       RETURN p.id AS projectId, e.id AS id, toString(e.createdAt) AS at,
              e.transitionKey AS transitionKey, e.to AS toStep,
              e.notes AS notes, w.id AS who
       ORDER BY p.id, e.createdAt ASC`,
    );

    const knownSteps = new Set<string>(projectStepEnum.enumValues);
    const projectIds = new Set(rows.map((row) => row.id));
    let droppedActors = 0;
    let agentActors = 0;
    let droppedSteps = 0;
    let unusableNotes = 0;
    /**
     * Which actor column this event belongs in, or null if the actor cannot be
     * placed at all.
     *
     * Both sets are read from the *Postgres* tables in a real run, so an actor
     * whose own row was dropped upstream (a soft-deleted user, say) is caught
     * here rather than failing the insert. Production has none of either — 0
     * absent actors, 0 that resolve to neither table — so this returning null is
     * itself worth logging rather than passing over.
     */
    const resolveActor = (
      who: ID | null,
    ): { who: ID | null; whoSystemAgentId: ID | null } | null => {
      if (!who) return null;
      if (userIds.has(who)) return { who, whoSystemAgentId: null };
      if (agentIds.has(who)) return { who: null, whoSystemAgentId: who };
      return null;
    };
    const lastStepByProject = new Map<ID, string>();
    const eventRows = events.flatMap((event) => {
      // Advance the per-project step chain over EVERY Neo4j event, in order,
      // BEFORE any drop check — `from_step` is DERIVED here (Neo4j doesn't store
      // it), so a dropped event must still contribute its `to`.
      //
      // Otherwise the corruption is worse than the drop: with B→C dropped, the
      // next surviving event reported `from: B` and claimed a B→D transition
      // that never happened. Advancing unconditionally yields `from: C` — the
      // missing event becomes a visible discontinuity between consecutive rows
      // instead of invented history. A gap you can see beats a lie you can't.
      //
      // Only KNOWN steps advance it: an unrecognized value would flow into a
      // later row's enum-typed `from_step` and fail the insert, so the chain
      // holds at the last known step, which is the best available truth.
      const fromStep = lastStepByProject.get(event.projectId) ?? null;
      if (knownSteps.has(event.toStep)) {
        lastStepByProject.set(event.projectId, event.toStep);
      }
      const actor = resolveActor(event.who);
      if (!actor) {
        droppedActors++;
        return [];
      }
      if (actor.whoSystemAgentId) agentActors++;
      if (!knownSteps.has(event.toStep) || !projectIds.has(event.projectId)) {
        droppedSteps++;
        return [];
      }
      // `notes` is RichText. It must go through `richText()`, NOT JSON.parse:
      // the Neo4j connection installs a read transformer (`cypher.factory.ts`
      // sets `conn.transformer = new MyTransformer()`), which recognizes the
      // `'\0RichText\0'` prefix and hands back a RichTextDocument OBJECT. Calling
      // JSON.parse on an object stringifies it to '[object Object]' and throws,
      // and the catch turned that into null — so EVERY note was silently
      // discarded. Nothing failed; the column just came out empty.
      //
      // `richText()` also covers the case the transformer misses (a value nested
      // inside a map still arrives serialized), which matters because Postgres
      // jsonb cannot hold a NUL byte at all — passing the serialized form
      // through is a hard insert failure, not a cosmetic one.
      const parsedNotes = richText(event.notes);
      if (parsedNotes === undefined) unusableNotes++;
      const notes = parsedNotes ?? null;
      return [
        {
          id: event.id,
          projectId: event.projectId,
          ...actor,
          // Runtime-validated against projectStepEnum above.
          fromStep: fromStep as ProjectStep | null,
          toStep: event.toStep as ProjectStep,
          transitionKey: event.transitionKey ?? null,
          notes,
          at: tsReq(event.at),
        },
      ];
    });
    if (agentActors) {
      ctx.log(
        `    attributed ${agentActors} workflow event(s) to system agents (who_system_agent_id)`,
      );
    }
    if (droppedActors) {
      ctx.log(
        `    ⚠ dropped ${droppedActors} workflow event(s) whose actor is neither a live user nor a live system agent`,
      );
    }
    if (droppedSteps) {
      ctx.log(
        `    ⚠ dropped ${droppedSteps} workflow event(s) with unknown steps or absent projects`,
      );
    }
    if (unusableNotes) {
      ctx.log(
        `    ⚠ nulled ${unusableNotes} unparseable workflow-event note(s) — row kept, notes empty`,
      );
    }
    out.project_workflow_events = stat(
      events.length,
      await bulkInsert(ctx, projectWorkflowEvents, eventRows),
    );

    // ── Step re-assert ─────────────────────────────────────────────────────
    // The step-sync trigger set `projects.step` to each project's last event.
    // Where Neo4j's current step disagrees with its own event history (steps
    // taken outside the workflow), Neo4j wins — it's the live value.
    if (!ctx.dryRun) {
      const stepById = new Map(rows.map((row) => [row.id, row.step]));
      const live = await ctx.db
        .select({ id: projects.id, step: projects.step })
        .from(projects)
        .where(inArray(projects.id, [...stepById.keys()]));
      const drifted = live.filter((row) => stepById.get(row.id) !== row.step);
      for (const row of drifted) {
        await ctx.db
          .update(projects)
          .set({ step: stepById.get(row.id)! })
          .where(inArray(projects.id, [row.id]));
      }
      if (drifted.length) {
        ctx.log(
          `    ⚠ re-asserted step on ${drifted.length} project(s) where event history disagreed with the live Neo4j step`,
        );
      }
    }

    return out;
  },
};
