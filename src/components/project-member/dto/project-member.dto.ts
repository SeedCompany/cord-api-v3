import { DateTime } from 'luxon';
import { Field, ObjectType } from 'type-graphql';
import { DateTimeField, Resource, SecuredPropertyList } from '../../../common';
import { SecuredUser } from '../../user';
import { Role } from '../../user/role';

@ObjectType({
  description: SecuredPropertyList.descriptionFor('roles'),
})
export abstract class SecuredRoles extends SecuredPropertyList(Role) {}

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
}
