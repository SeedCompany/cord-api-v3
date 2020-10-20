import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { times } from 'lodash';
import { InputException } from '../src/common';
import { Powers } from '../src/components/authorization/dto/powers';
import { Partner, PartnerType } from '../src/components/partner';
import { FinancialReportingType } from '../src/components/partnership';
import {
  createPartner,
  createPerson,
  createSession,
  createTestApp,
  fragments,
  registerUserWithPower,
  TestApp,
} from './utility';

describe('Partner e2e', () => {
  let app: TestApp;

  beforeAll(async () => {
    app = await createTestApp();
    await createSession(app);
    await registerUserWithPower(app, [Powers.CreateOrganization]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('create & read partner by id', async () => {
    const partner = await createPartner(app);
    expect(partner.id).toBeDefined();
    expect(partner.organization).toBeDefined();
    expect(partner.pointOfContact).toBeDefined();
    expect(partner.modifiedAt).toBeDefined();
  });

  it('update partner', async () => {
    const pt = await createPartner(app);
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

  it('should throw error if the pmcEntityCode is not invalid format', async () => {
    await expect(
      createPartner(app, { pmcEntityCode: 'AA1' })
    ).rejects.toThrowError(new InputException('Input validation failed'));

    await expect(
      createPartner(app, { pmcEntityCode: 'ABc' })
    ).rejects.toThrowError(new InputException('Input validation failed'));

    await expect(
      createPartner(app, { pmcEntityCode: 'AAAA' })
    ).rejects.toThrowError(new InputException('Input validation failed'));
  });

  it('should throw error if types & financialReportingType are mismatched', async () => {
    await expect(
      createPartner(app, {
        types: [PartnerType.Funding],
        financialReportingTypes: [FinancialReportingType.Funded],
      })
    ).rejects.toThrowError(
      'Financial reporting type can only be applied to managing partners'
    );
  });
});
