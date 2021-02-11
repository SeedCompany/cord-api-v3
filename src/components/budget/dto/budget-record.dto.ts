import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  Resource,
  SecuredFloatNullable,
  SecuredInt,
  SecuredString,
} from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class BudgetRecord extends Resource {
  static readonly Props = keysOf<BudgetRecord>();

  readonly organization: SecuredString;

  @Field()
  readonly fiscalYear: SecuredInt;

  @Field()
  readonly amount: SecuredFloatNullable;
}
