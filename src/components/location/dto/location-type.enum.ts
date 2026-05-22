import { type EnumType, makeEnum } from '~/common';

export type LocationType = EnumType<typeof LocationType>;
export const LocationType = makeEnum({
  name: 'LocationType',
  values: [
    'Country',
    'City',
    'County',
    { value: 'Region', label: 'Marketing Region' },
    'State',
    { value: 'CrossBorderArea', label: 'Cross-Border Area' },
  ],
});
