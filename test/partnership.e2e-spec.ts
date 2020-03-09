import {
  createTestApp,
  TestApp,
  createSession,
  createUser,
  fragments,
} from './utility';
import { createPartnership } from './utility/create-partnership';
import { gql } from 'apollo-server-core';
import {
  Partnership,
  PartnershipAgreementStatus,
  PartnershipType,
} from '../src/components/partnership';
import { sample, times } from 'lodash';

describe('Partnership e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('create & partnership by id', async () => {
    const partnership = await createPartnership(app);

    const result = await app.graphql.query(
      gql`
        query partnership($id: ID!) {
          partnership(id: $id) {
            ...partnership
          }
        }
        ${fragments.partnership}
      `,
      {
        id: partnership.id,
      }
    );

    const actual: Partnership = result.partnership;
    expect(actual.id).toBe(partnership.id);
    expect(actual.agreementStatus.value).toBe(
      partnership.agreementStatus.value
    );
    expect(actual.mouStatus.value).toBe(partnership.mouStatus.value);
    expect(actual.mouStart).toMatchObject(partnership.mouStart);
    expect(actual.mouEnd).toMatchObject(partnership.mouEnd);
    expect(actual.types).toEqual(expect.arrayContaining(partnership.types));
    expect(actual.organization).toBeTruthy();
    expect(actual.organization?.id).toBe(partnership.organization?.id);
  });

  it('update partnership', async () => {
    const partnership = await createPartnership(app);

    // lodash.sample used to grab a random enum value
    const newAgreementStatus = sample(
      Object.values(PartnershipAgreementStatus)
    );
    const newMouStatus = sample(Object.values(PartnershipAgreementStatus));
    const newTypes = [sample(Object.values(PartnershipType))];

    const result = await app.graphql.query(
      gql`
        mutation updatePartnership(
          $id: ID!
          $agreementStatus: PartnershipAgreementStatus!
          $mouStatus: PartnershipAgreementStatus!
          $types: [PartnershipType!]!
        ) {
          updatePartnership(
            input: {
              partnership: {
                id: $id
                agreementStatus: $agreementStatus
                mouStatus: $mouStatus
                types: $types
              }
            }
          ) {
            partnership {
              ...partnership
            }
          }
        }
        ${fragments.partnership}
      `,
      {
        id: partnership.id,
        agreementStatus: newAgreementStatus,
        mouStatus: newMouStatus,
        types: newTypes,
      }
    );

    expect(result.updatePartnership.partnership.id).toBe(partnership.id);
    expect(result.updatePartnership.partnership.agreementStatus.value).toBe(
      newAgreementStatus
    );
    expect(result.updatePartnership.partnership.mouStatus.value).toBe(
      newMouStatus
    );
    expect(result.updatePartnership.partnership.types).toEqual(
      expect.arrayContaining(newTypes)
    );
  });

  it('delete partnership', async () => {
    const partnership = await createPartnership(app);
    expect(partnership.id).toBeTruthy();
    const result = await app.graphql.mutate(
      gql`
        mutation deletePartnership($id: ID!) {
          deletePartnership(id: $id)
        }
      `,
      {
        id: partnership.id,
      }
    );

    const actual: boolean | undefined = result.deletePartnership;
    expect(actual).toBeTruthy();
    try {
      await app.graphql.query(
        gql`
          query partnership($id: ID!) {
            partnership(id: $id) {
              ...partnership
            }
          }
          ${fragments.partnership}
        `,
        {
          id: partnership.id,
        }
      );
    } catch (e) {
      expect(e.response.statusCode).toBe(404);
    }
  });

  it('List view of partnerships', async () => {
    // create 10 partnerships
    const numPartnerships = 10;
    const agreementStatus = PartnershipAgreementStatus.Signed;
    await Promise.all(
      times(numPartnerships).map(() =>
        createPartnership(app, {
          agreementStatus,
        })
      )
    );

    const { partnerships } = await app.graphql.query(
      gql`
        query partnerships($agreementStatus: PartnershipAgreementStatus!) {
          partnerships(
            input: { filter: { agreementStatus: $agreementStatus } }
          ) {
            items {
              ...partnership
            }
            hasMore
            total
          }
        }
        ${fragments.partnership}
      `,
      {
        agreementStatus,
      }
    );

    expect(partnerships.items.length).toBeGreaterThanOrEqual(numPartnerships);
  });
});
