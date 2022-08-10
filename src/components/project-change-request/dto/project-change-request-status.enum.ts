import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnum } from '../../../common';

export enum ProjectChangeRequestStatus {
  Draft = 'Draft',
  PendingReview = 'PendingReview',
  Approved = 'Approved',
  Closed = 'Closed',
}

registerEnumType(ProjectChangeRequestStatus, {
  name: 'ProjectChangeRequestStatus',
});

@ObjectType({
  description: SecuredEnum.descriptionFor('a project change request status'),
})
export abstract class SecuredProjectChangeRequestStatus extends SecuredEnum(
  ProjectChangeRequestStatus
) {}
