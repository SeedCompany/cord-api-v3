import { faker } from '@faker-js/faker';
import { beforeAll, describe, expect, it } from '@jest/globals';
import { Role } from '~/common';
import { graphql } from '~/graphql';
import { PartnerType } from '../src/components/partner/dto';
import { FinancialReportingType } from '../src/components/partnership/dto';
import {
  createOrganization,
  createPartner,
  createPartnership,
  createPerson,
  createProject,
  createSession,
  createTestApp,
  errors,
  fragments,
  registerUser,
  runAsAdmin,
  type TestApp,
} from './utility';

describe('Partner e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, { roles: [Role.LeadFinancialAnalyst] });
  });

  // Sensitivity is derived from the projects a partner is connected to — the
  // lowest of them, or High when there are none. Neo4j works this out on every
  // read. Postgres kept a stored column that nothing updated, so a partner's
  // sensitivity was frozen at whatever it was created or migrated with.
  //
  // The second half is what makes this test worth having. Reading a partner
  // that already had the right value proves nothing, because the stored column
  // was right at rest — it only went wrong once the connected projects changed,
  // and no read-only comparison between the two databases could see that.
  it('derives sensitivity from its projects, and follows them when they change', async () => {
    const partner = await runAsAdmin(app, () => createPartner(app));

    const readSensitivity = async () => {
      const { partner: read } = await app.graphql.query(
        graphql(`
          query partner($id: ID!) {
            partner(id: $id) {
              sensitivity
            }
          }
        `),
        { id: partner.id },
      );
      return read.sensitivity;
    };

    // No projects yet, so the most restrictive answer.
    expect(await readSensitivity()).toBe('High');

    // Connecting a Low project has to lower it. This is the assertion that
    // fails when sensitivity is read from the stored column: the partnership
    // is created, nothing recomputes, and the partner stays High.
    await runAsAdmin(app, async () => {
      const project = await createProject(app, {
        type: 'Internship',
        sensitivity: 'Low',
      });
      await createPartnership(app, {
        project: project.id,
        partner: partner.id,
      });
    });

    expect(await readSensitivity()).toBe('Low');
  });

  it('create & read partner by id', async () => {
    const org = await createOrganization(app);
    const partner = await createPartner(app, { organization: org.id });
    expect(partner.id).toBeDefined();
    expect(partner.organization).toBeDefined();
    expect(partner.pointOfContact).toBeDefined();
    expect(partner.modifiedAt).toBeDefined();
  });

  it('update partner', async () => {
    const org = await createOrganization(app);
    const pt = await createPartner(app, { organization: org.id });
    const person = await createPerson(app);
    const types = [PartnerType.Funding, PartnerType.Managing];
    const financialReportingTypes = [FinancialReportingType.FieldEngaged];
    const pmcEntityCode = faker.helpers.replaceSymbols('???').toUpperCase();
    const globalInnovationsClient = true;
    const active = true;
    const address = faker.location.city();

    const result = await app.graphql.mutate(
      graphql(
        `
          mutation updatePartner($input: UpdatePartner!) {
            updatePartner(input: $input) {
              partner {
                ...partner
              }
            }
          }
        `,
        [fragments.partner],
      ),
      {
        input: {
          id: pt.id,
          pointOfContact: person.id,
          types,
          financialReportingTypes,
          pmcEntityCode,
          globalInnovationsClient,
          active,
          address,
        },
      },
    );
    const updated = result.updatePartner.partner;
    expect(updated).toBeTruthy();
    expect(updated.pointOfContact.value!.id).toBe(person.id);
    expect(updated.types.value).toEqual(expect.arrayContaining(types));
    expect(updated.financialReportingTypes.value).toEqual(
      financialReportingTypes,
    );
    expect(updated.pmcEntityCode.value).toEqual(pmcEntityCode);
    expect(updated.globalInnovationsClient.value).toEqual(
      globalInnovationsClient,
    );
    expect(updated.active.value).toEqual(active);
    expect(updated.address.value).toEqual(address);
  });

  it('delete partner', async () => {
    const org = await createOrganization(app);
    const pt = await createPartner(app, { organization: org.id });

    await runAsAdmin(app, async () => {
      await app.graphql.mutate(
        graphql(`
          mutation deletePartner($id: ID!) {
            deletePartner(id: $id) {
              __typename
            }
          }
        `),
        {
          id: pt.id,
        },
      );
    });
  });

  it('list view of partners', async () => {
    const org1 = await createOrganization(app);
    const org2 = await createOrganization(app);
    await createPartner(app, { organization: org1.id });
    await createPartner(app, { organization: org2.id });
    const numPartners = 2;
    const { partners } = await app.graphql.query(
      graphql(
        `
          query {
            partners(input: { count: 25 }) {
              items {
                ...partner
              }
              hasMore
              total
            }
          }
        `,
        [fragments.partner],
      ),
    );

    expect(partners.items.length).toBeGreaterThanOrEqual(numPartners);
  });

  it('should throw error if try to create duplicate partners for organization', async () => {
    const org = await createOrganization(app);
    await createPartner(app, { organization: org.id });
    await expect(
      createPartner(app, { organization: org.id }),
    ).rejects.toThrowGqlError(
      errors.duplicate({
        message: 'Partner for organization already exists.',
        field: 'organization',
      }),
    );
  });

  it('should throw error if the pmcEntityCode is not invalid format', async () => {
    const org = await createOrganization(app);
    for (const pmc of ['AA1', 'ABc', 'AAAA']) {
      await expect(
        createPartner(app, {
          pmcEntityCode: pmc,
          organization: org.id,
        }),
      ).rejects.toThrowGqlError(
        errors.validation({
          pmcEntityCode: {
            matches: 'Must be 3 uppercase letters',
          },
        }),
      );
    }
  });

  it('should throw error if types & financialReportingType are mismatched', async () => {
    const org = await createOrganization(app);
    await expect(
      createPartner(app, {
        organization: org.id,
        types: [PartnerType.Funding],
        financialReportingTypes: [FinancialReportingType.Funded],
      }),
    ).rejects.toThrowGqlError(
      errors.input({
        message:
          'Financial reporting type can only be applied to managing partners',
        field: 'financialReportingType',
      }),
    );
  });

  it('lists people on a partner via organization membership', async () => {
    const org = await createOrganization(app);
    const poc = await createPerson(app);
    const partner = await createPartner(app, {
      organization: org.id,
      pointOfContact: poc.id,
    });

    const otherUser = await createPerson(app);
    const unrelatedUser = await createPerson(app);
    await runAsAdmin(app, async () => {
      await app.graphql.mutate(AssignOrgToUserDoc, {
        org: org.id,
        user: otherUser.id,
      });
      await app.graphql.mutate(AssignOrgToUserDoc, {
        org: org.id,
        user: poc.id,
      });
    });

    const result = await app.graphql.query(
      graphql(`
        query partnerPeople($id: ID!) {
          partner(id: $id) {
            pointOfContact {
              value {
                id
              }
            }
            people(input: { count: 25 }) {
              canRead
              canCreate
              total
              hasMore
              items {
                id
              }
            }
          }
        }
      `),
      { id: partner.id },
    );

    const list = result.partner.people;
    expect(list.canRead).toBe(true);
    const userIds = list.items.map((u) => u.id);
    expect(userIds).toEqual(expect.arrayContaining([poc.id, otherUser.id]));
    expect(userIds).not.toContain(unrelatedUser.id);
    expect(result.partner.pointOfContact.value?.id).toBe(poc.id);
  });
});

const AssignOrgToUserDoc = graphql(`
  mutation assignOrgToUserForPartnerPeople($org: ID!, $user: ID!) {
    assignOrganizationToUser(org: $org, user: $user) {
      __typename
    }
  }
`);
