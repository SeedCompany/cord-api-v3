import { Test } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession } from '../../common';
import { CoreModule, LoggerModule } from '../../core';
import { AuthenticationService } from '../authentication';
import { AuthenticationModule } from '../authentication/authentication.module';
import { OrganizationService } from '../organization';
import { OrganizationModule } from '../organization/organization.module';
import { Role } from '../project';
import { CreatePerson, UpdateUser, User, UserStatus } from './dto';
import { EducationService } from './education';
import { EducationModule } from './education/education.module';
import { UnavailabilityService } from './unavailability';
import { UnavailabilityModule } from './unavailability/unavailability.module';
import { UserService } from './user.service';

describe('UserService', () => {
  let userService: UserService;
  const id = generate();

  const createTestUser: User = {
    id: generate(),
    createdAt: DateTime.local(),
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
    status: {
      value: UserStatus.Active,
      canRead: true,
      canEdit: true,
    },
    roles: {
      value: [Role.ProjectManager, Role.Consultant],
      canRead: true,
      canEdit: true,
    },
    title: {
      value: 'title',
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

  it('should create a user', async () => {
    jest
      .spyOn(userService, 'create')
      .mockImplementation(async () => createTestUser.id);
    const userId = await userService.create(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      {} as CreatePerson,
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      {} as ISession
    );
    expect(userId).toEqual(createTestUser.id);
  });

  it('should read a user', async () => {
    jest
      .spyOn(userService, 'readOne')
      .mockImplementation(() => Promise.resolve(createTestUser));
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
    expect(user.title).toEqual(createTestUser.title);
  });

  it('should update a user', async () => {
    jest
      .spyOn(userService, 'update')
      .mockImplementation(() => Promise.resolve(createTestUser));
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
    expect(user.title).toEqual(createTestUser.title);
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
