/**
 * One-off repair: enum values that a text strategy overwrote with fake prose.
 *
 * WHY THIS EXISTS. The classification is supposed to leave enums alone, and for
 * most of them it does (`status`, `step`, `sensitivity`, `methodology`, `medium`
 * all say so explicitly). Two did not — `position` and `degree` were classified
 * as prose — so the scrub replaced enum members with invented words, and the API
 * then refuses to serialize them: `Enum "InternshipPosition" cannot represent
 * value: "Utilis"`.
 *
 * HOW THE ORIGINALS COME BACK. The fakes are deterministic by design, so the
 * same input always produces the same output. That makes the mapping invertible:
 * compute the fake for every member of every enum the API declares, and any
 * field whose stored values are all fakes of one enum is an over-scrubbed enum —
 * with the true value recoverable for each. No guessing, and no fresh restore.
 *
 * This doubles as the DISCOVERY tool. It does not trust the field name or a
 * hand-maintained list: it checks the data against the enums the schema actually
 * declares, so it finds fields nobody thought to look at.
 *
 * A field is only touched when most of what it holds maps onto one enum, and only
 * the values that map are rewritten. Values whose original is not a current member
 * of that enum cannot be mapped back to anything, so they are left as they are and
 * reported — never counted as repaired.
 *
 * The scrub is NOT idempotent for values, so a copy scrubbed twice holds a fake OF
 * a fake and the original is two applications back. This searches successive
 * generations; trying only one finds nothing and reads as "no enum was damaged".
 *
 * Enum members come from `schema.graphql`, which is generated from the API and
 * is plain SDL — deliberately not from parsing TypeScript, which produced a
 * false clearance the last time it was tried.
 *
 * Runs against a RESTORED COPY, never production. Boots with `DATABASE=neo4j`.
 * Safe to re-run: a field already holding real enum members matches no fake set,
 * so it is skipped.
 *
 * Usage:
 *   # report what it would change, write nothing
 *   yarn start --entryFile core/repair-scrubbed-enums.run -- --dry-run
 *
 *   # repair
 *   yarn start --entryFile core/repair-scrubbed-enums.run
 *
 * Flags: --dry-run | --max-distinct=N (default 200; skips high-cardinality
 *        fields like `name`, which cannot be enums)
 */
import { NestFactory } from '@nestjs/core';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { exit } from 'node:process';
import '../polyfills';

const parseFlags = (argv: readonly string[]) => {
  const get = (name: string) =>
    argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1];
  return {
    dryRun: argv.includes('--dry-run'),
    maxDistinct: get('max-distinct') ? Number(get('max-distinct')) : 200,
  };
};

/**
 * Enum name → members, read from the generated GraphQL schema.
 *
 * SDL is regular enough to read directly: `enum Name {` then one member per line
 * until the closing brace.
 *
 * ⚠ A member may carry a directive — the historic values look like
 * `TranslationFacilitator @deprecated(reason: "...")`. Requiring a LONE identifier
 * silently dropped every deprecated member, which read as "the original is not a
 * current member of this enum" for exactly the legacy values. Match the leading
 * identifier and allow anything after it.
 */
const readSchemaEnums = (sdl: string): Map<string, string[]> => {
  const enums = new Map<string, string[]>();
  const lines = sdl.split('\n');
  let current: string | null = null;
  let members: string[] = [];
  for (const line of lines) {
    const start = /^enum\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/.exec(line);
    if (start) {
      current = start[1]!;
      members = [];
      continue;
    }
    if (current === null) continue;
    if (/^\s*\}/.test(line)) {
      if (members.length > 0) enums.set(current, members);
      current = null;
      continue;
    }
    // Skip descriptions ("""…""" or #) and blank lines; take the identifier and
    // ignore any directive trailing it.
    if (/^\s*(#|"|$)/.test(line)) continue;
    const member = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(@.*)?$/.exec(line);
    if (member) members.push(member[1]!);
  }
  return enums;
};

/**
 * How many times the scrub may have been applied. A copy scrubbed twice holds a
 * fake of a fake; the original is that many applications back.
 */
const MAX_GENERATIONS = 5;
/** A genuine enum match accounts for most of the field, not a stray collision. */
const MIN_MATCHED_VALUES = 2;
const MIN_COVERAGE = 0.5;

interface Candidate {
  /** Link name or node-property key. */
  readonly name: string;
  readonly kind: 'link' | 'field';
  readonly strategy: string;
  readonly total: number;
  readonly distinct: readonly string[];
}

async function bootstrap() {
  const flags = parseFlags(process.argv.slice(2));
  process.argv.push('console');

  const { AppModule } = await import('../app.module');
  const { DatabaseService } = await import('~/core/neo4j');
  const { fakeValue, sortValueFor } = await import('./scrub/fake');
  const { links, properties } = await import('./scrub/classification');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  const neo4j = app.get(DatabaseService);
  // eslint-disable-next-line no-console
  const log = (msg: string) => console.log(msg);

  const sdlPath = path.join(process.cwd(), 'schema.graphql');
  const schemaEnums = readSchemaEnums(readFileSync(sdlPath, 'utf8'));
  log(
    flags.dryRun
      ? '\nDry run — reporting only, nothing is written.\n'
      : '\nRepairing over-scrubbed enum values in place.\n',
  );
  log(`Read ${schemaEnums.size} enums from schema.graphql.`);

  // Every field the classification rewrites with a text strategy. Credentials are
  // excluded: those are emptied on purpose and have no original to restore.
  const scrubbed: Array<{
    name: string;
    kind: 'link' | 'field';
    strategy: string;
  }> = [];
  for (const [name, action] of Object.entries(links)) {
    if (action.kind === 'scrub' && action.as !== 'credential') {
      scrubbed.push({ name, kind: 'link', strategy: action.as });
    }
  }
  for (const [name, action] of Object.entries(properties)) {
    if (action.kind === 'scrub' && action.as !== 'credential') {
      scrubbed.push({ name, kind: 'field', strategy: action.as });
    }
  }
  log(`Checking ${scrubbed.length} scrubbed field(s) against those enums.\n`);

  // Gather distinct values, skipping anything too varied to be an enum.
  const candidates: Candidate[] = [];
  for (const entry of scrubbed) {
    const cypher =
      entry.kind === 'link'
        ? `MATCH ()-[:\`${entry.name}\`]->(p)
           WHERE (p:Property OR p:Deleted_Property) AND p.value IS NOT NULL
           RETURN count(p) AS total, count(DISTINCT p.value) AS distinctCount`
        : `MATCH (n) WHERE n.\`${entry.name}\` IS NOT NULL
           RETURN count(n) AS total, count(DISTINCT n.\`${entry.name}\`) AS distinctCount`;
    const [counts] = [
      ...(await neo4j
        .query<{ total: number; distinctCount: number }>(cypher)
        .run()),
    ];
    const total = Number(counts?.total ?? 0);
    const distinctCount = Number(counts?.distinctCount ?? 0);
    if (total === 0 || distinctCount === 0) continue;
    if (distinctCount > flags.maxDistinct) continue;

    const valuesCypher =
      entry.kind === 'link'
        ? `MATCH ()-[:\`${entry.name}\`]->(p)
           WHERE (p:Property OR p:Deleted_Property) AND p.value IS NOT NULL
           RETURN DISTINCT p.value AS value`
        : `MATCH (n) WHERE n.\`${entry.name}\` IS NOT NULL
           RETURN DISTINCT n.\`${entry.name}\` AS value`;
    const rows = [
      ...(await neo4j.query<{ value: unknown }>(valuesCypher).run()),
    ];
    const distinct = rows
      .map((row) => row.value)
      .filter((value): value is string => typeof value === 'string');
    if (distinct.length === 0) continue;
    candidates.push({ ...entry, total, distinct });
  }

  // Match each candidate against every enum's fake set.
  let repairedFields = 0;
  let repairedValues = 0;
  const partial: string[] = [];

  for (const candidate of candidates) {
    let matched: {
      enumName: string;
      map: Map<string, string>;
      covered: readonly string[];
    } | null = null;
    let ambiguous = false;

    for (const [enumName, members] of schemaEnums) {
      // Search successive generations, because the scrub is not idempotent for
      // values: scrubbing an already-fake value produces a different fake. A copy
      // that has been through the scrub twice holds a fake OF a fake, so the
      // original is two applications back, not one. Trying only one generation
      // finds nothing and looks like "no enum was damaged".
      let fakeToReal = new Map<string, string>();
      let bestCovered = 0;
      // One generation is one more application of the fake, so carry each
      // member's value forward rather than re-deriving it from the member.
      let valueByMember = new Map(members.map((member) => [member, member]));
      let generation = 0;
      while (generation < MAX_GENERATIONS) {
        generation++;
        const advanced = new Map<string, string>();
        for (const [member, value] of valueByMember) {
          const next = fakeValue(candidate.strategy as never, value);
          // A strategy that does not return a string cannot be inverted, so
          // that member simply drops out of the search.
          if (typeof next === 'string') advanced.set(member, next);
        }
        valueByMember = advanced;

        const attempt = new Map<string, string>();
        let injective = true;
        for (const [member, value] of valueByMember) {
          if (attempt.has(value)) {
            // Two members collapsing to one fake would make the inverse ambiguous.
            injective = false;
            break;
          }
          attempt.set(value, member);
        }
        if (!injective) continue;
        const covered = candidate.distinct.filter((value) =>
          attempt.has(value),
        );
        if (covered.length > bestCovered) {
          bestCovered = covered.length;
          fakeToReal = attempt;
        }
      }
      if (fakeToReal.size === 0) continue;
      const covered = candidate.distinct.filter((value) =>
        fakeToReal.has(value),
      );
      if (covered.length === 0) continue;
      // Values that are ALREADY valid members need no repair, so they must not
      // count against coverage. Without this, a field that has been partly
      // repaired looks mostly-clean and the remainder can never be finished.
      const memberSet = new Set(members);
      const needsRepair = candidate.distinct.filter(
        (value) => !memberSet.has(value),
      );
      // A real match accounts for most of what the field holds. An unrelated prose
      // field will collide with a stray enum fake now and then — those land in the
      // low single-digit percentages, well under this bar.
      const coverage =
        needsRepair.length === 0 ? 0 : covered.length / needsRepair.length;
      if (covered.length >= MIN_MATCHED_VALUES && coverage >= MIN_COVERAGE) {
        if (matched) ambiguous = true;
        matched = { enumName, map: fakeToReal, covered };
      } else {
        partial.push(
          `  ? ${candidate.name} (${candidate.kind}): only ${covered.length} of ${needsRepair.length} unrecognised value(s) look like ${enumName} fakes — left alone, needs a human`,
        );
      }
    }

    if (!matched) continue;
    if (ambiguous) {
      partial.push(
        `  ? ${candidate.name} (${candidate.kind}): matches more than one enum — left alone, needs a human`,
      );
      continue;
    }

    const unmapped = candidate.distinct.filter(
      (value) => !matched.map.has(value),
    );
    log(
      `  \u2717 ${candidate.name} (${candidate.kind}) was scrubbed as '${candidate.strategy}' but holds ${matched.enumName} \u2014 ${matched.covered.length} value(s) recoverable`,
    );
    if (unmapped.length > 0) {
      // Values whose original is not a member of the enum the API declares now.
      // Nothing to map them back to, so they are left as they are and named here
      // rather than quietly counted as repaired.
      log(
        `      ${unmapped.length} not recoverable (original is not a current member of ${matched.enumName})`,
      );
    }
    repairedFields++;
    repairedValues += matched.covered.length;

    if (flags.dryRun) continue;

    const batch = matched.covered.map((fake) => ({
      fake,
      real: matched.map.get(fake)!,
      sortValue: sortValueFor(matched.map.get(fake)!),
    }));
    const writeCypher =
      candidate.kind === 'link'
        ? `UNWIND $batch AS row
           MATCH ()-[:\`${candidate.name}\`]->(p)
           WHERE (p:Property OR p:Deleted_Property) AND p.value = row.fake
           SET p.value = row.real,
               p.sortValue = CASE WHEN p.sortValue IS NULL THEN NULL ELSE row.sortValue END`
        : `UNWIND $batch AS row
           MATCH (n) WHERE n.\`${candidate.name}\` = row.fake
           SET n.\`${candidate.name}\` = row.real`;
    await neo4j.query(writeCypher, { batch }).run();
  }

  if (partial.length > 0) {
    log('\nInconclusive — reported, not changed:');
    for (const line of partial) log(line);
  }

  log('');
  log(
    `  fields ${flags.dryRun ? 'that would be' : ''} repaired: ${repairedFields}`,
  );
  log(
    `  distinct values ${flags.dryRun ? 'that would be' : ''} remapped: ${repairedValues}`,
  );
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
