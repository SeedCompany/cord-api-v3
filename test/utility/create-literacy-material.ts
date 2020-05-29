import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import {
  CreateLiteracyMaterial,
  LiteracyMaterial,
} from '../../src/components/product/literacy-material';
import { TestApp } from './create-app';
import { fragments } from './fragments';

export async function createLiteracyMaterial(
  app: TestApp,
  input: Partial<CreateLiteracyMaterial> = {}
) {
  const name = input.name || faker.hacker.noun() + faker.company.companyName();

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
          ranges: [
            {
              start: faker.random.number(),
              end: faker.random.number(),
            },
            {
              start: faker.random.number(),
              end: faker.random.number(),
            },
          ],
        },
      },
    }
  );
  const lm: LiteracyMaterial = result.createLiteracyMaterial.literacyMaterial;

  expect(lm).toBeTruthy();

  return lm;
}
