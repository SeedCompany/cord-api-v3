import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CalendarDate, ID, IdField } from '~/common';
import { AllianceMembership } from './alliance-membership.dto';

@InputType()
export abstract class CreateAllianceMembership {
  @IdField()
  readonly memberId: ID<'Organization'>;

  @IdField()
  readonly allianceId: ID<'Organization'>;

  @Field(() => CalendarDate, { nullable: true })
  @Type(() => CalendarDate)
  @ValidateNested()
  readonly joinedAt?: CalendarDate;
}

@InputType()
export abstract class CreateAllianceMembershipInput {
  @Field()
  @Type(() => CreateAllianceMembership)
  @ValidateNested()
  readonly allianceMembership: CreateAllianceMembership;
}

@ObjectType()
export abstract class CreateAllianceMembershipOutput {
  @Field()
  readonly allianceMembership: AllianceMembership;
}
