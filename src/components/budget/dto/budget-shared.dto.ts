import { ObjectType } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-scalars';
import { SecuredProperty } from '~/common';
import { Organization } from '../../organization/dto';

/**
 * Shared secured-property wrappers for the budget-line-items-poc resources
 * (`BudgetLineItem`, `OtherPartnerContribution`). Split out here rather than
 * duplicated per-file since both new types need them.
 */

/**
 * `Organization` doesn't otherwise have a nullable secured variant (its one
 * usage today, `BudgetRecord.organization`, is always present). Line items /
 * OPC rows reference an organization optionally (service provider, funder,
 * donor), so this fills that gap — mirrors `SecuredFloatNullable` etc.'s
 * pattern of a dedicated `Nullable` class rather than reusing the non-null
 * one with a different runtime value.
 */
@ObjectType({
  description: SecuredProperty.descriptionFor('an organization or null'),
})
export abstract class SecuredOrganizationNullable extends SecuredProperty<
  Organization,
  Organization,
  true
>(Organization, { nullable: true }) {}

/**
 * The `fiscal_year_amounts` JSONB column shape: an object keyed by fiscal
 * year number as a string, e.g. `{ "2025": 3000000, "2026": 4000000 }`. Kept
 * as a raw JSON object scalar rather than a typed list — the set of fiscal
 * years spans the parent budget's project dates, which isn't known to this
 * type in isolation.
 */
@ObjectType({
  description: SecuredProperty.descriptionFor(
    'a fiscal-year-keyed amounts object',
  ),
})
export abstract class SecuredFiscalYearAmounts extends SecuredProperty<
  Record<string, number>
>(GraphQLJSONObject) {}
