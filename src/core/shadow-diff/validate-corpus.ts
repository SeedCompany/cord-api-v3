/**
 * Validate every shadow-diff corpus document against the generated schema.
 *
 *     node src/core/shadow-diff/validate-corpus.ts
 *
 * Run this after ANY change to `corpus.ts`, before spending a capture run.
 *
 * Why it exists: an invalid selection fails on BOTH engines, so the two
 * captures record matching errors and the diff reports them as identical. A
 * broken corpus entry therefore looks exactly like a passing one — the failure
 * is invisible in the only place anyone would look for it.
 *
 * Run directly with node (>= 22 strips the types); it deliberately does not
 * boot the app, so it costs a second rather than a full Nest bootstrap.
 */
import { readFileSync } from 'fs';
import {
  buildSchema,
  parse,
  TypeInfo,
  validate,
  visit,
  visitWithTypeInfo,
} from 'graphql';

// Same shape as `cutover.run.ts`: one disabled helper rather than a disable
// comment on every line of output.
// eslint-disable-next-line no-console
const log = (message: string) => console.log(message);

const schema = buildSchema(readFileSync('schema.graphql', 'utf8'));
const src = readFileSync('src/core/shadow-diff/corpus.ts', 'utf8');

/**
 * Every `const NAME = /* GraphQL *\/ \`...\`` block, in file order — a const is
 * always defined before the document that interpolates it.
 */
const consts = new Map<string, string>();
const docs: Array<{ name: string; body: string }> = [];

const blockPattern = /const\s+(\w+)\s*=\s*\/\* GraphQL \*\/\s*`([\s\S]*?)`;/g;
let match: RegExpExecArray | null;
while ((match = blockPattern.exec(src)) !== null) {
  const name = match[1];
  const body = match[2];
  if (!name || !body) continue;
  consts.set(name, body);
  if (/^\s*(query|mutation)\s/.test(body)) docs.push({ name, body });
}

/** Resolve `${x}` against the consts map, repeatedly — selections nest. */
const resolveInterpolations = (body: string): string => {
  let out = body;
  // Bounded rather than `while`: a corpus const that interpolated itself would
  // otherwise spin forever, and the leftover `${...}` is reported below.
  for (const _pass of Array.from({ length: 12 })) {
    const before = out;
    out = out.replace(
      /\$\{(\w+)\}/g,
      (whole: string, id: string) => consts.get(id) ?? whole,
    );
    if (out === before) break;
  }
  return out;
};

/**
 * Corpus completeness: no type reachable ONLY as `{ id }`.
 *
 * The regression this closes: five migrated types (Budget among them —
 * 18,648 money rows) were compared as bare ids for six weeks while the diff
 * report read clean, because every selection that reached them stopped at
 * `{ id }`. Field coverage is unioned across the WHOLE corpus, so a link
 * stub (`fieldZone { value { id } }`) is fine as long as some document
 * selects the type's real fields.
 *
 * Allowlisted types must carry a reason; everything else that never gets a
 * field beyond id/__typename fails the run.
 */
const ID_ONLY_ALLOWED: ReadonlyMap<string, string> = new Map([
  [
    'File',
    'File-domain boundary: a DefinedFile answers through the Neo4j file ' +
      'repository on BOTH engines, so field comparison would compare one ' +
      'source with itself. Revisit when the file domain reads from Postgres.',
  ],
  [
    'Directory',
    'Same file-domain boundary (project.rootDirectory is id-only column ' +
      'parity).',
  ],
  [
    'Commentable',
    'Abstract parent link (commentThread.parent): the id proves the edge; ' +
      'the concrete types behind it are covered by their own documents.',
  ],
  [
    'Resource',
    'Abstract parent link (periodicReport.parent): same — edge parity only, ' +
      'concrete types covered elsewhere.',
  ],
]);

/** type name → union of field names selected on it anywhere in the corpus. */
const selectedFields = new Map<string, Set<string>>();

const recordSelections = (text: string): void => {
  const typeInfo = new TypeInfo(schema);
  visit(
    parse(text),
    visitWithTypeInfo(typeInfo, {
      // eslint-disable-next-line @typescript-eslint/naming-convention -- graphql visitor keys are AST kind names
      Field(node) {
        const parent = typeInfo.getParentType();
        if (!parent) return;
        const fields = selectedFields.get(parent.name) ?? new Set<string>();
        fields.add(node.name.value);
        selectedFields.set(parent.name, fields);
      },
    }),
  );
};

let invalid = 0;
const unresolved: string[] = [];

for (const { name, body } of docs) {
  const text = resolveInterpolations(body);
  const left = [...text.matchAll(/\$\{(\w+)\}/g)].map((m) => m[1]!);
  if (left.length > 0) {
    // Reported rather than skipped quietly: a document we could not assemble
    // is unchecked, which is the same blind spot this script exists to close.
    unresolved.push(`${name}: ${[...new Set(left)].join(', ')}`);
    continue;
  }
  try {
    const errors = validate(schema, parse(text));
    if (errors.length > 0) {
      invalid++;
      log(`\n✗ ${name}`);
      for (const error of errors.slice(0, 6)) log(`    ${error.message}`);
    } else {
      recordSelections(text);
    }
  } catch (error) {
    invalid++;
    const message = error instanceof Error ? error.message : String(error);
    log(`\n✗ ${name} — parse error: ${message.split('\n')[0] ?? message}`);
  }
}

const idOnly = [...selectedFields.entries()]
  .filter(([, fields]) =>
    [...fields].every((f) => f === 'id' || f === '__typename'),
  )
  .map(([type]) => type)
  .sort((a, b) => a.localeCompare(b));
let incomplete = 0;
for (const type of idOnly) {
  const reason = ID_ONLY_ALLOWED.get(type);
  if (reason) {
    log(`~ id-only (allowed) ${type} — ${reason}`);
  } else {
    incomplete++;
    log(
      `✗ id-only ${type} — reachable ONLY as { id }: its fields are never ` +
        'compared anywhere in the corpus. Select them, or allowlist the ' +
        'type here with a reason.',
    );
  }
}

log(
  `\nchecked ${docs.length} documents, ${invalid} invalid; ` +
    `${selectedFields.size} types selected, ${idOnly.length} id-only ` +
    `(${incomplete} not allowlisted)`,
);
if (unresolved.length > 0) {
  log(
    `⚠ ${unresolved.length} document(s) had unresolved interpolations and were NOT checked:`,
  );
  for (const entry of unresolved) log(`    ${entry}`);
}
process.exit(invalid > 0 || unresolved.length > 0 || incomplete > 0 ? 1 : 0);
