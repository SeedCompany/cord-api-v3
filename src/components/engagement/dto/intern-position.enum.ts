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

export enum InternshipDomain {
  Leadership = 'Leadership',
  Operations = 'Operations',
  FieldPrograms = 'FieldPrograms',
}

export enum InternshipProgram {
  QualityAssurance = 'QualityAssurance',
  CapacityBuilding = 'CapacityBuilding',
}

const Position = InternPosition;
const Domain = InternshipDomain;
const Program = InternshipProgram;

export const InternshipPositionToDomain: Record<
  InternPosition,
  InternshipDomain | null
> = {
  [Position.TranslationConsultantInTraining]: null,
  [Position.ExegeticalFacilitator]: null,

  [Position.LeadershipDevelopment]: Domain.Leadership,
  [Position.MobilizerOrPartnershipSupportSpecialist]: Domain.Leadership,
  [Position.PersonnelOrHrSpecialist]: Domain.Leadership,

  [Position.CommunicationSpecialistInternal]: Domain.Operations,
  [Position.CommunicationSpecialistMarketing]: Domain.Operations,
  [Position.AdministrativeSupportSpecialist]: Domain.Operations,
  [Position.TechnicalSupportSpecialist]: Domain.Operations,
  [Position.BusinessSupportSpecialist]: Domain.Operations,

  [Position.LanguageProgramManager]: Domain.FieldPrograms,
  [Position.LanguageSoftwareSupportSpecialist]: Domain.FieldPrograms,
  [Position.LiteracySpecialist]: Domain.FieldPrograms,
  [Position.LukePartnershipFacilitatorOrSpecialist]: Domain.FieldPrograms,
  [Position.OralFacilitatorOrSpecialist]: Domain.FieldPrograms,
  [Position.ScriptureUseSpecialist]: Domain.FieldPrograms,
  [Position.TranslationFacilitator]: Domain.FieldPrograms,
  [Position.Translator]: Domain.FieldPrograms,
  [Position.LanguageProgramManagerOrFieldOperations]: Domain.FieldPrograms,
};

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

registerEnumType(InternshipDomain, {
  name: 'InternshipDomain',
  description: stripIndent`
    An InternshipDomain represents/groups several InternshipEngagementPositions.
  `,
});
