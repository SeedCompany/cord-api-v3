import { ProjectStatus } from '../../project/dto';
import { InternalRole, Role } from '../dto';
import { Perm, policy, policyExecutor } from './policy';

// permissions are the intersection of a role and a base node type.
// each role will have a unique collection of read and write
// permissions on each type of base node.
// the Admin role SHALL have all properties on a base node

const policies = [
  policy('Budget', InternalRole.Admin, {
    universalTemplateFile: Perm.ReadAndEdit,
    records: Perm.ReadAndEdit,
    status: Perm.ReadAndEdit,
  }),
  policy('BudgetRecord', InternalRole.Admin, {
    amount: Perm.ReadAndEdit,
    fiscalYear: Perm.ReadAndEdit,
    organization: Perm.ReadAndEdit,
  }),
  policy('Ceremony', InternalRole.Admin, {
    actualDate: Perm.ReadAndEdit,
    estimatedDate: Perm.ReadAndEdit,
    planned: Perm.ReadAndEdit,
  }),
  policy('Directory', InternalRole.Admin, {
    name: Perm.ReadAndEdit,
    createdBy: Perm.ReadAndEdit,
    parent: Perm.ReadAndEdit,
  }),
  policy('Education', InternalRole.Admin, {
    degree: Perm.ReadAndEdit,
    institution: Perm.ReadAndEdit,
    major: Perm.ReadAndEdit,
  }),
  policy('EthnologueLanguage', InternalRole.Admin, {
    code: Perm.ReadAndEdit,
    name: Perm.ReadAndEdit,
    population: Perm.ReadAndEdit,
    provisionalCode: Perm.ReadAndEdit,
  }),
  policy('File', InternalRole.Admin, {
    name: Perm.ReadAndEdit,
    createdBy: Perm.ReadAndEdit,
    parent: Perm.ReadAndEdit,
    mimeType: Perm.ReadAndEdit,
  }),
  policy('FileVersion', InternalRole.Admin, {
    name: Perm.ReadAndEdit,
    createdBy: Perm.ReadAndEdit,
    parent: Perm.ReadAndEdit,
    mimeType: Perm.ReadAndEdit,
    size: Perm.ReadAndEdit,
  }),
  policy('Film', InternalRole.Admin, {
    name: Perm.ReadAndEdit,
    scriptureReferences: Perm.ReadAndEdit,
  }),
  policy('FundingAccount', InternalRole.Admin, {
    name: Perm.ReadAndEdit,
    accountNumber: Perm.ReadAndEdit,
  }),
  policy('Language', InternalRole.Admin, {
    displayName: Perm.ReadAndEdit,
    displayNamePronunciation: Perm.ReadAndEdit,
    isDialect: Perm.ReadAndEdit,
    isSignLanguage: Perm.ReadAndEdit,
    leastOfThese: Perm.ReadAndEdit,
    leastOfTheseReason: Perm.ReadAndEdit,
    name: Perm.ReadAndEdit,
    populationOverride: Perm.ReadAndEdit,
    registryOfDialectsCode: Perm.ReadAndEdit,
    signLanguageCode: Perm.ReadAndEdit,
    sponsorEstimatedEndDate: Perm.ReadAndEdit,
    ethnologue: Perm.ReadAndEdit,
    sensitivity: Perm.ReadAndEdit,
    hasExternalFirstScripture: Perm.ReadAndEdit,
  }),
  policy('LanguageEngagement', InternalRole.Admin, {
    ceremony: Perm.ReadAndEdit,
    communicationsCompleteDate: Perm.ReadAndEdit,
    completeDate: Perm.ReadAndEdit,
    disbursementCompleteDate: Perm.ReadAndEdit,
    endDate: Perm.ReadAndEdit,
    endDateOverride: Perm.ReadAndEdit,
    firstScripture: Perm.ReadAndEdit,
    initialEndDate: Perm.ReadAndEdit,
    language: Perm.ReadAndEdit,
    lastReactivatedAt: Perm.ReadAndEdit,
    lastSuspendedAt: Perm.ReadAndEdit,
    lukePartnership: Perm.ReadAndEdit,
    paraTextRegistryId: Perm.ReadAndEdit,
    pnp: Perm.ReadAndEdit,
    sentPrintingDate: Perm.ReadAndEdit,
    startDate: Perm.ReadAndEdit,
    startDateOverride: Perm.ReadAndEdit,
    statusModifiedAt: Perm.ReadAndEdit,
    modifiedAt: Perm.ReadAndEdit,
    product: Perm.ReadAndEdit,
  }),
  policy('LiteracyMaterial', InternalRole.Admin, {
    name: Perm.ReadAndEdit,
    scriptureReferences: Perm.ReadAndEdit,
  }),
  policy('InternshipEngagement', InternalRole.Admin, {
    ceremony: Perm.ReadAndEdit,
    communicationsCompleteDate: Perm.ReadAndEdit,
    completeDate: Perm.ReadAndEdit,
    countryOfOrigin: Perm.ReadAndEdit,
    disbursementCompleteDate: Perm.ReadAndEdit,
    endDate: Perm.ReadAndEdit,
    endDateOverride: Perm.ReadAndEdit,
    growthPlan: Perm.ReadAndEdit,
    initialEndDate: Perm.ReadAndEdit,
    intern: Perm.ReadAndEdit,
    lastReactivatedAt: Perm.ReadAndEdit,
    lastSuspendedAt: Perm.ReadAndEdit,
    mentor: Perm.ReadAndEdit,
    methodologies: Perm.ReadAndEdit,
    position: Perm.ReadAndEdit,
    startDate: Perm.ReadAndEdit,
    startDateOverride: Perm.ReadAndEdit,
    statusModifiedAt: Perm.ReadAndEdit,
    modifiedAt: Perm.ReadAndEdit,
  }),
  policy('Organization', InternalRole.Admin, {
    name: Perm.ReadAndEdit,
  }),
  policy('Partner', InternalRole.Admin, {
    organization: Perm.ReadAndEdit,
    pointOfContact: Perm.ReadAndEdit,
    types: Perm.ReadAndEdit,
  }),
  policy('Partnership', InternalRole.Admin, {
    agreement: Perm.ReadAndEdit,
    agreementStatus: Perm.ReadAndEdit,
    financialReportingType: Perm.ReadAndEdit,
    mou: Perm.ReadAndEdit,
    mouEnd: Perm.ReadAndEdit,
    mouEndOverride: Perm.ReadAndEdit,
    mouStart: Perm.ReadAndEdit,
    mouStartOverride: Perm.ReadAndEdit,
    mouStatus: Perm.ReadAndEdit,
    types: Perm.ReadAndEdit,
    organization: Perm.ReadAndEdit,
    partner: Perm.ReadAndEdit,
  }),
  policy('Product', InternalRole.Admin, {
    mediums: Perm.ReadAndEdit,
    methodology: Perm.ReadAndEdit,
    purposes: Perm.ReadAndEdit,
    scriptureReferences: Perm.ReadAndEdit,
    produces: Perm.ReadAndEdit,
    scriptureReferencesOverride: Perm.ReadAndEdit,
    isOverriding: Perm.ReadAndEdit,
  }),
  policy('Project', InternalRole.Admin, {
    estimatedSubmission: Perm.ReadAndEdit,
    step: Perm.ReadAndEdit,
    name: Perm.ReadAndEdit,
    departmentId: Perm.ReadAndEdit,
    mouStart: Perm.ReadAndEdit,
    mouEnd: Perm.ReadAndEdit,
    rootDirectory: Perm.Read,
    member: Perm.ReadAndEdit,
    partnership: Perm.ReadAndEdit,
    budget: Perm.ReadAndEdit,
    modifiedAt: Perm.ReadAndEdit,
    engagement: Perm.ReadAndEdit,
    primaryLocation: Perm.ReadAndEdit,
    otherLocations: Perm.ReadAndEdit,
    marketingLocation: Perm.ReadAndEdit,
    fieldRegion: Perm.ReadAndEdit,
    status: Perm.ReadAndEdit,
    sensitivity: Perm.ReadAndEdit,
  }),
  policy(
    'Project',
    InternalRole.Admin,
    (project) => project.status === ProjectStatus.InDevelopment,
    {
      mouStart: Perm.ReadAndEdit,
      mouEnd: Perm.ReadAndEdit,
    }
  ),
  policy('Project', Role.Translator, {
    mouStart: Perm.Read,
    mouEnd: Perm.Read,
    name: Perm.ReadAndEdit,
  }),
  policy('ProjectMember', InternalRole.Admin, {
    roles: Perm.ReadAndEdit,
    user: Perm.ReadAndEdit,
    modifiedAt: Perm.ReadAndEdit,
  }),
  policy('FieldRegion', InternalRole.Admin, {
    director: Perm.ReadAndEdit,
    name: Perm.ReadAndEdit,
    fieldZone: Perm.ReadAndEdit,
  }),
  policy('Song', InternalRole.Admin, {
    name: Perm.ReadAndEdit,
    scriptureReferences: Perm.ReadAndEdit,
  }),
  policy('Story', InternalRole.Admin, {
    name: Perm.ReadAndEdit,
    scriptureReferences: Perm.ReadAndEdit,
  }),
  policy('Unavailability', InternalRole.Admin, {
    description: Perm.ReadAndEdit,
    end: Perm.ReadAndEdit,
    start: Perm.ReadAndEdit,
  }),
  policy('User', InternalRole.Admin, {
    about: Perm.ReadAndEdit,
    displayFirstName: Perm.ReadAndEdit,
    displayLastName: Perm.ReadAndEdit,
    email: Perm.ReadAndEdit,
    phone: Perm.ReadAndEdit,
    realFirstName: Perm.ReadAndEdit,
    realLastName: Perm.ReadAndEdit,
    roles: Perm.ReadAndEdit,
    status: Perm.ReadAndEdit,
    timezone: Perm.ReadAndEdit,
    title: Perm.ReadAndEdit,
    education: Perm.ReadAndEdit,
    organization: Perm.ReadAndEdit,
    unavailability: Perm.ReadAndEdit,
  }),
  policy('User', InternalRole.AdminViewOfProjectMember, {
    displayFirstName: Perm.Read,
    displayLastName: Perm.Read,
    email: Perm.Read,
  }),
  policy('FieldZone', InternalRole.Admin, {
    director: Perm.ReadAndEdit,
    name: Perm.ReadAndEdit,
  }),
  policy('Location', InternalRole.Admin, {
    name: Perm.ReadAndEdit,
    type: Perm.ReadAndEdit,
    sensitivity: Perm.ReadAndEdit,
    iso31663: Perm.ReadAndEdit,
    fundingAccount: Perm.ReadAndEdit,
  }),
];

export const getRolePermissions = policyExecutor(policies);
