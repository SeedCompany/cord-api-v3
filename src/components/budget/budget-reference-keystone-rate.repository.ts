import { Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { budgetReferenceKeystoneRates } from '~/core/drizzle/schema';

/**
 * Pure reference/lookup data for the benchmark/keystone calculator
 * (`budgetBenchmark` query, budget-line-items-poc phase 3) — keyed by
 * (keystone country name, role label). Deliberately has NO public GraphQL
 * query of its own, unlike `BudgetReferenceCountryRepository`'s
 * `budgetReferenceCountries` query: the prototype's own explicit design goal
 * ("Reference benchmark data is embedded for calculation only and is never
 * displayed", per its README's Privacy section) applies specifically to
 * these rates, so this repository is only ever called from
 * `BudgetResolver.budgetBenchmark`'s server-side math, never exposed raw.
 *
 * Doesn't extend `DrizzleDtoRepository` (unlike the other budget-line-items
 * -poc repositories) — that base requires a `@RegisterResource()`/
 * `@ObjectType()`-decorated DTO class for its `EnhancedResource.of(dto)` /
 * `getChanges(dto)` machinery, and this table deliberately has no GraphQL
 * -facing DTO at all (see above). A thin, direct `DrizzleService` wrapper is
 * simpler and avoids that requirement entirely.
 */
@Injectable()
export class BudgetReferenceKeystoneRateRepository {
  constructor(private readonly drizzle: DrizzleService) {}

  private get db() {
    return this.drizzle.client;
  }

  /**
   * Exact-match weekly USD rate for a (keystone country, role) pair, or null
   * if no such row was seeded. Ported from the prototype's
   * `keystoneWeekly(keystoneCountry, roleLabel)`.
   */
  async findRate(
    keystoneCountryName: string,
    role: string,
  ): Promise<number | null> {
    const [row] = await this.db
      .select({ weeklyRateUsd: budgetReferenceKeystoneRates.weeklyRateUsd })
      .from(budgetReferenceKeystoneRates)
      .where(
        and(
          eq(
            budgetReferenceKeystoneRates.keystoneCountryName,
            keystoneCountryName,
          ),
          eq(budgetReferenceKeystoneRates.role, role),
        ),
      )
      .limit(1);
    return row?.weeklyRateUsd ?? null;
  }
}
