import { ArgsType } from '@nestjs/graphql';
import { type ID, IdField } from '~/common';

@ArgsType()
export class RemoveOrganizationFromUser {
  @IdField()
  readonly org: ID<'Organization'>;

  @IdField()
  readonly user: ID<'User'>;
}
