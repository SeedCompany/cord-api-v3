import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-scalars';
import { type ID, IdField } from '~/common';
import { BudgetLineItem } from './budget-line-item.dto';

@InputType()
export abstract class CreateBudgetLineItem {
  @IdField()
  readonly budget: ID<'Budget'>;

  @Field()
  readonly account: string;

  @Field(() => String, { nullable: true })
  readonly description?: string;

  @Field(() => String, {
    nullable: true,
    description: "Defaults to 'Cash' if omitted.",
  })
  readonly costType?: string;

  @Field(() => String, {
    nullable: true,
    description: "Defaults to 'Field Budget' if omitted.",
  })
  readonly budgetCategory?: string;

  @Field(() => String, { nullable: true })
  readonly activity?: string;

  @IdField({ nullable: true })
  readonly serviceProvider?: ID<'Organization'>;

  @IdField({ nullable: true })
  readonly funder?: ID<'Organization'>;

  @Field(() => GraphQLJSONObject, { nullable: true })
  readonly fiscalYearAmounts?: Record<string, number>;
}

@ObjectType()
export abstract class BudgetLineItemCreated {
  @Field()
  readonly budgetLineItem: BudgetLineItem;
}
