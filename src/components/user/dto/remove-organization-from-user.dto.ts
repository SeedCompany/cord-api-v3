import { InputType, ObjectType } from '@nestjs/graphql';
import { type ID, IdField, MutationPlaceholderOutput } from '~/common';

@InputType()
export class RemoveOrganizationFromUser {
  @IdField()
  readonly org: ID<'Organization'>;

  @IdField()
  readonly user: ID<'User'>;
}

@ObjectType()
export abstract class RemoveOrganizationFromUserOutput extends MutationPlaceholderOutput {}
