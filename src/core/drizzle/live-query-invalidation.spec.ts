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
 * either route through the base helpers or mention `liveQueryStore`. Anything
 * else must be listed below WITH A REASON. A new repository that writes without
 * invalidating fails this test rather than shipping.
 *
 * Same shape as the enum-sync invariant in `postgres-schema.e2e-spec.ts`: pin the
 * known set so drift is loud.
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

  // --- create-only / bootstrap paths ---
  'src/components/notifications/notification.drizzle.repository.ts':
    'create-only; no engine invalidates on create',
  'src/components/user/system-agent.drizzle.repository.ts':
    'bootstrap upsert of the three fixed system agents',
  'src/components/admin/admin.drizzle.repository.ts':
    'bootstrap only (root user / default org), runs before anything can subscribe',

  // --- genuinely pending ---
  'src/components/file/file.drizzle.repository.ts':
    'PENDING: the Neo4j arm DOES invalidate (file.repository.ts:517 update, :569 delete). ' +
    'Held out only because this file is modified by an in-flight branch; fix it there or ' +
    'immediately after that merges. This is the one entry here that is a real defect.',
};

const COMPONENTS = 'src/components';

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });

/** Method declarations whose names imply a write. */
const WRITE_METHOD =
  /\n\s{2,6}(?:protected |private )?async (?:create|update|delete|remove|add|set|assign|upsert|save|merge)\w*\(/i;
/** Raw drizzle writes, for repos whose method names don't follow the convention. */
const RAW_WRITE = /\.\s*(?:update|insert|delete)\s*\(/;

describe('LQ-1 structural guard: drizzle repositories invalidate live queries', () => {
  const repos = walk(COMPONENTS)
    .filter((path) => path.endsWith('.drizzle.repository.ts'))
    .map((path) => ({
      // POSIX-normalized so the pinned keys above are stable across platforms.
      key: relative('.', path).split(sep).join(posix.sep),
      source: readFileSync(path, 'utf8'),
    }));

  it('finds repositories to check (guards against a broken glob)', () => {
    // If the walk silently matched nothing, every assertion below would pass
    // vacuously — the exact failure mode this whole test exists to prevent.
    expect(repos.length).toBeGreaterThan(20);
  });

  it('every writing repository either uses the base helpers or invalidates itself', () => {
    const offenders = repos
      .filter(
        ({ source }) => WRITE_METHOD.test(source) || RAW_WRITE.test(source),
      )
      .filter(
        ({ source }) =>
          !source.includes('this.updateColumns(') &&
          !source.includes('this.softDelete(') &&
          !source.includes('liveQueryStore'),
      )
      .map(({ key }) => key);

    const unexplained = offenders.filter((key) => !(key in EXEMPT));
    expect(unexplained).toEqual([]);
  });

  it('has no stale exemptions', () => {
    // An exemption for a repo that now invalidates (or no longer exists) is
    // misleading documentation — make removing it mandatory.
    const stale = Object.keys(EXEMPT).filter((key) => {
      const repo = repos.find((candidate) => candidate.key === key);
      if (!repo) return true;
      return (
        repo.source.includes('this.updateColumns(') ||
        repo.source.includes('this.softDelete(') ||
        repo.source.includes('liveQueryStore')
      );
    });
    expect(stale).toEqual([]);
  });
});
