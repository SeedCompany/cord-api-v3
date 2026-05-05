import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { type ID } from '~/common';
import type { UserService as UserServiceClass } from './user.service';

// In ESM mode (ts-jest/presets/default-esm), jest.mock() is NOT hoisted and
// cannot intercept ES module imports. unstable_mockModule + dynamic import is
// required to avoid transitive circular-dep TDZ errors.
jest.unstable_mockModule('~/core/logger', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Logger: () => () => undefined,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  ILogger: class {},
}));

jest.unstable_mockModule('~/core/resources', () => ({
  HandleIdLookup: () => (_target: any, _key: string, descriptor: PropertyDescriptor) =>
    descriptor,
}));

jest.unstable_mockModule('./user.repository', () => ({
  UserRepository: class {},
}));

jest.unstable_mockModule('../authorization', () => ({
  Privileges: class {},
}));

jest.unstable_mockModule('../partner', () => ({
  PartnerService: class {},
}));

jest.unstable_mockModule('../location', () => ({
  LocationService: class {},
}));

jest.unstable_mockModule('../organization', () => ({
  OrganizationService: class {},
}));

jest.unstable_mockModule('./education', () => ({
  EducationService: class {},
}));

jest.unstable_mockModule('./unavailability', () => ({
  UnavailabilityService: class {},
}));

jest.unstable_mockModule('~/core/authentication', () => ({
  Identity: class {},
}));

jest.unstable_mockModule('~/core/hooks', () => ({
  Hooks: class {},
}));

jest.unstable_mockModule('./known-language.repository', () => ({
  KnownLanguageRepository: class {},
}));

jest.unstable_mockModule('./hooks/user-updated.hook', () => ({
  UserUpdatedHook: class {},
}));

jest.unstable_mockModule('../authorization/dto/assignable-roles.dto', () => ({
  AssignableRoles: class {},
}));

const USER_ID = 'user-uuid-1' as ID<'User'>;
const ORG_ID = 'org-uuid-1' as ID<'Organization'>;

const makeMockUser = (id: ID<'User'> = USER_ID) => ({
  id,
  email: { value: 'test@example.com', canRead: true, canEdit: false },
  realFirstName: { value: 'Test', canRead: true, canEdit: true },
  realLastName: { value: 'User', canRead: true, canEdit: true },
  displayFirstName: { value: 'Test', canRead: true, canEdit: true },
  displayLastName: { value: 'User', canRead: true, canEdit: true },
  roles: { value: [], canRead: true, canEdit: false },
  status: { value: 'Active', canRead: true, canEdit: false },
  __typename: 'User' as const,
});

describe('UserService — assignOrganizationToUser', () => {
  let UserService: typeof UserServiceClass;
  let service: UserServiceClass;
  let userRepo: any;
  let privilegesMock: any;
  let resourcePrivilegesMock: any;

  beforeAll(async () => {
    ({ UserService } = await import('./user.service'));
  });

  beforeEach(() => {
    resourcePrivilegesMock = {
      verifyCan: jest.fn(),
    };

    userRepo = {
      readOne: jest.fn(),
      assignOrganizationToUser: jest.fn(),
      removeOrganizationFromUser: jest.fn(),
      getActualChanges: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      list: jest.fn(),
    };

    privilegesMock = {
      for: jest.fn().mockReturnValue(resourcePrivilegesMock),
    };

    userRepo.readOne.mockResolvedValue(makeMockUser());
    userRepo.assignOrganizationToUser.mockResolvedValue(undefined);

    service = new UserService(
      {} as any, // educations
      {} as any, // organizations
      {} as any, // partners
      {} as any, // unavailabilities
      privilegesMock as any, // privileges
      {} as any, // locationService
      {} as any, // knownLanguages
      {} as any, // identity
      {} as any, // hooks
      userRepo as any, // userRepo
      { debug: jest.fn() } as any, // logger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('reads the user before checking privileges', async () => {
    await service.assignOrganizationToUser({ org: ORG_ID, user: USER_ID });

    expect(userRepo.readOne).toHaveBeenCalledWith(USER_ID);
  });

  it('checks edit privilege on organization property', async () => {
    const mockUser = makeMockUser();
    userRepo.readOne.mockResolvedValue(mockUser);

    await service.assignOrganizationToUser({ org: ORG_ID, user: USER_ID });

    expect(privilegesMock.for).toHaveBeenCalledWith(
      expect.anything(), // User class
      mockUser,
    );
    expect(resourcePrivilegesMock.verifyCan).toHaveBeenCalledWith(
      'edit',
      'organization',
    );
  });

  it('delegates to repository when privilege check passes', async () => {
    const request = { org: ORG_ID, user: USER_ID, primary: true };

    await service.assignOrganizationToUser(request);

    expect(userRepo.assignOrganizationToUser).toHaveBeenCalledWith(request);
  });

  it('does not call repository when privilege check throws', async () => {
    resourcePrivilegesMock.verifyCan.mockImplementation(() => {
      throw new Error('Unauthorized');
    });

    await expect(
      service.assignOrganizationToUser({ org: ORG_ID, user: USER_ID }),
    ).rejects.toThrow('Unauthorized');

    expect(userRepo.assignOrganizationToUser).not.toHaveBeenCalled();
  });

  it('propagates the error thrown by verifyCan', async () => {
    const authError = new Error('You do not have permission to edit organization');
    resourcePrivilegesMock.verifyCan.mockImplementation(() => {
      throw authError;
    });

    await expect(
      service.assignOrganizationToUser({ org: ORG_ID, user: USER_ID }),
    ).rejects.toBe(authError);
  });

  it('privilege check uses the user object returned by readOne', async () => {
    const specificUser = makeMockUser('other-user-id' as ID<'User'>);
    userRepo.readOne.mockResolvedValue(specificUser);

    await service.assignOrganizationToUser({
      org: ORG_ID,
      user: 'other-user-id' as ID<'User'>,
    });

    expect(privilegesMock.for).toHaveBeenCalledWith(
      expect.anything(),
      specificUser,
    );
  });
});

describe('UserService — removeOrganizationFromUser', () => {
  let UserService: typeof UserServiceClass;
  let service: UserServiceClass;
  let userRepo: any;
  let privilegesMock: any;
  let resourcePrivilegesMock: any;

  beforeAll(async () => {
    ({ UserService } = await import('./user.service'));
  });

  beforeEach(() => {
    resourcePrivilegesMock = {
      verifyCan: jest.fn(),
    };

    userRepo = {
      readOne: jest.fn(),
      assignOrganizationToUser: jest.fn(),
      removeOrganizationFromUser: jest.fn(),
      getActualChanges: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      list: jest.fn(),
    };

    privilegesMock = {
      for: jest.fn().mockReturnValue(resourcePrivilegesMock),
    };

    userRepo.readOne.mockResolvedValue(makeMockUser());
    userRepo.removeOrganizationFromUser.mockResolvedValue(undefined);

    service = new UserService(
      {} as any, // educations
      {} as any, // organizations
      {} as any, // partners
      {} as any, // unavailabilities
      privilegesMock as any, // privileges
      {} as any, // locationService
      {} as any, // knownLanguages
      {} as any, // identity
      {} as any, // hooks
      userRepo as any, // userRepo
      { debug: jest.fn() } as any, // logger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('reads the user before checking privileges', async () => {
    await service.removeOrganizationFromUser({ org: ORG_ID, user: USER_ID });

    expect(userRepo.readOne).toHaveBeenCalledWith(USER_ID);
  });

  it('checks edit privilege on organization property', async () => {
    const mockUser = makeMockUser();
    userRepo.readOne.mockResolvedValue(mockUser);

    await service.removeOrganizationFromUser({ org: ORG_ID, user: USER_ID });

    expect(privilegesMock.for).toHaveBeenCalledWith(
      expect.anything(), // User class
      mockUser,
    );
    expect(resourcePrivilegesMock.verifyCan).toHaveBeenCalledWith(
      'edit',
      'organization',
    );
  });

  it('delegates to repository when privilege check passes', async () => {
    const request = { org: ORG_ID, user: USER_ID };

    await service.removeOrganizationFromUser(request);

    expect(userRepo.removeOrganizationFromUser).toHaveBeenCalledWith(request);
  });

  it('does not call repository when privilege check throws', async () => {
    resourcePrivilegesMock.verifyCan.mockImplementation(() => {
      throw new Error('Unauthorized');
    });

    await expect(
      service.removeOrganizationFromUser({ org: ORG_ID, user: USER_ID }),
    ).rejects.toThrow('Unauthorized');

    expect(userRepo.removeOrganizationFromUser).not.toHaveBeenCalled();
  });

  it('propagates the error thrown by verifyCan', async () => {
    const authError = new Error('You do not have permission to edit organization');
    resourcePrivilegesMock.verifyCan.mockImplementation(() => {
      throw authError;
    });

    await expect(
      service.removeOrganizationFromUser({ org: ORG_ID, user: USER_ID }),
    ).rejects.toBe(authError);
  });

  it('privilege check uses the user object returned by readOne', async () => {
    const specificUser = makeMockUser('other-user-id' as ID<'User'>);
    userRepo.readOne.mockResolvedValue(specificUser);

    await service.removeOrganizationFromUser({
      org: ORG_ID,
      user: 'other-user-id' as ID<'User'>,
    });

    expect(privilegesMock.for).toHaveBeenCalledWith(
      expect.anything(),
      specificUser,
    );
  });

  it('privilege check happens before repository call (read then verify then remove)', async () => {
    const callOrder: string[] = [];

    userRepo.readOne.mockImplementation(async () => {
      callOrder.push('readOne');
      return makeMockUser();
    });
    resourcePrivilegesMock.verifyCan.mockImplementation(() => {
      callOrder.push('verifyCan');
    });
    userRepo.removeOrganizationFromUser.mockImplementation(async () => {
      callOrder.push('removeOrganizationFromUser');
    });

    await service.removeOrganizationFromUser({ org: ORG_ID, user: USER_ID });

    expect(callOrder).toEqual(['readOne', 'verifyCan', 'removeOrganizationFromUser']);
  });
});