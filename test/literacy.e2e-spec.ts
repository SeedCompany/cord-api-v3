import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { generate, isValid } from 'shortid';
import { LiteracyMaterial } from '../src/components/literacy-material';
import { createRandomScriptureReferences } from '../src/components/scripture/reference';
import {
  createLiteracyMaterial,
  createSession,
  createTestApp,
  createUser,
  fragments,
  TestApp,
} from './utility';

describe('LiteracyMaterial e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  // Create LiteracyMaterial
  it('create literacyMaterial', async () => {
    const name = faker.company.companyName();
    const scriptureReferences = createRandomScriptureReferences();
    const lm = await createLiteracyMaterial(app, { name, scriptureReferences });
    expect(lm.scriptureReferences.value).toBeDefined();
    expect(lm.scriptureReferences.value).toEqual(scriptureReferences);
  });

  // READ LiteracyMaterial
  it('create & read literacyMaterial by id', async () => {
    const name = faker.company.companyName();
    const scriptureReferences = createRandomScriptureReferences();
    const lm = await createLiteracyMaterial(app, { name, scriptureReferences });
    const { literacyMaterial: actual } = await app.graphql.query(
      gql`
        query lm($id: ID!) {
          literacyMaterial(id: $id) {
            ...literacyMaterial
          }
        }
        ${fragments.literacyMaterial}
      `,
      {
        id: lm.id,
      }
    );
    expect(actual.id).toBe(lm.id);
    expect(isValid(actual.id)).toBe(true);
    expect(actual.name.value).toBe(lm.name.value);
    expect(actual.scriptureReferences.value).toEqual(
      lm.scriptureReferences.value
    );
  });

  // UPDATE LiteracyMaterial
  it('update literacyMaterial', async () => {
    const lm = await createLiteracyMaterial(app);
    const newName = faker.company.companyName();
    const scriptureReferences = createRandomScriptureReferences();
    const result = await app.graphql.mutate(
      gql`
        mutation updateLiteracyMaterial($input: UpdateLiteracyMaterialInput!) {
          updateLiteracyMaterial(input: $input) {
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
            id: lm.id,
            name: newName,
            scriptureReferences,
          },
        },
      }
    );
    const updated = result.updateLiteracyMaterial.literacyMaterial;
    expect(updated).toBeTruthy();
    expect(updated.name.value).toBe(newName);
    expect(updated.scriptureReferences.value).toBeDefined();
    expect(updated.scriptureReferences.value).toEqual(scriptureReferences);
  });

  // DELETE literacyMaterial
  it('delete literacyMaterial', async () => {
    const fm = await createLiteracyMaterial(app);
    const result = await app.graphql.mutate(
      gql`
        mutation deleteLiteracyMaterial($id: ID!) {
          deleteLiteracyMaterial(id: $id)
        }
      `,
      {
        id: fm.id,
      }
    );
    const actual: LiteracyMaterial | undefined = result.deleteLiteracyMaterial;
    expect(actual).toBeTruthy();
  });

  // LIST LiteracyMaterials
  it('list view of LiteracyMaterials', async () => {
    // create a bunch of LiteracyMaterials
    const numLitMat = 2;
    await Promise.all(
      times(numLitMat).map(() =>
        createLiteracyMaterial(app, { name: generate() + ' Inc' })
      )
    );

    const { literacyMaterials } = await app.graphql.query(gql`
      query {
        literacyMaterials(input: { count: 15, filter: { name: "Inc" } }) {
          items {
            ...literacyMaterial
          }
          hasMore
          total
        }
      }
      ${fragments.literacyMaterial}
    `);

    expect(literacyMaterials.items.length).toBeGreaterThanOrEqual(numLitMat);
  });
});
