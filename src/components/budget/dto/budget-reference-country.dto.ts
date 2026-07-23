import { Field, Float, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { type ID, IdField, SecuredProperty } from '~/common';

/**
 * A row of the `budget_reference_countries` lookup table (budget-line-items-poc).
 * Pure, seeded reference/benchmark data (ported from the field-budget
 * prototype's `refdata.json`) used by the calculation engine and to populate
 * a country-picker on the client. Not a `Resource` / policy-gated type — like
 * an enum's members, every authenticated internal role can read the full
 * list (see the `budgetReferenceCountries` query); there's nothing
 * budget-specific or sensitive in the row itself. Access to *which* country a
 * given budget has selected is controlled instead via `Budget.country`
 * (`SecuredBudgetReferenceCountry`).
 */
@ObjectType()
export class BudgetReferenceCountry {
  @IdField()
  readonly id: ID<'BudgetReferenceCountry'>;

  @Field()
  readonly name: string;

  @Field({ nullable: true })
  readonly region: string | null;

  @Field({
    nullable: true,
    description: stripIndent`
      The name of the OTHER country whose keystone weekly salary rates this
      country benchmarks against (e.g. Afghanistan's is "Pakistan"). Null if
      this country has no keystone benchmark configured.
    `,
  })
  readonly keystoneCountryName: string | null;

  @Field({ nullable: true })
  readonly currencyCode: string | null;

  @Field(() => Float, { nullable: true })
  readonly costOfLivingIndex: number | null;

  @Field({ nullable: true })
  readonly indexMethodology: string | null;

  @Field(() => Float, {
    nullable: true,
    description: 'The Category-3 admin-fee cap for this country, if any.',
  })
  readonly adminFeeCap: number | null;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a budget reference country'),
})
export abstract class SecuredBudgetReferenceCountry extends SecuredProperty<
  BudgetReferenceCountry,
  BudgetReferenceCountry,
  true
>(BudgetReferenceCountry, { nullable: true }) {}
