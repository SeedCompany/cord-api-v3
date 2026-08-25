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
import { buildSchema, parse, validate } from 'graphql';

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
    }
  } catch (error) {
    invalid++;
    const message = error instanceof Error ? error.message : String(error);
    log(`\n✗ ${name} — parse error: ${message.split('\n')[0] ?? message}`);
  }
}

log(`\nchecked ${docs.length} documents, ${invalid} invalid`);
if (unresolved.length > 0) {
  log(
    `⚠ ${unresolved.length} document(s) had unresolved interpolations and were NOT checked:`,
  );
  for (const entry of unresolved) log(`    ${entry}`);
}
process.exit(invalid > 0 || unresolved.length > 0 ? 1 : 0);
