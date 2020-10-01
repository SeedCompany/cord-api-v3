import { registerEnumType } from '@nestjs/graphql';

export enum LocationType {
  City = 'City',
  County = 'Country',
  State = 'State',
  Country = 'Country',
  CrossBorderArea = 'CrossBorderArea',
}

registerEnumType(LocationType, { name: 'LocationType' });
