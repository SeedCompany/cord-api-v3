import { registerEnumType } from 'type-graphql';

export enum Sensitivity {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
}

registerEnumType(Sensitivity, {
  name: 'Sensitivity',
});
