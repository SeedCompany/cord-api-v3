import { EnumType, makeEnum } from '~/common';

export type ProjectType = EnumType<typeof ProjectType>;
export const ProjectType = makeEnum({
  name: 'ProjectType',
  values: [
    { value: 'MomentumTranslation', label: 'Momentum' },
    { value: 'MultiplicationTranslation', label: 'Multiplication' },
    'Internship',
  ],
});
