import { gql } from 'apollo-server-core';
import {
  CreateEducation,
  Education,
  Degree,
} from '../../src/components/user/education';
import { TestApp } from './create-app';
import * as faker from 'faker';
import { fragments } from './fragments';
import { IRequestUser } from '../../src/common';

export async function createEducation(
  app: TestApp,
  userId: string,
) {
  const education: CreateEducation = {
    userId,
    degree: Degree.Associates,
    major: faker.hacker.adjective() + ' Degree',
    institution: faker.company.companyName(),
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createEducation($input: CreateEducationInput!) {
        createEducation(input: $input) {
          education {
            ...education
          }
        }
      }
      ${fragments.education}
    `,
    {
      input: {
        education,
      },
    },
  );
  const actual: Education | undefined = result.createEducation?.education;

  expect(actual).toBeTruthy();

  return actual;
}
