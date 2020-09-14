import { gql } from 'apollo-server-core';
import { times } from 'lodash';
import { Partner } from '../src/components/partner';
import {
  createPartner,
  createSession,
  createTestApp,
  createUser,
  fragments,
  TestApp,
} from './utility';

describe('Partner e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('create & read partner by id ', async () => {
    const partner = await createPartner(app);
    expect(partner.id).toBeDefined();
    expect(partner.organization).toBeDefined();
  });

  it('update partner', async () => {
    const pt = await createPartner(app);
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
          },
        },
      }
    );
    const updated = result.updatePartner.partner;
    expect(updated).toBeTruthy();
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
