import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-scalars';
import { type ID, IdField } from '~/common';
import { OtherPartnerContribution } from './other-partner-contribution.dto';

@InputType()
export abstract class CreateOtherPartnerContribution {
  @IdField()
  readonly budget: ID<'Budget'>;

  @IdField({ nullable: true })
  readonly donor?: ID<'Organization'>;

  @Field({ nullable: true })
  readonly description?: string;

  @Field(() => GraphQLJSONObject, { nullable: true })
  readonly fiscalYearAmounts?: Record<string, number>;
}

@ObjectType()
export abstract class OtherPartnerContributionCreated {
  @Field()
  readonly otherPartnerContribution: OtherPartnerContribution;
}
