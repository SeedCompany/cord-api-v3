import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { UserService as UserServiceClass } from './user.service';

// ESM mode requires unstable_mockModule + dynamic import.
// jest.mock() is not hoisted in ESM and cannot intercept ES module imports.

jest.unstable_mockModule('~/core/logger', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Logger: () => () => undefined,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  ILogger: class {},
}));

jest.unstable_mockModule('./user.repository', () => ({
  UserRepository: class {},
}));

jest.unstable_mockModule('../authorization/policy/executor/privileges', () => ({
  Privileges: class {},
}));

jest.unstable_mockModule('../organization', () => ({
  OrganizationService: class {},
}));

jest.unstable_mockModule('../partner', () => ({
  PartnerService: class {},
}));

jest.unstable_mockModule('../location', () => ({
  LocationService: class {},
}));

jest.unstable_mockModule('./education', () => ({
  EducationService: class {},
}));

jest.unstable_mockModule('./unavailability', () => ({
  UnavailabilityService: class {},
}));

jest.unstable_mockModule('./known-language.repository', () => ({
  KnownLanguageRepository: class {},
}));

jest.unstable_mockModule('~/core/authentication', () => ({
  Identity: class {},
}));

jest.unstable_mockModule('~/core/hooks', () => ({
  Hooks: class {},
}));

jest.unstable_mockModule('./hooks/user-updated.hook', () => ({
  UserUpdatedHook: class {},
}));

const FAKE_USER_ID = 'user-uuid-1' as any;
const FAKE_ORG_ID = 'org-uuid-1' as any;

const makeFakeUser = (id = FAKE_USER_ID) => ({
  id,
  email: { value: 'test@example.com', canRead: true, canEdit: false },
  realFirstName: { value: 'Test', canRead: true, canEdit: false },
  realLastName: { value: 'User', canRead: true, canEdit: false },
});

describe('UserService — assignOrganizationToUser', () => {
  let UserService: typeof UserServiceClass;
  let service: UserServiceClass;
  let userRepo: any;
  let privileges: any;
  let resourcePrivileges: any;

  beforeAll(async () => {
    ({ UserService } = await import('./user.service'));
  });

  beforeEach(() => {
    resourcePrivileges = {
      verifyCan: jest.fn(),
    };

    privileges = {
      for: jest.fn().mockReturnValue(resourcePrivileges),
    };

    userRepo = {
      readOne: jest.fn(),
      assignOrganizationToUser: jest.fn(),
      removeOrganizationFromUser: jest.fn(),
      getActualChanges: jest.fn(),
    };

    service = new (UserService as any)(
      {} as any, // educations
      {} as any, // organizations
      {} as any, // partners
      {} as any, // unavailabilities
      privileges, // privileges
      {} as any, // locationService
      {} as any, // knownLanguages
      {} as any, // identity
      {} as any, // hooks
      userRepo, // userRepo
      { debug: jest.fn() } as any, // logger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('reads the user from the repository before checking privileges', async () => {
    const fakeUser = makeFakeUser();
    userRepo.readOne.mockResolvedValue(fakeUser);
    userRepo.assignOrganizationToUser.mockResolvedValue(undefined);

    const request = { user: FAKE_USER_ID, org: FAKE_ORG_ID };
    await service.assignOrganizationToUser(request as any);

    expect(userRepo.readOne).toHaveBeenCalledWith(FAKE_USER_ID);
  });

  it('checks the organization edit privilege with the fetched user', async () => {
    const fakeUser = makeFakeUser();
    userRepo.readOne.mockResolvedValue(fakeUser);
    userRepo.assignOrganizationToUser.mockResolvedValue(undefined);

    const { User } = await import('./dto');
    const request = { user: FAKE_USER_ID, org: FAKE_ORG_ID };
    await service.assignOrganizationToUser(request as any);

    expect(privileges.for).toHaveBeenCalledWith(User, fakeUser);
    expect(resourcePrivileges.verifyCan).toHaveBeenCalledWith(
      'edit',
      'organization',
    );
  });

  it('delegates to the repository when the privilege check passes', async () => {
    const fakeUser = makeFakeUser();
    userRepo.readOne.mockResolvedValue(fakeUser);
    userRepo.assignOrganizationToUser.mockResolvedValue(undefined);

    const request = { user: FAKE_USER_ID, org: FAKE_ORG_ID };
    await service.assignOrganizationToUser(request as any);

    expect(userRepo.assignOrganizationToUser).toHaveBeenCalledWith(request);
  });

  it('does NOT call the repository when the privilege check throws', async () => {
    const fakeUser = makeFakeUser();
    userRepo.readOne.mockResolvedValue(fakeUser);
    resourcePrivileges.verifyCan.mockImplementation(() => {
      throw new Error('Unauthorized');
    });

    const request = { user: FAKE_USER_ID, org: FAKE_ORG_ID };
    await expect(
      service.assignOrganizationToUser(request as any),
    ).rejects.toThrow('Unauthorized');

    expect(userRepo.assignOrganizationToUser).not.toHaveBeenCalled();
  });

  it('propagates errors thrown by userRepo.readOne', async () => {
    userRepo.readOne.mockRejectedValue(new Error('DB connection failed'));

    const request = { user: FAKE_USER_ID, org: FAKE_ORG_ID };
    await expect(
      service.assignOrganizationToUser(request as any),
    ).rejects.toThrow('DB connection failed');

    expect(resourcePrivileges.verifyCan).not.toHaveBeenCalled();
    expect(userRepo.assignOrganizationToUser).not.toHaveBeenCalled();
  });

  it('privilege check receives the exact object returned by readOne', async () => {
    const specificUser = { id: 'specific-uuid' as any, roles: ['Consultant'] };
    userRepo.readOne.mockResolvedValue(specificUser);
    userRepo.assignOrganizationToUser.mockResolvedValue(undefined);

    const request = { user: 'specific-uuid' as any, org: FAKE_ORG_ID };
    await service.assignOrganizationToUser(request as any);

    // The second argument to privileges.for must be the exact object from readOne
    expect(privileges.for).toHaveBeenCalledWith(expect.anything(), specificUser);
  });
});

describe('UserService — removeOrganizationFromUser', () => {
  let UserService: typeof UserServiceClass;
  let service: UserServiceClass;
  let userRepo: any;
  let privileges: any;
  let resourcePrivileges: any;

  beforeAll(async () => {
    ({ UserService } = await import('./user.service'));
  });

  beforeEach(() => {
    resourcePrivileges = {
      verifyCan: jest.fn(),
    };

    privileges = {
      for: jest.fn().mockReturnValue(resourcePrivileges),
    };

    userRepo = {
      readOne: jest.fn(),
      assignOrganizationToUser: jest.fn(),
      removeOrganizationFromUser: jest.fn(),
      getActualChanges: jest.fn(),
    };

    service = new (UserService as any)(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      privileges,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      userRepo,
      { debug: jest.fn() } as any,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('reads the user from the repository before checking privileges', async () => {
    const fakeUser = makeFakeUser();
    userRepo.readOne.mockResolvedValue(fakeUser);
    userRepo.removeOrganizationFromUser.mockResolvedValue(undefined);

    const request = { user: FAKE_USER_ID, org: FAKE_ORG_ID };
    await service.removeOrganizationFromUser(request as any);

    expect(userRepo.readOne).toHaveBeenCalledWith(FAKE_USER_ID);
  });

  it('checks the organization edit privilege with the fetched user', async () => {
    const fakeUser = makeFakeUser();
    userRepo.readOne.mockResolvedValue(fakeUser);
    userRepo.removeOrganizationFromUser.mockResolvedValue(undefined);

    const { User } = await import('./dto');
    const request = { user: FAKE_USER_ID, org: FAKE_ORG_ID };
    await service.removeOrganizationFromUser(request as any);

    expect(privileges.for).toHaveBeenCalledWith(User, fakeUser);
    expect(resourcePrivileges.verifyCan).toHaveBeenCalledWith(
      'edit',
      'organization',
    );
  });

  it('delegates to the repository when the privilege check passes', async () => {
    const fakeUser = makeFakeUser();
    userRepo.readOne.mockResolvedValue(fakeUser);
    userRepo.removeOrganizationFromUser.mockResolvedValue(undefined);

    const request = { user: FAKE_USER_ID, org: FAKE_ORG_ID };
    await service.removeOrganizationFromUser(request as any);

    expect(userRepo.removeOrganizationFromUser).toHaveBeenCalledWith(request);
  });

  it('does NOT call the repository when the privilege check throws', async () => {
    const fakeUser = makeFakeUser();
    userRepo.readOne.mockResolvedValue(fakeUser);
    resourcePrivileges.verifyCan.mockImplementation(() => {
      throw new Error('Unauthorized');
    });

    const request = { user: FAKE_USER_ID, org: FAKE_ORG_ID };
    await expect(
      service.removeOrganizationFromUser(request as any),
    ).rejects.toThrow('Unauthorized');

    expect(userRepo.removeOrganizationFromUser).not.toHaveBeenCalled();
  });

  it('propagates errors thrown by userRepo.readOne', async () => {
    userRepo.readOne.mockRejectedValue(new Error('User not found'));

    const request = { user: FAKE_USER_ID, org: FAKE_ORG_ID };
    await expect(
      service.removeOrganizationFromUser(request as any),
    ).rejects.toThrow('User not found');

    expect(resourcePrivileges.verifyCan).not.toHaveBeenCalled();
    expect(userRepo.removeOrganizationFromUser).not.toHaveBeenCalled();
  });

  it('privilege check uses the exact user object returned by readOne', async () => {
    const specificUser = { id: 'other-uuid' as any, roles: ['FieldPartner'] };
    userRepo.readOne.mockResolvedValue(specificUser);
    userRepo.removeOrganizationFromUser.mockResolvedValue(undefined);

    const request = { user: 'other-uuid' as any, org: FAKE_ORG_ID };
    await service.removeOrganizationFromUser(request as any);

    expect(privileges.for).toHaveBeenCalledWith(expect.anything(), specificUser);
  });
});
