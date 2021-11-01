import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnum } from '../../../common';

export enum ProgressMeasurement {
  Percent = 'Percent',
  Number = 'Number',
  Done = 'Done',
}

registerEnumType(ProgressMeasurement, {
  name: 'ProgressMeasurement',
  description: 'Measurement units for reporting progress',
});

@ObjectType({
  description: SecuredEnum.descriptionFor('progress measurement'),
})
export class SecuredProgressMeasurement extends SecuredEnum(
  ProgressMeasurement
) {}
