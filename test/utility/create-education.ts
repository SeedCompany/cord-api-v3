import { faker } from '@faker-js/faker';
import { upperFirst } from 'lodash';
import { isValidId } from '~/common';
import {
  CreateEducation,
  Degree,
  Education,
} from '../../src/components/user/education/dto';
import { TestApp } from './create-app';
import { fragments } from './fragments';
import { gql } from './gql-tag';

export async function createEducation(
  app: TestApp,
  input: Partial<CreateEducation> = {},
) {
  const education: CreateEducation = {
    userId: input.userId!,
    degree: Degree.Associates,
    major: upperFirst(faker.hacker.adjective()) + ' Degree',
    institution: faker.company.name(),
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

  const actual: Education = result.createEducation.education;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}
