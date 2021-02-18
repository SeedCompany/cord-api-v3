import { Field, ObjectType } from '@nestjs/graphql';
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
  readonly organization: SecuredString;

  @Field()
  readonly fiscalYear: SecuredInt;

  @Field()
  readonly amount: SecuredFloatNullable;
}
