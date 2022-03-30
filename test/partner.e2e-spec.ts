import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { DuplicateException, InputException } from '../src/common';
import { Role } from '../src/components/authorization/dto';
import { Partner, PartnerType } from '../src/components/partner';
import { FinancialReportingType } from '../src/components/partnership';
import {
  createOrganization,
  createPartner,
  createPerson,
  createSession,
  createTestApp,
  fragments,
  registerUser,
  runAsAdmin,
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
    const address = faker.address.city();

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
      }
    );
    const updated = result.updatePartner.partner;
    expect(updated).toBeTruthy();
    expect(updated.pointOfContact.value.id).toBe(person.id);
    expect(updated.types.value).toEqual(expect.arrayContaining(types));
    expect(updated.financialReportingTypes.value).toEqual(
      financialReportingTypes
    );
    expect(updated.pmcEntityCode.value).toEqual(pmcEntityCode);
    expect(updated.globalInnovationsClient.value).toEqual(
      globalInnovationsClient
    );
    expect(updated.active.value).toEqual(active);
    expect(updated.address.value).toEqual(address);
  });

  it('delete partner', async () => {
    const org = await createOrganization(app);
    const pt = await createPartner(app, { organizationId: org.id });
    const result = await runAsAdmin(app, async () => {
      return await app.graphql.mutate(
        gql`
          mutation deletePartner($id: ID!) {
            deletePartner(id: $id) {
              __typename
            }
          }
        `,
        {
          id: pt.id,
        }
      );
    });
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
      createPartner(app, { organizationId: org.id })
    ).rejects.toThrowError(
      new DuplicateException(
        'partner.organizationId',
        'Partner for organization already exists.'
      )
    );
  });

  it('should throw error if the pmcEntityCode is not invalid format', async () => {
    const org = await createOrganization(app);
    await expect(
      createPartner(app, { pmcEntityCode: 'AA1', organizationId: org.id })
    ).rejects.toThrowError(new InputException('Input validation failed'));

    await expect(
      createPartner(app, { pmcEntityCode: 'ABc', organizationId: org.id })
    ).rejects.toThrowError(new InputException('Input validation failed'));

    await expect(
      createPartner(app, { pmcEntityCode: 'AAAA', organizationId: org.id })
    ).rejects.toThrowError(new InputException('Input validation failed'));
  });

  it('should throw error if types & financialReportingType are mismatched', async () => {
    const org = await createOrganization(app);
    await expect(
      createPartner(app, {
        organizationId: org.id,
        types: [PartnerType.Funding],
        financialReportingTypes: [FinancialReportingType.Funded],
      })
    ).rejects.toThrowError(
      'Financial reporting type can only be applied to managing partners'
    );
  });
});
