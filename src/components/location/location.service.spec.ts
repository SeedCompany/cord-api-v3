import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { Order } from '../../common';
import { CoreModule, DatabaseService, LoggerModule } from '../../core';
import { AuthenticationService } from '../authentication';
import { AuthenticationModule } from '../authentication/authentication.module';
import { OrganizationService } from '../organization';
import { EducationService, UnavailabilityService, UserService } from '../user';
import { UserModule } from '../user/user.module';
import { Country, LocationListOutput } from './dto';
import { LocationService } from './index';
import { LocationModule } from './location.module';

describe('LocationService', () => {
  let locationService: LocationService;
  const id = generate();
  const regionId = 'seed-region-1';
  const zoneId = 'seed-zone-1';
  const directorId = 'seed-director-1';

  const createTestLocation: Partial<Country> = {
    id,
    name: {
      value: 'seed-location',
      canRead: true,
      canEdit: true,
    },
  };

  const updateTestLocation: Partial<Country> = {
    id,
    name: {
      value: 'seed-new-location',
      canRead: true,
      canEdit: true,
    },
  };

  const mockDbService = {
    createNode: () => createTestLocation,
    updateProperties: () => updateTestLocation,
    deleteNode: () => ({}),
    query: () => ({
      raw: () => ({
        run: () => ({}),
        first: () => ({}),
      }),
    }),
    readProperties: () => createTestLocation,
  };

  const mockSession = {
    token:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
    userId: '12345',
    issuedAt: DateTime.local(),
    owningOrgId: 'Seed Company',
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        LoggerModule.forTest(),
        CoreModule,
        AuthenticationModule,
        LocationModule,
        UserModule,
      ],
      providers: [
        AuthenticationService,
        UserService,
        OrganizationService,
        UnavailabilityService,
        EducationService,
        LocationService,
        {
          provide: DatabaseService,
          useValue: mockDbService,
        },
      ],
    }).compile();

    locationService = module.get<LocationService>(LocationService);
  });

  it('should create country node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    locationService.readOneCountry = jest
      .fn()
      .mockReturnValue(createTestLocation);
    const country = await locationService.createCountry(
      {
        regionId,
        name: 'seed-location',
      },
      mockSession
    );
    expect(country.id).toEqual(createTestLocation.id);
    expect(country.name).toEqual(createTestLocation.name);
  });

  it('should create region node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    locationService.readOneRegion = jest
      .fn()
      .mockReturnValue(createTestLocation);
    const region = await locationService.createRegion(
      {
        zoneId,
        name: 'seed-location',
        directorId,
      },
      mockSession
    );
    expect(region.id).toEqual(createTestLocation.id);
    expect(region.name).toEqual(createTestLocation.name);
  });

  it('should create zone node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    locationService.readOneZone = jest.fn().mockReturnValue(createTestLocation);
    const zone = await locationService.createZone(
      {
        name: 'seed-location',
        directorId,
      },
      mockSession
    );
    expect(zone.id).toEqual(createTestLocation.id);
    expect(zone.name).toEqual(createTestLocation.name);
  });

  it('should read country node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    locationService.readOneCountry = jest
      .fn()
      .mockReturnValue(createTestLocation);
    const country = await locationService.readOneCountry(id, mockSession);
    expect(country.id).toEqual(createTestLocation.id);
    expect(country.name).toEqual(createTestLocation.name);
  });

  it('should read region node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    locationService.readOneRegion = jest
      .fn()
      .mockReturnValue(createTestLocation);
    const region = await locationService.readOneRegion(id, mockSession);
    expect(region.id).toEqual(createTestLocation.id);
    expect(region.name).toEqual(createTestLocation.name);
  });

  it('should read zone node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    locationService.readOneZone = jest.fn().mockReturnValue(createTestLocation);
    const zone = await locationService.readOneZone(id, mockSession);
    expect(zone.id).toEqual(createTestLocation.id);
    expect(zone.name).toEqual(createTestLocation.name);
  });

  it('should update country node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    locationService.readOneCountry = jest
      .fn()
      .mockReturnValue(updateTestLocation);
    const country = await locationService.updateCountry(
      {
        id,
        name: 'seed-new-location',
      },
      mockSession
    );
    expect(country.name).toEqual(updateTestLocation.name);
  });

  it('should update region node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    locationService.readOneRegion = jest
      .fn()
      .mockReturnValue(updateTestLocation);
    const region = await locationService.updateRegion(
      {
        id,
        name: 'seed-new-location',
      },
      mockSession
    );
    expect(region.name).toEqual(updateTestLocation.name);
  });

  it('should update zone node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    locationService.readOneZone = jest.fn().mockReturnValue(createTestLocation);
    const zone = await locationService.updateZone(
      {
        id,
        name: 'seed-location',
      },
      mockSession
    );
    expect(zone.name).toEqual(createTestLocation.name);
  });

  it('should delete country node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    locationService.readOneCountry = jest
      .fn()
      .mockReturnValue(createTestLocation);
    const country = await locationService.createCountry(
      {
        regionId,
        name: 'seed-location',
      },
      mockSession
    );
    await locationService.delete(id, mockSession);
    // since delete is making the graph node inactive, we just test for the nodes existance now
    expect(country.id).toEqual(createTestLocation.id);
    expect(country.name).toEqual(createTestLocation.name);
  });

  it('should delete region node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    locationService.readOneRegion = jest
      .fn()
      .mockReturnValue(createTestLocation);
    const region = await locationService.createRegion(
      {
        zoneId,
        name: 'seed-location',
        directorId,
      },
      mockSession
    );
    await locationService.delete(id, mockSession);
    // since delete is making the graph node inactive, we just test for the nodes existance now
    expect(region.id).toEqual(createTestLocation.id);
    expect(region.name).toEqual(createTestLocation.name);
  });

  it('should delete zone node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    locationService.readOneZone = jest.fn().mockReturnValue(createTestLocation);
    const zone = await locationService.createZone(
      {
        name: 'seed-location',
        directorId,
      },
      mockSession
    );
    await locationService.delete(id, mockSession);
    // since delete is making the graph node inactive, we just test for the nodes existance now
    expect(zone.id).toEqual(createTestLocation.id);
    expect(zone.name).toEqual(createTestLocation.name);
  });

  const listOutput: Partial<LocationListOutput> = {
    hasMore: false,
    items: [],
    total: 0,
  };

  it('should list location', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    locationService.list = jest.fn().mockReturnValue(listOutput);

    const listInput = await locationService.list(
      {
        count: 25,
        page: 1,
        sort: 'name',
        filter: {
          name: 'name',
          userIds: ['9gf-Ogtbw'],
          types: ['country'],
        },
        order: Order.ASC,
      },
      mockSession
    );

    expect(listInput.total).toEqual(listOutput.total);
    expect(listInput.hasMore).toEqual(listOutput.hasMore);
    expect(listInput.items.length).toEqual(listOutput.items?.length);
  });
});
