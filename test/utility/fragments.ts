/* eslint-disable @typescript-eslint/naming-convention */
import { type FragmentOf, graphql } from '~/graphql';

export const org = graphql(`
  fragment org on Organization {
    createdAt
    id
    sensitivity
    name {
      value
      canRead
      canEdit
    }
    address {
      value
      canRead
      canEdit
    }
    locations {
      canRead
      canCreate
      items {
        id
        createdAt
        name {
          value
          canEdit
          canRead
        }
        type {
          value
          canEdit
          canRead
        }
        isoAlpha3 {
          value
          canEdit
          canRead
        }
        fundingAccount {
          value {
            id
            name {
              value
              canRead
              canEdit
            }
            accountNumber {
              value
              canRead
              canEdit
            }
            createdAt
          }
          canEdit
          canRead
        }
        defaultFieldRegion {
          value {
            id
            name {
              value
            }
          }
        }
      }
    }
  }
`);
export type org = FragmentOf<typeof org>;

export const user = graphql(`
  fragment user on User {
    id
    email {
      value
      canEdit
      canRead
    }
    displayFirstName {
      value
      canEdit
      canRead
    }
    displayLastName {
      value
      canEdit
      canRead
    }
    realFirstName {
      value
      canEdit
      canRead
    }
    realLastName {
      value
      canEdit
      canRead
    }
    phone {
      value
      canEdit
      canRead
    }
    timezone {
      value {
        name
      }
      canEdit
      canRead
    }
    about {
      value
      canEdit
      canRead
    }
    status {
      value
      canEdit
      canRead
    }
    roles {
      value
      canEdit
      canRead
    }
    title {
      value
      canRead
      canEdit
    }
    education {
      canCreate
      canRead
    }
    organizations {
      canCreate
      canRead
    }
    partners {
      canCreate
      canRead
    }
    unavailabilities {
      canCreate
      canRead
    }
    locations {
      canCreate
      canRead
    }
  }
`);
export type user = FragmentOf<typeof user>;

export const language = graphql(`
  fragment language on Language {
    id
    name {
      value
      canEdit
      canRead
    }
    displayName {
      value
      canEdit
      canRead
    }
    isDialect {
      value
      canEdit
      canRead
    }
    signLanguageCode {
      value
      canEdit
      canRead
    }
    isSignLanguage {
      value
      canEdit
      canRead
    }
    populationOverride {
      value
      canEdit
      canRead
    }
    registryOfLanguageVarietiesCode {
      value
      canEdit
      canRead
    }
    leastOfThese {
      value
      canEdit
      canRead
    }
    leastOfTheseReason {
      value
      canEdit
      canRead
    }
    sponsorEstimatedEndDate {
      value
      canEdit
      canRead
    }
    ethnologue {
      code {
        value
        canRead
        canEdit
      }
      provisionalCode {
        value
        canRead
        canEdit
      }
      name {
        value
        canRead
        canEdit
      }
      population {
        value
        canRead
        canEdit
      }
    }
    sensitivity
    displayNamePronunciation {
      value
      canRead
      canEdit
    }
    hasExternalFirstScripture {
      value
      canRead
      canEdit
    }
    tags {
      value
      canRead
      canEdit
    }
    presetInventory {
      value
      canRead
      canEdit
    }
    locations {
      canRead
      canCreate
      items {
        id
        createdAt
        name {
          value
          canEdit
          canRead
        }
        type {
          value
          canEdit
          canRead
        }
        isoAlpha3 {
          value
          canEdit
          canRead
        }
        fundingAccount {
          value {
            id
            name {
              value
              canRead
              canEdit
            }
            accountNumber {
              value
              canRead
              canEdit
            }
            createdAt
          }
          canEdit
          canRead
        }
        defaultFieldRegion {
          value {
            id
            name {
              value
            }
          }
        }
      }
    }
  }
`);
export type language = FragmentOf<typeof language>;

export const unavailability = graphql(`
  fragment unavailability on Unavailability {
    id
    createdAt
    description {
      value
      canEdit
      canRead
    }
    start {
      value
      canEdit
      canRead
    }
    end {
      value
      canEdit
      canRead
    }
  }
`);
export type unavailability = FragmentOf<typeof unavailability>;

export const education = graphql(`
  fragment education on Education {
    id
    createdAt
    degree {
      value
      canRead
      canEdit
    }
    major {
      value
      canRead
      canEdit
    }
    institution {
      value
      canRead
      canEdit
    }
  }
`);
export type education = FragmentOf<typeof education>;

export const fileNodeChildren = graphql(`
  fragment children on FileListOutput {
    total
    hasMore
    items {
      id
      type
      name
    }
  }
`);
export type fileNodeChildren = FragmentOf<typeof fileNodeChildren>;

export const fileNode = graphql(
  `
    fragment fileNode on FileNode {
      __typename
      id
      type
      name
      createdAt
      createdBy {
        ...user
      }
      parents {
        id
        name
        type
      }
      ... on FileVersion {
        mimeType
        size
        url
      }
      ... on File {
        mimeType
        size
        url
        modifiedAt
        modifiedBy {
          ...user
        }
      }
    }
  `,
  [user],
);
export type fileNode = FragmentOf<typeof fileNode>;
export type directory = Extract<fileNode, { __typename: 'Directory' }>;
export type fileVersion = Extract<fileNode, { __typename: 'FileVersion' }>;
export type file = Extract<fileNode, { __typename: 'File' }>;

export const scriptureReference = graphql(`
  fragment scriptureReference on ScriptureReference {
    book
    chapter
    verse
  }
`);
export type scriptureReference = FragmentOf<typeof scriptureReference>;

export const scriptureRange = graphql(
  `
    fragment scriptureRange on SecuredScriptureRanges {
      canEdit
      canRead
      value {
        start {
          ...scriptureReference
        }
        end {
          ...scriptureReference
        }
      }
    }
  `,
  [scriptureReference],
);
export type scriptureRange = FragmentOf<typeof scriptureRange>;

export const product = graphql(
  `
    fragment product on Product {
      __typename
      id
      createdAt
      mediums {
        canEdit
        canRead
        value
      }
      purposes {
        canEdit
        canRead
        value
      }
      approach
      methodology {
        canEdit
        canRead
        value
      }
      scriptureReferences {
        ...scriptureRange
      }
    }
  `,
  [scriptureRange],
);
export type product = FragmentOf<typeof product>;

export const project = graphql(`
  fragment project on Project {
    id
    createdAt
    type
    sensitivity
    rootDirectory {
      canRead
      canEdit
      value {
        id
        children {
          items {
            name
          }
        }
      }
    }
    name {
      value
      canRead
      canEdit
    }
    departmentId {
      value
      canRead
      canEdit
    }
    step {
      value
      canRead
      canEdit
    }
    stepChangedAt {
      value
      canRead
      canEdit
    }
    status
    pinned
    fieldRegion {
      value {
        id
        name {
          value
        }
      }
    }
    primaryLocation {
      canRead
      canEdit
      value {
        id
      }
    }
    mouStart {
      value
      canRead
      canEdit
    }
    mouEnd {
      value
      canRead
      canEdit
    }
    initialMouEnd {
      value
      canRead
      canEdit
    }
    estimatedSubmission {
      value
      canRead
      canEdit
    }
    tags {
      value
      canRead
      canEdit
    }
    financialReportReceivedAt {
      canRead
      canEdit
      value
    }
    engagements {
      canRead
      canCreate
    }
    partnerships {
      canRead
      canCreate
    }
    team {
      canRead
      canCreate
    }
    presetInventory {
      canRead
      canEdit
      value
    }
  }
`);
export type project = FragmentOf<typeof project>;

export const partner = graphql(
  `
    fragment partner on Partner {
      id
      createdAt
      modifiedAt
      sensitivity
      organization {
        canEdit
        canRead
        value {
          ...org
        }
      }
      pointOfContact {
        canEdit
        canRead
        value {
          ...user
        }
      }
      types {
        value
        canRead
        canEdit
      }
      financialReportingTypes {
        value
        canRead
        canEdit
      }
      pmcEntityCode {
        value
        canRead
        canEdit
      }
      globalInnovationsClient {
        value
        canRead
        canEdit
      }
      active {
        value
        canRead
        canEdit
      }
      address {
        value
        canRead
        canEdit
      }
    }
  `,
  [org, user],
);
export type partner = FragmentOf<typeof partner>;

export const partnership = graphql(
  `
    fragment partnership on Partnership {
      id
      agreementStatus {
        value
        canRead
        canEdit
      }
      mouStatus {
        value
        canRead
        canEdit
      }
      mouStart {
        value
        canRead
        canEdit
      }
      mouEnd {
        value
        canRead
        canEdit
      }
      mouStartOverride {
        value
        canRead
        canEdit
      }
      mouEndOverride {
        value
        canRead
        canEdit
      }
      types {
        value
        canRead
        canEdit
      }
      primary {
        value
        canRead
        canEdit
      }
      sensitivity
      financialReportingType {
        value
        canRead
        canEdit
      }
      mou {
        value {
          id
        }
        canRead
        canEdit
      }
      partner {
        canEdit
        canRead
        value {
          ...partner
        }
      }
    }
  `,
  [partner],
);
export type partnership = FragmentOf<typeof partnership>;

export const projectMember = graphql(`
  fragment projectMember on ProjectMember {
    id
    createdAt
    modifiedAt
    roles {
      value
      canRead
      canEdit
    }
    user {
      canRead
      canEdit
      value {
        id
      }
    }
  }
`);
export type projectMember = FragmentOf<typeof projectMember>;

export const engagement = graphql(
  `
    fragment engagement on Engagement {
      __typename
      id
      createdAt
      modifiedAt
      sensitivity
      status {
        value
        canRead
        canEdit
      }
      ceremony {
        canRead
        canEdit
        value {
          id
        }
      }
      completeDate {
        canEdit
        canRead
        value
      }
      disbursementCompleteDate {
        canEdit
        canRead
        value
      }
      startDate {
        canEdit
        canRead
        value
      }
      startDateOverride {
        canEdit
        canRead
        value
      }
      endDate {
        canEdit
        canRead
        value
      }
      endDateOverride {
        canEdit
        canRead
        value
      }
      initialEndDate {
        canEdit
        canRead
        value
      }
      lastSuspendedAt {
        canEdit
        canRead
        value
      }
      lastReactivatedAt {
        canEdit
        canRead
        value
      }
      statusModifiedAt {
        canEdit
        canRead
        value
      }
      ... on LanguageEngagement {
        language {
          canEdit
          canRead
          value {
            ...language
          }
        }
        historicGoal {
          canEdit
          canRead
          value
        }
        firstScripture {
          canEdit
          canRead
          value
        }
        lukePartnership {
          canEdit
          canRead
          value
        }
        sentPrintingDate {
          canEdit
          canRead
          value
        }
        paratextRegistryId {
          canEdit
          canRead
          value
        }
        pnp {
          canEdit
          canRead
          value {
            id
          }
        }
        products {
          total
          items {
            ...product
          }
        }
      }
      ... on InternshipEngagement {
        countryOfOrigin {
          canRead
          canEdit
          value {
            id
          }
        }
        intern {
          canRead
          canEdit
          value {
            id
          }
        }
        mentor {
          canRead
          canEdit
          value {
            id
          }
        }
        position {
          canRead
          canEdit
          value
        }
        methodologies {
          canRead
          canEdit
          value
        }
        growthPlan {
          canRead
          canEdit
          value {
            id
          }
        }
      }
    }
  `,
  [language, product],
);
export type engagement = FragmentOf<typeof engagement>;

export const languageEngagement = graphql(
  `
    fragment languageEngagement on LanguageEngagement {
      ...engagement
    }
  `,
  [engagement],
);
export type languageEngagement = FragmentOf<typeof languageEngagement>;

export const internshipEngagement = graphql(
  `
    fragment internshipEngagement on InternshipEngagement {
      ...engagement
    }
  `,
  [engagement],
);
export type internshipEngagement = FragmentOf<typeof internshipEngagement>;

export const fieldZone = graphql(`
  fragment fieldZone on FieldZone {
    id
    createdAt
    director {
      canRead
      canEdit
      value {
        id
      }
    }
    name {
      value
      canEdit
      canRead
    }
  }
`);
export type fieldZone = FragmentOf<typeof fieldZone>;

export const fieldRegion = graphql(
  `
    fragment fieldRegion on FieldRegion {
      id
      createdAt
      name {
        value
        canEdit
        canRead
      }
      fieldZone {
        canRead
        canEdit
        value {
          ...fieldZone
        }
      }
      director {
        canRead
        canEdit
        value {
          id
        }
      }
    }
  `,
  [fieldZone],
);
export type fieldRegion = FragmentOf<typeof fieldRegion>;

export const budgetRecord = graphql(
  `
    fragment budgetRecord on BudgetRecord {
      id
      createdAt
      organization {
        value {
          ...org
        }
        canEdit
        canRead
      }
      fiscalYear {
        value
        canEdit
        canRead
      }
      amount {
        value
        canEdit
        canRead
      }
    }
  `,
  [org],
);
export type budgetRecord = FragmentOf<typeof budgetRecord>;

export const budget = graphql(
  `
    fragment budget on Budget {
      id
      createdAt
      status
      sensitivity
      universalTemplateFile {
        canRead
        canEdit
        value {
          id
        }
      }
      records {
        ...budgetRecord
      }
    }
  `,
  [budgetRecord],
);
export type budget = FragmentOf<typeof budget>;

export const film = graphql(
  `
    fragment film on Film {
      id
      name {
        value
        canRead
        canEdit
      }
      scriptureReferences {
        ...scriptureRange
      }
      createdAt
    }
  `,
  [scriptureRange],
);
export type film = FragmentOf<typeof film>;

export const story = graphql(
  `
    fragment story on Story {
      id
      name {
        value
        canRead
        canEdit
      }
      scriptureReferences {
        ...scriptureRange
      }
      createdAt
    }
  `,
  [scriptureRange],
);
export type story = FragmentOf<typeof story>;

export const ceremony = graphql(`
  fragment ceremony on Ceremony {
    id
    createdAt
    type
    planned {
      canRead
      canEdit
      value
    }
    estimatedDate {
      canRead
      canEdit
      value
    }
    actualDate {
      canRead
      canEdit
      value
    }
  }
`);
export type ceremony = FragmentOf<typeof ceremony>;

export const fundingAccount = graphql(`
  fragment fundingAccount on FundingAccount {
    id
    name {
      value
      canRead
      canEdit
    }
    accountNumber {
      value
      canRead
      canEdit
    }
    createdAt
  }
`);
export type fundingAccount = FragmentOf<typeof fundingAccount>;

export const locationName = graphql(`
  fragment locationName on Location {
    id
    name {
      value
      canRead
      canEdit
    }
  }
`);

export const location = graphql(
  `
    fragment location on Location {
      id
      createdAt
      name {
        value
        canEdit
        canRead
      }
      type {
        value
        canEdit
        canRead
      }
      isoAlpha3 {
        value
        canEdit
        canRead
      }
      fundingAccount {
        value {
          ...fundingAccount
        }
        canEdit
        canRead
      }
      defaultFieldRegion {
        value {
          ...fieldRegion
        }
      }
      defaultMarketingRegion {
        value {
          ...locationName
        }
      }
    }
  `,
  [fundingAccount, fieldRegion, locationName],
);
export type location = FragmentOf<typeof location>;

export const projectChangeRequest = graphql(`
  fragment projectChangeRequest on ProjectChangeRequest {
    id
    status {
      value
      canEdit
      canRead
    }
    summary {
      value
      canEdit
      canRead
    }
    types {
      value
      canEdit
      canRead
    }
    createdAt
    canEdit
  }
`);
export type projectChangeRequest = FragmentOf<typeof projectChangeRequest>;
