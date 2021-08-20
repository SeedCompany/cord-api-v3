import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DateTimeField,
  Resource,
  SecuredProps,
  Sensitivity,
  SensitivityField,
} from '../../../../common';
import { SecuredRoles } from '../../../authorization';
import { SecuredUser } from '../../../user';

@ObjectType({
  implements: [Resource],
})
export class ProjectMember extends Resource {
  static readonly Props = keysOf<ProjectMember>();
  static readonly SecuredProps = keysOf<SecuredProps<ProjectMember>>();

  @Field()
  readonly user: SecuredUser;

  @Field()
  readonly roles: SecuredRoles;

  @SensitivityField({
    description: "Based on the project's sensitivity",
  })
  readonly sensitivity: Sensitivity;

  @DateTimeField()
  readonly modifiedAt: DateTime;
}
