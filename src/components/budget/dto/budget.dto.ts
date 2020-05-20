import { Type } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';
import { Resource } from '../../../common';
import { BudgetRecord } from './budget-record.dto';
import { BudgetStatus } from './budget-status.enum';

@ObjectType({
  implements: [Resource],
})
export class Budget extends Resource {
  static classType = (Budget as any) as Type<Budget>;

  @Field()
  readonly status: BudgetStatus;

  @Field(() => [BudgetRecord])
  readonly records: readonly BudgetRecord[];
}
