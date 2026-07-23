import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { BudgetReferenceCountryRepository } from './budget-reference-country.repository';
import { type BudgetReferenceCountry } from './dto';

// No resource thunk — `BudgetReferenceCountry` isn't `@RegisterResource()`'d
// (it's plain reference data, not a policy resource; see the dto file), so
// it can't satisfy the resource registry's `ValueOf<ResourceMap>` type. This
// loader is only ever injected directly via `@Loader(BudgetReferenceCountryLoader)`,
// not resolved dynamically by resource name, so that's not needed here.
@LoaderFactory()
export class BudgetReferenceCountryLoader implements DataLoaderStrategy<
  BudgetReferenceCountry,
  ID<BudgetReferenceCountry>
> {
  constructor(private readonly repo: BudgetReferenceCountryRepository) {}

  async loadMany(ids: ReadonlyArray<ID<BudgetReferenceCountry>>) {
    return await this.repo.readMany(ids);
  }
}
