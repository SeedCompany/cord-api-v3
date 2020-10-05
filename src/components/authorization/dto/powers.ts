/* eslint typescript-sort-keys/string-enum: "warn" */

import { registerEnumType } from '@nestjs/graphql';

export enum Powers {
  CreateBudget = 'CreateBudget',
  CreateBudgetRecord = 'CreateBudgetRecord',
  CreateCeremony = 'CreateCeremony',
  CreateCountry = 'CreateCountry',
  CreateDirectory = 'CreateDirectory',
  CreateEducation = 'CreateEducation',
  CreateEthnologueLanguage = 'CreateEthnologueLanguage',
  CreateFile = 'CreateFile',
  CreateFileVersion = 'CreateFileVersion',
  CreateFilm = 'CreateFilm',
  CreateFundingAccount = 'CreateFundingAccount',
  CreateInternshipEngagement = 'CreateInternshipEngagement',
  CreateLanguage = 'CreateLanguage',
  CreateLanguageEngagement = 'CreateLanguageEngagement',
  CreateLiteracyMaterial = 'CreateLiteracyMaterial',
  CreateOrganization = 'CreateOrganization',
  CreatePartner = 'CreatePartner',
  CreatePartnership = 'CreatePartnership',
  CreateProduct = 'CreateProduct',
  CreateProject = 'CreateProject',
  CreateProjectEngagement = 'CreateProjectEngagement', // place holder if needed
  CreateProjectMember = 'CreateProjectMember',
  CreateRegion = 'CreateRegion',
  CreateSong = 'CreateSong',
  CreateStory = 'CreateStory',
  CreateTranslationEngagement = 'CreateTranslationEngagement',
  CreateUnavailability = 'CreateUnavailability',
  CreateUser = 'CreateUser',
  CreateZone = 'CreateZone',
  GrantPower = 'GrantPower',
}

registerEnumType(Powers, { name: 'Powers' });
