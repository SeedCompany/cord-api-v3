import { Field, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import {
  Calculated,
  DbLabel,
  type ID,
  IntersectTypes,
  Resource,
  type ResourceRelationsShape,
  type Secured,
  SecuredFloat,
  SecuredInt,
  SecuredProperty,
  SecuredString,
  Sensitivity,
  SensitivityField,
} from '~/common';
import { e } from '~/core/gel';
import { type BaseNode } from '~/core/neo4j/results';
import { RegisterResource } from '~/core/resources';
import { ChangesetAware } from '../../changeset/dto';
import { type DefinedFile } from '../../file/dto';
import { IProject } from '../../project/dto';
import { BudgetLineItem } from './budget-line-item.dto';
import { BudgetRecord } from './budget-record.dto';
import { BudgetStatus } from './budget-status.enum';
import { OtherPartnerContribution } from './other-partner-contribution.dto';

const Interfaces = IntersectTypes(Resource, ChangesetAware);

@ObjectType({
  description: stripIndent`
    Rollup information across budget records.
    Provides aggregated insights and summary data about budget records.
  `,
})
export class BudgetSummary {
  @Field(() => Boolean, {
    description: 'Whether any budget record has a preApproved amount set',
  })
  hasPreApproved: boolean;

  @Field(() => Boolean, {
    description:
      'Whether any budget record amount exceeds its preApproved amount',
  })
  preApprovedExceeded: boolean;
}

@Calculated()
@RegisterResource({ db: e.Budget })
@ObjectType({
  implements: Interfaces.members,
})
export class Budget extends Interfaces {
  static readonly Relations = (() => ({
    ...Resource.Relations(),
    records: [BudgetRecord],
    lineItems: [BudgetLineItem],
    otherPartnerContributions: [OtherPartnerContribution],
  })) satisfies ResourceRelationsShape;
  static readonly Parent = () =>
    import('../../project/dto').then((m) => m.IProject);

  @Field(() => IProject)
  declare readonly parent: BaseNode;

  @Field()
  @DbLabel('BudgetStatus')
  readonly status: BudgetStatus;

  @Field(() => [BudgetRecord])
  readonly records: readonly BudgetRecord[];

  readonly universalTemplateFile: DefinedFile;

  @SensitivityField({
    description: "Based on the project's sensitivity",
  })
  readonly sensitivity: Sensitivity;

  // ── budget-line-items-poc additions ──

  /**
   * budget-line-items-poc phase 3: now purely SERVER-DERIVED from
   * `Project.primaryLocation` (see `BudgetDerivedFieldsService.resolveCountry`
   * / `BudgetResolver.country`) — no longer manually set. `@Calculated()` is
   * therefore the CORRECT decorator again here, matching how
   * `BudgetLineItem.serviceProvider`/`funder` (also server-managed,
   * never user-set) already use it.
   *
   * History: an earlier phase of this POC made `country` directly settable
   * via `UpdateBudget.country` and deliberately did NOT mark it
   * `@Calculated()` — `@Calculated()` wires into `CalculatedCondition`,
   * which hardcodes `isAllowed() { return false; }` for ANY role including
   * Administrator, so marking a genuinely user-settable field that way made
   * it permanently uneditable regardless of policy grants (caught by
   * hand-testing `updateBudget` end-to-end; schema/type-check/lint can't
   * catch an authorization-condition mistake like this). Now that the field
   * is purely derived and `country` has been removed from `UpdateBudget`
   * entirely, that concern no longer applies.
   *
   * Not `@Field()`'d directly — the `BudgetReferenceCountry` object is
   * resolved by `BudgetResolver.country` (which calls
   * `BudgetDerivedFieldsService.resolveCountry`, not the raw value below),
   * matching how `BudgetRecord.organization` is declared (bare `Secured<ID>`
   * here, full object resolved in the resolver).
   */
  @Calculated()
  readonly country: Secured<ID<'BudgetReferenceCountry'> | null>;

  @Field({
    description: stripIndent`
      Which currency line-item amounts are entered in: \`USD\` or \`Local\`.
      Freeform text, not a GraphQL enum — matches how \`entryCurrencyMode\` is
      stored (see migration 0022's notes).
    `,
  })
  readonly entryCurrencyMode: SecuredString;

  @Field({
    description: stripIndent`
      Which currency totals are displayed in: \`USD\` or \`Local\`. Ignored
      (entry currency is used instead) when the budget's sensitivity is
      \`High\` — see \`BudgetCalculationService\`.
    `,
  })
  readonly displayCurrencyMode: SecuredString;

  @Field({
    description: 'Local-currency-per-USD rate used to convert between modes.',
  })
  readonly exchangeRate: SecuredFloat;

  @Field({
    description:
      'Annual inflation rate applied when spreading amounts across fiscal years.',
  })
  readonly inflationRate: SecuredFloat;

  @Field({
    description:
      "The manually-entered admin-fee percent applied to this budget's cash + in-kind total.",
  })
  readonly adminFeePercent: SecuredFloat;

  /**
   * budget-line-items-poc phase 3: now purely SERVER-DERIVED from the
   * count of the project's Language Engagements (see
   * `BudgetDerivedFieldsService.countLanguageEngagements` /
   * `BudgetResolver.languageCount`) — no longer manually set, mirroring
   * `country`'s same "derived, not manually set" change above (and for the
   * same reason, `@Calculated()` here too rather than left editable via a
   * field nobody can ever actually change through `UpdateBudget` anymore).
   * Not `@Field()`'d directly, for the same reason as `country` — see that
   * field's comment.
   */
  @Calculated()
  readonly languageCount: SecuredInt;

  @Field(() => [BudgetLineItem])
  readonly lineItems: readonly BudgetLineItem[];

  @Field(() => [OtherPartnerContribution])
  readonly otherPartnerContributions: readonly OtherPartnerContribution[];
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a budget'),
})
export class SecuredBudget extends SecuredProperty(Budget) {}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Budget: typeof Budget;
  }
  interface ResourceDBMap {
    Budget: typeof e.default.Budget;
  }
}
