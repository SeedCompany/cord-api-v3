import { faker } from '@faker-js/faker';
import { gql } from 'apollo-server-core';
import {
  CreateLiteracyMaterial,
  LiteracyMaterial,
} from '../../src/components/literacy-material';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createLiteracyMaterial(
  app: TestApp,
  input: Partial<CreateLiteracyMaterial> = {}
) {
  const name = input.name || faker.hacker.noun() + faker.company.name();

  const result = await app.graphql.mutate(
    gql`
      mutation createLiteracyMaterial($input: CreateLiteracyMaterialInput!) {
        createLiteracyMaterial(input: $input) {
          literacyMaterial {
            ...literacyMaterial
          }
        }
      }
      ${fragments.literacyMaterial}
    `,
    {
      input: {
        literacyMaterial: {
          ...input,
          name,
        },
      },
    }
  );
  const lm: LiteracyMaterial = result.createLiteracyMaterial.literacyMaterial;

  expect(lm).toBeTruthy();

  return lm;
}
