import { gql } from 'apollo-server-core';
import { sample, times } from 'lodash';
import { CalendarDate } from '../src/common';
import {
  CreatePartnership,
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
    expect(actual.organization).toEqual(partnership.organization);
    expect(actual.agreementStatus.canEdit).toBe(true);
  });

  it('update partnership', async () => {
    const partnership = await createPartnership(app);

    // lodash.sample used to grab a random enum value
    const newAgreementStatus = sample(
      Object.values(PartnershipAgreementStatus)
    );
    const newMouStatus = sample(Object.values(PartnershipAgreementStatus));
    const newTypes = [
      sample(Object.values(PartnershipType)),
      PartnershipType.Managing,
    ];

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

  it('update mou overrides partnership', async () => {
    const partnership = await createPartnership(app);

    const mouStartOverride = '1981-01-01';
    const mouEndOverride = '2020-01-01';

    const result = await app.graphql.query(
      gql`
        mutation updatePartnership(
          $id: ID!
          $startOverride: Date!
          $endOverride: Date!
        ) {
          updatePartnership(
            input: {
              partnership: {
                id: $id
                mouStartOverride: $startOverride
                mouEndOverride: $endOverride
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
        startOverride: mouStartOverride,
        endOverride: mouEndOverride,
      }
    );

    expect(result.updatePartnership.partnership.id).toBe(partnership.id);
    expect(result.updatePartnership.partnership.mouStart.value).toBe(
      mouStartOverride
    );
    expect(result.updatePartnership.partnership.mouEnd.value).toBe(
      mouEndOverride
    );
  });

  it('List view of partnerships', async () => {
    // create 2 partnerships
    const numPartnerships = 2;
    await Promise.all(times(numPartnerships).map(() => createPartnership(app)));

    const { partnerships } = await app.graphql.query(
      gql`
        query {
          partnerships {
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
      `
    );

    expect(partnerships.items.length).toBeGreaterThanOrEqual(numPartnerships);
  });

  it('List view of partnerships by projectId', async () => {
    // create 2 partnerships
    const numPartnerships = 2;

    await Promise.all(
      times(numPartnerships).map(() =>
        createPartnership(app, {
          projectId: project.id,
        })
      )
    );

    const result = await app.graphql.query(
      gql`
        query partnerships($projectId: ID!) {
          project(id: $projectId) {
            partnerships {
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
        }
      `,
      {
        projectId: project.id,
      }
    );

    expect(result.project.partnerships.items.length).toBeGreaterThanOrEqual(
      numPartnerships
    );
  });

  // skipping until we refactor consistency checks
  it.skip('Check consistency across partnership nodes', async () => {
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

  it('create partnership does not create if organizationId is invalid', async () => {
    // create bad partnership with fake project id and org id
    const badPartnership: CreatePartnership = {
      projectId: 'fakeProj',
      agreementStatus: PartnershipAgreementStatus.AwaitingSignature,
      mouStatus: PartnershipAgreementStatus.AwaitingSignature,
      types: [PartnershipType.Managing],
      organizationId: 'fakeOrg',
      mouStartOverride: CalendarDate.local(),
      mouEndOverride: CalendarDate.local(),
    };

    await expect(
      app.graphql.mutate(
        gql`
          mutation createPartnership($input: CreatePartnershipInput!) {
            createPartnership(input: $input) {
              partnership {
                ...partnership
              }
            }
          }
          ${fragments.partnership}
        `,
        {
          input: {
            partnership: badPartnership,
          },
        }
      )
    ).rejects.toThrowError();
  });

  it('should create partnership without mou dates but returns project mou dates if exists', async () => {
    const partnership = await createPartnership(app, {
      mouStartOverride: undefined,
      mouEndOverride: undefined,
      projectId: project.id,
    });

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
    expect(actual.mouStart.value).toBe(project.mouStart.value);
    expect(actual.mouEnd.value).toBe(project.mouEnd.value);
    expect(actual.types.value).toEqual(
      expect.arrayContaining(partnership.types.value)
    );
    expect(actual.organization).toBeTruthy();
    expect(actual.organization).toEqual(partnership.organization);
    expect(actual.agreementStatus.canEdit).toBe(true);
  });

  it('should create budget records if types field contains Funding', async () => {
    await createPartnership(app, {
      mouStartOverride: CalendarDate.fromISO('2020-08-01'),
      mouEndOverride: CalendarDate.fromISO('2022-08-01'),
      types: [PartnershipType.Funding, PartnershipType.Managing],
      projectId: project.id,
    });

    const result = await app.graphql.query(
      gql`
        query project($id: ID!) {
          project(id: $id) {
            ...project
            budget {
              value {
                id
                records {
                  id
                }
              }
            }
          }
        }
        ${fragments.project}
      `,
      {
        id: project.id,
      }
    );

    const actual = result.project;
    expect(actual.id).toBe(project.id);
    expect(actual.budget.value.records.length).toBe(2);
  });
});
