import { Field, ObjectType } from '@nestjs/graphql';
import {
  Calculated,
  type ID,
  IntersectTypes,
  Resource,
  type Secured,
  SecuredFloatNullable,
  SecuredInt,
  Sensitivity,
  SensitivityField,
} from '~/common';
import { type BaseNode } from '~/core/database/results';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';
import { ChangesetAware } from '../../changeset/dto';
import { type BudgetStatus } from './budget-status.enum';
import { Budget } from './budget.dto';

const Interfaces = IntersectTypes(Resource, ChangesetAware);

@Calculated()
@RegisterResource({ db: e.Budget.Record })
@ObjectType({
  implements: Interfaces.members,
})
export class BudgetRecord extends Interfaces {
  static readonly Parent = () => import('./budget.dto').then((m) => m.Budget);

  @Field(() => Budget)
  declare readonly parent: BaseNode;

  @Calculated()
  readonly organization: Secured<ID>;

  @Calculated()
  @Field()
  readonly fiscalYear: SecuredInt;

  @Field({
    description: 'The current amount including any change to plans',
  })
  readonly amount: SecuredFloatNullable;

  @Field({
    description: 'The amount that was pre-approved for this budget record.',
  })
  readonly preApprovedAmount: SecuredFloatNullable;

  @Field({
    description:
      'The amount that was originally approved for this budget record.',
  })
  readonly initialAmount: SecuredFloatNullable;

  @SensitivityField({
    description: "Based on the project's sensitivity",
  })
  readonly sensitivity: Sensitivity;

  readonly status: BudgetStatus;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    BudgetRecord: typeof BudgetRecord;
  }
  interface ResourceDBMap {
    BudgetRecord: typeof e.Budget.Record;
  }
}
