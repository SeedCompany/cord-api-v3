import { Query, Resolver } from '@nestjs/graphql';
import { BudgetReferenceCountryRepository } from './budget-reference-country.repository';
import { BudgetReferenceCountry } from './dto';

@Resolver()
export class BudgetReferenceCountryResolver {
  constructor(private readonly repo: BudgetReferenceCountryRepository) {}

  @Query(() => [BudgetReferenceCountry], {
    description:
      'The full list of budget reference countries, for populating a country picker. Not paginated — this is a small, complete lookup table.',
  })
  async budgetReferenceCountries(): Promise<readonly BudgetReferenceCountry[]> {
    return await this.repo.list();
  }
}
