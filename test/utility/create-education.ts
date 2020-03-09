import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { upperFirst } from 'lodash';
import { isValid } from 'shortid';
import {
  CreateEducation,
  Degree,
  Education,
} from '../../src/components/user/education';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createEducation(
  app: TestApp,
  input: Partial<CreateEducation> = {}
) {
  const education: CreateEducation = {
    userId: input.userId!,
    degree: Degree.Associates,
    major: upperFirst(faker.hacker.adjective()) + ' Degree',
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
    }
  );

  const actual: Education = result.createEducation.education;
  expect(actual).toBeTruthy();

  expect(isValid(actual.id)).toBe(true);

  return actual;
}
