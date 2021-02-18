import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { DateTimeField, Resource, SecuredBoolean } from '../../../../common';
import { SecuredRoles } from '../../../authorization';
import { SecuredUser } from '../../../user';

@ObjectType({
  implements: [Resource],
})
export class ProjectMember extends Resource {
  @Field()
  readonly user: SecuredUser;

  @Field()
  readonly roles: SecuredRoles;

  @DateTimeField()
  readonly modifiedAt: DateTime;

  readonly canDelete: SecuredBoolean;
}
