import { EnumType, makeEnum } from '~/common';

export type LocationType = EnumType<typeof LocationType>;
export const LocationType = makeEnum({
  name: 'LocationType',
  values: [
    'Country',
    'City',
    'County',
    'Region',
    'State',
    { value: 'CrossBorderArea', label: 'Cross-Border Area' },
  ],
});
