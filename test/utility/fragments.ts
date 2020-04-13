import { gql } from 'apollo-server-core';

export const fragments = {
  org: gql`
    fragment org on Organization {
      id
      name {
        value
        canRead
        canEdit
      }
      createdAt
    }
  `,
  user: gql`
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
        value
        canEdit
        canRead
      }
      bio {
        value
        canEdit
        canRead
      }
    }
  `,
  language: gql`
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
      beginFiscalYear {
        value
        canEdit
        canRead
      }
      ethnologueName {
        value
        canEdit
        canRead
      }
      organizationPopulation {
        value
        canEdit
        canRead
      }
      rodNumber {
        value
        canEdit
        canRead
      }
    }
  `,
  unavailability: gql`
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
  `,
  education: gql`
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
  `,
  file: gql`
    fragment file on FileNode {
      id
      type
      createdBy
      modifiedBy
      size
      name
    }
  `,
  product: gql`
    fragment product on Product {
      id
      type
      books
      mediums
      purposes
      approach
      methodology
    }
  `,
  project: gql`
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
      deptId {
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
      modifiedAt
    }
  `,
  partnership: gql`
    fragment partnership on Partnership {
      id
      agreementStatus {
        value
      }
      mouStatus {
        value
      }
      mouStart {
        value
      }
      mouEnd {
        value
      }
      types {
        value
      }
      organization {
        id
        name {
          value
        }
      }
    }
  `,
  projectMember: gql`
    fragment projectMember on ProjectMember {
      id
      createdAt
      roles {
        value
      }
      user {
        value {
          id
        }
      }
    }
  `,
  languageEngagement: gql`
    fragment languageEngagement on LanguageEngagement {
      id
      createdAt
      language {
        value {
          id
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
    }
  `,
  internshipEngagement: gql`
    fragment internshipEngagement on InternshipEngagement {
      id
      createdAt
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
    }
  `,
  zone: gql`
    fragment zone on Zone {
      id
      createdAt
      name {
        value
        canEdit
        canRead
      }
    }
  `,
  region: gql`
    fragment region on Region {
      id
      createdAt
      name {
        value
        canEdit
        canRead
      }
    }
  `,
  country: gql`
    fragment country on Country {
      id
      createdAt
      name {
        value
        canEdit
        canRead
      }
    }
  `,
  budget: gql`
    fragment budget on Budget {
      id
      createdAt
      status
      records {
        value
        canEdit
        canRead
      }
    }
  `,
  budgetRecord: gql`
    fragment budgetRecord on BudgetRecord {
      id
      createdAt
      organizationId {
        value
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
  securityGroup: gql`
    fragment securityGroup on SecurityGroup {
      id
      success
    }
  `,
  permission: gql`
    fragment permission on Permission {
      id
      success
    }
  `,
  workflow: gql`
    fragment workflow on Workflow {
      id
      stateIdentifier
    }
  `,
  state: gql`
    fragment state on State {
      id
      value
    }
  `,
};
