/**
 * One-off repair: post bodies that were turned into rich-text documents.
 *
 * WHY THIS EXISTS. `body` is one link name covering two value types — rich text
 * on a comment, a plain string on a post. An earlier classification sent both
 * through the rich-text handler, so every post body in an already-scrubbed copy
 * is a serialized single-block document where the column holds plain text. The
 * API declares `Post.body` as a String, so GraphQL cannot serialize it and the
 * whole post list fails.
 *
 * Re-scrubbing does NOT fix this: the converted value reads back as an object,
 * so the corrected handler sees an object and faithfully keeps it a document.
 * Hence a repair rather than another pass.
 *
 * WHAT IT RESTORES. The words inside those documents are already fake, generated
 * from the originals, so flattening the blocks back to a plain string yields
 * exactly what the corrected handler would have written. It does NOT recover
 * production's real text — that is gone, and only a fresh restore brings it back.
 * Since every value in a scrubbed copy is fake by design, the type is the only
 * thing that matters here.
 *
 * SCOPE. Posts only. Comment bodies are legitimately documents and are left
 * alone — the owning label is the whole distinction. Runs against a RESTORED
 * COPY, never production, and boots with `DATABASE=neo4j` so the Neo4j
 * connection is the one in play.
 *
 * Safe to re-run: a body already stored as a plain string is skipped, not
 * rewritten.
 *
 * Usage:
 *   # count what would change, write nothing
 *   yarn start --entryFile core/repair-post-bodies.run -- --dry-run
 *
 *   # repair
 *   yarn start --entryFile core/repair-post-bodies.run
 *
 * Flags: --dry-run | --batch=N
 */
import { NestFactory } from '@nestjs/core';
import { exit } from 'node:process';
import '../polyfills';

const parseFlags = (argv: readonly string[]) => {
  const get = (name: string) =>
    argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
  return {
    dryRun: argv.includes('--dry-run'),
    // Paging by internal id is quadratic — there is no index on those, so every
    // page rescans. A small page size is what made the scrub look hung.
    batchSize: get('batch') ? Number(get('batch')) : 25_000,
  };
};

interface BodyRow {
  nodeId: number;
  value: unknown;
}

/** Strip inline markup and collapse whitespace; block text may carry HTML. */
const plainText = (html: string) =>
  html
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Only the two static helpers this needs, described structurally so the module
 * holding them stays a runtime import inside `bootstrap` — the entry file must
 * not pull the app in before argv is set.
 */
interface SerializedDocReader {
  isSerialized: (value: unknown) => value is string;
  fromSerialized: (value: string) => unknown;
}

/**
 * Pull the prose back out of a document. Returns null when the value is not a
 * document at all, which is how an already-repaired row is skipped.
 */
const flattenToText = (
  value: unknown,
  richText: SerializedDocReader,
): string | null => {
  let doc: { blocks?: unknown[] } | undefined;
  if (value !== null && typeof value === 'object') {
    doc = value as { blocks?: unknown[] };
  } else if (richText.isSerialized(value)) {
    // Belt and braces: the connection's read transformer normally hands these
    // back as objects, but a raw serialized string must not slip through.
    try {
      doc = richText.fromSerialized(value) as {
        blocks?: unknown[];
      };
    } catch {
      doc = undefined;
    }
  }
  if (!doc || !Array.isArray(doc.blocks)) return null;

  const parts: string[] = [];
  for (const block of doc.blocks) {
    if (block === null || typeof block !== 'object') continue;
    const data = (block as { data?: unknown }).data;
    if (data === null || typeof data !== 'object') continue;
    const text = (data as { text?: unknown }).text;
    if (typeof text === 'string') parts.push(plainText(text));
    // List blocks keep their content in `items` rather than `text`.
    const items = (data as { items?: unknown }).items;
    if (Array.isArray(items)) {
      for (const item of items) {
        if (typeof item === 'string') parts.push(plainText(item));
        else if (item !== null && typeof item === 'object') {
          const content = (item as { content?: unknown }).content;
          if (typeof content === 'string') parts.push(plainText(content));
        }
      }
    }
  }
  return parts.filter((part) => part.length > 0).join(' ');
};

async function bootstrap() {
  // Flags first, THEN push 'console' so ConfigService.isCli is true — same order
  // as scrub.run.ts and cutover.run.ts.
  const flags = parseFlags(process.argv.slice(2));
  process.argv.push('console');

  const pageSize = Math.trunc(flags.batchSize);
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new Error(`Batch size must be a positive integer (got ${pageSize})`);
  }

  const { AppModule } = await import('../app.module');
  const { DatabaseService } = await import('~/core/neo4j');
  const { RichTextDocument } = await import('~/common');
  const { sortValueFor } = await import('./scrub/fake');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const neo4j = app.get(DatabaseService);

  // eslint-disable-next-line no-console
  const log = (msg: string) => console.log(msg);

  log(
    flags.dryRun
      ? '\nDry run — counting only, nothing is written.\n'
      : '\nRepairing post bodies in place.\n',
  );

  let examined = 0;
  let repaired = 0;
  let alreadyPlain = 0;
  let emptyAfterFlatten = 0;

  // Keyset on id(p), not SKIP: values change under us as we write, and ids never
  // move, so a page can never step over an unprocessed row.
  let after = -1;
  let page = 0;
  do {
    const rows = [
      ...(await neo4j
        .query<BodyRow>(
          `MATCH (owner)-[:body]->(p)
           WHERE (owner:Post OR owner:Deleted_Post)
             AND (p:Property OR p:Deleted_Property)
             AND p.value IS NOT NULL
             AND id(p) > $after
           RETURN id(p) AS nodeId, p.value AS value
           ORDER BY id(p) LIMIT ${pageSize}`,
          { after },
        )
        .run()),
    ];
    page = rows.length;
    if (page === 0) break;
    examined += page;
    after = rows[page - 1]!.nodeId;

    const updates: Array<{ nodeId: number; value: string }> = [];
    for (const row of rows) {
      const text = flattenToText(row.value, RichTextDocument);
      if (text === null) {
        // Not a document — already a plain string, nothing to do.
        alreadyPlain++;
        continue;
      }
      if (text.length === 0) emptyAfterFlatten++;
      updates.push({ nodeId: row.nodeId, value: text });
    }

    if (updates.length > 0 && !flags.dryRun) {
      await neo4j
        .query(
          `UNWIND $batch AS row
           MATCH (p) WHERE id(p) = row.nodeId
           SET p.value = row.value,
               p.sortValue = CASE WHEN p.sortValue IS NULL THEN NULL ELSE row.sortValue END`,
          {
            batch: updates.map((update) => ({
              nodeId: update.nodeId,
              value: update.value,
              sortValue: sortValueFor(update.value),
            })),
          },
        )
        .run();
    }
    repaired += updates.length;
  } while (page === pageSize);

  log(`  examined:            ${examined}`);
  log(`  ${flags.dryRun ? 'would repair' : 'repaired'}:        ${repaired}`);
  log(`  already plain text:  ${alreadyPlain}`);
  if (emptyAfterFlatten > 0) {
    log(
      `  ⚠ empty after flattening: ${emptyAfterFlatten} (document held no readable text; stored as an empty body)`,
    );
  }
  log('');

  await app.close();
}

await bootstrap().then(
  () => exit(0),
  (error: unknown) => {
    // eslint-disable-next-line no-console
    console.error(error);
    exit(1);
  },
);
