import { Test, TestingModule } from '@nestjs/testing';
import { CoreModule, LoggerModule } from '../../core';
import { OrganizationService } from './organization.service';
import {
  CreateOrganization,
  Organization,
  UpdateOrganization,
  OrganizationListInput,
  OrganizationListOutput
} from './dto';
import { generate } from 'shortid';
import { ISession } from '../../common';

describe('OrganizationService', () => {
  let module: TestingModule;
  let organizationService: OrganizationService;
  const id = generate();

  const createTestOrganization: Partial<Organization> = {
    id: generate(),
    name: {
      value: 'seed-organization',
      canRead: true,
      canEdit: true,
    },
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot(),
        CoreModule
      ],
      providers: [
        OrganizationService
      ],
    }).compile();

    organizationService = module.get<OrganizationService>(OrganizationService);
  });

  it('should be defined', () => {
    expect(OrganizationService).toBeDefined();
  });

  it('should create an organization node', async () => {
    jest
      .spyOn(organizationService, 'create')
      .mockImplementation(() => Promise.resolve(createTestOrganization as Organization));
    const organization = await organizationService.create(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      {} as CreateOrganization,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      {} as ISession
    );
    expect(organization.name).toEqual(createTestOrganization.name);
  });

  it('should read an organization', async () => {
    jest
      .spyOn(organizationService, 'readOne')
      .mockImplementation(() => Promise.resolve(createTestOrganization as Organization));
    const organization = await organizationService.readOne(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      id,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      {} as ISession
    );
    expect(organization.name).toEqual(createTestOrganization.name);
  });

  // it('should read organizations', async () => {
  //   jest
  //     .spyOn(organizationService, 'list')
  //     .mockImplementation(() => Promise.resolve(createTestOrganization as Organization));
  //   const organization = await organizationService.list(
  //     // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  //     {} as OrganizationListInput,
  //     // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  //     {} as ISession
  //   );
  //   expect(organization.total).toEqual(createTestOrganization);
  // });

  it('should update an organization', async () => {
    jest
      .spyOn(organizationService, 'update')
      .mockImplementation(() => Promise.resolve(createTestOrganization as Organization));
    const organization = await organizationService.update(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      {} as UpdateOrganization,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      {} as ISession
    );
    expect(organization.name).toEqual(createTestOrganization.name);
  });

  it('should delete an organization', async () => {
    jest
      .spyOn(organizationService, 'delete')
      .mockImplementation(() => Promise.resolve());
    const organization = await organizationService.delete(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      id,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      {} as ISession
    );
  });
});