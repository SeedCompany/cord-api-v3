import { type ID } from '~/common';
import { tools, toolUsages, users } from '~/core/drizzle/schema';
import {
  bulkInsert,
  cypher,
  keepLanded,
  liveTargetIds,
  one,
  resolveParentTypes,
  warnIfRelTypeUnknown,
} from '../cutover.helpers';
import { type Extractor } from '../cutover.types';

/**
 * Tool usages — a record that some resource uses some tool, from some date.
 *
 * The container is polymorphic and deliberately unconstrained: Rob's scope call
 * (2026-07-29) is that a usage may attach to ANY resource, which is how the domain
 * was built. So `container_id` carries no foreign key and `container_type` stores
 * the container's concrete `__typename` alongside it.
 *
 * That discriminator is why this extractor resolves types through
 * {@link resolveParentTypes} rather than reading Neo4j labels. A Neo4j project node
 * carries a stack of labels (`BaseNode`, `Project`, `TranslationProject`,
 * `MomentumTranslationProject`) and picking the concrete one back out means
 * reimplementing precedence rules that already exist — twice over, since the read
 * path in the repository has its own copy keyed off this exact column. Asking
 * Postgres which table holds the id gives the same answer from the source of truth,
 * and it doubles as the landed-container guard, so the two can never disagree.
 *
 * A container that does not resolve is dropped rather than carried. Two reasons,
 * and they agree: Neo4j's hydrate opens with a required `(container:BaseNode)` match
 * and soft delete strips even the `BaseNode` label, so a usage under a removed
 * container does not come back there either — and here a row with no
 * `container_type` cannot be written at all, the column being NOT NULL. That is the
 * opposite call from `pin`, whose FK-less `resource_id` has no discriminator to fill
 * and so loses nothing by carrying an inert row.
 *
 * `tool_id` and `creator_id` are both real foreign keys AND both required matches in
 * the Neo4j hydrate, so the guards below reproduce behaviour rather than inventing
 * it.
 */
export const toolUsageExtractor: Extractor = {
  name: 'tool-usage',
  targetTables: ['tool_usages'],
  // Every domain resolveParentTypes can name has to have landed first, or a usage
  // on it looks like an unresolvable container and gets dropped.
  dependsOn: [
    'tool',
    'user',
    'language',
    'partner',
    'project',
    'engagement',
    'periodic-report',
  ],
  async run(ctx) {
    const rows = await cypher<{
      id: ID<'ToolUsage'>;
      containerId: ID;
      toolId: ID<'Tool'>;
      creatorId: ID<'User'> | null;
      startDate: string | null;
      createdAt: string | null;
      modifiedAt: string | null;
    }>(
      ctx,
      `MATCH (container:BaseNode)-[:uses { active: true }]->(node:ToolUsage)
       MATCH (node)-[:tool]->(tool:Tool)
       OPTIONAL MATCH (node)-[:creator]->(creator:Actor)
       OPTIONAL MATCH (node)-[:startDate { active: true }]->(startDate:Property)
       RETURN node.id AS id,
              container.id AS containerId,
              tool.id AS toolId,
              creator.id AS creatorId,
              toString(startDate.value) AS startDate,
              toString(node.createdAt) AS createdAt,
              toString(node.modifiedAt) AS modifiedAt`,
    );
    if (rows.length === 0) {
      await warnIfRelTypeUnknown(ctx, 'uses');
    }

    const landedTools = await liveTargetIds(ctx, 'Tool', tools);
    const landedUsers = await liveTargetIds(ctx, 'User', users);

    const creatorless = rows.filter((row) => !row.creatorId).length;
    if (creatorless > 0) {
      ctx.log(
        `    ⚠ DROPPED ${creatorless} tool usage(s) with no \`creator\` edge at all ` +
          `(creator_id is NOT NULL). Neo4j's hydrate requires that edge too, so these ` +
          `are already invisible in the app.`,
      );
    }

    const withRefs = keepLanded(
      rows.filter((row) => row.creatorId),
      [
        [landedTools, (row) => row.toolId],
        [landedUsers, (row) => row.creatorId!],
      ],
    );
    if (withRefs.skipped > 0) {
      ctx.log(
        `    ⚠ DROPPED ${withRefs.skipped} tool usage(s) whose tool or creator never ` +
          `landed (both are real FKs). Note the creator must be a live USER — a usage ` +
          `attributed to a system agent would land here, and system agents live in a ` +
          `different table, so it would be reported rather than written.`,
      );
    }

    // Dry-run cannot do this: `resolveParentTypes` reads the Postgres tables, which
    // are empty until a real run has filled them. Report the shortfall instead of
    // silently treating every container as unresolvable.
    if (ctx.dryRun) {
      ctx.log(
        `    ℹ dry-run: container types are resolved against the Postgres tables, ` +
          `which are empty here, so ${withRefs.kept.length} usage(s) are counted as ` +
          `read but their container_type is unverified. A real run is what exercises ` +
          `this.`,
      );
      return one('tool_usages', rows.length, 0);
    }

    const containerTypes = await resolveParentTypes(
      ctx,
      withRefs.kept.map((row) => row.containerId),
    );

    const unresolved: string[] = [];
    const values = withRefs.kept.flatMap((row) => {
      const containerType = containerTypes.get(row.containerId);
      if (!containerType) {
        unresolved.push(row.containerId);
        return [];
      }
      const created = row.createdAt ? new Date(row.createdAt) : new Date();
      return [
        {
          id: row.id,
          containerId: row.containerId,
          containerType,
          toolId: row.toolId,
          creatorId: row.creatorId!,
          // A plain `date` column, not a timestamp — the usage records when the tool
          // started being used, with no time of day. Not `dateStr()`: that takes a
          // Luxon value, and the Cypher above has already stringified this one.
          // Neo4j renders both `date` and `datetime` ISO-first, so the leading ten
          // characters are the calendar date either way.
          startDate: row.startDate ? row.startDate.slice(0, 10) : null,
          createdAt: created,
          updatedAt: row.modifiedAt ? new Date(row.modifiedAt) : created,
          // The ETL is live-only; nothing arrives already deleted.
          deletedAt: null,
        },
      ];
    });
    if (unresolved.length > 0) {
      ctx.log(
        `    ⚠ DROPPED ${unresolved.length} tool usage(s) whose container did not ` +
          `resolve to a live row in any of the tables resolveParentTypes covers ` +
          `(progress report / engagement / project / partner / language / user). ` +
          `Expected causes: a soft-deleted or hard-deleted container, or a container ` +
          `on a resource type that map does not yet name. The second is worth ` +
          `checking — container_type is NOT NULL, so an unnamed type loses the row.`,
      );
    }

    const inserted = await bulkInsert(ctx, toolUsages, values);
    return one('tool_usages', rows.length, inserted);
  },
};
