import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
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

export enum InternshipProgram {
  QualityAssurance = 'QualityAssurance',
  CapacityBuilding = 'CapacityBuilding',
}

const Position = InternPosition;
const Program = InternshipProgram;

export const InternshipPositionToProgram: Record<
  InternPosition,
  InternshipProgram
> = {
  [Position.TranslationConsultantInTraining]: Program.QualityAssurance,
  [Position.ExegeticalFacilitator]: Program.QualityAssurance,

  [Position.AdministrativeSupportSpecialist]: Program.CapacityBuilding,
  [Position.BusinessSupportSpecialist]: Program.CapacityBuilding,
  [Position.CommunicationSpecialistInternal]: Program.CapacityBuilding,
  [Position.CommunicationSpecialistMarketing]: Program.CapacityBuilding,
  [Position.LanguageProgramManager]: Program.CapacityBuilding,
  [Position.LanguageProgramManagerOrFieldOperations]: Program.CapacityBuilding,
  [Position.LanguageSoftwareSupportSpecialist]: Program.CapacityBuilding,
  [Position.LeadershipDevelopment]: Program.CapacityBuilding,
  [Position.LiteracySpecialist]: Program.CapacityBuilding,
  [Position.LukePartnershipFacilitatorOrSpecialist]: Program.CapacityBuilding,
  [Position.MobilizerOrPartnershipSupportSpecialist]: Program.CapacityBuilding,
  [Position.OralFacilitatorOrSpecialist]: Program.CapacityBuilding,
  [Position.PersonnelOrHrSpecialist]: Program.CapacityBuilding,
  [Position.ScriptureUseSpecialist]: Program.CapacityBuilding,
  [Position.TechnicalSupportSpecialist]: Program.CapacityBuilding,
  [Position.TranslationFacilitator]: Program.CapacityBuilding,
  [Position.Translator]: Program.CapacityBuilding,
};

registerEnumType(InternPosition, {
  name: 'InternshipEngagementPosition',
});

@ObjectType({
  description: SecuredEnum.descriptionFor('an intern position'),
})
export class SecuredInternPosition extends SecuredEnum(InternPosition, {
  nullable: true,
}) {}

registerEnumType(InternshipProgram, {
  name: 'InternshipProgram',
  description: stripIndent`
    An InternshipProgram represents/groups several InternshipEngagementPositions.
  `,
});

@ObjectType({
  description: SecuredEnum.descriptionFor('an internship program'),
})
export class SecuredInternshipProgram extends SecuredEnum(InternshipProgram, {
  nullable: true,
}) {}
