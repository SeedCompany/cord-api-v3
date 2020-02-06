import { gql } from 'apollo-server-core';
import {
  CreateEducation,
  Education,
} from '../../src/components/user/education';
import { TestApp } from './create-app';
import * as faker from 'faker';
import { fragments } from './fragments';

export async function createEducation(
  app: TestApp,
  input: Partial<CreateEducation> = {},
) {
  const institution = input.institution || faker.company.companyName();

  const result = await app.graphql.mutate(
    gql`
      mutation createEducation($input: CreateEducationInput!) {
        createEducation(input: $input) {
          education {
            ...educt
          }
        }
      }
      ${fragments.educt}
    `,
    {
      input: {
        education: {
          ...input,
          institution,
        },
      },
    },
  );
  const educt: Education | undefined = result.createEducation?.education;

  expect(educt).toBeTruthy();

  return educt;
}
