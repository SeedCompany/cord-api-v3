import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnum, SecuredEnumList } from '../../../common';

export enum CommunicationRegion {
  // Seed Company Communication Regions
  SeedCompanyAfrica = 'SeedCompanyAfrica',
  SeedCompanyAmericas = 'SeedCompanyAmericas',
  SeedCompanyEuropeAndMiddleEast = 'SeedCompanyEuropeAndMiddleEast',
  SeedCompanyPacific = 'SeedCompanyPacific',

  // Illuminations Communication Regions
  IlluminationsAmericasAndPacific = 'IlluminationsAmericasAndPacific',
  IlluminationsAfrica = 'IlluminationsAfrica',
  IlluminationsAsiaAndMiddleEast = 'IlluminationsAsiaAndMiddleEast',
}

registerEnumType(CommunicationRegion, {
  name: 'CommunicationRegion',
  description: 'Communication Regions',
});

@ObjectType({
  description: SecuredEnum.descriptionFor('a communication region'),
})
export class SecuredCommunicationRegion extends SecuredEnum(
  CommunicationRegion
) {}

@ObjectType({
  description: SecuredEnumList.descriptionFor('communication regions'),
})
export class SecuredCommunicationRegions extends SecuredEnumList(
  CommunicationRegion
) {}
