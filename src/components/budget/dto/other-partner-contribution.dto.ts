import { Field, ObjectType } from '@nestjs/graphql';
import {
  Calculated,
  type ID,
  Resource,
  type Secured,
  SecuredStringNullable,
} from '~/common';
import { RegisterResource } from '~/core/resources';
import { SecuredFiscalYearAmounts } from './budget-shared.dto';

/**
 * Tracks a contribution from a partner OTHER than the budget's primary
 * funder — subtracted out when computing net-to-funder (budget-line-items-poc).
 * See `BudgetLineItem` for the `RegisterResource()`/`Parent`/`Secured<ID>`
 * conventions this mirrors.
 */
@RegisterResource()
@ObjectType({
  implements: [Resource],
})
export class OtherPartnerContribution extends Resource {
  static readonly Parent = () => import('./budget.dto').then((m) => m.Budget);

  @Calculated()
  readonly donor: Secured<ID<'Organization'> | null>;

  @Field()
  readonly description: SecuredStringNullable;

  @Field({
    description:
      'Amounts by fiscal year, e.g. `{ "2025": 3000000, "2026": 4000000 }`.',
  })
  readonly fiscalYearAmounts: SecuredFiscalYearAmounts;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    OtherPartnerContribution: typeof OtherPartnerContribution;
  }
}
