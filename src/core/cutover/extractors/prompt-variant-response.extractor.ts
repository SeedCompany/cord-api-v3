import { type ID } from '~/common';
import {
  periodicReports,
  promptVariantResponseEntries,
  promptVariantResponses,
  users,
} from '~/core/drizzle/schema';
import { ProgressReportCommunityStory } from '../../../components/progress-report/dto/community-stories.dto';
import { ProgressReportHighlight } from '../../../components/progress-report/dto/highlights.dto';
import { ProgressReportTeamNews } from '../../../components/progress-report/dto/team-news.dto';
import { type Prompt } from '../../../components/prompts/dto/prompt.dto';
import {
  bulkInsert,
  cypher,
  fetchIds,
  keepLanded,
  liveTargetIds,
  richText,
  stat,
  ts,
  tsReq,
} from '../cutover.helpers';
import { type Extractor, type TableStat } from '../cutover.types';

/**
 * PromptVariantResponse — the prompt/answer pairs on progress reports
 * (ProgressReportTeamNews / …Highlight / …CommunityStory), plus their per-variant
 * answers. Both live in one table pair discriminated by `resource_type`.
 *
 * The concrete DTO classes drive BOTH sides of the mapping: `type.name` is
 * simultaneously the Neo4j label and the `resource_type` value the drizzle repo
 * filters on, so there is no place for the two to drift apart. There is no
 * enumerable base label to use instead — `:PromptVariantResponse` exists but
 * carries no discriminator, and the whole point of `resource_type` is to keep
 * the subtypes apart.
 *
 * Two things about the entry (VariantResponse) rows:
 *
 * · The response history is carried, not just the current answer. Neo4j keeps
 *   superseded answers as `Deleted_VariantResponse` nodes whose `child` edge is
 *   still `active: true` — so the edge cannot be used to tell live from retired,
 *   only the LABEL can (109 nodes locally: 69 live, 40 retired). The partial
 *   unique index on (response_id, variant) is likewise scoped WHERE deleted_at
 *   IS NULL, which is exactly what makes carrying the history legal.
 *
 * · `response` needs a real conversion, not a copy. Neo4j stores rich text as a
 *   NUL-delimited tagged string (`\0RichText\0{…}` — see RichTextDocument), while
 *   the column is jsonb. Passing the stored form through would not merely be
 *   wrong, it would be rejected: Postgres text/jsonb cannot hold a NUL byte. The
 *   read transformer normally parses this on the way out, so the shared
 *   `richText()` helper is the belt to that braces (comments need it too).
 */
const PVR_TYPES = [
  ProgressReportTeamNews,
  ProgressReportHighlight,
  ProgressReportCommunityStory,
] as const;

interface PvrRow {
  id: ID;
  parentId: ID;
  creatorId: ID<'User'>;
  // The Cypher property already holds a Prompt id, not its text — see the
  // schema comment on `promptVariantResponses.prompt`.
  prompt: ID<Prompt>;
  createdAt: string;
  modifiedAt: string | null;
}

interface EntryRow {
  responseId: ID;
  variant: string;
  response: unknown;
  creatorId: ID<'User'>;
  createdAt: string;
  modifiedAt: string | null;
  deletedAt: string | null;
}

export const promptVariantResponseExtractor: Extractor = {
  name: 'prompt-variant-response',
  targetTables: ['prompt_variant_responses', 'prompt_variant_response_entries'],
  dependsOn: ['periodic-report', 'user'],
  async run(ctx) {
    const out: Record<string, TableStat> = {};

    const landedReports = await liveTargetIds(
      ctx,
      'PeriodicReport',
      periodicReports,
    );
    const landedUsers = await liveTargetIds(ctx, 'User', users);

    // ── prompt_variant_responses ──────────────────────────────────────────────
    const read: Array<PvrRow & { resourceType: string }> = [];
    for (const type of PVR_TYPES) {
      const rows = await cypher<PvrRow>(
        ctx,
        `MATCH (parent:BaseNode)-[:child { active: true }]->(n:\`${type.name}\`)
         MATCH (n)-[:creator]->(creator:User)
         MATCH (n)-[:prompt { active: true }]->(prompt:Property)
         RETURN n.id AS id, parent.id AS parentId, creator.id AS creatorId,
                prompt.value AS prompt, toString(n.createdAt) AS createdAt,
                toString(n.modifiedAt) AS modifiedAt`,
      );
      // Enumerate independently so an unknown label warns (the ethnologue trap)
      // and so a node lost to a missing creator / active prompt is visible —
      // the joins above are all required, and a silent inner-join loss would
      // otherwise reconcile ✓.
      const ids = await fetchIds(ctx, type.name);
      if (ids.length !== rows.length) {
        ctx.log(
          `    ⚠ ${type.name}: ${ids.length} node(s) enumerated but ${rows.length} matched the ` +
            `parent + creator + active-prompt joins — ${ids.length - rows.length} lost to a broken required rel`,
        );
      }
      for (const row of rows) {
        read.push({ ...row, resourceType: type.name });
      }
    }

    const pvrKept = keepLanded(read, [
      [landedReports, (row) => row.parentId],
      [landedUsers, (row) => row.creatorId],
    ]);
    if (pvrKept.skipped > 0) {
      ctx.log(
        `    ⚠ DROPPED ${pvrKept.skipped} prompt response(s) whose parent report or creator never landed`,
      );
    }

    out.prompt_variant_responses = stat(
      read.length,
      await bulkInsert(
        ctx,
        promptVariantResponses,
        pvrKept.kept.map((row) => ({
          id: row.id,
          resourceType: row.resourceType,
          parentId: row.parentId,
          prompt: row.prompt,
          creatorId: row.creatorId,
          createdAt: tsReq(row.createdAt),
          // NOT NULL here, optional in Neo4j — coalesce to createdAt, which is
          // what the Neo4j hydrate does for the entry rows.
          modifiedAt: tsReq(row.modifiedAt ?? row.createdAt),
          updatedAt: tsReq(row.modifiedAt ?? row.createdAt),
          // No soft-deleted state to carry: Neo4j relabels a deleted PVR, so
          // `MATCH (n:ProgressReportTeamNews)` never returns one, and the read
          // path filters deleted_at IS NULL anyway. Same visibility either way.
          deletedAt: null,
        })),
      ),
    );

    // ── prompt_variant_response_entries ───────────────────────────────────────
    // Live AND retired answers — see the docblock on why the label, not the edge,
    // is the liveness test.
    const entryRows = await cypher<EntryRow>(
      ctx,
      `MATCH (n:PromptVariantResponse)-[:child]->(entry)
       WHERE entry:VariantResponse OR entry:Deleted_VariantResponse
       MATCH (entry)-[:creator]->(creator:User)
       RETURN n.id AS responseId, entry.variant AS variant, entry.response AS response,
              creator.id AS creatorId, toString(entry.createdAt) AS createdAt,
              toString(entry.modifiedAt) AS modifiedAt, toString(entry.deletedAt) AS deletedAt`,
    );

    const landedPvrs = new Set<string>(pvrKept.kept.map((row) => row.id));
    const entriesKept = keepLanded(entryRows, [
      [landedPvrs, (row) => row.responseId],
      [landedUsers, (row) => row.creatorId],
    ]);
    if (entriesKept.skipped > 0) {
      ctx.log(
        `    ⚠ DROPPED ${entriesKept.skipped} answer(s) whose prompt response or creator never landed`,
      );
    }

    const unparsedResponses: string[] = [];
    out.prompt_variant_response_entries = stat(
      entryRows.length,
      await bulkInsert(
        ctx,
        promptVariantResponseEntries,
        // `id` is a bigserial, so insert order assigns it. Sort so a re-run
        // hands out the same ids rather than reshuffling every row.
        [...entriesKept.kept]
          .sort(
            (a, b) =>
              a.responseId.localeCompare(b.responseId) ||
              a.createdAt.localeCompare(b.createdAt) ||
              a.variant.localeCompare(b.variant),
          )
          .map((row) => {
            const response = richText(row.response);
            if (response === undefined) {
              unparsedResponses.push(`${row.responseId}/${row.variant}`);
            }
            return {
              responseId: row.responseId,
              variant: row.variant,
              response: response ?? null,
              creatorId: row.creatorId,
              createdAt: tsReq(row.createdAt),
              modifiedAt: tsReq(row.modifiedAt ?? row.createdAt),
              deletedAt: ts(row.deletedAt),
            };
          }),
      ),
    );
    if (unparsedResponses.length > 0) {
      ctx.log(
        `    ⚠ ${unparsedResponses.length} answer(s) had a rich-text body that could not be parsed ` +
          `into jsonb — stored as null: ${unparsedResponses.slice(0, 10).join(', ')}`,
      );
    }

    return out;
  },
};
