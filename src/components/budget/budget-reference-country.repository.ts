import { Injectable } from '@nestjs/common';
import { asc } from 'drizzle-orm';
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
