import { gql } from 'apollo-server-core';
import { sample, times } from 'lodash';
import {
  Partnership,
  PartnershipAgreementStatus,
  PartnershipType,
} from '../src/components/partnership';
import { Project } from '../src/components/project/dto';
import {
  createProject,
  createSession,
  createTestApp,
  createUser,
  expectNotFound,
  fragments,
  Raw,
  TestApp,
} from './utility';
import { createPartnership } from './utility/create-partnership';

describe('Partnership e2e', () => {
  let app: TestApp;
  let project: Raw<Project>;

  beforeAll(async () => {
    jest.setTimeout(50000);
    app = await createTestApp();
    await createSession(app);
    await createUser(app);
    project = await createProject(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('create & read partnership by id', async () => {
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
        projectId: project.id,
      }
    );

    const actual: Partnership = result.partnership;

    expect(actual.id).toBe(partnership.id);
    expect(actual.agreementStatus.value).toBe(
      partnership.agreementStatus.value
    );
    expect(actual.mouStatus.value).toBe(partnership.mouStatus.value);
    expect(actual.mouStart.value).toBe(partnership.mouStart.value);
    expect(actual.mouEnd.value).toBe(partnership.mouEnd.value);
    expect(actual.types.value).toEqual(
      expect.arrayContaining(partnership.types.value)
    );
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
    expect(result.updatePartnership.partnership.types.value).toEqual(
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
    await expectNotFound(
      app.graphql.query(
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
      )
    );
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
              id
              agreementStatus {
                value
              }
            }
            hasMore
            total
          }
        }
      `,
      {
        agreementStatus,
      }
    );

    expect(partnerships.items.length).toBeGreaterThanOrEqual(numPartnerships);
  });
  it('List view of partnerships by projectId', async () => {
    // create 10 partnerships
    const numPartnerships = 10;

    await Promise.all(
      times(numPartnerships).map(() =>
        createPartnership(app, {
          projectId: project.id,
        })
      )
    );

    const { partnerships } = await app.graphql.query(
      gql`
        query partnerships($projectId: ID!) {
          partnerships(input: { filter: { projectId: $projectId } }) {
            items {
              id
              agreementStatus {
                value
              }
            }
            hasMore
            total
          }
        }
      `,
      {
        projectId: project.id,
      }
    );

    expect(partnerships.items.length).toBeGreaterThanOrEqual(numPartnerships);
  });

  it('Check consistency across partnership nodes', async () => {
    // create a partnership
    const partnership = await createPartnership(app);
    // test it has proper schema
    const result = await app.graphql.query(gql`
      query {
        checkPartnershipConsistency
      }
    `);
    expect(result.checkPartnershipConsistency).toBeTruthy();
    // delete partnership node so next test will pass
    await app.graphql.mutate(
      gql`
        mutation deletePartnership($id: ID!) {
          deletePartnership(id: $id)
        }
      `,
      {
        id: partnership.id,
      }
    );
  });
});
