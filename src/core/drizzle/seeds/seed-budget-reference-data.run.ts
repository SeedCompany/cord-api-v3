/**
 * One-time seed script (budget-line-items-poc) that loads
 * `budget-reference-data.json` — ported verbatim from the field-budget
 * prototype's `refdata.json` — into the two new reference/lookup tables:
 * `budget_reference_countries` (177 rows) and
 * `budget_reference_keystone_rates` (126 rows).
 *
 * There is no existing Postgres-specific seed-script convention in this repo
 * yet (the only precedent, `core/gel/seeds.run.ts`, is Gel-specific and reads
 * `.edgeql`/`.ts` files out of `dbschema/seeds/`). This mirrors that script's
 * shape — a standalone, DI-free entry file run via the Nest CLI's
 * `--entryFile` flag — but talks to Postgres directly via the same
 * `drizzle-orm/node-postgres` + `pg.Pool` pairing `DrizzleService` uses,
 * since bootstrapping the full Nest app just to run an insert isn't
 * necessary.
 *
 * Run with: `yarn drizzle:seed-budget-reference-data`
 *
 * Idempotency: this is intentionally a one-time load, not an upsert. Neither
 * reference table has a unique constraint to key an upsert off of (per the
 * schema spec, they're pure lookup data with no natural key enforced at the
 * DB level), so re-running against a database that already has rows would
 * duplicate them. The script guards against that by refusing to run if
 * either table is non-empty.
 */
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { type ID } from '~/common';
import { generateId } from '~/common/functions/generate-id';
import {
  budgetReferenceCountries,
  budgetReferenceKeystoneRates,
} from '../schema/index';

config({ path: '.env.local' });

interface CountryRow {
  country: string;
  region: string | null;
  keystone: string | null;
  ccy: string | null;
  index: number | null;
  indexUsed: string | null;
  cap: number | null;
}

interface KeystoneRow {
  key: string;
  keystone: string;
  role: string;
  weekly: number;
}

interface RefData {
  countries: readonly CountryRow[];
  keystone: readonly KeystoneRow[];
}

async function main() {
  const url = process.env.POSTGRES_URL;
  if (!url) {
    throw new Error(
      'POSTGRES_URL is required to run seed-budget-reference-data',
    );
  }

  const dataPath = path.join(
    process.cwd(),
    'src/core/drizzle/seeds/budget-reference-data.json',
  );
  const raw = await fs.readFile(dataPath, 'utf-8');
  const data = JSON.parse(raw) as RefData;

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);

  try {
    const [existingCountry] = await db
      .select({ id: budgetReferenceCountries.id })
      .from(budgetReferenceCountries)
      .limit(1);
    const [existingKeystone] = await db
      .select({ id: budgetReferenceKeystoneRates.id })
      .from(budgetReferenceKeystoneRates)
      .limit(1);
    if (existingCountry || existingKeystone) {
      throw new Error(
        'budget_reference_countries and/or budget_reference_keystone_rates ' +
          'already has rows — refusing to re-run this one-time seed. ' +
          'Truncate both tables first if you really want to reload.',
      );
    }

    const countryRows = await Promise.all(
      data.countries.map(async (c) => ({
        id: await generateId<ID<'BudgetReferenceCountry'>>(),
        name: c.country,
        region: c.region,
        keystoneCountryName: c.keystone,
        currencyCode: c.ccy,
        costOfLivingIndex: c.index,
        indexMethodology: c.indexUsed,
        adminFeeCap: c.cap,
      })),
    );
    if (countryRows.length > 0) {
      await db.insert(budgetReferenceCountries).values(countryRows);
    }

    const keystoneRows = data.keystone.map((k) => ({
      keystoneCountryName: k.keystone,
      role: k.role,
      weeklyRateUsd: k.weekly,
    }));
    if (keystoneRows.length > 0) {
      await db.insert(budgetReferenceKeystoneRates).values(keystoneRows);
    }

    // eslint-disable-next-line no-console
    console.log(
      `Seeded ${countryRows.length} budget_reference_countries rows and ` +
        `${keystoneRows.length} budget_reference_keystone_rates rows.`,
    );
  } finally {
    await pool.end();
  }
}

await main();
