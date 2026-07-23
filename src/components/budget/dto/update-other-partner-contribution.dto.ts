import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-scalars';
import { type ID, IdField, NameField } from '~/common';
import { OtherPartnerContribution } from './other-partner-contribution.dto';

@InputType()
export abstract class UpdateOtherPartnerContribution {
  @IdField()
  readonly id: ID;

  @IdField({ nullable: true })
  readonly donor?: ID<'Organization'> | null;

  @NameField({ nullable: true })
  readonly description?: string | null;

  @Field(() => GraphQLJSONObject, { nullable: true })
  readonly fiscalYearAmounts?: Record<string, number>;
}

@ObjectType()
export abstract class OtherPartnerContributionUpdated {
  @Field()
  readonly otherPartnerContribution: OtherPartnerContribution;
}
