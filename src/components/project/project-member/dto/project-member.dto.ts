import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import { e } from '~/core/edgedb';
import { RegisterResource } from '~/core/resources';
import {
  DateTimeField,
  Resource,
  SecuredProps,
  Sensitivity,
  SensitivityField,
  SetUnsecuredType,
  UnsecuredDto,
} from '../../../../common';
import { SecuredRoles } from '../../../authorization';
import { SecuredUser, User } from '../../../user/dto';

@RegisterResource({ db: e.Project.Member })
@ObjectType({
  implements: [Resource],
})
export class ProjectMember extends Resource {
  static readonly Props = keysOf<ProjectMember>();
  static readonly SecuredProps = keysOf<SecuredProps<ProjectMember>>();
  static readonly Parent = import('../../dto').then((m) => m.IProject);

  @Field(() => SecuredUser)
  readonly user: SecuredUser & SetUnsecuredType<UnsecuredDto<User>>;

  @Field()
  readonly roles: SecuredRoles;

  @SensitivityField({
    description: "Based on the project's sensitivity",
  })
  readonly sensitivity: Sensitivity;

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
