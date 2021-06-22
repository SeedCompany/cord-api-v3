import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { SecuredProps, SecuredString } from '../../../common';
import { ScopedRole } from '../../authorization';
import { Changeset } from '../../changeset/dto';
import { SecuredProjectChangeRequestStatus } from './project-change-request-status.enum';
import { SecuredProjectChangeRequestTypes } from './project-change-request-type.enum';

@ObjectType({
  implements: [Changeset],
})
export abstract class ProjectChangeRequest extends Changeset {
  static readonly Props = keysOf<ProjectChangeRequest>();
  static readonly SecuredProps = keysOf<SecuredProps<ProjectChangeRequest>>();
  __typename: 'ProjectChangeRequest';

  @Field()
  readonly types: SecuredProjectChangeRequestTypes;

  @Field()
  readonly summary: SecuredString;

  @Field()
  readonly status: SecuredProjectChangeRequestStatus;

  @Field({
    description:
      'Whether or not modifications can be made (via other mutations `changeset` input) with this change request',
  })
  readonly canEdit: boolean;

  // A list of non-global roles the requesting user has available for this object.
  // This is just a cache, to prevent extra db lookups within the same request.
  readonly scope?: ScopedRole[];
}
