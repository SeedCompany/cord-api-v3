import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { type ID, IdField } from '~/common';
import { Partner } from '../../../components/partner/dto';

@InputType()
export class AssignOrganizationToUser {
  @IdField()
  readonly orgId: ID;

  @IdField()
  readonly userId: ID;

  @Field(() => Boolean, { nullable: true })
  readonly primary?: boolean;
}

@InputType()
export abstract class AssignOrganizationToUserInput {
  @Field()
  @Type(() => AssignOrganizationToUser)
  @ValidateNested()
  readonly assignment: AssignOrganizationToUser;
}

@ObjectType()
export abstract class AssignOrganizationToUserOutput {
  @Field()
  readonly partner: Partner;
}
