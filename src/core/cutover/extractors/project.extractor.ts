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
    // `who` is FK → users; Neo4j actors can be SystemAgents, which have no
    // users row. Those events are dropped + logged — migration-todo(cutover):
    // decide mapping (relax FK vs attribute to root) before prod.
    const userIds = await liveTargetIds(ctx, 'User', users);

    const events = await cypher<{
      projectId: ID;
      id: ID;
      at: string;
      transitionKey: string | null;
      toStep: string;
      notes: string | null;
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
    let droppedSteps = 0;
    const lastStepByProject = new Map<ID, string>();
    const eventRows = events.flatMap((event) => {
      if (!event.who || !userIds.has(event.who)) {
        droppedActors++;
        return [];
      }
      if (!knownSteps.has(event.toStep) || !projectIds.has(event.projectId)) {
        droppedSteps++;
        return [];
      }
      const fromStep = lastStepByProject.get(event.projectId) ?? null;
      lastStepByProject.set(event.projectId, event.toStep);
      let notes: unknown = null;
      if (event.notes) {
        try {
          notes = JSON.parse(event.notes);
        } catch {
          notes = null;
        }
      }
      return [
        {
          id: event.id,
          projectId: event.projectId,
          who: event.who,
          // Runtime-validated against projectStepEnum above.
          fromStep: fromStep as ProjectStep | null,
          toStep: event.toStep as ProjectStep,
          transitionKey: event.transitionKey ?? null,
          notes,
          at: new Date(event.at),
        },
      ];
    });
    if (droppedActors) {
      ctx.log(
        `    ⚠ dropped ${droppedActors} workflow event(s) with SystemAgent/absent actors (who FK → users) — migration-todo(cutover): decide mapping`,
      );
    }
    if (droppedSteps) {
      ctx.log(
        `    ⚠ dropped ${droppedSteps} workflow event(s) with unknown steps or absent projects`,
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
