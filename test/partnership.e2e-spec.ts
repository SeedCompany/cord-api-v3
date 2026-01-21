import { beforeAll, describe, expect, it } from '@jest/globals';
import { sample, times } from 'lodash';
import { v1 as uuid } from 'uuid';
import { type ID, Role } from '~/common';
import { graphql } from '~/graphql';
import { PartnerType } from '../src/components/partner/dto';
import {
  FinancialReportingType,
  PartnershipAgreementStatus,
} from '../src/components/partnership/dto';
import {
  createPartner,
  createPartnership,
  createProject,
  createSession,
  createTestApp,
  errors,
  fragments,
  registerUser,
  type TestApp,
} from './utility';

describe('Partnership e2e', () => {
  let app: TestApp;
  let project: fragments.project;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, {
      roles: [Role.FieldOperationsDirector, Role.Controller],
    });

    project = await createProject(app);
  });

  it('create & read partnership by id', async () => {
    const partnership = await createPartnership(app, { project: project.id });

    const result = await app.graphql.query(
      graphql(
        `
          query partnership($id: ID!) {
            partnership(id: $id) {
              ...partnership
            }
          }
        `,
        [fragments.partnership],
      ),
      {
        id: partnership.id,
      },
    );

    const actual = result.partnership;

    expect(actual.id).toBe(partnership.id);
    expect(actual.agreementStatus.value).toBe(
      partnership.agreementStatus.value,
    );
    expect(actual.mouStatus.value).toBe(partnership.mouStatus.value);
    expect(actual.mouStart.value).toBe(partnership.mouStart.value);
    expect(actual.mouEnd.value).toBe(partnership.mouEnd.value);
    expect(actual.types.value).toEqual(
      expect.arrayContaining(partnership.types.value),
    );
    expect(actual.partner).toBeTruthy();
    expect(actual.partner).toEqual(partnership.partner);
    expect(actual.agreementStatus.canEdit).toBe(true);
  });

  it('update partnership', async () => {
    const partnership = await createPartnership(app, { project: project.id });

    // lodash.sample used to grab a random enum value
    const newAgreementStatus = sample(
      Object.values(PartnershipAgreementStatus),
    );
    const newMouStatus = sample(Object.values(PartnershipAgreementStatus));
    const newTypes = [PartnerType.Managing];

    const result = await app.graphql.query(
      graphql(
        `
          mutation updatePartnership($input: UpdatePartnership!) {
            updatePartnership(input: $input) {
              partnership {
                ...partnership
              }
            }
          }
        `,
        [fragments.partnership],
      ),
      {
        input: {
          id: partnership.id,
          agreementStatus: partnership.agreementStatus.canEdit
            ? newAgreementStatus
            : undefined,
          mouStatus: partnership.mouStatus.canEdit ? newMouStatus : undefined,
          types: partnership.types.canEdit ? newTypes : undefined,
        },
      },
    );
    expect(result.updatePartnership.partnership.id).toBe(partnership.id);
    partnership.agreementStatus.canEdit &&
      expect(result.updatePartnership.partnership.agreementStatus.value).toBe(
        newAgreementStatus,
      );
    partnership.mouStatus.canEdit &&
      expect(result.updatePartnership.partnership.mouStatus.value).toBe(
        newMouStatus,
      );
    partnership.types.canEdit &&
      expect(result.updatePartnership.partnership.types.value).toEqual(
        expect.arrayContaining(newTypes),
      );
  });

  it.skip('delete partnership', async () => {
    const partnership = await createPartnership(app, { project: project.id });
    expect(partnership.id).toBeTruthy();
    const result = await app.graphql.mutate(
      graphql(`
        mutation deletePartnership($id: ID!) {
          deletePartnership(id: $id) {
            __typename
          }
        }
      `),
      {
        id: partnership.id,
      },
    );

    const actual = result.deletePartnership;
    expect(actual).toBeTruthy();
    await app.graphql
      .query(
        graphql(
          `
            query partnership($id: ID!) {
              partnership(id: $id) {
                ...partnership
              }
            }
          `,
          [fragments.partnership],
        ),
        {
          id: partnership.id,
        },
      )
      .expectError(errors.notFound());
  });

  it('update mou overrides partnership', async () => {
    const partnership = await createPartnership(app, { project: project.id });

    const mouStartOverride = '1981-01-01';
    const mouEndOverride = '2020-01-01';

    const result = await app.graphql.query(
      graphql(
        `
          mutation updatePartnership($input: UpdatePartnership!) {
            updatePartnership(input: $input) {
              partnership {
                ...partnership
              }
            }
          }
        `,
        [fragments.partnership],
      ),
      {
        input: {
          id: partnership.id,
          mouStartOverride,
          mouEndOverride,
        },
      },
    );

    expect(result.updatePartnership.partnership.id).toBe(partnership.id);
    expect(result.updatePartnership.partnership.mouStart.value).toBe(
      mouStartOverride,
    );
    expect(result.updatePartnership.partnership.mouEnd.value).toBe(
      mouEndOverride,
    );
  });

  it('List view of partnerships', async () => {
    // create 2 partnerships
    const numPartnerships = 2;
    await Promise.all(
      times(numPartnerships).map(() =>
        createPartnership(app, { project: project.id }),
      ),
    );

    const { partnerships } = await app.graphql.query(
      graphql(`
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
      `),
    );

    expect(partnerships.items.length).toBeGreaterThanOrEqual(numPartnerships);
  });

  it('List view of partnerships by projectId', async () => {
    // create 2 partnerships
    const numPartnerships = 2;
    await Promise.all(
      times(numPartnerships).map(() =>
        createPartnership(app, {
          project: project.id,
        }),
      ),
    );

    const result = await app.graphql.query(
      graphql(`
        query partnerships($project: ID!) {
          project(id: $project) {
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
      `),
      {
        project: project.id,
      },
    );

    expect(result.project.partnerships.items.length).toBeGreaterThanOrEqual(
      numPartnerships,
    );
  });

  it('create partnership does not create if partner id is invalid', async () => {
    await expect(
      createPartnership(app, {
        project: project.id,
        partner: uuid() as ID,
      }),
    ).rejects.toThrowGqlError(
      errors.notFound({
        message: 'Could not find partner',
        field: 'partner',
      }),
    );
  });

  it('create partnership does not create if project id is invalid', async () => {
    await expect(
      createPartnership(app, {
        project: uuid() as ID,
      }),
    ).rejects.toThrowGqlError(
      errors.notFound({
        message: 'Could not find project',
        field: 'project',
      }),
    );
  });

  it('should create partnership without mou dates but returns project mou dates if exists', async () => {
    const partnership = await createPartnership(app, {
      mouStartOverride: undefined,
      mouEndOverride: undefined,
      project: project.id,
    });

    const result = await app.graphql.query(
      graphql(
        `
          query partnership($id: ID!) {
            partnership(id: $id) {
              ...partnership
            }
          }
        `,
        [fragments.partnership],
      ),
      {
        id: partnership.id,
      },
    );

    const actual = result.partnership;

    expect(actual.id).toBe(partnership.id);
    expect(actual.agreementStatus.value).toBe(
      partnership.agreementStatus.value,
    );
    expect(actual.mouStatus.value).toBe(partnership.mouStatus.value);
    expect(actual.mouStart.value).toBe(project.mouStart.value);
    expect(actual.mouEnd.value).toBe(project.mouEnd.value);
    expect(actual.types.value).toEqual(
      expect.arrayContaining(partnership.types.value),
    );
    expect(actual.partner).toBeTruthy();
    expect(actual.partner).toEqual(partnership.partner);
    expect(actual.agreementStatus.canEdit).toBe(true);
  });

  it('should create budget records if types field contains Funding', async () => {
    await createPartnership(app, {
      mouStartOverride: '2020-08-01',
      mouEndOverride: '2022-08-01',
      types: [PartnerType.Funding, PartnerType.Managing],
      project: project.id,
    });

    const result = await app.graphql.query(
      graphql(
        `
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
        `,
        [fragments.project],
      ),
      {
        id: project.id,
      },
    );

    const actual = result.project;
    expect(actual.id).toBe(project.id);
    expect(actual.budget.value!.records.length).toBe(3);
  });

  it('should throw error if financialReportingType is not subset of its Partner financialReportingTypes on create', async () => {
    const partner = await createPartner(app, {
      types: [PartnerType.Funding],
      financialReportingTypes: [],
    });

    await expect(
      createPartnership(app, {
        partner: partner.id,
        financialReportingType: FinancialReportingType.Funded,
      }),
    ).rejects.toThrowGqlError(
      errors.input({
        message:
          'Partner does not have this financial reporting type available',
        field: 'financialReportingType',
      }),
    );
  });

  it('should throw error if financialReportingType is not subset of its Partner financialReportingTypes on update', async () => {
    const partner = await createPartner(app, {
      types: [PartnerType.Funding],
      financialReportingTypes: [],
    });

    const partnership = await createPartnership(app, {
      partner: partner.id,
      financialReportingType: undefined,
    });

    await expect(
      app.graphql.mutate(
        graphql(
          `
            mutation updatePartnership($input: UpdatePartnership!) {
              updatePartnership(input: $input) {
                partnership {
                  ...partnership
                }
              }
            }
          `,
          [fragments.partnership],
        ),
        {
          input: {
            id: partnership.id,
            financialReportingType: FinancialReportingType.Funded,
          },
        },
      ),
    ).rejects.toThrowGqlError(
      errors.input({
        message:
          'Partner does not have this financial reporting type available',
        field: 'financialReportingType',
      }),
    );
  });

  it('should throw error if partnership is already created with same project and partner', async () => {
    const partner = await createPartner(app);
    const project = await createProject(app);

    await createPartnership(app, {
      partner: partner.id,
      project: project.id,
    });

    await expect(
      createPartnership(app, {
        partner: partner.id,
        project: project.id,
      }),
    ).rejects.toThrowGqlError(
      errors.duplicate({
        message: 'Partnership for this project and partner already exists',
        field: 'project',
      }),
    );
  });

  it('primary partnership logic', async () => {
    const project = await createProject(app);
    let partnership1 = await createPartnership(app, {
      project: project.id,
      primary: true,
    });
    let partnership2 = await createPartnership(app, {
      project: project.id,
      primary: true,
    });
    let partnership3 = await createPartnership(app, {
      project: project.id,
      primary: true,
    });

    const getPartnershipById = async (partnership: ID) => {
      const result = await app.graphql.query(
        graphql(
          `
            query partnership($id: ID!) {
              partnership(id: $id) {
                ...partnership
              }
            }
          `,
          [fragments.partnership],
        ),
        {
          id: partnership,
        },
      );
      return result.partnership;
    };

    const deletePartnership = async (partnership: ID): Promise<void> => {
      await app.graphql.mutate(
        graphql(`
          mutation deletePartnership($id: ID!) {
            deletePartnership(id: $id) {
              __typename
            }
          }
        `),
        {
          id: partnership,
        },
      );
    };

    partnership1 = await getPartnershipById(partnership1.id);
    partnership2 = await getPartnershipById(partnership2.id);
    partnership3 = await getPartnershipById(partnership3.id);
    expect(partnership1.primary.value).toBe(false);
    expect(partnership2.primary.value).toBe(false);
    expect(partnership3.primary.value).toBe(true);

    // update partnership2 primary to true, check others' primary is false
    await app.graphql.query(
      graphql(
        `
          mutation updatePartnership($input: UpdatePartnership!) {
            updatePartnership(input: $input) {
              partnership {
                ...partnership
              }
            }
          }
        `,
        [fragments.partnership],
      ),
      {
        input: {
          id: partnership2.id,
          primary: true,
        },
      },
    );
    partnership1 = await getPartnershipById(partnership1.id);
    partnership2 = await getPartnershipById(partnership2.id);
    partnership3 = await getPartnershipById(partnership3.id);
    expect(partnership1.primary.value).toBe(false);
    expect(partnership2.primary.value).toBe(true);
    expect(partnership3.primary.value).toBe(false);

    // delete primary partnership, throw error if it's not the only one
    await expect(deletePartnership(partnership2.id)).rejects.toThrowGqlError(
      errors.input({
        message:
          'Primary partnerships cannot be removed. Make another partnership primary first.',
      }),
    );

    await deletePartnership(partnership1.id);
    await expect(deletePartnership(partnership2.id)).rejects.toThrowGqlError(
      errors.input({
        message:
          'Primary partnerships cannot be removed. Make another partnership primary first.',
      }),
    );

    await deletePartnership(partnership3.id);
    await deletePartnership(partnership2.id);
  });
});
