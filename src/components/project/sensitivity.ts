import { registerEnumType } from 'type-graphql';

export enum Sensitivity {
  Low = 1,
  Medium = 2,
  High = 3,
}

registerEnumType(Sensitivity, { name: 'Sensitivity' });
