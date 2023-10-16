import { ObjectType } from '@nestjs/graphql';
import { EnumType, makeEnum, SecuredEnum } from '~/common';

export type ProjectChangeRequestStatus = EnumType<
  typeof ProjectChangeRequestStatus
>;
export const ProjectChangeRequestStatus = makeEnum({
  name: 'ProjectChangeRequestStatus',
  values: ['Pending', 'Approved', 'Rejected'],
});

@ObjectType({
  description: SecuredEnum.descriptionFor('a project change request status'),
})
export abstract class SecuredProjectChangeRequestStatus extends SecuredEnum(
  ProjectChangeRequestStatus,
) {}
