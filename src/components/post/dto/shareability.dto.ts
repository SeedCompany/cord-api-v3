import { EnumType, makeEnum } from '~/common';

export type PostShareability = EnumType<typeof PostShareability>;
export const PostShareability = makeEnum({
  name: 'PostShareability',
  values: [
    { value: 'Membership', label: 'Team Members' },
    {
      value: 'ProjectTeam',
      label: 'Team Members',
      deprecationReason: 'Use `Membership` instead',
    },
    'Internal',
    'AskToShareExternally',
    'External',
  ],
});
