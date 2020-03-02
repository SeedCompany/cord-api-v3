import { registerEnumType } from 'type-graphql';

export enum Sensitivity {
  Low = 1,
  Medium,
  High,
}

registerEnumType(Sensitivity, {
  name: 'Sensitivity',
});
