import { registerEnumType } from '@nestjs/graphql';

export enum Sensitivity {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
}

registerEnumType(Sensitivity, {
  name: 'Sensitivity',
});
