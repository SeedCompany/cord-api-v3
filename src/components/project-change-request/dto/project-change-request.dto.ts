import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { ID, SecuredProps, SecuredString } from '../../../common';
import { Changeset } from '../../changeset/dto';
import { SecuredProjectChangeRequestStatus } from './project-change-request-status.enum';
import { SecuredProjectChangeRequestTypes } from './project-change-request-type.enum';

@ObjectType({
  implements: [Changeset],
})
export abstract class ProjectChangeRequest extends Changeset {
  static readonly Props = keysOf<ProjectChangeRequest>();
  static readonly SecuredProps = keysOf<SecuredProps<ProjectChangeRequest>>();
  static readonly Parent = import('../../project/dto').then((m) => m.IProject);

  __typename: 'ProjectChangeRequest';

  readonly project: ID;

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
}
