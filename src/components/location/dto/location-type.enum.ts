import { registerEnumType } from '@nestjs/graphql';

export enum LocationType {
  Managing = 'Managing',
}

registerEnumType(LocationType, { name: 'LocationType' });
