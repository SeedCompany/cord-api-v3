import { Type } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredInt, SecuredString } from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class BudgetRecord extends Resource {
  static classType = (BudgetRecord as any) as Type<BudgetRecord>;

  readonly organizationId: SecuredString;

  @Field()
  readonly fiscalYear: SecuredInt;

  @Field()
  readonly amount: SecuredInt;
}
