import { type ID } from '~/common';
import {
  fileNodes,
  pnpExtractionResultProblems,
  pnpExtractionResults,
} from '~/core/drizzle/schema';
import {
  bulkInsert,
  cypher,
  keepLanded,
  liveTargetIds,
  stat,
  ts,
  warnIfRelTypeUnknown,
} from '../cutover.helpers';
import { type Extractor, type TableStat } from '../cutover.types';

/**
 * PnpExtractionResult + its problems — the outcome of parsing an uploaded PnP
 * spreadsheet.
 *
 * Two things about the Neo4j shape drive this extractor:
 *
 * 1. **The result node holds no properties at all.** `save()` does
 *    `.setVariables({ result: '{}' })` to clear the old denormalized schema
 *    (pnp-extraction-result.neo4j.repository.ts:93), so the node carries neither
 *    an `id` nor a `createdAt`. The Postgres table matches on the id front — its
 *    primary key IS `file_id`, one result per File — but `created_at` is NOT NULL
 *    with no source to read. **The owning File's `createdAt` is used**, which is
 *    the closest defensible stand-in: a result is created by uploading a version
 *    of that file, so it cannot predate it. Flagged rather than hidden — if
 *    result timestamps ever matter, they have to come from somewhere else.
 * 2. **Problem data lives on the relationship, not a node.** Each problem is
 *    `(result)-[:problem { id, source, context }]->(:PnpProblemType)`, so `type`
 *    comes from the target node's id while everything else comes from the edge.
 *    `context` is stored as a JSON *string* via `apoc.convert.toJson`, so it must
 *    be parsed on the way into a `jsonb` column.
 *
 * Neither `[:pnpExtractionResult]` nor `[:problem]` carries an `active` flag —
 * `save()` hard-`delete`s the old problem edges instead of deactivating them — so
 * this query must not filter on one.
 */

interface RawProblem {
  id: ID | null;
  source: string | null;
  context: string | null;
  type: string | null;
}

interface RawResult {
  fileId: ID<'File'>;
  fileCreatedAt: { toJSDate: () => Date } | null;
  problems: RawProblem[];
}

const READ = `
  MATCH (file:File)-[:pnpExtractionResult]->(result:PnpExtractionResult)
  OPTIONAL MATCH (result)-[problemRel:problem]->(type:PnpProblemType)
  RETURN file.id AS fileId,
         file.createdAt AS fileCreatedAt,
         collect({
           id: problemRel.id,
           source: problemRel.source,
           context: problemRel.context,
           type: type.id
         }) AS problems
`;

/** The stored JSON string → the object a `jsonb` NOT NULL column takes. */
const parseContext = (
  value: string | null,
): Record<string, unknown> | undefined => {
  if (value == null) return {};
  try {
    const parsed: unknown = JSON.parse(value);
    // A bare array or scalar is legal JSON but not the type-specific render input
    // the column is declared to hold, so treat it as unusable rather than write it.
    return parsed !== null &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
};

export const pnpExtractionResultExtractor: Extractor = {
  name: 'pnpExtractionResult',
  targetTables: ['pnp_extraction_results', 'pnp_extraction_result_problems'],
  dependsOn: ['file'],
  async run(ctx) {
    const out: Record<string, TableStat> = {};
    await warnIfRelTypeUnknown(ctx, 'pnpExtractionResult');
    await warnIfRelTypeUnknown(ctx, 'problem');
    const raw = await cypher<RawResult>(ctx, READ);
    const landedFileNodes = await liveTargetIds(ctx, 'FileNode', fileNodes);

    const { kept, skipped } = keepLanded(raw, [
      [landedFileNodes, (row) => row.fileId],
    ]);
    if (skipped > 0) {
      ctx.log(
        `    ⚠ ${skipped} PnpExtractionResult(s) skipped — their File did not land ` +
          `(file_id is the primary key and carries the FK)`,
      );
    }

    const undated = kept.filter((row) => row.fileCreatedAt == null).length;
    if (undated > 0) {
      ctx.log(
        `    ⚠ ${undated} result(s) whose File has no createdAt — created_at falls back to the epoch`,
      );
    }

    const resultRows = kept.map((row) => ({
      fileId: row.fileId,
      createdAt: ts(row.fileCreatedAt) ?? new Date(0),
    }));
    const resultsInserted = await bulkInsert(
      ctx,
      pnpExtractionResults,
      resultRows,
    );

    // `collect()` over an OPTIONAL MATCH that found nothing still yields one
    // all-null map, because a map literal is itself non-null. Those are absences,
    // not problems.
    // Cannot use liveTargetIds here: this table's primary key is `file_id`, not
    // `id`, so the helper's `table.id` projection does not exist.
    const landedResultFiles = ctx.dryRun
      ? new Set(resultRows.map((row) => String(row.fileId)))
      : new Set(
          (
            await ctx.db
              .select({ fileId: pnpExtractionResults.fileId })
              .from(pnpExtractionResults)
          ).map((row) => String(row.fileId)),
        );

    let unusableContext = 0;
    let incomplete = 0;
    const problemRows: Array<{
      id: ID;
      fileId: ID<'File'>;
      type: string;
      source: string;
      context: Record<string, unknown>;
    }> = [];
    for (const row of kept) {
      if (!landedResultFiles.has(row.fileId)) continue;
      for (const problem of row.problems) {
        if (problem.id == null && problem.type == null) continue; // the null map
        if (
          problem.id == null ||
          problem.type == null ||
          problem.source == null
        ) {
          incomplete++;
          continue;
        }
        const context = parseContext(problem.context);
        if (context === undefined) {
          unusableContext++;
          continue;
        }
        problemRows.push({
          id: problem.id,
          fileId: row.fileId,
          type: problem.type,
          source: problem.source,
          context,
        });
      }
    }
    if (incomplete > 0) {
      ctx.log(
        `    ⚠ ${incomplete} problem edge(s) missing id, type or source — DROPPED (all three NOT NULL)`,
      );
    }
    if (unusableContext > 0) {
      ctx.log(
        `    ⚠ ${unusableContext} problem edge(s) whose context is not a JSON object — DROPPED ` +
          `(context is jsonb NOT NULL and the render input must be a map)`,
      );
    }

    const problemsInserted = await bulkInsert(
      ctx,
      pnpExtractionResultProblems,
      problemRows,
    );

    out.pnp_extraction_results = stat(resultRows.length, resultsInserted);
    out.pnp_extraction_result_problems = stat(
      problemRows.length,
      problemsInserted,
    );
    return out;
  },
};
