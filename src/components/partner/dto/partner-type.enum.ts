import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnumList } from '../../../common';

export enum PartnerType {
  Managing = 'Managing',
  Funding = 'Funding',
  Impact = 'Impact',
  Technical = 'Technical',
  Resource = 'Resource',
}

registerEnumType(PartnerType, { name: 'PartnerType' });

@ObjectType({
  description: SecuredEnumList.descriptionFor('partner types'),
})
export abstract class SecuredPartnerTypes extends SecuredEnumList(
  PartnerType,
) {}
