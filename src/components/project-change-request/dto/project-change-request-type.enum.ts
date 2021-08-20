import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnumList } from '../../../common';

export enum ProjectChangeRequestType {
  Time = 'Time',
  Budget = 'Budget',
  Goal = 'Goal',
  Engagement = 'Engagement',
  Other = 'Other',
}

registerEnumType(ProjectChangeRequestType, {
  name: 'ProjectChangeRequestType',
});

@ObjectType({
  description: SecuredEnumList.descriptionFor('project change request types'),
})
export abstract class SecuredProjectChangeRequestTypes extends SecuredEnumList(
  ProjectChangeRequestType
) {}
