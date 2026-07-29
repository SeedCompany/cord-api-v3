import { Field, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import {
  Calculated,
  type ID,
  Resource,
  type Secured,
  SecuredInt,
  SecuredString,
  SecuredStringNullable,
} from '~/common';
import { RegisterResource } from '~/core/resources';
import { SecuredFiscalYearAmounts } from './budget-shared.dto';

/**
 * A single row of the field-budget calculator's line-item grid
 * (budget-line-items-poc). New resource — no Neo4j/Gel counterpart exists,
 * so `@RegisterResource()` is called without a `db` binding (same pattern as
 * `ProjectChangeRequest`/`Changeset`). `static Parent` points back to
 * `Budget` for authorization purposes only (matches `Education`/
 * `Unavailability` — no GraphQL `parent`/`budget` field is exposed since it
 * wasn't asked for; query via `Budget.lineItems` instead).
 *
 * `serviceProvider` / `funder` are declared here as bare `Secured<ID>` (no
 * `@Field()`) rather than `SecuredOrganizationNullable` directly — matching
 * `BudgetRecord.organization` — because the actual Organization object is
 * hydrated by a `@ResolveField` in `BudgetLineItemResolver` via a loader, not
 * by the repository. The unsecured DTO only ever carries the raw id.
 */
@RegisterResource()
@ObjectType({
  implements: [Resource],
})
export class BudgetLineItem extends Resource {
  static readonly Parent = () => import('./budget.dto').then((m) => m.Budget);

  @Field({
    description: stripIndent`
      Freeform, matching the field's fixed set of allowed values: \`line\` or
      \`header\`. \`header\` rows are visual section dividers in the grid —
      they carry only a \`description\` (\`account\` is null, and all other
      fields are ignored) and contribute nothing to any calculated total. Not
      a GraphQL enum — see \`costType\` for why.
    `,
  })
  readonly type: SecuredString;

  @Field({
    description:
      'Stable ordering position within the budget, lowest first. Assigned server-side (current-max-plus-one) on create — not settable directly.',
  })
  readonly position: SecuredInt;

  @Field({
    description:
      'The chart-of-accounts line this cost is booked to. Null for `header` rows.',
  })
  readonly account: SecuredStringNullable;

  @Field()
  readonly description: SecuredStringNullable;

  @Field({
    description: stripIndent`
      Freeform, matching the field's fixed set of allowed values: \`Cash\` or
      \`In-Kind\`. Not a GraphQL enum — mirrors the underlying column, which is
      plain text (see migration 0022's notes) rather than a Postgres enum, to
      keep the value set adjustable without a schema change.
    `,
  })
  readonly costType: SecuredString;

  @Field({
    description: stripIndent`
      Freeform, matching the field's fixed set of allowed values: \`Field
      Budget\` or \`Direct Charge to Funder\`. See \`costType\` for why this
      isn't a GraphQL enum.
    `,
  })
  readonly budgetCategory: SecuredString;

  @Field({
    description: stripIndent`
      Freeform, matching the field's fixed set of allowed values: \`Bible
      Translation\` or \`Other Costs\`; null if this line hasn't been
      classified. See \`costType\` for why this isn't a GraphQL enum.
    `,
  })
  readonly activity: SecuredStringNullable;

  @Field({
    description:
      "SIL's chart-of-accounts name for this line's `account`, when the field has mapped it. A real user choice (cascading dropdowns or manual free-text) — not a computed lookup.",
  })
  readonly partnerAccountName: SecuredStringNullable;

  @Field({
    description:
      "SIL's chart-of-accounts number for this line's `account`, when the field has mapped it. A real user choice (cascading dropdowns or manual free-text) — not a computed lookup.",
  })
  readonly partnerAccountNumber: SecuredStringNullable;

  @Calculated()
  readonly serviceProvider: Secured<ID<'Organization'> | null>;

  @Calculated()
  readonly funder: Secured<ID<'Organization'> | null>;

  @Field({
    description:
      'Amounts by fiscal year, e.g. `{ "2025": 3000000, "2026": 4000000 }`.',
  })
  readonly fiscalYearAmounts: SecuredFiscalYearAmounts;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    BudgetLineItem: typeof BudgetLineItem;
  }
}
