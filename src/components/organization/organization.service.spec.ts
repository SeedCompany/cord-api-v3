import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { CoreModule, DatabaseService, LoggerModule } from '../../core';
import { Organization } from './dto';
import { OrganizationService } from './organization.service';

describe('OrganizationService', () => {
  let organizationService: OrganizationService;
  const id = generate();

  const createTestOrganization: Partial<Organization> = {
    id,
    name: {
      value: 'seed-organization',
      canRead: true,
      canEdit: true,
    },
  };

  const mockDbService = {
    createNode: () => createTestOrganization,
    updateProperties: () => createTestOrganization,
    deleteNode: () => ({}),
    query: () => ({
      raw: () => ({
        run: () => ({}),
      }),
    }),
    readProperties: () => createTestOrganization,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule.forRoot(), CoreModule],
      providers: [
        OrganizationService,
        {
          provide: DatabaseService,
          useValue: mockDbService,
        },
      ],
    }).compile();

    organizationService = module.get<OrganizationService>(OrganizationService);
  });

  it('should be defined', () => {
    expect(OrganizationService).toBeDefined();
  });

  it('should create organization node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    organizationService.readOne = jest
      .fn()
      .mockReturnValue(createTestOrganization);
    const organization = await organizationService.create(
      {
        name: 'seed-organization',
      },
      {
        token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
        userId: '12345',
        issuedAt: DateTime.local(),
      }
    );
    expect(organization.name).toEqual(createTestOrganization.name);
  });

  it('should read organization node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    organizationService.readOne = jest
      .fn()
      .mockReturnValue(createTestOrganization);
    const organization = await organizationService.readOne(id, {
      token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
      userId: '12345',
      issuedAt: DateTime.local(),
    });
    expect(organization.name).toEqual(createTestOrganization.name);
  });

  it('should update organization node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    organizationService.readOne = jest
      .fn()
      .mockReturnValue(createTestOrganization);

    const organization = await organizationService.update(
      {
        id: '12345',
        name: 'update-organization',
      },
      {
        token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
        userId: '12345',
        issuedAt: DateTime.local(),
      }
    );
    expect(organization.name).toEqual(createTestOrganization.name);
  });

  it('should delete organization node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    organizationService.readOne = jest
      .fn()
      .mockReturnValue(createTestOrganization);

    await organizationService.delete(id, {
      token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
      userId: '12345',
      issuedAt: DateTime.local(),
    });
    await organizationService.readOne(id, {
      token:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
      userId: '12345',
      issuedAt: DateTime.local(),
    });
  });
});
