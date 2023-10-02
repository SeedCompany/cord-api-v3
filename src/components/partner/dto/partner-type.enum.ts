import { ObjectType } from '@nestjs/graphql';
import { EnumType, makeEnum, SecuredEnumList } from '~/common';

export type PartnerType = EnumType<typeof PartnerType>;
export const PartnerType = makeEnum({
  name: 'PartnerType',
  values: ['Managing', 'Funding', 'Impact', 'Technical', 'Resource'],
});

@ObjectType({
  description: SecuredEnumList.descriptionFor('partner types'),
})
export abstract class SecuredPartnerTypes extends SecuredEnumList(
  PartnerType,
) {}
