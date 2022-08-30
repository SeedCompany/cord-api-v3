import { faker } from '@faker-js/faker';
import { times } from 'lodash';
import { isValidId } from '../src/common';
import { Role } from '../src/components/authorization/dto/role.dto';
import { LiteracyMaterial } from '../src/components/literacy-material';
import { ScriptureRange } from '../src/components/scripture';
import {
  createLiteracyMaterial,
  createSession,
  createTestApp,
  fragments,
  gql,
  registerUser,
  TestApp,
} from './utility';

describe('LiteracyMaterial e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, { roles: [Role.FieldOperationsDirector] });
  });

  afterAll(async () => {
    await app.close();
  });

  // Create LiteracyMaterial
  it('create literacyMaterial', async () => {
    const name = faker.company.name();
    const scriptureReferences = ScriptureRange.randomList();
    const lm = await createLiteracyMaterial(app, { name, scriptureReferences });
    expect(lm.scriptureReferences.value).toBeDefined();
    expect(lm.scriptureReferences.value).toEqual(
      expect.arrayContaining(scriptureReferences)
    );
  });

  // READ LiteracyMaterial
  it('create & read literacyMaterial by id', async () => {
    const name = faker.company.name();
    const scriptureReferences = ScriptureRange.randomList();
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
    expect(isValidId(actual.id)).toBe(true);
    expect(actual.name.value).toBe(lm.name.value);
    expect(actual.scriptureReferences.value).toEqual(
      expect.arrayContaining(lm.scriptureReferences.value)
    );
  });

  // UPDATE LiteracyMaterial
  it('update literacyMaterial', async () => {
    const lm = await createLiteracyMaterial(app);
    const newName = faker.company.name();
    const scriptureReferences = ScriptureRange.randomList();
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
    expect(updated.scriptureReferences.value).toEqual(
      expect.arrayContaining(scriptureReferences)
    );
  });

  // DELETE literacyMaterial
  it.skip('delete literacyMaterial', async () => {
    const fm = await createLiteracyMaterial(app);
    const result = await app.graphql.mutate(
      gql`
        mutation deleteLiteracyMaterial($id: ID!) {
          deleteLiteracyMaterial(id: $id) {
            __typename
          }
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
    const numLitMat = 2;
    await Promise.all(times(2).map(() => createLiteracyMaterial(app)));

    const { literacyMaterials } = await app.graphql.query(gql`
      query {
        literacyMaterials(input: { count: 15 }) {
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
