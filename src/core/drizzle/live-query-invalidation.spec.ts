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
 * So: enumerate every `*.repository.ts` that writes, and require each to
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
 * - It only sees files named `*.repository.ts`. A repository named any other
 *   way is invisible to it.
 *
 * The walk covers `src/components` AND `src/core`: repositories aren't only
 * under `src/components` (`src/core/authentication/authentication.repository.ts`
 * and the webhooks repos below live under `src/core`), and scoping the walk to
 * `src/components` alone would silently exempt every one of them from this
 * check — the exact same blind spot that let the whole Webhooks domain go
 * unported with no tracker row in the first place.
 */

/**
 * Repositories that write but deliberately do not invalidate.
 *
 * `parity` — the Neo4j repository this one replaced did not invalidate either.
 * These gaps pre-date the move to Postgres; fixing them is a product decision.
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
  // --- parity: verified the Neo4j repository it replaced never invalidated ---
  'src/components/pin/pin.repository.ts':
    'parity — the Neo4j repository extended no invalidating base and never invalidated',
  'src/components/project/financial-approver/financial-approver.repository.ts':
    'parity — the Neo4j repository wrote with hand-built queries (merge / ' +
    'setValues / detachDelete), never one of its invalidating methods, so an ' +
    'approver change has never been announced',
  'src/components/product-progress/product-progress.repository.ts':
    'parity — the Neo4j repository extended no invalidating base',
  'src/components/progress-summary/progress-summary.repository.ts':
    'parity — the Neo4j repository called no invalidating base method',
  'src/components/comments/comment-thread.repository.ts':
    'parity — the Neo4j repository called no invalidating base method',
  'src/components/user/known-language.repository.ts':
    'parity — the Neo4j repository called no invalidating base method',
  'src/components/project/workflow/project-workflow.repository.ts':
    'parity — append-only workflow events; no update/delete path to invalidate',
  'src/components/file/media/media.repository.ts':
    'parity — sole writer is save() (an upsert); the Neo4j repository never ' +
    'called one of its invalidating helpers',
  'src/components/pnp/extraction-result/pnp-extraction-result.repository.ts':
    'parity — sole writer is save() (an upsert); the Neo4j repository never ' +
    'invalidated',
  'src/components/partnership-producing-medium/partnership-producing-medium.repository.ts':
    'parity — the Neo4j repository wrote with hand-built queries, never one of ' +
    'its invalidating methods (updateRelation / updateRelationList / deleteNode)',
  'src/components/progress-report/variance-explanation/variance-explanation.repository.ts':
    'parity — the Neo4j repository wrote through the standalone ' +
    '`updateProperties` query helper, which did not invalidate',
  'src/components/progress-report/workflow/progress-report-workflow.repository.ts':
    'parity — events are append-only, and the one real update, changeStatus(), ' +
    'went through the Neo4j Connection helper rather than an invalidating base ' +
    'method, so a status change has never been announced. Worth revisiting on ' +
    'its merits: a status change arguably SHOULD refresh a live report page',

  // --- create-only / bootstrap paths ---
  'src/components/notifications/notification.repository.ts':
    'create-only; no engine invalidates on create',
  'src/components/user/system-agent.repository.ts':
    'bootstrap upsert of the three fixed system agents',
  'src/components/admin/admin.repository.ts':
    'bootstrap only (root user / default org), runs before anything can subscribe',

  // --- named like a writer, but nothing is ever stored ---
  'src/components/project-change-request/project-change-request.repository.ts':
    'never writes — changesets are not carried forward, so create(), update() ' +
    'and deleteNode() each throw NotImplementedException and there is no ' +
    'insert/update/delete anywhere in the file; reads answer empty',

  // --- src/core repos (see the walk comment above) ---
  'src/core/authentication/authentication.repository.ts':
    'sessions / password-reset tokens are auth internals with no live-query ' +
    'subscriber; nothing in the Neo4j session/identity path invalidates either',
  'src/core/webhooks/management/webhooks.repository.ts':
    'parity — the Neo4j repository hand-rolled save/deleteBy/rotateSecret in ' +
    'raw Cypher and never called an invalidating base method',
  'src/components/audit/resource-mutation.repository.ts':
    'append-only audit trail; nothing subscribes to it, so nothing to invalidate',
  'src/core/webhooks/channels/webhook-channel.repository.ts':
    'parity — the Neo4j repository wrote with hand-built Cypher, never one of ' +
    'its invalidating helpers',
};

const SCAN_ROOTS = ['src/components', 'src/core'];
// migration-todo: drop this exclusion when `src/core/neo4j` is deleted.
const EXCLUDE = 'src/core/neo4j/';

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

describe('LQ-1 structural guard: repositories invalidate live queries', () => {
  const repos = SCAN_ROOTS.flatMap(walk)
    .filter((path) => path.endsWith('.repository.ts'))
    .map((path) => ({
      // POSIX-normalized so the pinned keys above are stable across platforms.
      key: relative('.', path).split(sep).join(posix.sep),
      code: toCode(readFileSync(path, 'utf8')),
    }))
    .filter(({ key }) => !key.startsWith(EXCLUDE));

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
