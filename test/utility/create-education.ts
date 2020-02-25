import * as faker from 'faker';

import { CreateEducation, Education, Degree } from '../../src/components/user/education';

import { DateTime } from 'luxon';
import { TestApp } from './create-app';
import { createUser } from './create-user';
import { fragments } from './fragments';
import { gql } from 'apollo-server-core';
import { isValid } from 'shortid';

export async function createEducation(
  app: TestApp,
  input: Partial<CreateEducation> = {},
) {
  const education: CreateEducation = {
    userId: input.userId,
    degree: Degree.Associates,
    major: faker.hacker.adjective() + ' Degree',
    institution: faker.company.companyName(),
    ...input,
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
        education: {
          ...education,
        },
      },
    },
  );

  const actual: Education | undefined = result?.createEducation?.education;
  expect(actual).toBeTruthy();

  expect(isValid(actual?.id)).toBe(true);

  return actual;
}
