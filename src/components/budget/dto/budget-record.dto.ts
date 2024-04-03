import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { BaseNode } from '~/core/database/results';
import { e } from '~/core/edgedb';
import { RegisterResource } from '~/core/resources';
import {
  Calculated,
  ID,
  IntersectionType,
  Resource,
  Secured,
  SecuredFloatNullable,
  SecuredInt,
  SecuredProps,
  Sensitivity,
  SensitivityField,
} from '../../../common';
import { ChangesetAware } from '../../changeset/dto';
import { BudgetStatus } from './budget-status.enum';
import { Budget } from './budget.dto';

@Calculated()
@RegisterResource({ db: e.Budget.Record })
@ObjectType({
  implements: [Resource, ChangesetAware],
})
export class BudgetRecord extends IntersectionType(ChangesetAware, Resource) {
  static readonly Props = keysOf<BudgetRecord>();
  static readonly SecuredProps = keysOf<SecuredProps<BudgetRecord>>();
  static readonly Parent = import('./budget.dto').then((m) => m.Budget);

  @Field(() => Budget)
  declare readonly parent: BaseNode;

  @Calculated()
  readonly organization: Secured<ID>;

  @Calculated()
  @Field()
  readonly fiscalYear: SecuredInt;

  @Field()
  readonly amount: SecuredFloatNullable;

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
