import { registerEnumType } from '@nestjs/graphql';

export enum LocationType {
  City = 'City',
  County = 'County',
  State = 'State',
  Country = 'Country',
  CrossBorderArea = 'CrossBorderArea',
}

registerEnumType(LocationType, { name: 'LocationType' });
