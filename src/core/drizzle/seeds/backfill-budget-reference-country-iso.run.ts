/**
 * One-time backfill (budget-line-items-poc, phase 2) that populates the new
 * `budget_reference_countries.iso_alpha3` column for all 177 existing rows.
 * This becomes the future join key for deriving a budget's country from
 * `Project.primaryLocation` — that Location's `isoAlpha3` is already
 * ISO 3166-1 alpha-3 (see `location.resolver.ts`'s `isoCountry`), but this
 * table's own `name` column is NOT a reliable match against ISO's official
 * country names (different casing, alternate/colloquial names, and at least
 * one genuine ambiguity — see `MANUAL_ISO_ALPHA3_OVERRIDES` below).
 *
 * Shape/conventions mirror `seed-budget-reference-data.run.ts`: a
 * standalone, DI-free entry file run via the Nest CLI's `--entryFile` flag,
 * talking to Postgres directly via `drizzle-orm/node-postgres` + `pg.Pool`.
 *
 * Resolution strategy, in order:
 *   1. `iso-3166-1`'s `whereCountry(name)` — the same package/reverse-lookup
 *      already used at `location.resolver.ts`. It does a case-insensitive
 *      exact match against ISO's official short name, so it happily
 *      resolves rows that only differ by casing (e.g. this table's "Bosnia
 *      And Herzegovina" / "Côte D'Ivoire" against ISO's "Bosnia and
 *      Herzegovina" / "Côte d'Ivoire").
 *   2. `MANUAL_ISO_ALPHA3_OVERRIDES` — a hand-built map for the ~25 rows
 *      whose name doesn't match ISO's official short name at all (colloquial
 *      names, alternate spellings, "Country (Alt Name)" formatting, or a
 *      genuine one-name-two-countries ambiguity). Each entry documents the
 *      real-world reasoning, using this table's own `ccy` (currency) column
 *      as a disambiguator where relevant (e.g. Congo-Brazzaville vs
 *      Congo-Kinshasa).
 *
 * One row — "Private" — is not a real country (a placeholder entry for
 * budgets with no benchmarked country; `ccy: "Local"`, every other numeric
 * field null/zero) and has no ISO 3166-1 code. It is intentionally left with
 * `iso_alpha3 = NULL` and is called out explicitly in this script's summary
 * output rather than silently skipped.
 *
 * Idempotent: this UPDATEs existing rows by primary key (no INSERTs), so
 * re-running it is always safe — unlike `seed-budget-reference-data.run.ts`,
 * there's no duplicate-row risk to guard against.
 *
 * Run with: `yarn drizzle:backfill-budget-reference-country-iso`
 */
import { config } from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { whereCountry } from 'iso-3166-1';
import { Pool } from 'pg';
import { budgetReferenceCountries } from '../schema/index';

config({ path: '.env.local' });

/**
 * Rows whose `name` doesn't match ISO 3166-1's official short country name
 * closely enough for `whereCountry` (case-insensitive exact match) to
 * resolve. Keyed by this table's exact `name` value.
 */
const MANUAL_ISO_ALPHA3_OVERRIDES: Record<string, string> = {
  // ISO: "Brunei Darussalam".
  Brunei: 'BRN',
  // ISO: "Cabo Verde".
  'Cape Verde': 'CPV',
  // Congo-Kinshasa / DRC. Disambiguated from plain "Congo" (Congo-
  // Brazzaville, below) by this table's own currency column — this row
  // carries "CFA" as a placeholder/incorrect currency code (DRC's real
  // currency is CDF), but the country identity is unambiguous either way:
  // "Dem Rep Congo" only ever refers to Kinshasa.
  'Dem Rep Congo': 'COD',
  // ISO: "Timor-Leste".
  'East Timor': 'TLS',
  // This package's ISO 3166-1 data uses the older official name
  // "Swaziland" rather than "Eswatini" (the country's 2018 rename).
  Eswatini: 'SWZ',
  // ISO: "Islamic Republic of Iran".
  Iran: 'IRN',
  // ISO: "Lao People's Democratic Republic".
  Laos: 'LAO',
  // Misspelling of "Luxembourg" in this table.
  Luxemborg: 'LUX',
  // ISO: "Macao".
  'Macau (Macao)': 'MAC',
  // ISO: "Federated States of Micronesia".
  Micronesia: 'FSM',
  // ISO: "Republic of Moldova".
  Moldova: 'MDA',
  // ISO: "Myanmar" (this table appends the colloquial former name).
  'Myanmar (Burma)': 'MMR',
  // ISO: "Northern Mariana Islands".
  'N Mariana Islands': 'MNP',
  // ISO: "Sao Tome and Principe".
  'Sao Tome': 'STP',
  // ISO: "Republic of Korea" (vs. North Korea's "Democratic People's
  // Republic of Korea" — this table has no separate North Korea row).
  'South Korea': 'KOR',
  // ISO: "Saint Lucia".
  'St. Lucia': 'LCA',
  // ISO: "Syrian Arab Republic".
  Syria: 'SYR',
  // ISO: "Taiwan, Province of China".
  Taiwan: 'TWN',
  // ISO: "United Republic of Tanzania".
  Tanzania: 'TZA',
  // Same real country/code as the table's separate "Gambia" row (which
  // resolves automatically via whereCountry) — this table just has both a
  // plain and a "The"-prefixed row for it.
  'The Gambia': 'GMB',
  // ISO: "Trinidad and Tobago".
  'Trinidad & Tobago': 'TTO',
  // ISO: "United Kingdom of Great Britain and Northern Ireland".
  'United Kingdom': 'GBR',
  // ISO: "United States of America".
  'United States': 'USA',
  // ISO: "Venezuela (Bolivarian Republic of)".
  Venezuela: 'VEN',
  // ISO: "Viet Nam".
  Vietnam: 'VNM',
  // Congo-Brazzaville. `whereCountry('Congo')` happens to resolve this
  // correctly on its own (ISO 3166-1 lists two "Congo" entries — COG then
  // COD — and `Array.find` returns the first), but that's incidental to
  // array ordering, not a real disambiguation. Pinned explicitly here so
  // the correct answer doesn't depend on that ordering: this row's currency
  // is "XAF" (CFA franc BEAC, used by Congo-Brazzaville and other Central
  // African states), distinct from "Dem Rep Congo"'s row above.
  Congo: 'COG',
};

/** Not a real country — see file doc comment. Left `iso_alpha3 = NULL`. */
const KNOWN_UNRESOLVABLE = new Set(['Private']);

function resolveIsoAlpha3(name: string): string | null {
  const iso = whereCountry(name);
  if (iso) return iso.alpha3;
  const override = MANUAL_ISO_ALPHA3_OVERRIDES[name];
  if (override) return override;
  return null;
}

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      'POSTGRES_URL is required to run backfill-budget-reference-country-iso',
    );
  }

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  try {
    const rows = await db
      .select({
        id: budgetReferenceCountries.id,
        name: budgetReferenceCountries.name,
        currencyCode: budgetReferenceCountries.currencyCode,
      })
      .from(budgetReferenceCountries);

    if (rows.length !== 177) {
      // eslint-disable-next-line no-console
      console.warn(
        `Expected 177 budget_reference_countries rows, found ${rows.length}. ` +
          'Proceeding anyway, but double-check the unresolved list below.',
      );
    }

    let updated = 0;
    const unresolved: string[] = [];
    for (const row of rows) {
      const alpha3 = resolveIsoAlpha3(row.name);
      if (!alpha3) {
        if (!KNOWN_UNRESOLVABLE.has(row.name)) {
          unresolved.push(`${row.name} (ccy: ${row.currencyCode ?? 'null'})`);
        }
        continue;
      }
      await db
        .update(budgetReferenceCountries)
        .set({ isoAlpha3: alpha3 })
        .where(eq(budgetReferenceCountries.id, row.id));
      updated += 1;
    }

    // eslint-disable-next-line no-console
    console.log(
      `Backfilled iso_alpha3 on ${updated}/${rows.length} budget_reference_countries rows.`,
    );
    const knownUnresolved = rows.filter((r) => KNOWN_UNRESOLVABLE.has(r.name));
    if (knownUnresolved.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        `Intentionally left NULL (not a real country): ${knownUnresolved
          .map((r) => r.name)
          .join(', ')}`,
      );
    }
    if (unresolved.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        `UNRESOLVED (needs a manual override added to this script): ${unresolved.join(', ')}`,
      );
      process.exitCode = 1;
    }
  } finally {
    await pool.end();
  }
}

await main();
