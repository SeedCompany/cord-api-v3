import { registerEnumType } from 'type-graphql';

export enum InternshipEngagementPosition {
  ExegeticalFacilitator = 'exegetical_facilitator',
  TranslationConsultantInTraining = 'translation_consultant_in_training',
  AdministrativeSupportSpecialist = 'administrative_support_specialist',
  BusinessSupportSpecialist = 'business_support_specialist',
  CommunicationSpecialistInternal = 'communication_specialist_internal',
  CommunicationSpecialistMarketing = 'communication_specialist_marketing',
  LanguageProgramManager = 'language_program_manager',
  LanguageProgramManagerOrFieldOperations = 'language_program_manager_field_operations',
  LanguageSoftwareSupportSpecialist = 'language_software_support_specialist',
  LeadershipDevelopment = 'leadership_development',
  LiteracySpecialist = 'literacy_specialist',
  LukePartnershipFacilitatorOrSpecialist = 'luke_partnership_facilitator_specialist',
  MobilizerOrPartnershipSupportSpecialist = 'mobilizer_partnership_support_specialist',
  OralFacilitatorOrSpecialist = 'oral_facilitator_specialist',
  PersonnelOrHrSpecialist = 'personnel_hr_specialist',
  ScriptureUseSpecialist = 'scripture_use_specialist',
  TechnicalSupportSpecialist = 'technical_support_specialist',
  TranslationFacilitator = 'translation_facilitator',
  Translator = 'translator',
}

registerEnumType(InternshipEngagementPosition, {
  name: 'InternshipEngagementPosition',
});
