import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { type ID, IdField, MutationPlaceholderOutput } from '~/common';

@InputType()
export class RemoveOrganizationFromUser {
  @IdField()
  readonly org: ID<'Organization'>;

  @IdField()
  readonly user: ID<'User'>;
}

@InputType()
export abstract class RemoveOrganizationFromUserInput {
  @Field()
  @Type(() => RemoveOrganizationFromUser)
  @ValidateNested()
  readonly request: RemoveOrganizationFromUser;
}

@ObjectType()
export abstract class RemoveOrganizationFromUserOutput extends MutationPlaceholderOutput {}
