import { ObjectType, registerEnumType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { SecuredEnum } from '../../../common';

export enum InternshipPosition {
  ConsultantInTraining = 'ConsultantInTraining',
  MidLevelQualityAssurance = 'MidLevelQualityAssurance',

  LeadershipDevelopment = 'LeadershipDevelopment',
  Mobilization = 'Mobilization',
  Personnel = 'Personnel',

  Communication = 'Communication',
  Administration = 'Administration',
  Technology = 'Technology',
  Finance = 'Finance',

  LanguageProgramManager = 'LanguageProgramManager',
  Literacy = 'Literacy',
  OralityFacilitator = 'OralityFacilitator',
  ScriptureEngagement = 'ScriptureEngagement',

  // historic
  OtherAttached = 'OtherAttached',
  OtherTranslationCapacity = 'OtherTranslationCapacity',
  OtherPartnershipCapacity = 'OtherPartnershipCapacity',
  ExegeticalFacilitator = 'ExegeticalFacilitator',
  TranslationFacilitator = 'TranslationFacilitator',
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

const Position = InternshipPosition;
const Domain = InternshipDomain;
const Program = InternshipProgram;

export const InternshipPositionToDomain: Record<
  InternshipPosition,
  InternshipDomain | null
> = {
  [Position.ConsultantInTraining]: null,
  [Position.MidLevelQualityAssurance]: null,

  [Position.LeadershipDevelopment]: Domain.Leadership,
  [Position.Mobilization]: Domain.Leadership,
  [Position.Personnel]: Domain.Leadership,

  [Position.Communication]: Domain.Operations,
  [Position.Administration]: Domain.Operations,
  [Position.Technology]: Domain.Operations,
  [Position.Finance]: Domain.Operations,

  [Position.LanguageProgramManager]: Domain.FieldPrograms,
  [Position.Literacy]: Domain.FieldPrograms,
  [Position.OralityFacilitator]: Domain.FieldPrograms,
  [Position.ScriptureEngagement]: Domain.FieldPrograms,

  // historic -- best guesses for domains
  [Position.OtherAttached]: Domain.FieldPrograms,
  [Position.OtherTranslationCapacity]: Domain.FieldPrograms,
  [Position.OtherPartnershipCapacity]: Domain.Leadership,
  [Position.ExegeticalFacilitator]: null,
  [Position.TranslationFacilitator]: Domain.FieldPrograms,
};

export const InternshipPositionToProgram: Record<
  InternshipPosition,
  InternshipProgram
> = {
  [Position.ConsultantInTraining]: Program.QualityAssurance,
  [Position.MidLevelQualityAssurance]: Program.QualityAssurance,

  [Position.LeadershipDevelopment]: Program.CapacityBuilding,
  [Position.Mobilization]: Program.CapacityBuilding,
  [Position.Personnel]: Program.CapacityBuilding,

  [Position.Communication]: Program.CapacityBuilding,
  [Position.Administration]: Program.CapacityBuilding,
  [Position.Technology]: Program.CapacityBuilding,
  [Position.Finance]: Program.CapacityBuilding,

  [Position.LanguageProgramManager]: Program.CapacityBuilding,
  [Position.Literacy]: Program.CapacityBuilding,
  [Position.OralityFacilitator]: Program.CapacityBuilding,
  [Position.ScriptureEngagement]: Program.CapacityBuilding,

  // historic
  [Position.OtherAttached]: Program.QualityAssurance,
  [Position.OtherTranslationCapacity]: Program.QualityAssurance,
  [Position.OtherPartnershipCapacity]: Program.CapacityBuilding,
  [Position.ExegeticalFacilitator]: Program.QualityAssurance,
  [Position.TranslationFacilitator]: Program.CapacityBuilding,
};

export const historic = [
  Position.OtherAttached,
  Position.OtherTranslationCapacity,
  Position.OtherPartnershipCapacity,
  Position.ExegeticalFacilitator,
  Position.TranslationFacilitator,
];

registerEnumType(InternshipPosition, {
  name: 'InternshipPosition',
  valuesMap: {
    ExegeticalFacilitator: {
      deprecationReason: 'Legacy. Only used in historic data.',
    },
    TranslationFacilitator: {
      deprecationReason: 'Legacy. Only used in historic data.',
    },
  },
});

@ObjectType({
  description: SecuredEnum.descriptionFor('an intern position'),
})
export class SecuredInternPosition extends SecuredEnum(InternshipPosition, {
  nullable: true,
}) {}

registerEnumType(InternshipProgram, {
  name: 'InternshipProgram',
  description: stripIndent`
    An InternshipProgram represents/groups several InternshipPositions.
  `,
});

registerEnumType(InternshipDomain, {
  name: 'InternshipDomain',
  description: stripIndent`
    An InternshipDomain represents/groups several InternshipPositions.
  `,
});
