import { ObjectType } from '@nestjs/graphql';
import { EnumType, makeEnum, SecuredEnumList } from '~/common';

export type ProjectChangeRequestType = EnumType<
  typeof ProjectChangeRequestType
>;
export const ProjectChangeRequestType = makeEnum({
  name: 'ProjectChangeRequestType',
  values: ['Time', 'Budget', 'Goal', 'Engagement', 'Other'],
});
@ObjectType({
  description: SecuredEnumList.descriptionFor('project change request types'),
})
export abstract class SecuredProjectChangeRequestTypes extends SecuredEnumList(
  ProjectChangeRequestType,
) {}
