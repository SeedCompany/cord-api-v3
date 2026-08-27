/**
 * Mutation-coverage checker: every schema mutation is exercised by test/,
 * or carries a registered exemption with a reason.
 *
 *     node src/core/mutation-coverage.check.ts
 *
 * No app boot — it parses `schema.graphql` for the Mutation fields and scans
 * every TypeScript file under `test/` for GraphQL documents (specs AND the
 * utility helpers both hold them as template literals), unioning the root
 * mutation fields they select.
 *
 * Why it exists: coverage was hand-tallied twice (2026-08-25/26) and the
 * first tally was WRONG ("zero writes") — and any hand tally goes stale the
 * moment a mutation or spec lands. This computes the join fresh and fails
 * loudly, in both directions: a mutation nobody tests fails the run unless
 * exempted, and an exemption for a mutation that IS now tested fails too
 * (stale exemptions are how registers rot).
 *
 * Scope: GraphQL-layer coverage only. The mutation probe
 * (`mutation-probe.run.ts`) writes at the SERVICE layer against migrated
 * rows and reports separately — it cannot be joined by mutation name.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { buildSchema, Kind, parse } from 'graphql';
import { join } from 'path';

// eslint-disable-next-line no-console
const log = (message: string) => console.log(message);

/** Exemptions must name a real, genuinely untestable-here mutation. */
const EXEMPT: ReadonlyMap<string, string> = new Map([
  [
    'deleteProjectChangeRequest',
    'Changesets are out of cutover scope (Rob, 2026-08-26); the other ' +
      'changeRequest mutations are still exercised by the changeset suites.',
  ],
  [
    'modifyQueue',
    'BullMQ queue control in src/core — touches no domain table, cannot ' +
      'differ by engine.',
  ],
  [
    'scheduledTask',
    'Scheduler control in src/core — same: no domain table, engine-independent.',
  ],
  [
    'updateMediaMetadata',
    'Needs an uploaded image; the upload flow exists in ' +
      'progress-report-media.e2e-spec.ts but the metadata call is not wired ' +
      'up yet. Reachable — do it when media work resumes.',
  ],
  [
    'reextractPnpProgress',
    'Needs a real PnP spreadsheet fixture and none exists anywhere in ' +
      'test/ — genuinely blocked until one is committed.',
  ],
]);

// ─── schema side ─────────────────────────────────────────────────────────────

const schema = buildSchema(readFileSync('schema.graphql', 'utf8'));
const mutationType = schema.getMutationType();
if (!mutationType) throw new Error('schema.graphql has no Mutation type');
const schemaMutations = new Set(Object.keys(mutationType.getFields()));

// ─── test side ───────────────────────────────────────────────────────────────

const tsFilesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return tsFilesUnder(path);
    return path.endsWith('.ts') ? [path] : [];
  });

/** mutation name → files that select it. */
const exercised = new Map<string, Set<string>>();
let unparsable = 0;

const INTERPOLATION_HOLE = '__interpolated';

const record = (name: string, file: string): void => {
  const files = exercised.get(name) ?? new Set<string>();
  files.add(file);
  exercised.set(name, files);
};

for (const file of tsFilesUnder('test')) {
  const src = readFileSync(file, 'utf8');
  let hadInterpolatedDoc = false;
  // Every template literal that looks like it holds a mutation operation.
  // (gql-tada fragments arrive as a second argument, so the document text
  // itself is self-contained apart from `...spread` names, which parse fine.)
  for (const match of src.matchAll(/`([^`]*\bmutation\b[^`]*)`/gs)) {
    const raw = match[1]!;
    if (!/^\s*mutation\b/m.test(raw)) continue;
    // A document can parameterize the FIELD NAME itself
    // (known-language.e2e-spec's ModifyDoc) — plug the hole so the rest of
    // the document still parses, and credit the possible names below.
    const holes = raw.includes('${');
    const text = raw.replace(/\$\{[^}]*\}/g, INTERPOLATION_HOLE);
    try {
      for (const def of parse(text).definitions) {
        if (
          def.kind !== Kind.OPERATION_DEFINITION ||
          def.operation !== 'mutation'
        ) {
          continue;
        }
        if (holes) hadInterpolatedDoc = true;
        for (const sel of def.selectionSet.selections) {
          if (sel.kind !== Kind.FIELD) continue;
          if (sel.name.value === INTERPOLATION_HOLE) continue;
          record(sel.name.value, file);
        }
      }
    } catch {
      // Counted, not ignored: an unparsable candidate is unverified coverage.
      // (Comment prose that merely contains the word "mutation" also lands
      // here — the count stays honest either way.)
      unparsable++;
    }
  }
  // A file with an interpolated document names the concrete mutations as
  // string literals somewhere nearby (a union type, a call site). Credit
  // schema mutation names quoted in THAT file only — a plain string match
  // across all files would count prose.
  if (hadInterpolatedDoc) {
    for (const literal of src.matchAll(/['"]([a-z][a-zA-Z0-9]*)['"]/g)) {
      const name = literal[1]!;
      if (schemaMutations.has(name)) record(name, file);
    }
  }
}

// ─── the join, loud in both directions ───────────────────────────────────────

const missing = [...schemaMutations]
  .filter((name) => !exercised.has(name) && !EXEMPT.has(name))
  .sort((a, b) => a.localeCompare(b));
const exempt = [...schemaMutations]
  .filter((name) => !exercised.has(name) && EXEMPT.has(name))
  .sort((a, b) => a.localeCompare(b));
const staleExemptions = [...EXEMPT.keys()].filter((name) =>
  exercised.has(name),
);
const unknownExemptions = [...EXEMPT.keys()].filter(
  (name) => !schemaMutations.has(name),
);
// Documents selecting mutations the schema does not define would silently
// inflate coverage of nothing; surface them.
const phantom = [...exercised.keys()]
  .filter((name) => !schemaMutations.has(name))
  .sort((a, b) => a.localeCompare(b));

for (const name of missing) {
  log(`✗ untested  ${name}`);
}
for (const name of exempt) {
  log(`~ exempt    ${name} — ${EXEMPT.get(name)!}`);
}
for (const name of staleExemptions) {
  log(
    `✗ STALE exemption ${name} — now exercised by ` +
      `${[...exercised.get(name)!].join(', ')}; remove it from the register.`,
  );
}
for (const name of unknownExemptions) {
  log(`✗ UNKNOWN exemption ${name} — not a schema mutation; remove or fix.`);
}
for (const name of phantom) {
  log(
    `⚠ phantom   ${name} — selected in ${[...exercised.get(name)!].join(', ')} ` +
      'but not a schema mutation.',
  );
}

const covered = [...schemaMutations].filter((name) =>
  exercised.has(name),
).length;
log(
  `\n${schemaMutations.size} schema mutations — ${covered} exercised by ` +
    `test/, ${exempt.length} exempt with reasons, ${missing.length} ` +
    `MISSING; ${staleExemptions.length} stale + ${unknownExemptions.length} ` +
    `unknown exemption(s), ${unparsable} unparsable candidate document(s).`,
);
process.exit(
  missing.length > 0 ||
    staleExemptions.length > 0 ||
    unknownExemptions.length > 0
    ? 1
    : 0,
);
