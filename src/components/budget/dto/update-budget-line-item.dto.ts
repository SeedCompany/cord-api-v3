import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-scalars';
import { type ID, IdField, NameField, OptionalField } from '~/common';
import { BudgetLineItem } from './budget-line-item.dto';

@InputType()
export abstract class UpdateBudgetLineItem {
  @IdField()
  readonly id: ID;

  @OptionalField(() => String)
  readonly type?: string;

  @NameField({ nullable: true })
  readonly account?: string | null;

  @NameField({ nullable: true })
  readonly description?: string | null;

  @OptionalField(() => String)
  readonly costType?: string;

  @OptionalField(() => String)
  readonly budgetCategory?: string;

  @OptionalField(() => String, { nullable: true })
  readonly activity?: string | null;

  @NameField({ nullable: true })
  readonly partnerAccountName?: string | null;

  @NameField({ nullable: true })
  readonly partnerAccountNumber?: string | null;

  @IdField({ nullable: true })
  readonly serviceProvider?: ID<'Organization'> | null;

  @IdField({ nullable: true })
  readonly funder?: ID<'Organization'> | null;

  @Field(() => GraphQLJSONObject, { nullable: true })
  readonly fiscalYearAmounts?: Record<string, number>;
}

@ObjectType()
export abstract class BudgetLineItemUpdated {
  @Field()
  readonly budgetLineItem: BudgetLineItem;
}
