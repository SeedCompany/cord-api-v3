import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { SecuredEnum } from '../../../common';

export enum InternPosition {
  ConsultantInTraining = 'ConsultantInTraining',
  ExegeticalFacilitator = 'ExegeticalFacilitator',

  LeadershipDevelopment = 'LeadershipDevelopment',
  Mobilization = 'Mobilization',
  Personnel = 'Personnel',

  Communication = 'Communication',
  Administration = 'Administration',
  Technology = 'Technology',
  Finance = 'Finance',

  LanguageProgramManager = 'LanguageProgramManager',
  Literacy = 'Literacy',
  TranslationFacilitator = 'TranslationFacilitator',
  OralityFacilitator = 'OralityFacilitator',
  ScriptureEngagement = 'ScriptureEngagement',
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
  [Position.ConsultantInTraining]: null,
  [Position.ExegeticalFacilitator]: null,

  [Position.LeadershipDevelopment]: Domain.Leadership,
  [Position.Mobilization]: Domain.Leadership,
  [Position.Personnel]: Domain.Leadership,

  [Position.Communication]: Domain.Operations,
  [Position.Administration]: Domain.Operations,
  [Position.Technology]: Domain.Operations,
  [Position.Finance]: Domain.Operations,

  [Position.LanguageProgramManager]: Domain.FieldPrograms,
  [Position.Literacy]: Domain.FieldPrograms,
  [Position.TranslationFacilitator]: Domain.FieldPrograms,
  [Position.OralityFacilitator]: Domain.FieldPrograms,
  [Position.ScriptureEngagement]: Domain.FieldPrograms,
};

export const InternshipPositionToProgram: Record<
  InternPosition,
  InternshipProgram
> = {
  [Position.ConsultantInTraining]: Program.QualityAssurance,
  [Position.ExegeticalFacilitator]: Program.QualityAssurance,

  [Position.LeadershipDevelopment]: Program.CapacityBuilding,
  [Position.Mobilization]: Program.CapacityBuilding,
  [Position.Personnel]: Program.CapacityBuilding,

  [Position.Communication]: Program.CapacityBuilding,
  [Position.Administration]: Program.CapacityBuilding,
  [Position.Technology]: Program.CapacityBuilding,
  [Position.Finance]: Program.CapacityBuilding,

  [Position.LanguageProgramManager]: Program.CapacityBuilding,
  [Position.Literacy]: Program.CapacityBuilding,
  [Position.TranslationFacilitator]: Program.CapacityBuilding,
  [Position.OralityFacilitator]: Program.CapacityBuilding,
  [Position.ScriptureEngagement]: Program.CapacityBuilding,
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
