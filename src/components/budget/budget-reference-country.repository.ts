import { Injectable } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import { type ID } from '~/common';
import { DrizzleDtoRepository } from '~/core/drizzle';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import { budgetReferenceCountries } from '~/core/drizzle/schema';
import { BudgetReferenceCountry } from './dto';

/**
 * Pure reference/lookup data — no policy gating, no soft delete (see the
 * migration's notes). No Neo4j/Gel counterpart, so this is a single, direct
 * Drizzle repository rather than the usual `splitDb(...)`-wired pair;
 * there's no other engine to split against (budget-line-items-poc).
 */
@Injectable()
export class BudgetReferenceCountryRepository extends DrizzleDtoRepository<
  typeof budgetReferenceCountries,
  BudgetReferenceCountry
> {
  constructor(db: DrizzleService) {
    super(db, budgetReferenceCountries, BudgetReferenceCountry);
  }

  async list(): Promise<readonly BudgetReferenceCountry[]> {
    const rows = await this.db
      .select()
      .from(budgetReferenceCountries)
      .orderBy(asc(budgetReferenceCountries.name));
    return rows.map((row) => this.toDto(row));
  }

  /**
   * Exact-match lookup by ISO 3166-1 alpha-3 code — the join key used to
   * derive a budget's country from `Project.primaryLocation.isoAlpha3`
   * (budget-line-items-poc phase 3; see `BudgetDerivedFieldsService
   * .resolveCountry`). Null if no row's `iso_alpha3` matches (e.g. the
   * location's ISO code isn't one of the 177 seeded reference countries).
   */
  async findByIsoAlpha3(
    isoAlpha3: string,
  ): Promise<BudgetReferenceCountry | null> {
    const [row] = await this.db
      .select()
      .from(budgetReferenceCountries)
      .where(eq(budgetReferenceCountries.isoAlpha3, isoAlpha3))
      .limit(1);
    return row ? this.toDto(row) : null;
  }

  protected toDto(
    row: typeof budgetReferenceCountries.$inferSelect,
  ): BudgetReferenceCountry {
    return {
      id: row.id as ID<'BudgetReferenceCountry'>,
      name: row.name,
      region: row.region,
      keystoneCountryName: row.keystoneCountryName,
      currencyCode: row.currencyCode,
      costOfLivingIndex: row.costOfLivingIndex,
      indexMethodology: row.indexMethodology,
      adminFeeCap: row.adminFeeCap,
    };
  }
}
