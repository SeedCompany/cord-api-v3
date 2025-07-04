import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import {
  DateTimeField,
  Resource,
  SecuredDateTimeNullable,
  SecuredRoles,
  Sensitivity,
  SensitivityField,
  type SetUnsecuredType,
  type UnsecuredDto,
} from '~/common';
import { e } from '~/core/gel';
import { type LinkTo, RegisterResource } from '~/core/resources';
import { SecuredUser, type User } from '../../../user/dto';

@RegisterResource({ db: e.Project.Member })
@ObjectType({
  implements: [Resource],
})
export class ProjectMember extends Resource {
  static readonly Parent = () => import('../../dto').then((m) => m.IProject);

  readonly project: LinkTo<'Project'>;

  @Field(() => SecuredUser)
  readonly user: SecuredUser & SetUnsecuredType<UnsecuredDto<User>>;

  @Field()
  readonly roles: SecuredRoles;

  @SensitivityField({
    description: "Based on the project's sensitivity",
  })
  readonly sensitivity: Sensitivity;

  @Field()
  readonly inactiveAt: SecuredDateTimeNullable;

  @DateTimeField()
  readonly modifiedAt: DateTime;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    ProjectMember: typeof ProjectMember;
  }
  interface ResourceDBMap {
    ProjectMember: typeof e.Project.Member;
  }
}
