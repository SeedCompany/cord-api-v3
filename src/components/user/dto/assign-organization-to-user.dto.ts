import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField, MutationPlaceholderOutput } from '../../../common';

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
  readonly request: AssignOrganizationToUser;
}

@ObjectType()
export abstract class AssignOrganizationToUserOutput extends MutationPlaceholderOutput {}
