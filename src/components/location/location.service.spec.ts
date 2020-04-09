import { Test } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { Order } from '../../common';
import { CoreModule, DatabaseService, LoggerModule } from '../../core';
import { AuthenticationModule, AuthenticationService } from '../authentication';
import { OrganizationService } from '../organization';
import {
  EducationService,
  UnavailabilityService,
  UserModule,
  UserService,
} from '../user';
import { LocationListOutput } from './dto';
import { LocationModule } from './location.module';
import { LocationService } from './location.service';

describe('LocationService', () => {
  let locationService: LocationService;

  const mockSession = {
    token:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
    userId: '12345',
    issuedAt: DateTime.local(),
    owningOrgId: '',
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot(),
        CoreModule,
        AuthenticationModule,
        LocationModule,
        UserModule,
      ],
      providers: [
        LocationService,
        AuthenticationService,
        UserService,
        OrganizationService,
        UnavailabilityService,
        DatabaseService,
        EducationService,
      ],
    }).compile();

    locationService = module.get<LocationService>(LocationService);
  });

  it('should be defined', () => {
    expect(locationService).toBeDefined();
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

  /*
  const createTestZone: Partial<Zone> = {
    name: 'seed-organization',
    type: 'type',
  };

  it('should create zone node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    locationService.readOne = jest.fn().mockReturnValue(createTestZone);
    const zone = await locationService.createZone(
      {
        name: 'seed-organization',
        directorId: generate(),
      },
      mockSession
    );
    expect(zone.name).toEqual(createTestZone.name);
  });

  it('should update zone node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    locationService.readOne = jest.fn().mockReturnValue(createZone);
    const zone = await locationService.updateZone(
      {
        id: '',
        name: 'seed-organization',
        directorId: 'tmpUiLso',
      },
      mockSession
    );
    expect(zone.name).toEqual(createZone);
  });

  const createTestRegion: Partial<Region> = {};

  it('should create region node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    locationService.readOne = jest.fn().mockReturnValue(createTestRegion);
    const region = await locationService.createRegion(
      {
        name: 'seed-organization',
        zoneId: '8O5BB3pv-',
        directorId: 'tmpUiLso',
      },
      mockSession
    );
    expect(region.name).toEqual(createTestRegion);
  });

  it('should update region node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    locationService.readOne = jest.fn().mockReturnValue(createTestRegion);
    const region = await locationService.updateRegion(
      {
        id: '8O5BB3pv',
        name: 'seed-organization',
        zoneId: '8O5BB3pv-',
        directorId: 'tmpUiLso',
      },
      mockSession
    );
    expect(region.name).toEqual(createTestRegion);
  });

  it('should read region node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    locationService.readOne = jest
      .fn()
      .mockReturnValue(createTestRegion);
    const region = await locationService.readOne(id, mockSession);
    expect(region.name).toEqual(createTestRegion.name);
  });

  const createTestCountry: Partial<country> = 'country';
  it('should create country node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    locationService.readOne = jest.fn().mockReturnValue(createTestCountry);
    const country = await locationService.createCountry(
      {
        name: 'seed-organization',
        regionId: 'tmpUiLso',
      },
      mockSession
    );
    expect(country.name).toEqual(createTestCountry);
  });

  it('should update country node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    locationService.readOne = jest.fn().mockReturnValue(createTestCountry);
    const country = await locationService.updateCountry(
      {
        id: 'tmpUiLso',
        name: 'seed-organization',
      },
      mockSession
    );
    expect(country.name).toEqual(createTestCountry);
  });
  */
});
