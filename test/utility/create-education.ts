import { faker } from '@faker-js/faker';
import { expect } from '@jest/globals';
import { upperFirst } from 'lodash';
import { isValidId } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import { type TestApp } from './create-app';
import * as fragments from './fragments';

export async function createEducation(
  app: TestApp,
  input: Partial<InputOf<typeof CreateEducationDoc>> = {},
) {
  const result = await app.graphql.mutate(CreateEducationDoc, {
    input: {
      userId: input.userId!,
      degree: 'Associates',
      major: upperFirst(faker.hacker.adjective()) + ' Degree',
      institution: faker.company.name(),
      ...input,
    },
  });

  const actual = result.createEducation.education;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}

const CreateEducationDoc = graphql(
  `
    mutation createEducation($input: CreateEducation!) {
      createEducation(input: { education: $input }) {
        education {
          ...education
        }
      }
    }
  `,
  [fragments.education],
);
