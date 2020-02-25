import { Unavailability } from '../../src/components/user';
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
      type
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
      name
      deptId
      status
      location
      publicLocation
      mouStart
      mouEnd
      partnerships
      sensitivity
      team
      budgets
      estimatedSubmission
      engagements
    }
  `
};
