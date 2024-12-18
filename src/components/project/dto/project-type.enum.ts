import { ObjectType } from '@nestjs/graphql';
import { EnumType, makeEnum, SecuredEnum, SecuredEnumList } from '~/common';

export type ProjectType = EnumType<typeof ProjectType>;
export const ProjectType = makeEnum({
  name: 'ProjectType',
  values: [
    { value: 'MomentumTranslation', label: 'Momentum' },
    { value: 'MultiplicationTranslation', label: 'Multiplication' },
    'Internship',
  ],
  exposeOrder: true,
});

@ObjectType({
  description: SecuredEnum.descriptionFor('project types'),
})
export abstract class SecuredProjectTypes extends SecuredEnumList(
  ProjectType,
) {}
