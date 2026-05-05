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
// required.
jest.unstable_mockModule('~/core/logger', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Logger: () => () => undefined,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  ILogger: class {},
}));
jest.unstable_mockModule('~/core/hooks', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Hooks: class {},
}));
jest.unstable_mockModule('~/core/authentication', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Identity: class {},
}));
jest.unstable_mockModule('~/core/resources', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  HandleIdLookup: () => (_target: any, _key: any, descriptor: any) =>
    descriptor,
}));
jest.unstable_mockModule('../authorization', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Privileges: class {},
  // eslint-disable-next-line @typescript-eslint/naming-convention
  AssignableRoles: class {},
}));
jest.unstable_mockModule('../location', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  LocationService: class {},
}));
jest.unstable_mockModule('../organization', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  OrganizationService: class {},
}));
jest.unstable_mockModule('../partner', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  PartnerService: class {},
}));
jest.unstable_mockModule('./education', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  EducationService: class {},
}));
jest.unstable_mockModule('./unavailability', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  UnavailabilityService: class {},
}));
jest.unstable_mockModule('./known-language.repository', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  KnownLanguageRepository: class {},
}));
jest.unstable_mockModule('./user.repository', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention
  UserRepository: class {},
}));

const USER_ID = 'user-uuid-1' as ID<'User'>;
const ORG_ID = 'org-uuid-1' as ID<'Organization'>;

const makeFakeUser = (id = USER_ID) => ({
  id,
  __typename: 'User' as const,
  email: { value: 'test@example.com', canRead: true, canEdit: false },
  realFirstName: { value: 'Test', canRead: true, canEdit: true },
  realLastName: { value: 'User', canRead: true, canEdit: true },
  displayFirstName: { value: 'Test', canRead: true, canEdit: true },
  displayLastName: { value: 'User', canRead: true, canEdit: true },
});

describe('UserService', () => {
  let UserService: typeof UserServiceClass;
  // Typed as `any` to keep mock setup simple.
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

    userRepo = {
      readOne: jest.fn(),
      assignOrganizationToUser: jest.fn(),
      removeOrganizationFromUser: jest.fn(),
      readMany: jest.fn(),
      readManyActors: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      list: jest.fn(),
      getActualChanges: jest.fn(),
      doesEmailAddressExist: jest.fn(),
      getUserByEmailAddress: jest.fn(),
    };

    privileges = {
      for: jest.fn().mockReturnValue(resourcePrivileges),
    };

    // Default: readOne returns a fake user
    userRepo.readOne.mockResolvedValue(makeFakeUser());
    // Default: verifyCan succeeds (no throw)
    resourcePrivileges.verifyCan.mockReturnValue(undefined);
    // Default: repo operations succeed
    userRepo.assignOrganizationToUser.mockResolvedValue(undefined);
    userRepo.removeOrganizationFromUser.mockResolvedValue(undefined);

    service = new (UserService as any)(
      {} as any, // educations
      {} as any, // organizations
      {} as any, // partners
      {} as any, // unavailabilities
      privileges,
      {} as any, // locationService
      {} as any, // knownLanguages
      {} as any, // identity
      {} as any, // hooks
      userRepo,
      { debug: jest.fn() } as any, // logger
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('assignOrganizationToUser', () => {
    it('reads the user from the repository before checking privileges', async () => {
      const request = { user: USER_ID, org: ORG_ID };

      await service.assignOrganizationToUser(request);

      expect(userRepo.readOne).toHaveBeenCalledWith(USER_ID);
    });

    it('verifies the caller can edit the organization field', async () => {
      const fakeUser = makeFakeUser();
      userRepo.readOne.mockResolvedValue(fakeUser);

      await service.assignOrganizationToUser({ user: USER_ID, org: ORG_ID });

      expect(privileges.for).toHaveBeenCalledWith(
        expect.anything(), // User resource
        fakeUser,
      );
      expect(resourcePrivileges.verifyCan).toHaveBeenCalledWith(
        'edit',
        'organization',
      );
    });

    it('delegates to the repository after successful privilege check', async () => {
      const request = { user: USER_ID, org: ORG_ID };

      await service.assignOrganizationToUser(request);

      expect(userRepo.assignOrganizationToUser).toHaveBeenCalledWith(request);
    });

    it('does not call the repository when privilege check throws', async () => {
      const authError = new Error('Insufficient permission');
      resourcePrivileges.verifyCan.mockImplementation(() => {
        throw authError;
      });

      await expect(
        service.assignOrganizationToUser({ user: USER_ID, org: ORG_ID }),
      ).rejects.toThrow(authError);

      expect(userRepo.assignOrganizationToUser).not.toHaveBeenCalled();
    });

    it('propagates errors thrown by the repository', async () => {
      const repoError = new Error('Database failure');
      userRepo.assignOrganizationToUser.mockRejectedValue(repoError);

      await expect(
        service.assignOrganizationToUser({ user: USER_ID, org: ORG_ID }),
      ).rejects.toThrow(repoError);
    });

    it('forwards the full request object including the optional primary flag', async () => {
      const request = { user: USER_ID, org: ORG_ID, primary: true };

      await service.assignOrganizationToUser(request);

      expect(userRepo.assignOrganizationToUser).toHaveBeenCalledWith(request);
    });
  });

  describe('removeOrganizationFromUser', () => {
    it('reads the user from the repository before checking privileges', async () => {
      await service.removeOrganizationFromUser({ user: USER_ID, org: ORG_ID });

      expect(userRepo.readOne).toHaveBeenCalledWith(USER_ID);
    });

    it('verifies the caller can edit the organization field', async () => {
      const fakeUser = makeFakeUser();
      userRepo.readOne.mockResolvedValue(fakeUser);

      await service.removeOrganizationFromUser({ user: USER_ID, org: ORG_ID });

      expect(privileges.for).toHaveBeenCalledWith(
        expect.anything(), // User resource
        fakeUser,
      );
      expect(resourcePrivileges.verifyCan).toHaveBeenCalledWith(
        'edit',
        'organization',
      );
    });

    it('delegates to the repository after successful privilege check', async () => {
      const request = { user: USER_ID, org: ORG_ID };

      await service.removeOrganizationFromUser(request);

      expect(userRepo.removeOrganizationFromUser).toHaveBeenCalledWith(request);
    });

    it('does not call the repository when privilege check throws', async () => {
      const authError = new Error('Insufficient permission');
      resourcePrivileges.verifyCan.mockImplementation(() => {
        throw authError;
      });

      await expect(
        service.removeOrganizationFromUser({ user: USER_ID, org: ORG_ID }),
      ).rejects.toThrow(authError);

      expect(userRepo.removeOrganizationFromUser).not.toHaveBeenCalled();
    });

    it('propagates errors thrown by the repository', async () => {
      const repoError = new Error('Database failure');
      userRepo.removeOrganizationFromUser.mockRejectedValue(repoError);

      await expect(
        service.removeOrganizationFromUser({ user: USER_ID, org: ORG_ID }),
      ).rejects.toThrow(repoError);
    });

    it('privilege check uses the user returned by readOne, not the request id', async () => {
      const differentUser = makeFakeUser('other-user-id' as ID<'User'>);
      userRepo.readOne.mockResolvedValue(differentUser);

      await service.removeOrganizationFromUser({ user: USER_ID, org: ORG_ID });

      // Privileges are checked against the actual user object from the DB
      expect(privileges.for).toHaveBeenCalledWith(
        expect.anything(),
        differentUser,
      );
    });
  });
});