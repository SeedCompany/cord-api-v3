import { registerEnumType } from '@nestjs/graphql';

export enum LocationType {
  Country = 'Country',
  City = 'City',
  County = 'County',
  State = 'State',
  CrossBorderArea = 'CrossBorderArea',
}

registerEnumType(LocationType, {
  name: 'LocationType',
  valuesMap: {
    CrossBorderArea: {
      description: `@label Cross-Border Area`,
    },
  },
});
