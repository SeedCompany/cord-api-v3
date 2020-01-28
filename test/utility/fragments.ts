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
    fragment user on CreateUserOutput {
      id
      email
      displayFirstName
      displayLastName
      realFirstName
      realLastName
    }
  `,
};
