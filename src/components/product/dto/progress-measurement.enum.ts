import { ObjectType } from '@nestjs/graphql';
import { EnumType, makeEnum, SecuredEnum } from '~/common';

export type ProgressMeasurement = EnumType<typeof ProgressMeasurement>;
export const ProgressMeasurement = makeEnum({
  name: 'ProgressMeasurement',
  description: 'Measurement units for reporting progress',
  values: ['Number', 'Percent', { value: 'Boolean', label: 'Done / Not Done' }],
});

@ObjectType({
  description: SecuredEnum.descriptionFor('progress measurement'),
})
export class SecuredProgressMeasurement extends SecuredEnum(
  ProgressMeasurement,
) {}
