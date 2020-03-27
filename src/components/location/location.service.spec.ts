import { Test } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { Order } from '../../common';
import { CoreModule, DatabaseService, LoggerModule } from '../../core';
import { AuthModule } from '../auth/auth.module';
import { AuthService } from '../auth/auth.service';
import { OrganizationService } from '../organization';
import { EducationService, UnavailabilityService, UserService } from '../user';
import { LocationListInput } from './dto';
import { LocationModule } from './location.module';
import { LocationService } from './location.service';

describe('LocationService', () => {
  let locationService: LocationService;

  /*const listInput: Partial<LocationListInput> = {

    count : 25,
    page: 1,
    sort: "name",
    filter : 
      { 
          name:"name",
          userIds: ["9gf-Ogtbw"],
          types: ['country']
      },
      order : Order.ASC
    
  };*/

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [LoggerModule.forRoot(), CoreModule, AuthModule, LocationModule],
      providers: [
        LocationService,
        AuthService,
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

  it('should list location', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    locationService.readOne = jest.fn().mockReturnValue(LocationListInput);

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
      {
        token:
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
        userId: '12345',
        issuedAt: DateTime.local(),
      }
    );

    expect(listInput.total).toEqual(0);
    expect(listInput.hasMore).toEqual(false);
    expect(listInput.items.length).toEqual(0);
  });
});
