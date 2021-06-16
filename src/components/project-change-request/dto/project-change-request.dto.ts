import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { Resource, SecuredProps, SecuredString } from '../../../common';
import { Changeset } from '../../changeset/dto';
import { SecuredProjectChangeRequestStatus } from './project-change-request-status.enum';
import { SecuredProjectChangeRequestTypes } from './project-change-request-type.enum';

@ObjectType({
  implements: [Changeset, Resource],
})
export abstract class ProjectChangeRequest
  extends Resource
  implements Changeset
{
  static readonly Props = keysOf<ProjectChangeRequest>();
  static readonly SecuredProps = keysOf<SecuredProps<ProjectChangeRequest>>();
  __typename: 'ProjectChangeRequest';

  @Field()
  readonly types: SecuredProjectChangeRequestTypes;

  @Field()
  readonly summary: SecuredString;

  @Field()
  readonly status: SecuredProjectChangeRequestStatus;
}
