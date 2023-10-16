import { EnumType, makeEnum } from '~/common';

export type ProjectType = EnumType<typeof ProjectType>;
export const ProjectType = makeEnum({
  name: 'ProjectType',
  values: ['Translation', 'Internship'],
});
