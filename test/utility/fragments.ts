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
};
