import { faker } from '@faker-js/faker';
import { Role } from '../src/components/authorization/dto';
import { Partner, PartnerType } from '../src/components/partner';
import { FinancialReportingType } from '../src/components/partnership';
import {
  createOrganization,
  createPartner,
  createPerson,
  createSession,
  createTestApp,
  errors,
  fragments,
  gql,
  registerUser,
  TestApp,
} from './utility';

describe('Partner e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUser(app, { roles: [Role.LeadFinancialAnalyst] });
  });

  afterAll(async () => {
    await app.close();
  });

  it('create & read partner by id', async () => {
    const org = await createOrganization(app);
    const partner = await createPartner(app, { organizationId: org.id });
    expect(partner.id).toBeDefined();
    expect(partner.organization).toBeDefined();
    expect(partner.pointOfContact).toBeDefined();
    expect(partner.modifiedAt).toBeDefined();
  });

  it('update partner', async () => {
    const org = await createOrganization(app);
    const pt = await createPartner(app, { organizationId: org.id });
    const person = await createPerson(app);
    const types = [PartnerType.Funding, PartnerType.Managing];
    const financialReportingTypes = [FinancialReportingType.FieldEngaged];
    const pmcEntityCode = faker.helpers.replaceSymbols('???').toUpperCase();
    const globalInnovationsClient = true;
    const active = true;
    const address = faker.location.city();

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
            financialReportingTypes,
            pmcEntityCode,
            globalInnovationsClient,
            active,
            address,
          },
        },
      },
    );
    const updated = result.updatePartner.partner;
    expect(updated).toBeTruthy();
    expect(updated.pointOfContact.value.id).toBe(person.id);
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
    const pt = await createPartner(app, { organizationId: org.id });
    const result = await app.graphql.mutate(
      gql`
        mutation deletePartner($id: ID!) {
          deletePartner(id: $id) {
            __typename
          }
        }
      `,
      {
        id: pt.id,
      },
    );
    const actual: Partner | undefined = result.deletePartner;
    expect(actual).toBeTruthy();
  });

  it('list view of partners', async () => {
    const org1 = await createOrganization(app);
    const org2 = await createOrganization(app);
    await createPartner(app, { organizationId: org1.id });
    await createPartner(app, { organizationId: org2.id });
    const numPartners = 2;
    const { partners } = await app.graphql.query(gql`
      query {
        partners(input: { count: 25 }) {
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

  it('should throw error if try to create duplicate partners for organization', async () => {
    const org = await createOrganization(app);
    await createPartner(app, { organizationId: org.id });
    await expect(
      createPartner(app, { organizationId: org.id }),
    ).rejects.toThrowGqlError(
      errors.duplicate({
        message: 'Partner for organization already exists.',
        field: 'partner.organizationId',
      }),
    );
  });

  it('should throw error if the pmcEntityCode is not invalid format', async () => {
    const org = await createOrganization(app);
    for (const pmc of ['AA1', 'ABc', 'AAAA']) {
      await expect(
        createPartner(app, {
          pmcEntityCode: pmc,
          organizationId: org.id,
        }),
      ).rejects.toThrowGqlError(
        errors.validation({
          'partner.pmcEntityCode': {
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
        organizationId: org.id,
        types: [PartnerType.Funding],
        financialReportingTypes: [FinancialReportingType.Funded],
      }),
    ).rejects.toThrowGqlError(
      errors.input({
        message:
          'Financial reporting type can only be applied to managing partners',
        field: 'partnership.financialReportingType',
      }),
    );
  });
});
