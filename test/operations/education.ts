import { faker } from '@faker-js/faker';
import { expect } from '@jest/globals';
import { upperFirst } from 'lodash';
import { isValidId } from '~/common';
import { graphql, type InputOf } from '~/graphql';
import type { IdentifiedTester } from '../setup';
import { fragments } from '../utility';

type EduInput = Partial<InputOf<typeof CreateEduDoc>>;

export const createEducation =
  (input?: EduInput) => async (tester: IdentifiedTester) => {
    const result = await tester.run(CreateEduDoc, {
      input: {
        user: tester.identity.id,
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
  };

const CreateEduDoc = graphql(
  `
    mutation createEducation($input: CreateEducation!) {
      createEducation(input: $input) {
        education {
          ...education
        }
      }
    }
  `,
  [fragments.education],
);
