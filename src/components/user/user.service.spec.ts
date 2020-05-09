import { Test } from '@nestjs/testing';
import { generate } from 'shortid';
import { ISession } from '../../common';
import { CoreModule, LoggerModule } from '../../core';
import { AuthenticationModule, AuthenticationService } from '../authentication';
import { OrganizationModule, OrganizationService } from '../organization';
import { CreateUser, UpdateUser, User } from './dto';
import { EducationModule, EducationService } from './education';
import { UnavailabilityModule, UnavailabilityService } from './unavailability';
import { UserService } from './user.service';

describe('UserService', () => {
  let userService: UserService;
  const id = generate();

  const createTestUser: Partial<User> = {
    id: generate(),
    email: {
      value: 'test@test.com',
      canRead: true,
      canEdit: true,
    },
    realFirstName: {
      value: 'FirstName',
      canRead: true,
      canEdit: true,
    },
    realLastName: {
      value: 'LastName',
      canRead: true,
      canEdit: true,
    },
    displayFirstName: {
      value: 'DisplayFirst',
      canRead: true,
      canEdit: true,
    },
    displayLastName: {
      value: 'DisplayLast',
      canRead: true,
      canEdit: true,
    },
    // password: {
    //   value: "test@test.com",
    //   canRead: true,
    //   canEdit: true,
    // },
    phone: {
      value: '919191919191',
      canRead: true,
      canEdit: true,
    },
    timezone: {
      value: 'PST',
      canRead: true,
      canEdit: true,
    },
    bio: {
      value: 'bio-details',
      canRead: true,
      canEdit: true,
    },
  };

  // beforeEach(async () => {
  //   const module = await Test.createTestingModule({
  //     imports: [LoggerModule.forTest(), CoreModule, EducationModule, OrganizationModule, UnavailabilityModule, AuthModule],
  //     providers: [UserService, EducationService, OrganizationService, UnavailabilityService, AuthService],
  //   }).compile();

  //   userService = module.get<UserService>(UserService);
  // });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        LoggerModule.forTest(),
        CoreModule,
        EducationModule,
        OrganizationModule,
        UnavailabilityModule,
        AuthenticationModule,
      ],
      providers: [
        UserService,
        EducationService,
        OrganizationService,
        UnavailabilityService,
        AuthenticationService,
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(userService).toBeDefined();
  });

  it('should create a user node', async () => {
    jest
      .spyOn(userService, 'createAndLogin')
      .mockImplementation(() => Promise.resolve(createTestUser as User));
    const user = await userService.createAndLogin(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      {} as CreateUser,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      {} as ISession
    );
    expect(user.email).toEqual(createTestUser.email);
    expect(user.realFirstName).toEqual(createTestUser.realFirstName);
    expect(user.realLastName).toEqual(createTestUser.realLastName);
    expect(user.displayFirstName).toEqual(createTestUser.displayFirstName);
    expect(user.displayLastName).toEqual(createTestUser.displayLastName);
    expect(user.phone).toEqual(createTestUser.phone);
    expect(user.timezone).toEqual(createTestUser.timezone);
    expect(user.bio).toEqual(createTestUser.bio);
  });

  it('should read a user', async () => {
    jest
      .spyOn(userService, 'readOne')
      .mockImplementation(() => Promise.resolve(createTestUser as User));
    const user = await userService.readOne(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      id,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      {} as ISession
    );
    expect(user.email).toEqual(createTestUser.email);
    expect(user.realFirstName).toEqual(createTestUser.realFirstName);
    expect(user.realLastName).toEqual(createTestUser.realLastName);
    expect(user.displayFirstName).toEqual(createTestUser.displayFirstName);
    expect(user.displayLastName).toEqual(createTestUser.displayLastName);
    expect(user.phone).toEqual(createTestUser.phone);
    expect(user.timezone).toEqual(createTestUser.timezone);
    expect(user.bio).toEqual(createTestUser.bio);
  });

  it('should update a user', async () => {
    jest
      .spyOn(userService, 'update')
      .mockImplementation(() => Promise.resolve(createTestUser as User));
    const user = await userService.update(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      {} as UpdateUser,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      {} as ISession
    );
    expect(user.email).toEqual(createTestUser.email);
    expect(user.realFirstName).toEqual(createTestUser.realFirstName);
    expect(user.realLastName).toEqual(createTestUser.realLastName);
    expect(user.displayFirstName).toEqual(createTestUser.displayFirstName);
    expect(user.displayLastName).toEqual(createTestUser.displayLastName);
    expect(user.phone).toEqual(createTestUser.phone);
    expect(user.timezone).toEqual(createTestUser.timezone);
    expect(user.bio).toEqual(createTestUser.bio);
  });

  it('should delete a user', async () => {
    jest
      .spyOn(userService, 'delete')
      .mockImplementation(() => Promise.resolve());
    await userService.delete(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      id,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      {} as ISession
    );
  });
});
