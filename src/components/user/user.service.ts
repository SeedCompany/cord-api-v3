import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  type ID,
  type ObjectView,
  Role,
  SecuredList,
  UnauthorizedException,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
import { Hooks } from '~/core/hooks';
import { ILogger, Logger } from '~/core/logger';
import { HandleIdLookup, type LinkTo, ResourceLoader } from '~/core/resources';
import { ResourceMutatedHook } from '../audit/resource-mutated.hook';
import { Privileges } from '../authorization';
import { AssignableRoles } from '../authorization/dto/assignable-roles.dto';
import { FileNodeLoader } from '../file';
import { type File } from '../file/dto';
import { LocationService } from '../location';
import {
  type LocationListInput,
  type SecuredLocationList,
} from '../location/dto';
import { OrganizationService } from '../organization';
import {
  type OrganizationListInput,
  type SecuredOrganizationList,
} from '../organization/dto';
import { PartnerService } from '../partner';
import { type PartnerListInput, type SecuredPartnerList } from '../partner/dto';
import {
  type AssignOrganizationToUser,
  type CreatePerson,
  type ModifyKnownLanguageArgs,
  type RemoveOrganizationFromUser,
  type SystemAgent,
  type UpdateUser,
  User,
  type UserListInput,
  type UserListOutput,
  UserUpdate,
} from './dto';
import { EducationService } from './education';
import {
  type EducationListInput,
  type SecuredEducationList,
} from './education/dto';
import { UserDeletedHook } from './hooks/user-deleted.hook';
import { UserUpdatedHook } from './hooks/user-updated.hook';
import { KnownLanguageRepository } from './known-language.repository';
import { UnavailabilityService } from './unavailability';
import {
  type SecuredUnavailabilityList,
  type UnavailabilityListInput,
} from './unavailability/dto';
import { UserChannels } from './user.channels';
import { UserRepository } from './user.repository';

@Injectable()
export class UserService {
  constructor(
    private readonly educations: EducationService,
    private readonly organizations: OrganizationService,
    @Inject(forwardRef(() => PartnerService))
    private readonly partners: PartnerService & {},
    private readonly unavailabilities: UnavailabilityService,
    private readonly privileges: Privileges,
    private readonly locationService: LocationService,
    private readonly knownLanguages: KnownLanguageRepository,
    private readonly identity: Identity,
    private readonly hooks: Hooks,
    private readonly resources: ResourceLoader,
    private readonly channels: UserChannels,
    private readonly userRepo: UserRepository,
    @Logger('user:service') private readonly logger: ILogger,
  ) {}

  async create(input: CreatePerson) {
    if (
      input.roles &&
      input.roles.length > 0 &&
      // Note: session is only omitted for creating RootUser
      this.identity.currentIfInCtx
    ) {
      this.verifyRolesAreAssignable(input.roles);
    }

    const { id } = await this.userRepo.create(input);
    await this.hooks.run(new ResourceMutatedHook('User', id, 'Create'));

    // The repo returns only the id, so `at` cannot come from a persisted
    // `createdAt` the way Language's does. Returning the published payload —
    // rather than letting the resolver stamp its own timestamp — keeps the
    // mutation response and the broadcast event reporting the same instant.
    const payload = this.channels.publishToAll('created', {
      user: id,
      at: DateTime.now(),
    });
    return { id, payload };
  }

  @HandleIdLookup(User)
  async readOne(id: ID, _view?: ObjectView): Promise<User> {
    const user = await this.userRepo.readOne(id);
    return this.secure(user);
  }

  async readOneUnsecured(id: ID): Promise<UnsecuredDto<User>> {
    return await this.userRepo.readOne(id);
  }

  async readMany(ids: readonly ID[]) {
    const users = await this.userRepo.readMany(ids);
    return users.map((dto) => this.secure(dto));
  }

  async readManyActors(
    ids: readonly ID[],
  ): Promise<ReadonlyArray<User | SystemAgent>> {
    const users = await this.userRepo.readManyActors(ids);
    return users.map((dto) =>
      dto.__typename === 'User' ? this.secure(dto) : (dto as SystemAgent),
    );
  }

  secure(user: UnsecuredDto<User>): User {
    return this.privileges.for(User).secure(user);
  }

  async update(input: UpdateUser) {
    this.logger.debug('mutation update User', { input });
    const user = await this.userRepo.readOne(input.id);

    const changes = this.userRepo.getActualChanges(user, input);

    this.privileges.for(User, user).verifyChanges(changes);

    if (Object.keys(changes).length === 0) {
      return { user: this.secure(user) };
    }

    if (changes.roles) {
      this.verifyRolesAreAssignable(changes.roles);
    }

    input = {
      id: user.id,
      ...changes,
    };
    const updated = await this.userRepo.update(input);

    const event = new UserUpdatedHook(updated, user, input);
    await this.hooks.run(event);
    await this.hooks.run(
      new ResourceMutatedHook('User', user.id, 'Update', changes),
    );

    // Published after the hooks, following Ceremony rather than Language, so
    // that any handler which mutates state has already run. Ordering is not a
    // rollback concern: TransactionDeferredTransport holds publishes until
    // afterCommit for anything inside a GraphQL mutation.
    // `photo` is an upload input, which cannot appear in an output type, so it
    // is mapped to the new version's link — see LanguageEngagement.pnp.
    // `previous.photo` is deliberately left unset. It would need the prior
    // latest version read *before* the update, as EngagementService does for
    // pnp, and its value is marginal: `updatedKeys` reports that the photo
    // changed, and the links resolver returns null for an unset value.
    const { photo, ...simpleChanges } = changes;
    // Resolved from the file itself rather than from `photo.upload`, so that a
    // direct `file` upload — which carries no upload id, since
    // FileService.createFileVersion generates one — is reported too.
    const photoVersion = photo
      ? await this.latestPhotoVersion(updated)
      : undefined;
    // `User.gender` is nullable but `UpdateUser.gender` is not, so the stored
    // value does not fit the derived update type. Absent and null mean the same
    // thing in this payload, so it is narrowed rather than widening the input.
    const previous = { ...user, gender: user.gender ?? undefined };
    const payload = this.channels.publishToAll('updated', {
      user: updated.id,
      at: DateTime.now(),
      updated: {
        ...UserUpdate.fromInput(simpleChanges),
        // Spread conditionally rather than assigning `undefined`: an
        // always-present key would make `updatedKeys` report `photo` on every
        // update, since it reads the payload's own keys.
        ...(photoVersion ? { photo: photoVersion } : {}),
      },
      previous: UserUpdate.pickPrevious(previous, simpleChanges),
    });

    return { user: this.secure(updated), payload };
  }

  /**
   * The id of the version just written to the user's photo file.
   *
   * `CreateDefinedFileVersion` accepts either an `upload` id or a `file` to
   * upload directly; only the former is knowable from the input, since
   * FileService.createFileVersion generates an id for the latter. Reading the
   * file after the write covers both. The loader is cleared first because the
   * file may already be cached from before the new version existed.
   */
  private async latestPhotoVersion(
    user: UnsecuredDto<User>,
  ): Promise<LinkTo<'FileVersion'> | undefined> {
    if (!user.photo) {
      return undefined;
    }
    const files = await this.resources.getLoader(FileNodeLoader);
    files.clear(user.photo.id);
    const file = (await files.load(user.photo.id)) as File;
    return file.latestVersionId ? { id: file.latestVersionId } : undefined;
  }

  async delete(id: ID) {
    const object = await this.readOne(id);
    this.privileges.for(User, object).verifyCan('delete');
    await this.userRepo.delete(id, object);
    // Same-transaction side effects (e.g. session revocation — a deleted
    // user must not keep live sessions).
    await this.hooks.run(new UserDeletedHook(object.id));
    await this.hooks.run(new ResourceMutatedHook('User', id, 'Delete'));

    return this.channels.publishToAll('deleted', {
      user: id,
      at: DateTime.now(),
    });
  }

  async list(input: UserListInput): Promise<UserListOutput> {
    const results = await this.userRepo.list(input);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto)),
    };
  }

  getAssignableRoles() {
    const privileges = this.privileges.for(AssignableRoles);
    const assignableRoles = new Set(
      [...Role].filter((role) => privileges.can('edit', role)),
    );
    return assignableRoles;
  }

  verifyRolesAreAssignable(roles: readonly Role[]) {
    const allowed = this.getAssignableRoles();
    const invalid = roles.filter((role) => !allowed.has(role));
    if (invalid.length === 0) {
      return;
    }
    const invalidStr = invalid.join(', ');
    throw new UnauthorizedException(
      `You do not have the permission to assign users the roles: ${invalidStr}`,
    );
  }

  async listEducations(
    userId: ID,
    input: EducationListInput,
  ): Promise<SecuredEducationList> {
    const user = await this.userRepo.readOne(userId);
    const perms = this.privileges.for(User, user).all.education;

    if (!perms.read) {
      return SecuredList.Redacted;
    }
    const result = await this.educations.list({
      ...input,
      filter: {
        ...input.filter,
        userId: userId,
      },
    });
    return {
      ...result,
      canRead: perms.read,
      canCreate: perms.create,
    };
  }

  async listOrganizations(
    userId: ID,
    input: OrganizationListInput,
  ): Promise<SecuredOrganizationList> {
    const user = await this.userRepo.readOne(userId);
    const perms = this.privileges.for(User, user).all.organization;

    if (!perms.read) {
      return SecuredList.Redacted;
    }
    const result = await this.organizations.list({
      ...input,
      filter: {
        ...input.filter,
        userId: userId,
      },
    });
    return {
      ...result,
      canRead: perms.read,
      canCreate: perms.edit,
    };
  }

  async listPartners(
    userId: ID,
    input: PartnerListInput,
  ): Promise<SecuredPartnerList> {
    const user = await this.userRepo.readOne(userId);
    const perms = this.privileges.for(User, user).all.partner;
    const result = await this.partners.list({
      ...input,
      filter: {
        ...input.filter,
        userId,
      },
    });
    return {
      ...result,
      canRead: perms.read,
      canCreate: perms.edit,
    };
  }

  async listUnavailabilities(
    userId: ID,
    input: UnavailabilityListInput,
  ): Promise<SecuredUnavailabilityList> {
    const user = await this.userRepo.readOne(userId);
    const perms = this.privileges.for(User, user).all.unavailability;

    if (!perms.read) {
      return SecuredList.Redacted;
    }
    const result = await this.unavailabilities.list({
      ...input,
      filter: {
        ...input.filter,
        userId: userId,
      },
    });

    return {
      ...result,
      canRead: perms.read,
      canCreate: perms.create,
    };
  }

  async addLocation(userId: ID<'User'>, locationId: ID<'Location'>) {
    const changedAt = await this.locationService.addLocationToNode(
      'User',
      userId,
      'locations',
      locationId,
    );
    // Null when the link already existed — nothing changed, so no event.
    if (!changedAt) {
      return undefined;
    }
    return this.channels.publishToAll('updated', {
      user: userId,
      at: changedAt,
      updated: { locations: { Added: [locationId] } },
      previous: {},
    });
  }

  async removeLocation(userId: ID<'User'>, locationId: ID<'Location'>) {
    const changedAt = await this.locationService.removeLocationFromNode(
      'User',
      userId,
      'locations',
      locationId,
    );
    if (!changedAt) {
      return undefined;
    }
    return this.channels.publishToAll('updated', {
      user: userId,
      at: changedAt,
      updated: { locations: { Removed: [locationId] } },
      previous: {},
    });
  }

  async listLocations(
    user: User,
    input: LocationListInput,
  ): Promise<SecuredLocationList> {
    return await this.locationService.listLocationForResource(
      this.privileges.for(User, user).forEdge('locations'),
      user,
      input,
    );
  }

  async createKnownLanguage(args: ModifyKnownLanguageArgs) {
    await this.knownLanguages.create(args);
  }

  async deleteKnownLanguage(args: ModifyKnownLanguageArgs) {
    await this.knownLanguages.delete(args);
  }

  async listKnownLanguages(userId: ID) {
    const user = await this.userRepo.readOne(userId);
    const perms = this.privileges.for(User, user).all.knownLanguage;
    if (!perms.read) {
      return [];
    }
    return await this.knownLanguages.list(userId);
  }

  async checkEmail(email: string): Promise<boolean> {
    const exists = await this.userRepo.doesEmailAddressExist(email);
    return !exists;
  }

  async getUserByEmailAddress(email: string) {
    const user = await this.userRepo.getUserByEmailAddress(email);
    return user ? this.secure(user) : null;
  }

  // TODO Publish `userUpdated` for organization changes, the way addLocation()
  //  above does for locations. Deferred out of the CDC port because it needs
  //  more than wiring:
  //  1. Neither repository reports whether anything changed. The Drizzle path
  //     is an unconditional `onConflictDoUpdate` upsert returning void, and the
  //     Neo4j path is raw cypher returning nothing, so there is no `changedAt`
  //     to gate an event on. Both signatures have to change.
  //  2. `primary` makes this mutation mean two things — "add to the collection"
  //     or "promote an existing membership" (see its own description: "Assign
  //     organization OR primaryOrganization to user"). A collection delta of
  //     `{ Added | Removed }` cannot express the promotion case.
  //  3. `primaryOrganization` is not a readable field on `User` — only the
  //     `organizations` list is — so putting it in the event payload would
  //     expose a concept subscribers cannot otherwise read.
  //  Until then these return an event-shaped response with empty diffs; see
  //  UserResolver.updatedEvent.
  async assignOrganizationToUser(request: AssignOrganizationToUser) {
    await this.userRepo.assignOrganizationToUser(request);
  }

  async removeOrganizationFromUser(
    request: RemoveOrganizationFromUser,
  ): Promise<void> {
    await this.userRepo.removeOrganizationFromUser(request);
  }
}
