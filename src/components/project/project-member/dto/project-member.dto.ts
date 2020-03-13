import { Type } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { DateTimeField, Resource } from '../../../../common';
import { SecuredUser } from '../../../user';
import { SecuredRoles } from './role.dto';

@ObjectType({
  implements: [Resource],
})
export class ProjectMember extends Resource {
  /* TS wants a public constructor for "ClassType" */
  static classType = (ProjectMember as any) as Type<ProjectMember>;

  @Field()
  readonly user: SecuredUser;

  @Field()
  readonly roles: SecuredRoles;

  @DateTimeField()
  readonly modifiedAt: DateTime;
}
