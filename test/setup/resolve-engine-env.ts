import { parse } from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Make `process.env.DATABASE` agree with the engine the app will actually boot.
 *
 * The app's ConfigService loads dotenv, so a `DATABASE=` line in `.env.local`
 * decides which database it uses. A test file, however, decides which database
 * it is testing when it loads — before any app starts — and sees only real
 * environment variables, which dotenv has not touched.
 * `test/setup/pg-setup.ts` documents the same blind spot for `POSTGRES_URL`.
 *
 * Left alone, those two disagree: a bare `yarn test:e2e` on a machine whose
 * `.env.local` says postgres runs every spec's *Neo4j* path against a
 * *Postgres* app. That produced 68 failures across 5 specs on 2026-08-03 and
 * read exactly like a real regression — the only tell was a suite failing with
 * counts identical to the Postgres baseline, which two different engines cannot
 * do.
 *
 * It is worse for suites written as "skip when this is Postgres" (webhooks, the
 * changeset specs): with the variable absent they RUN, against a database that
 * cannot support them. The older form, "run only when this is Postgres", fails
 * the harmless way round and merely skips.
 *
 * So resolve the same precedence the app uses — real environment first, then
 * dotenv, then the app's own default — and publish the answer to the
 * environment before any spec is evaluated. An explicitly-set variable always
 * wins, so CI (which sets `DATABASE` from the job matrix) is unaffected.
 */

// Matches ConfigService's default: env.string('DATABASE').optional('neo4j')
const APP_DEFAULT_ENGINE = 'neo4j';

/**
 * The same files EnvironmentService reads, in the same order — including the
 * NODE_ENV-specific pair. A `DATABASE` in `.env.development.local` decides what
 * the app boots, so a resolver that skipped it would reintroduce the exact
 * disagreement this file exists to remove.
 *
 * Earlier files win, and that is checked rather than assumed: the app seeds its
 * accumulator from `process.env` and expands each file into it, leaving any
 * already-set key alone. It also drops empty values between files, so an empty
 * `DATABASE=` does not shadow a later file — hence the truthiness test below.
 */
const dotenvFiles = () => {
  const env = process.env.NODE_ENV || 'development';
  return [`.env.${env}.local`, `.env.${env}`, '.env.local', '.env'];
};

const readEngineFromDotenv = (): string | undefined => {
  for (const file of dotenvFiles()) {
    let contents: string;
    try {
      contents = readFileSync(resolve(process.cwd(), file), 'utf8');
    } catch {
      continue; // absent or unreadable is normal, not an error
    }
    // Parsed by dotenv itself — the same function EnvironmentService uses — so
    // quoting, `export ` prefixes and inline comments resolve exactly as they
    // will for the app. Hand-rolling this got one case wrong: a `#` inside a
    // quoted value is content, not the start of a comment.
    //
    // `${...}` expansion is deliberately NOT mirrored. The app applies
    // dotenv-expand as well, but an engine name has nothing to interpolate, and
    // reproducing it here means reproducing the `process.env` swap it needs.
    // Lowercased because ConfigService reads this same value with .toLowerCase().
    const value = parse(contents).DATABASE?.trim();
    if (value) return value.toLowerCase();
  }
  return undefined;
};

if (!process.env.DATABASE) {
  process.env.DATABASE = readEngineFromDotenv() ?? APP_DEFAULT_ENGINE;
}
