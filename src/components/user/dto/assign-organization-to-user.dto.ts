import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { type ID, IdField, MutationPlaceholderOutput } from '~/common';

@InputType()
export class AssignOrganizationToUser {
  @IdField()
  readonly org: ID<'Organization'>;

  @IdField()
  readonly user: ID<'User'>;

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
