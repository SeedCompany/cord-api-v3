import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';

/**
 * Structural guard for LQ-1.
 *
 * The Drizzle repository base invalidates the live-query store on
 * `updateColumns()` / `softDelete()`, but a repository that hand-rolls its own
 * writes bypasses that and has to invalidate itself. Nothing stops the next
 * repository from silently reintroducing the gap, and the symptom — a detail page
 * that quietly stops refreshing — is invisible in review and in every functional
 * test.
 *
 * So: enumerate every `*.drizzle.repository.ts` that writes, and require each to
 * either route through the base helpers or actually call the store. Anything else
 * must be listed below WITH A REASON. A new repository that writes without
 * invalidating fails this test rather than shipping.
 *
 * Same shape as the enum-sync invariant in `postgres-schema.e2e-spec.ts`: pin the
 * known set so drift is loud.
 *
 * Two known limits of a source-text guard, both deliberate:
 *
 * - It is file-granular, not method-granular. A repository that invalidates in
 *   one method satisfies the check even if a sibling method doesn't. Catching
 *   that needs per-method analysis; the exemption reasons carry the per-method
 *   detail in the meantime.
 * - It only sees files named `*.drizzle.repository.ts`. A Postgres-only
 *   repository that skips the `.drizzle.` infix is invisible to it —
 *   `src/components/audit/resource-mutation.repository.ts` is the one such file
 *   today (append-only audit trail, nothing subscribes to it, so nothing to
 *   invalidate). Renaming it to match the convention is tracked separately.
 *
 * The walk covers `src/components` AND `src/core`: Postgres repos aren't only
 * under `src/components` (`src/core/authentication/authentication.drizzle.repository.ts`
 * and the webhooks repos below live under `src/core`), and scoping the walk to
 * `src/components` alone would silently exempt every one of them from this
 * check — the exact same blind spot that let the whole Webhooks domain go
 * unported with no tracker row in the first place.
 */

/**
 * Repositories that write but deliberately do not invalidate.
 *
 * `parity` — the Neo4j arm does not invalidate here either, so Postgres matches
 * it. These are a pre-existing gap on ALL engines, not a migration regression;
 * fixing them is a product decision, not a cutover one.
 *
 * `create-only` — nothing is watching a brand-new id yet, and no engine
 * invalidates on create.
 *
 * `never writes` — the repository has methods NAMED like writes, but every one of
 * them only throws. This check classifies by method name (see WRITE_METHOD), so a
 * domain that is not being carried forward to Postgres still reads as a writer
 * even though it stores nothing. There is no write to invalidate after.
 */
const EXEMPT: Record<string, string> = {
  // --- parity: verified the Neo4j counterpart has no invalidation either ---
  'src/components/pin/pin.drizzle.repository.ts':
    'parity — pin.repository.ts extends no invalidating base and never invalidates',
  'src/components/product-progress/product-progress.drizzle.repository.ts':
    'parity — product-progress.repository.ts extends no invalidating base',
  'src/components/progress-summary/progress-summary.drizzle.repository.ts':
    'parity — progress-summary.repository.ts calls no invalidating base method',
  'src/components/comments/comment-thread.drizzle.repository.ts':
    'parity — comment-thread.repository.ts calls no invalidating base method',
  'src/components/user/known-language.drizzle.repository.ts':
    'parity — known-language.repository.ts calls no invalidating base method',
  'src/components/project/workflow/project-workflow.drizzle.repository.ts':
    'parity — append-only workflow events; no update/delete path to invalidate',
  'src/components/file/media/media.drizzle.repository.ts':
    'parity — sole writer is save() (an upsert); media.repository.ts extends ' +
    'CommonRepository but never calls one of its invalidating helpers',
  'src/components/pnp/extraction-result/pnp-extraction-result.drizzle.repository.ts':
    'parity — sole writer is save() (an upsert); ' +
    'pnp-extraction-result.neo4j.repository.ts never invalidates',
  'src/components/partnership-producing-medium/partnership-producing-medium.drizzle.repository.ts':
    'parity — partnership-producing-medium.repository.ts extends CommonRepository ' +
    'but writes with hand-built queries, never one of its invalidating methods ' +
    '(updateRelation / updateRelationList / deleteNode)',
  'src/components/progress-report/variance-explanation/variance-explanation.drizzle.repository.ts':
    'parity — variance-explanation.repository.ts writes through the standalone ' +
    '`updateProperties` QUERY helper, which does not invalidate; only the ' +
    'repository base methods do',
  'src/components/progress-report/workflow/progress-report-workflow.drizzle.repository.ts':
    'parity — events are append-only, and the one real update, changeStatus(), ' +
    'goes through `this.db.updateProperties` in ' +
    'progress-report-workflow.repository.ts. That is the Connection helper, not ' +
    'the invalidating base method, so Neo4j does not invalidate a status change ' +
    'either. Same category as its Project sibling above. Worth revisiting on its ' +
    'merits after cutover: a status change arguably SHOULD refresh a live report ' +
    'page. It is a gap on every engine, so not a migration regression',

  // --- create-only / bootstrap paths ---
  'src/components/notifications/notification.drizzle.repository.ts':
    'create-only; no engine invalidates on create',
  'src/components/user/system-agent.drizzle.repository.ts':
    'bootstrap upsert of the three fixed system agents',
  'src/components/admin/admin.drizzle.repository.ts':
    'bootstrap only (root user / default org), runs before anything can subscribe',

  // --- named like a writer, but nothing is ever stored ---
  'src/components/project-change-request/project-change-request.drizzle.repository.ts':
    'never writes — changesets are not carried forward, so create(), update() ' +
    'and deleteNode() each throw NotImplementedException and there is no ' +
    'insert/update/delete anywhere in the file; reads answer empty',

  // --- src/core repos (pre-existing blind spot, see the walk comment above) ---
  'src/core/authentication/authentication.drizzle.repository.ts':
    'sessions / password-reset tokens are auth internals with no live-query ' +
    'subscriber; nothing in the Neo4j session/identity path invalidates either',
  'src/core/webhooks/management/webhooks.drizzle.repository.ts':
    'parity — webhooks.repository.ts (Neo4j) hand-rolls save/deleteBy/rotateSecret ' +
    'in raw Cypher and never calls an invalidating base method',
  'src/core/webhooks/channels/webhook-channel.drizzle.repository.ts':
    'parity — webhook-channel.repository.ts (Neo4j) extends CommonRepository ' +
    'but writes with hand-built Cypher, never one of its invalidating helpers',
};

const SCAN_ROOTS = ['src/components', 'src/core'];

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });

/**
 * Blank out comments and quoted strings so a mere mention can't satisfy any
 * check below. Template literals are left intact on purpose — `RAW_SQL_WRITE`
 * has to see inside them.
 */
const toCode = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');

/** Method declarations whose names imply a write. */
const WRITE_METHOD =
  /\n\s{2,6}(?:protected |private )?async (?:create|update|delete|remove|add|set|assign|upsert|save|merge)\w*\(/i;
/** Raw drizzle writes, for repos whose method names don't follow the convention. */
const RAW_WRITE = /\.\s*(?:update|insert|delete)\s*\(/;
/**
 * Raw SQL writes — `db.execute(sql\`UPDATE …\`)` carries no method call the two
 * patterns above can see, so without this a repository could do every one of its
 * writes in raw SQL and never register as a writer at all.
 */
const RAW_SQL_WRITE =
  /sql`[^`]*\b(?:update\b|insert\s+into\b|delete\s+from\b)/is;

const writes = (code: string) =>
  WRITE_METHOD.test(code) || RAW_WRITE.test(code) || RAW_SQL_WRITE.test(code);

/**
 * Require an actual call. The bare identifier `liveQueryStore` used to satisfy
 * this, which meant a comment explaining why a method does NOT invalidate
 * counted as invalidating — the check could be passed by writing prose about it.
 */
const INVALIDATE_CALL = /\bliveQueryStore\s*\.\s*invalidate(?:All)?\s*\(/;

const invalidates = (code: string) =>
  code.includes('this.updateColumns(') ||
  code.includes('this.softDelete(') ||
  INVALIDATE_CALL.test(code);

describe('LQ-1 structural guard: drizzle repositories invalidate live queries', () => {
  const repos = SCAN_ROOTS.flatMap(walk)
    .filter((path) => path.endsWith('.drizzle.repository.ts'))
    .map((path) => ({
      // POSIX-normalized so the pinned keys above are stable across platforms.
      key: relative('.', path).split(sep).join(posix.sep),
      code: toCode(readFileSync(path, 'utf8')),
    }));

  const writers = repos.filter(({ code }) => writes(code));
  const offenders = writers
    .filter(({ code }) => !invalidates(code))
    .map(({ key }) => key);

  it('finds repositories to check (guards against a broken glob)', () => {
    // If the walk silently matched nothing, every assertion below would pass
    // vacuously — the exact failure mode this whole test exists to prevent.
    expect(repos.length).toBeGreaterThan(20);
  });

  it('detects both writers and invalidators (guards against a broken strip)', () => {
    // `toCode` blanking too much would empty every source and make the offender
    // list trivially empty. Assert both halves of the classification still find
    // things, so the guard can't pass by seeing nothing.
    expect(writers.length).toBeGreaterThan(20);
    expect(
      repos.filter(({ code }) => invalidates(code)).length,
    ).toBeGreaterThan(5);
  });

  it('every writing repository either uses the base helpers or invalidates itself', () => {
    const unexplained = offenders.filter((key) => !(key in EXEMPT));
    expect(unexplained).toEqual([]);
  });

  it('has no stale exemptions', () => {
    // An exemption is only honest while the repo is still an offender. This
    // catches all three ways one rots: the file is gone, it now invalidates, or
    // it no longer writes at all — the last of which a "does it invalidate?"
    // check on its own would miss.
    const stale = Object.keys(EXEMPT).filter((key) => !offenders.includes(key));
    expect(stale).toEqual([]);
  });
});
