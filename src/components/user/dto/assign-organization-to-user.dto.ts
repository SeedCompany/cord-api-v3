import { Field, InputType, ObjectType } from '@nestjs/graphql';
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

@ObjectType()
export abstract class OrganizationAssignedToUser extends MutationPlaceholderOutput {}
