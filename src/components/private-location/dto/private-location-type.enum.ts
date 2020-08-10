import { registerEnumType } from '@nestjs/graphql';

export enum PrivateLocationType {
  City = 'City',
  County = 'County',
  State = 'State',
  Country = 'Country',
  CrossBorderArea = 'CrossBorderArea',
}

registerEnumType(PrivateLocationType, { name: 'PrivateLocationType' });
