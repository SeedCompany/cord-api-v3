import { inArray } from 'drizzle-orm';
import { type ID } from '~/common';
import {
  fieldRegions,
  fileNodes,
  locations,
  organizations,
  projectOtherLocations,
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
  keepBlank,
  keepLanded,
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
 * `root_directory_id` is backfilled from the same `rootDirectory` relationship
 * the live repo hydrates — the File wave landed `file_nodes` with identical ids
 * carried over from Neo4j, so no second pass is needed: `file` just has to run
 * before `project` (added to `dependsOn` below) and the id is already sitting
 * on the DTO. `department_id_block_id` has no Neo4j source (the PG handler
 * doesn't write it either) — NULL.
 */
export const projectExtractor: Extractor = {
  name: 'project',
  targetTables: [
    'projects',
    'project_workflow_events',
    'project_other_locations',
  ],
  dependsOn: [
    'user',
    'location',
    'fieldRegion',
    'organization',
    'departmentIdBlock',
    'file',
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
    // 'FileNode' matches Directory/File/FileVersion alike, same as file.extractor.ts's
    // own read — a rootDirectory only ever points at a Directory, but checking the
    // shared label is what the `file` extractor's landed set actually supports.
    const liveFileNodes = await liveTargetIds(ctx, 'FileNode', fileNodes);
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
        sensitivity: orDefault(
          ctx,
          'projects.sensitivity',
          p.sensitivity,
          'High' as const,
        ),
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
        rootDirectoryId: liveOrNull(linkId(p.rootDirectory), liveFileNodes),
        mouStart: dateStr(p.mouStart),
        mouEnd: dateStr(p.mouEnd),
        initialMouEnd: dateStr(p.initialMouEnd),
        estimatedSubmission: dateStr(p.estimatedSubmission),
        // Carried across verbatim, nulls included. Postgres used to derive
        // this from the latest workflow event, but that trail only starts
        // 2021-02-13 and 1,560 projects moved step before it existed — see
        // migration 0041. All 4,305 stored values carry a time and zone, so
        // `ts` cannot pick up the loader machine's timezone here.
        stepChangedAt: ts(p.stepChangedAt),
        financialReportReceivedAt: ts(p.financialReportReceivedAt),
        financialReportPeriod,
        tags: [...orDefault(ctx, 'projects.tags', p.tags, [])],
        // Nullable since migration 0042 — a project nobody marked is blank,
        // not a definite "no". Also keeps the `presetInventory: false` list
        // filter from sweeping in every unmarked project, which is what
        // Neo4j's `filter.propVal()` does today.
        presetInventory: keepBlank(
          ctx,
          'projects.preset_inventory',
          p.presetInventory,
        ),
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
        `    ⚠ nulled ${danglingRefs} dangling project ref(s) to soft-deleted/dropped locations/regions/orgs/root-directories (prod-finding #2)`,
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
              e.transition AS transitionKey, e.to AS toStep,
              e.notes AS notes, w.id AS who
       ORDER BY p.id, e.createdAt ASC`,
    );

    const knownSteps = new Set<string>(projectStepEnum.enumValues);
    // Postgres truth rather than the mapped `rows`, for the same reason the
    // other_locations junction below reads it: a project that mapped fine can
    // still have been dropped by onConflictDoNothing, and its events would then
    // FK-abort. `rows` only catches the hydrate-drop half of that.
    const projectIds = ctx.dryRun
      ? new Set(rows.map((row) => row.id))
      : await liveTargetIds(ctx, 'Project', projects);
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

    // ── Step + modifiedAt + stepChangedAt re-assert ────────────────────────
    // Inserting the events fired the step-sync trigger, which sets
    // `projects.step`, `projects.modified_at` AND `projects.step_changed_at`
    // from the newest event (`sync_project_step_from_event`, 0010 as amended
    // by 0041). Three distinct corrections are needed, and the last two are
    // easy to miss:
    //
    //   step — where Neo4j's current step disagrees with its own event history
    //     (steps taken outside the workflow), Neo4j wins, it is the live value.
    //
    //   modified_at — the trigger REGRESSES it to the last transition's
    //     timestamp, discarding the Neo4j value this extractor deliberately
    //     carries (S7). A project last transitioned in 2023 but edited in 2026
    //     would land claiming it had not been touched since 2023, and the
    //     Postgres read side both returns and sorts/filters on this column.
    //     Every project with at least one event is affected, so this is not an
    //     edge case. `updated_at` keeps the carried value either way, which is
    //     the cheapest way to spot the divergence if it ever regresses again.
    //
    //   step_changed_at — same shape as modified_at, and it matters MOST where
    //     Neo4j holds nothing. 509 projects have an event trail but no stored
    //     value, because their newest event is the February-2021 backfill that
    //     created the trail — many carry no transition key at all, so nobody
    //     moved them; the trail was simply written around them. Letting the
    //     trigger stand there reports "step changed Feb 2021" for a project
    //     completed in 2015, which is a migration artifact dressed as a
    //     business date — the same mistake as the created_at fallback 0041
    //     removes. Neo4j reports blank; blank is the honest answer, so a
    //     carried NULL has to win over the trigger.
    if (!ctx.dryRun) {
      const wantById = new Map(
        rows.map((row) => [
          row.id,
          {
            step: row.step,
            modifiedAt: row.modifiedAt,
            stepChangedAt: row.stepChangedAt,
          },
        ]),
      );
      const live = await ctx.db
        .select({
          id: projects.id,
          step: projects.step,
          modifiedAt: projects.modifiedAt,
          stepChangedAt: projects.stepChangedAt,
        })
        .from(projects)
        .where(inArray(projects.id, [...wantById.keys()]));

      let stepDrift = 0;
      let modifiedDrift = 0;
      let stepChangedDrift = 0;
      /** Two timestamps agree when both are absent or both name the instant. */
      const sameMoment = (a: Date | null, b: Date | null) =>
        a === null || b === null ? a === b : a.getTime() === b.getTime();
      const drifted = live.filter((row) => {
        const want = wantById.get(row.id);
        if (!want) return false;
        const stepOff = want.step !== row.step;
        const modifiedOff =
          want.modifiedAt.getTime() !== row.modifiedAt.getTime();
        const stepChangedOff = !sameMoment(
          want.stepChangedAt,
          row.stepChangedAt,
        );
        if (stepOff) stepDrift++;
        if (modifiedOff) modifiedDrift++;
        if (stepChangedOff) stepChangedDrift++;
        return stepOff || modifiedOff || stepChangedOff;
      });
      for (const row of drifted) {
        const want = wantById.get(row.id)!;
        await ctx.db
          .update(projects)
          .set({
            step: want.step,
            modifiedAt: want.modifiedAt,
            stepChangedAt: want.stepChangedAt,
          })
          .where(inArray(projects.id, [row.id]));
      }
      if (stepDrift) {
        ctx.log(
          `    ⚠ re-asserted step on ${stepDrift} project(s) where event history disagreed with the live Neo4j step`,
        );
      }
      if (modifiedDrift) {
        ctx.log(
          `    ⚠ restored modifiedAt on ${modifiedDrift} project(s) that the step-sync trigger had set to their last transition time`,
        );
      }
      if (stepChangedDrift) {
        ctx.log(
          `    ⚠ restored stepChangedAt on ${stepChangedDrift} project(s) the step-sync trigger had overwritten — ` +
            'includes the ones Neo4j leaves blank, which must stay blank',
        );
      }
    }

    // ── project_other_locations ────────────────────────────────────────────
    // The plural `otherLocations` edge — distinct from the singular
    // primaryLocation/marketingLocation FKs mapped above. Mirrors
    // organization.extractor.ts's `organization_locations` junction, same
    // landed-both-sides guard. Reads Postgres truth for `Project` (not the
    // `dtos`/`rows` read set) since onConflictDoNothing can drop a project
    // this wave otherwise assumed landed — same reasoning as `landedUsers` in
    // user.extractor.ts.
    const otherLocPairs = await cypher<{ projectId: ID; locationId: ID }>(
      ctx,
      `MATCH (p:Project)-[:otherLocations { active: true }]->(l:Location)
       RETURN p.id AS projectId, l.id AS locationId`,
    );
    const landedProjects = await liveTargetIds(ctx, 'Project', projects);
    const otherLocRows = keepLanded(otherLocPairs, [
      [landedProjects, (row) => row.projectId],
      [liveLocations, (row) => row.locationId],
    ]);
    if (otherLocRows.skipped > 0) {
      ctx.log(
        `    ⚠ skipped ${otherLocRows.skipped} project_other_locations row(s) — project or location never landed`,
      );
    }
    out.project_other_locations = stat(
      otherLocPairs.length,
      await bulkInsert(ctx, projectOtherLocations, otherLocRows.kept),
    );

    return out;
  },
};
