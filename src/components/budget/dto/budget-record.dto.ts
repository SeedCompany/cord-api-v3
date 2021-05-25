import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  ID,
  Resource,
  Secured,
  SecuredFloatNullable,
  SecuredInt,
  SecuredProps,
  Sensitivity,
} from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class BudgetRecord extends Resource {
  static readonly Props = keysOf<BudgetRecord>();
  static readonly SecuredProps = keysOf<SecuredProps<BudgetRecord>>();

  readonly organization: Secured<ID>;

  @Field()
  readonly fiscalYear: SecuredInt;

  @Field()
  readonly amount: SecuredFloatNullable;

  @Field(() => Sensitivity, {
    description: "Based on the project's sensitivity",
  })
  readonly sensitivity: Sensitivity;
}
