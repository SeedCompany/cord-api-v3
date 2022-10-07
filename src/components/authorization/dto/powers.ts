/* eslint typescript-sort-keys/string-enum: "warn" */

import { registerEnumType } from '@nestjs/graphql';

export enum Powers {
  BetaFeatures = 'BetaFeatures',

  CreateEthnoArt = 'CreateEthnoArt',
  CreateFieldRegion = 'CreateFieldRegion',
  CreateFieldZone = 'CreateFieldZone',
  CreateFilm = 'CreateFilm',
  CreateFundingAccount = 'CreateFundingAccount',
  CreateLanguage = 'CreateLanguage',
  CreateLiteracyMaterial = 'CreateLiteracyMaterial',
  CreateLocation = 'CreateLocation',
  CreateOrganization = 'CreateOrganization',
  CreatePartner = 'CreatePartner',
  CreateProject = 'CreateProject',
  CreateSong = 'CreateSong',
  CreateStory = 'CreateStory',
  CreateUser = 'CreateUser',

  /* eslint-disable typescript-sort-keys/string-enum */

  /** @deprecated Use `Project.budget` instead */
  CreateBudget = 'CreateBudget',
  /** @deprecated Use `Project.budget` instead */
  CreateBudgetRecord = 'CreateBudgetRecord',
  /** @deprecated Use `Engagement.ceremony` instead */
  CreateCeremony = 'CreateCeremony',
  /** @deprecated Use `Project.changeRequests` instead */
  CreateChangeRequest = 'CreateChangeRequest',
  /** @deprecated Use something else instead */
  CreateDirectory = 'CreateDirectory',
  /** @deprecated Use `User.education` instead */
  CreateEducation = 'CreateEducation',
  /** @deprecated Just check `CreateLanguage` instead. This is a sub-object */
  CreateEthnologueLanguage = 'CreateEthnologueLanguage',
  /** @deprecated Use something else instead */
  CreateFile = 'CreateFile',
  /** @deprecated Use something else instead */
  CreateFileVersion = 'CreateFileVersion',
  /** @deprecated Use `Project.engagements` instead */
  CreateInternshipEngagement = 'CreateInternshipEngagement',
  /** @deprecated Use `Project.engagements` instead */
  CreateLanguageEngagement = 'CreateLanguageEngagement',
  /** @deprecated Use `Project.partnerships` instead */
  CreatePartnership = 'CreatePartnership',
  /** @deprecated Use `X.posts` instead */
  CreatePost = 'CreatePost',
  /** @deprecated Use `Engagement.products` instead */
  CreateProduct = 'CreateProduct',
  /** @deprecated Use `Project.engagements` instead */
  CreateProjectEngagement = 'CreateProjectEngagement',
  /** @deprecated Use `Project.team` instead */
  CreateProjectMember = 'CreateProjectMember',
  /** @deprecated Use `Project.engagements` instead */
  CreateTranslationEngagement = 'CreateTranslationEngagement',
  /** @deprecated Use `User.unavailabilities` instead */
  CreateUnavailability = 'CreateUnavailability',

  /** @deprecated Use `AuthorizedRoles.Intern` instead */
  GrantInternRole = 'GrantInternRole',
  /** @deprecated Use `AuthorizedRoles.Liaison` instead */
  GrantLiaisonRole = 'GrantLiaisonRole',
  /** @deprecated Use `AuthorizedRoles.Mentor` instead */
  GrantMentorRole = 'GrantMentorRole',
  /** @deprecated Use `AuthorizedRoles.RegionalCommunicationsCoordinator` instead */
  GrantRegionalCommunicationsCoordinatorRole = 'GrantRegionalCommunicationsCoordinatorRole',
  /** @deprecated Use `AuthorizedRoles.Translator` instead */
  GrantTranslatorRole = 'GrantTranslatorRole',
}

registerEnumType(Powers, { name: 'Power' });
