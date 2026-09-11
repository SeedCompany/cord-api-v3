#!/usr/bin/env node
// Turns a `pg_dump --schema-only` of the fully-migrated reference database into
// a drizzle-appliable genesis migration.
//
// This is how 0000_genesis.sql was produced, kept here so the baseline is
// reproducible rather than a 4,500-line file nobody can re-derive. It is a
// one-shot tool, not part of the app or the build; nothing imports it, and the
// migrator only ever reads `<journal tag>.sql`.
//
// Usage:
//   node src/core/drizzle/migrations/build-genesis.mjs <dump.sql> <out.sql>
//
// To re-baseline from scratch (PG=<your postgres container>):
//   1. build a reference database from the migrations you want to collapse
//      (`--> statement-breakpoint` is a valid SQL comment, so psql applies the
//      files directly, and `--single-transaction` mirrors how drizzle applies them):
//        docker exec -i $PG psql -U postgres -c 'create database genesis_ref'
//        cat 0000_genesis.sql 0001_....sql 0002_....sql \   # NAME THEM, in journal order
//          | docker exec -i $PG psql -U postgres -d genesis_ref -v ON_ERROR_STOP=1 --single-transaction -q
//      List the files explicitly rather than globbing `*.sql`. A glob also sweeps
//      up anything you did NOT intend to collapse — a migration parked on another
//      branch, or one added after you started — and whatever lands in the
//      reference database becomes part of the new baseline, which step 5 then
//      tells you to delete.
//   2. dump its schema:
//        docker exec $PG pg_dump -U postgres -d genesis_ref --schema-only \
//          --no-owner --no-acl --no-comments --exclude-schema=drizzle > dump.sql
//   3. node src/core/drizzle/migrations/build-genesis.mjs dump.sql \
//        src/core/drizzle/migrations/0000_genesis.sql
//   4. PROVE it: apply the output to a second empty database, dump that the same
//      way, and diff the two dumps -- they must be byte-identical. Plant a
//      defect (delete one CREATE INDEX) and confirm the diff catches it, so you
//      know the comparison has teeth rather than comparing two empty things.
//   5. RETIRE what you collapsed: delete every .sql file that went into the
//      reference database except the new 0000_genesis.sql, and delete its entry
//      from meta/_journal.json, so `entries` holds genesis alone. Leaving a
//      collapsed migration behind is not a no-op — a fresh database applies its
//      changes twice, once from genesis and once from the file, and dies on the
//      first duplicate object. Existing databases skip both by timestamp, so the
//      breakage appears only in new environments, which is where nobody looks.
//
// Two classes of line must go, and both matter:
//   1. psql meta-commands (`\restrict`) — not SQL; drizzle sends the file
//      straight to the server, which would reject them.
//   2. the session-scoped preamble (`SET statement_timeout`, and especially
//      `set_config('search_path','')`) — drizzle runs this on a POOLED
//      application connection, so anything set here would outlive the
//      migration and silently reconfigure that connection for the app's life.
// Every name in the dump is schema-qualified (`public.x`) precisely because
// pg_dump emitted it under an empty search_path, so dropping that line is safe.
//
// Statement-breakpoint markers are then restored between statements, matching
// the hand-written migrations this replaces: drizzle splits on them and sends
// one query per chunk, so a failure quotes the offending statement instead of
// all 116KB. Splitting is the one step here that could corrupt SQL, hence the
// dollar-quote assertion and round-trip guard below.

import { readFileSync, writeFileSync } from 'node:fs';

// Assembled rather than written literally: this file's own prose must not
// contain the marker, or drizzle would split THIS generator's output there.
const MARKER = '-->' + ' statement-breakpoint';

const [, , inPath, outPath] = process.argv;
// Not just a friendlier error than the one node would throw: `tsconfig.json`
// type-checks this file, and without narrowing these off `string | undefined`
// the failed `readFileSync` overload makes `raw` `any`, which silently spreads
// implicit-any through every callback below.
if (!inPath || !outPath) {
  throw new Error(
    'usage: node src/core/drizzle/migrations/build-genesis.mjs <dump.sql> <out.sql>',
  );
}
const raw = readFileSync(inPath, 'utf8');

const DROP_LINE = [
  /^\\(un)?restrict\b/, // psql meta-command, not SQL
  /^SET (statement_timeout|lock_timeout|idle_in_transaction_session_timeout|client_encoding|standard_conforming_strings|check_function_bodies|xmloption|client_min_messages|row_security|default_tablespace|default_table_access_method)\b/,
  /^SELECT pg_catalog\.set_config\('search_path'/,
  /^-- Dumped (from|by)\b/, // pins the file to a pg_dump build; pure noise
  /^-- PostgreSQL database dump( complete)?$/,
];

const kept = raw
  .split('\n')
  .filter((line) => !DROP_LINE.some((re) => re.test(line)))
  .join('\n')
  // the stripped banners leave bare `--` rules at both ends
  .replace(/^(?:(?:--)?[ \t]*\n)+/, '')
  .replace(/(?:\n(?:--)?[ \t]*)+$/, '\n');

// pg_dump precedes every object with a `--\n-- Name: ...\n--` header block and
// emits exactly one statement per block, so those headers are a safe statement
// boundary — safer than tokenizing for top-level semicolons. That holds only if
// no such header hides inside a dollar-quoted body, which is asserted here.
for (const body of kept.match(/\$\$[\s\S]*?\$\$/g) ?? []) {
  if (/^-- Name: /m.test(body)) {
    throw new Error(
      'a dollar-quoted body contains a `-- Name:` header — the split boundary is unsafe',
    );
  }
}

// Split so each header stays attached to the statement it describes. Chunks
// carrying only comments/blanks (the husk left where a banner was stripped) are
// dropped — a breakpoint around no SQL is just noise.
/** @param {string} part */
const hasSql = (part) =>
  part
    .split('\n')
    .some((line) => line.trim() !== '' && !line.trim().startsWith('--'));

const statements = kept
  .split(/(?=\n--\n-- Name: )/)
  .filter(hasSql)
  .map((part) => part.replace(/^\n+|\n+$/g, ''));

// Round-trip guard: prove that splitting lost or reordered no SQL. Compares the
// SQL only — comment lines are excluded on both sides, since dropping the
// comment-only husks above is an intended difference. Comment lines inside the
// dollar-quoted body would be excluded too, but it has none (asserted above).
/** @param {string} text */
const sqlOnly = (text) =>
  text
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.trim().startsWith('--'))
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim();

if (sqlOnly(statements.join('\n')) !== sqlOnly(kept)) {
  throw new Error('round-trip failed: splitting changed the SQL text');
}

const header = `-- Genesis migration — the entire Postgres schema in one file.
--
-- Collapses the original 0000-0042 hand-written migrations. Generated from a
-- \`pg_dump --schema-only\` of a database built by applying all 43 in order, so
-- it reproduces the END STATE rather than the history: where a later migration
-- replaced an earlier object (e.g. 0041 redefining
-- \`sync_project_step_from_event()\`, 0030/0042 relaxing constraints) only the
-- final definition survives here, which is the point.
--
-- Existing databases are unaffected. Drizzle decides what to apply purely by
-- comparing timestamps (\`lastApplied.created_at < entry.when\`) and never by
-- file hash, so this entry keeps the original 0000 \`when\` (1745625600000).
-- Any database that already ran the old migrations has a later \`created_at\`
-- than that and therefore skips this file; a fresh database has no row at all
-- and applies it. See src/core/drizzle/migrator.ts.
--
-- CAVEAT: a database stranded PART-WAY through the old sequence can no longer
-- catch up -- it skips this file too, and the individual files it still needs
-- are gone. Such a database must be rebuilt.
--
-- The one thing deliberately dropped is 0041's backfill of
-- \`projects.step_changed_at\`, which read rows that a fresh database does not
-- have. It was a no-op here.
--
-- Do NOT hand-edit this file to change the schema: add a normal numbered
-- migration on top. It is a baseline, not a living document. It is generated by
-- build-genesis.mjs, beside this file, which documents the full re-baseline and
-- verification recipe and restores the statement-breakpoint markers below. Note
-- drizzle matches that marker as a plain string, comments included, so prose
-- here must never spell it out or the file splits at the mention.
--
-- When you add that next migration, its \`when\` must be LATER THAN
-- 1754265600000 (old 0042's timestamp, not this file's). Databases that ran
-- the old sequence recorded 0042's timestamp as their high-water mark, so a
-- \`when\` below it would apply on fresh databases and be skipped on every
-- existing one. \`Date.now()\` satisfies this; a hand-picked date may not.

`;

const out = header + statements.join(`\n\n${MARKER}\n\n`) + '\n';
writeFileSync(outPath, out);

const markerCount = out.split(MARKER).length - 1;
console.log(`statements: ${statements.length}`);
console.log(`markers:    ${markerCount} (expected ${statements.length - 1})`);
console.log(`lines:      ${out.split('\n').length}`);
console.log(`bytes:      ${out.length}`);
if (markerCount !== statements.length - 1) {
  throw new Error('marker count does not match the statement count — the header likely spells out the marker');
}
