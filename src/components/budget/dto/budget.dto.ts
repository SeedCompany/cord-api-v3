import { Field, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import {
  Calculated,
  DbLabel,
  IntersectTypes,
  Resource,
  type ResourceRelationsShape,
  SecuredProperty,
  Sensitivity,
  SensitivityField,
} from '~/common';
import { type BaseNode } from '~/core/database/results';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';
import { ChangesetAware } from '../../changeset/dto';
import { type DefinedFile } from '../../file/dto';
import { IProject } from '../../project/dto';
import { BudgetRecord } from './budget-record.dto';
import { BudgetStatus } from './budget-status.enum';

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
