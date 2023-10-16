import { EnumType, makeEnum } from '~/common';

export type Power = EnumType<typeof Power>;
export const Power = makeEnum({
  name: 'Power',
  values: [
    'BetaFeatures',
    'CreateEthnoArt',
    'CreateFieldRegion',
    'CreateFieldZone',
    'CreateFilm',
    'CreateFundingAccount',
    'CreateLanguage',
    'CreateLiteracyMaterial',
    'CreateLocation',
    'CreateOrganization',
    'CreatePartner',
    'CreateProject',
    'CreateSong',
    'CreateStory',
    'CreateUser',
    {
      value: 'CreateBudget',
      deprecationReason: 'Use `Project.budget` instead',
    },
    {
      value: 'CreateBudgetRecord',
      deprecationReason: 'Use `Project.budget` instead',
    },
    {
      value: 'CreateCeremony',
      deprecationReason: 'Use `Engagement.ceremony` instead',
    },
    {
      value: 'CreateChangeRequest',
      deprecationReason: 'Use `Project.changeRequests` instead',
    },
    {
      value: 'CreateDirectory',
      deprecationReason: 'Use something else instead',
    },
    {
      value: 'CreateEducation',
      deprecationReason: 'Use `User.education` instead',
    },
    {
      value: 'CreateEthnologueLanguage',
      deprecationReason:
        'Just check `CreateLanguage` instead. This is a sub-object ',
    },
    { value: 'CreateFile', deprecationReason: 'Use something else instead' },
    {
      value: 'CreateFileVersion',
      deprecationReason: 'Use something else instead',
    },
    {
      value: 'CreateInternshipEngagement',
      deprecationReason: 'Use `Project.engagements` instead',
    },
    {
      value: 'CreateLanguageEngagement',
      deprecationReason: 'Use `Project.engagements` instead',
    },
    {
      value: 'CreatePartnership',
      deprecationReason: 'Use `Project.partnerships` instead ',
    },
    { value: 'CreatePost', deprecationReason: 'Use `X.posts` instead' },
    {
      value: 'CreateProduct',
      deprecationReason: 'Use `Engagement.products` instead',
    },
    {
      value: 'CreateProjectEngagement',
      deprecationReason: 'Use `Project.engagements` instead',
    },
    {
      value: 'CreateProjectMember',
      deprecationReason: 'Use `Project.team` instead',
    },
    {
      value: 'CreateTranslationEngagement',
      deprecationReason: 'Use `Project.engagements` instead',
    },
    {
      value: 'CreateUnavailability',
      deprecationReason: 'Use `User.unavailabilities` instead',
    },
    {
      value: 'GrantInternRole',
      deprecationReason: 'Use `AuthorizedRoles.Intern` instead',
    },
    {
      value: 'GrantLiaisonRole',
      deprecationReason: 'Use `AuthorizedRoles.Liaison` instead',
    },
    {
      value: 'GrantMentorRole',
      deprecationReason: 'Use `AuthorizedRoles.Mentor` instead',
    },
    {
      value: 'GrantRegionalCommunicationsCoordinatorRole',
      deprecationReason:
        'Use `AuthorizedRoles.RegionalCommunicationsCoordinator` instead',
    },
    {
      value: 'GrantTranslatorRole',
      deprecationReason: 'Use `AuthorizedRoles.Translator` instead',
    },
  ],
});
