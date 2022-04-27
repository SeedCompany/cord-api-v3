import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnum } from '../../../common';

export enum ProgressMeasurement {
  Percent = 'Percent',
  Number = 'Number',
  Boolean = 'Boolean',
}

registerEnumType(ProgressMeasurement, {
  name: 'ProgressMeasurement',
  description: 'Measurement units for reporting progress',
  valuesMap: {
    Boolean: {
      description: `@label Done / Not Done`,
    },
  },
});

@ObjectType({
  description: SecuredEnum.descriptionFor('progress measurement'),
})
export class SecuredProgressMeasurement extends SecuredEnum(
  ProgressMeasurement
) {}
