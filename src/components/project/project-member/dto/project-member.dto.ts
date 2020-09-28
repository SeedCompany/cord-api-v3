import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { DateTimeField, Resource, SecuredKeys } from '../../../../common';
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
}

declare module '../../../authorization/policies/mapping' {
  interface TypeToDto {
    ProjectMember: ProjectMember;
  }
  interface TypeToSecuredProps {
    ProjectMember: SecuredKeys<ProjectMember> | 'modifiedAt';
  }
}
