import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { Powers } from '../src/components/authorization/dto/powers';
import { Partner, PartnerType } from '../src/components/partner';
import {
  createPartner,
  createPerson,
  createSession,
  createTestApp,
  createUser,
  fragments,
  grantPower,
  login,
  TestApp,
} from './utility';

describe('Partner e2e', () => {
  let app: TestApp;
  const password: string = faker.internet.password();

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    const user = await createUser(app, { password });
    await grantPower(app, user.id, Powers.CreateOrganization);
    await login(app, { email: user.email.value, password });
  });

  afterAll(async () => {
    await app.close();
  });

  it('create & read partner by id ', async () => {
    const partner = await createPartner(app);
    expect(partner.id).toBeDefined();
    expect(partner.organization).toBeDefined();
    expect(partner.pointOfContact).toBeDefined();
  });

  it('update partner', async () => {
    const pt = await createPartner(app);
    const person = await createPerson(app);
    const types = [PartnerType.Funding];
    const result = await app.graphql.mutate(
      gql`
        mutation updatePartner($input: UpdatePartnerInput!) {
          updatePartner(input: $input) {
            partner {
              ...partner
            }
          }
        }
        ${fragments.partner}
      `,
      {
        input: {
          partner: {
            id: pt.id,
            pointOfContactId: person.id,
            types,
          },
        },
      }
    );
    const updated = result.updatePartner.partner;
    expect(updated).toBeTruthy();
    expect(updated.pointOfContact.value.id).toBe(person.id);
    expect(updated.types.value).toEqual(expect.arrayContaining(types));
  });

  it('delete partner', async () => {
    const pt = await createPartner(app);
    const result = await app.graphql.mutate(
      gql`
        mutation deletePartner($id: ID!) {
          deletePartner(id: $id)
        }
      `,
      {
        id: pt.id,
      }
    );
    const actual: Partner | undefined = result.deletePartner;
    expect(actual).toBeTruthy();
  });

  it('list view of partners', async () => {
    const numPartners = 2;
    await Promise.all(times(numPartners).map(() => createPartner(app)));

    const { partners } = await app.graphql.query(gql`
      query {
        partners(input: { count: 25, page: 1 }) {
          items {
            ...partner
          }
          hasMore
          total
        }
      }
      ${fragments.partner}
    `);

    expect(partners.items.length).toBeGreaterThanOrEqual(numPartners);
  });
});
