import { EnumType, makeEnum } from '~/common';

export type MediaCategory = EnumType<typeof MediaCategory>;
export const MediaCategory = makeEnum({
  name: 'ProgressReportMediaCategory',
  values: [
    'Team',
    { value: 'WorkInProgress', label: 'Work in Progress' },
    {
      value: 'CommunityEngagement',
      label: 'Community Engagement with the word',
    },
    { value: 'LifeInCommunity', label: 'Life in Community' },
    'Events',
    { value: 'SceneryLandscape', label: 'Scenery & Landscape' },
    'Other',
  ],
});
