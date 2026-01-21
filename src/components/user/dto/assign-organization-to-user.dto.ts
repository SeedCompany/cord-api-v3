import { ArgsType, Field } from '@nestjs/graphql';
import { type ID, IdField } from '~/common';

@ArgsType()
export class AssignOrganizationToUser {
  @IdField()
  readonly org: ID<'Organization'>;

  @IdField()
  readonly user: ID<'User'>;

  @Field(() => Boolean, { nullable: true })
  readonly primary?: boolean;
}
