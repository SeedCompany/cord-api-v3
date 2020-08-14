import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { SecuredEnum } from '../../../common';

export enum InternPosition {
  ExegeticalFacilitator = 'ExegeticalFacilitator',
  TranslationConsultantInTraining = 'TranslationConsultantInTraining',
  AdministrativeSupportSpecialist = 'AdministrativeSupportSpecialist',
  BusinessSupportSpecialist = 'BusinessSupportSpecialist',
  CommunicationSpecialistInternal = 'CommunicationSpecialistInternal',
  CommunicationSpecialistMarketing = 'CommunicationSpecialistMarketing',
  LanguageProgramManager = 'LanguageProgramManager',
  LanguageProgramManagerOrFieldOperations = 'LanguageProgramManagerOrFieldOperations',
  LanguageSoftwareSupportSpecialist = 'LanguageSoftwareSupportSpecialist',
  LeadershipDevelopment = 'LeadershipDevelopment',
  LiteracySpecialist = 'LiteracySpecialist',
  LukePartnershipFacilitatorOrSpecialist = 'LukePartnershipFacilitatorOrSpecialist',
  MobilizerOrPartnershipSupportSpecialist = 'MobilizerOrPartnershipSupportSpecialist',
  OralFacilitatorOrSpecialist = 'OralFacilitatorOrSpecialist',
  PersonnelOrHrSpecialist = 'PersonnelOrHrSpecialist',
  ScriptureUseSpecialist = 'ScriptureUseSpecialist',
  TechnicalSupportSpecialist = 'TechnicalSupportSpecialist',
  TranslationFacilitator = 'TranslationFacilitator',
  Translator = 'Translator',
}

registerEnumType(InternPosition, {
  name: 'InternshipEngagementPosition',
});

@ObjectType({
  description: SecuredEnum.descriptionFor('an intern position'),
})
export class SecuredInternPosition extends SecuredEnum(InternPosition) {}
