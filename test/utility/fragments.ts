import { gql } from 'apollo-server-core';
import { Except, Merge, MergeExclusive } from 'type-fest';
import { ID, Secured } from '../../src/common';
import {
  IEngagement,
  InternshipEngagement,
  LanguageEngagement,
} from '../../src/components/engagement/dto';
import {
  File,
  FileListOutput,
  FileVersion,
  IFileNode,
  SecuredFile,
} from '../../src/components/file';
import { SecuredLanguage } from '../../src/components/language/dto';
import { Product, ProductApproach } from '../../src/components/product/dto';
import { User } from '../../src/components/user';
import { Raw } from './raw.type';

export const org = gql`
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
`;

export const user = gql`
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
  }
`;
export type RawUser = Merge<Raw<User>, { timezone: Secured<{ name: string }> }>;

export const language = gql`
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
    registryOfDialectsCode {
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
`;

export const unavailability = gql`
  fragment unavailability on Unavailability {
    id
    createdAt
    description {
      value
      canEdit
      canRead
    }
    start
    end
  }
`;

export const education = gql`
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
`;

export const fileNodeChildren = gql`
  fragment children on FileListOutput {
    total
    hasMore
    items {
      id
      type
      name
    }
  }
`;
export type RawFileNodeChildren = Pick<FileListOutput, 'total' | 'hasMore'> & {
  items: Array<Pick<IFileNode, 'id' | 'type' | 'name'>>;
};

export const fileNode = gql`
  fragment fileNode on FileNode {
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
      downloadUrl
    }
    ... on File {
      mimeType
      size
      downloadUrl
      modifiedAt
      modifiedBy {
        ...user
      }
    }
  }
  ${user}
`;
type RawNode<Node, Without extends keyof Node, Add> = Raw<
  Merge<Except<Node, Without>, Add>
>;
export type RawBaseFileNode = RawNode<
  IFileNode,
  'createdById',
  {
    createdBy: User;
    parents: Array<Pick<IFileNode, 'id' | 'type' | 'name'>>;
  }
>;
export type RawDirectory = RawBaseFileNode;
export type RawFileVersion = RawBaseFileNode &
  RawNode<FileVersion, keyof IFileNode, { downloadUrl: string }>;
export type RawFile = RawFileVersion &
  RawNode<
    File,
    'latestVersionId' | 'modifiedById' | keyof IFileNode,
    {
      modifiedBy: User;
    }
  >;
export type RawFileNode = RawDirectory | RawFileVersion | RawFile;

export const scriptureReference = gql`
  fragment scriptureReference on ScriptureReference {
    book
    chapter
    verse
  }
`;

export const scriptureRange = gql`
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
  ${scriptureReference}
`;

export const product = gql`
  fragment product on Product {
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
  ${scriptureRange}
`;
export type RawProduct = Raw<Product> & { approach?: ProductApproach };

export const project = gql`
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
`;

export const partner = gql`
  fragment partner on Partner {
    id
    createdAt
    modifiedAt
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
  ${org}
  ${user}
`;

export const partnership = gql`
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
  ${partner}
`;

export const projectMember = gql`
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
`;

export const engagement = gql`
  fragment engagement on Engagement {
    id
    createdAt
    modifiedAt
    sensitivity
    # status, // WIP
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
        value {
          id
        }
      }
      intern {
        value {
          id
        }
      }
      mentor {
        value {
          id
        }
      }
      position {
        value
      }
      methodologies {
        value
      }
      growthPlan {
        value {
          id
        }
      }
    }
  }
  ${language}
  ${product}
`;
type RawBaseEngagement = Except<Raw<IEngagement>, 'ceremony'> & {
  ceremony: Secured<{ id: ID }>;
};
export type RawLanguageEngagement = RawBaseEngagement &
  Merge<
    Except<LanguageEngagement, keyof IEngagement>,
    {
      language: SecuredLanguage;
      pnp: SecuredFile;
    }
  >;
export type RawInternshipEngagement = RawBaseEngagement &
  Merge<
    Except<InternshipEngagement, keyof IEngagement>,
    {
      language: SecuredLanguage;
      pnp: SecuredFile;
    }
  >;
export type RawEngagement = MergeExclusive<
  RawLanguageEngagement,
  RawInternshipEngagement
>;

export const languageEngagement = gql`
  fragment languageEngagement on LanguageEngagement {
    ...engagement
  }
  ${engagement}
`;

export const internshipEngagement = gql`
  fragment internshipEngagement on InternshipEngagement {
    ...engagement
  }
  ${engagement}
`;

export const fieldZone = gql`
  fragment fieldZone on FieldZone {
    id
    createdAt
    name {
      value
      canEdit
      canRead
    }
  }
`;

export const fieldRegion = gql`
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
    }
    director {
      canRead
      canEdit
    }
  }
`;

export const budgetRecord = gql`
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
  ${org}
`;

export const budget = gql`
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
  ${budgetRecord}
`;

export const film = gql`
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
  ${scriptureRange}
`;

export const literacyMaterial = gql`
  fragment literacyMaterial on LiteracyMaterial {
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
  ${scriptureRange}
`;

export const story = gql`
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
  ${scriptureRange}
`;

export const song = gql`
  fragment song on Song {
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
  ${scriptureRange}
`;

export const ceremony = gql`
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
`;

export const fundingAccount = gql`
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
`;

export const location = gql`
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
  }
  ${fundingAccount}
  ${fieldRegion}
`;

export const projectChangeRequest = gql`
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
`;

export const fragments = {
  org,
  user,
  language,
  unavailability,
  education,
  product,
  project,
  partnership,
  projectMember,
  languageEngagement,
  internshipEngagement,
  fieldZone,
  fieldRegion,
  location,
  budget,
  budgetRecord,
  film,
  literacyMaterial,
  story,
  song,
  ceremony,
  partner,
  fundingAccount,
  projectChangeRequest,
};
