import { gql } from 'apollo-server-core';
import { Except, Merge, MergeExclusive } from 'type-fest';
import { Secured } from '../../src/common';
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
    id
    name {
      value
      canRead
      canEdit
    }
    createdAt
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
    bio {
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
      ... on File {
        category
      }
    }
  }
`;
export type RawFileNodeChildren = Pick<FileListOutput, 'total' | 'hasMore'> & {
  items: Array<Pick<IFileNode, 'id' | 'type' | 'name' | 'category'>>;
};

export const fileNode = gql`
  fragment fileNode on FileNode {
    id
    type
    name
    category
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
    status
    location {
      value {
        id
        name {
          value
        }
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
    estimatedSubmission {
      value
      canRead
      canEdit
    }
  }
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
    organization {
      id
      name {
        value
        canRead
        canEdit
      }
    }
  }
`;

export const projectMember = gql`
  fragment projectMember on ProjectMember {
    id
    createdAt
    modifiedAt
    roles {
      value
    }
    user {
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
    status
    # status, // WIP
    ceremony {
      value {
        id
      }
    }
    completeDate {
      value
    }
    disbursementCompleteDate {
      value
    }
    communicationsCompleteDate {
      value
    }
    startDate {
      value
    }
    endDate {
      value
    }
    initialEndDate {
      value
    }
    lastSuspendedAt {
      value
    }
    lastReactivatedAt {
      value
    }
    statusModifiedAt {
      value
    }
    ... on LanguageEngagement {
      language {
        value {
          ...language
        }
      }
      firstScripture {
        value
      }
      lukePartnership {
        value
      }
      sentPrintingDate {
        value
      }
      paraTextRegistryId {
        value
      }
      pnp {
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
  ceremony: Secured<{ id: string }>;
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

export const zone = gql`
  fragment zone on Zone {
    id
    createdAt
    name {
      value
      canEdit
      canRead
    }
  }
`;

export const region = gql`
  fragment region on Region {
    id
    createdAt
    name {
      value
      canEdit
      canRead
    }
  }
`;

export const country = gql`
  fragment country on Country {
    id
    createdAt
    name {
      value
      canEdit
      canRead
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
    records {
      ...budgetRecord
    }
  }
  ${budgetRecord}
`;

export const securityGroup = gql`
  fragment securityGroup on SecurityGroup {
    id
    success
  }
`;

export const permission = gql`
  fragment permission on Permission {
    id
    success
  }
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

export const workflow = gql`
  fragment workflow on Workflow {
    id
    stateIdentifier
    startingState {
      id
      value
    }
  }
`;

export const state = gql`
  fragment state on State {
    id
    value
  }
`;

export const fav = gql`
  fragment fav on Favorite {
    baseNodeId
  }
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
  zone,
  region,
  country,
  budget,
  budgetRecord,
  securityGroup,
  permission,
  workflow,
  state,
  film,
  literacyMaterial,
  story,
  song,
  fav,
  ceremony,
};
