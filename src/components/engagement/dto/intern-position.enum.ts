import { ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { EnumType, makeEnum, SecuredEnum } from '~/common';

export type InternshipDomain = EnumType<typeof InternshipDomain>;
export const InternshipDomain = makeEnum({
  name: 'InternshipDomain',
  values: ['Leadership', 'Operations', 'FieldPrograms'],
  description: stripIndent`
    An InternshipDomain represents/groups several InternshipPositions.
  `,
});

export type InternshipProgram = EnumType<typeof InternshipProgram>;
export const InternshipProgram = makeEnum({
  name: 'InternshipProgram',
  values: ['QualityAssurance', 'CapacityBuilding'],
  description: stripIndent`
    An InternshipProgram represents/groups several InternshipPositions.
  `,
});

export type InternshipPosition = EnumType<typeof InternshipPosition>;
export const InternshipPosition = makeEnum({
  name: 'InternshipPosition',
  values: [
    {
      value: 'ConsultantInTraining',
      domain: null,
      program: InternshipProgram.QualityAssurance,
    },
    {
      value: 'MidLevelQualityAssurance',
      domain: null,
      program: InternshipProgram.QualityAssurance,
    },

    {
      value: 'LeadershipDevelopment',
      domain: InternshipDomain.Leadership,
      program: InternshipProgram.CapacityBuilding,
    },
    {
      value: 'Mobilization',
      domain: InternshipDomain.Leadership,
      program: InternshipProgram.CapacityBuilding,
    },
    {
      value: 'Personnel',
      domain: InternshipDomain.Leadership,
      program: InternshipProgram.CapacityBuilding,
    },

    {
      value: 'Communication',
      domain: InternshipDomain.Operations,
      program: InternshipProgram.CapacityBuilding,
    },
    {
      value: 'Administration',
      domain: InternshipDomain.Operations,
      program: InternshipProgram.CapacityBuilding,
    },
    {
      value: 'Technology',
      domain: InternshipDomain.Operations,
      program: InternshipProgram.CapacityBuilding,
    },
    {
      value: 'Finance',
      domain: InternshipDomain.Operations,
      program: InternshipProgram.CapacityBuilding,
    },

    {
      value: 'LanguageProgramManager',
      domain: InternshipDomain.FieldPrograms,
      program: InternshipProgram.CapacityBuilding,
    },
    {
      value: 'Literacy',
      domain: InternshipDomain.FieldPrograms,
      program: InternshipProgram.CapacityBuilding,
    },
    {
      value: 'OralityFacilitator',
      domain: InternshipDomain.FieldPrograms,
      program: InternshipProgram.CapacityBuilding,
    },
    {
      value: 'ScriptureEngagement',
      domain: InternshipDomain.FieldPrograms,
      program: InternshipProgram.CapacityBuilding,
    },
    // historic
    {
      value: 'OtherAttached',
      domain: InternshipDomain.FieldPrograms,
      program: InternshipProgram.QualityAssurance,
      historic: true,
    },
    {
      value: 'OtherTranslationCapacity',
      domain: InternshipDomain.FieldPrograms,
      program: InternshipProgram.QualityAssurance,
      historic: true,
    },
    {
      value: 'OtherPartnershipCapacity',
      domain: InternshipDomain.Leadership,
      program: InternshipProgram.CapacityBuilding,
      historic: true,
    },
    {
      value: 'ExegeticalFacilitator',
      domain: null,
      program: InternshipProgram.QualityAssurance,
      historic: true,
    },
    {
      value: 'TranslationFacilitator',
      domain: InternshipDomain.FieldPrograms,
      program: InternshipProgram.CapacityBuilding,
      historic: true,
    },
    {
      value: 'ExegeticalFacilitator',
      deprecationReason: 'Legacy. Only used in historic data.',
      historic: true,
    },
    {
      value: 'TranslationFacilitator',
      deprecationReason: 'Legacy. Only used in historic data.',
      historic: true,
    },
  ],
});

@ObjectType({
  description: SecuredEnum.descriptionFor('an intern position'),
})
export class SecuredInternPosition extends SecuredEnum(InternshipPosition, {
  nullable: true,
}) {}
