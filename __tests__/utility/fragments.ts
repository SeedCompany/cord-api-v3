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
};
