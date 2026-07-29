import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-scalars';
import { type ID, IdField } from '~/common';
import { BudgetLineItem } from './budget-line-item.dto';

@InputType()
export abstract class CreateBudgetLineItem {
  @IdField()
  readonly budget: ID<'Budget'>;

  @Field(() => String, {
    nullable: true,
    description:
      "Defaults to 'line' if omitted. Use 'header' for a visual, description-only section-divider row.",
  })
  readonly type?: string;

  @Field(() => String, {
    nullable: true,
    description:
      'The chart-of-accounts line this cost is booked to. Omit for `header` rows.',
  })
  readonly account?: string;

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

  @Field(() => String, { nullable: true })
  readonly partnerAccountName?: string;

  @Field(() => String, { nullable: true })
  readonly partnerAccountNumber?: string;

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
