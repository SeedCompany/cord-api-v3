import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { asNonEmptyArray } from '@seedcompany/common';
import {
  CollectionMutationType,
  Grandparent,
  loadManyIgnoreMissingThrowAny,
  mapSecuredValue,
  SecuredList,
} from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { Privileges } from '../authorization';
import { FileNodeLoader } from '../file';
import { asFileVersion, SecuredFileVersion } from '../file/dto';
import { LocationLoader } from '../location';
import { SecuredLocationList } from '../location/dto';
import { User, UserUpdate, type UserUpdated } from './dto';
import { UserLoader } from './user.loader';

@Resolver(UserUpdate)
export class UserUpdateLinksResolver {
  constructor(private readonly privileges: Privileges) {}

  @ResolveField(() => SecuredLocationList, {
    nullable: true,
  })
  async locations(
    @Args({
      name: 'mutation',
      type: () => CollectionMutationType,
      nullable: false,
    })
    type: CollectionMutationType,
    @Grandparent() updated: UserUpdated,
    @Parent() update: UserUpdate,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>,
  ): Promise<SecuredLocationList | null> {
    const ids = asNonEmptyArray(update.locations?.[type] ?? []);
    if (!ids) {
      return null;
    }

    const user = await users.load(updated.userId);

    const perms = this.privileges.for(User, user).forEdge('locations');
    if (!perms.can('read')) {
      return SecuredList.Redacted;
    }

    const items = await loadManyIgnoreMissingThrowAny(locations, ids);

    return {
      canRead: true,
      canCreate: false, // meaningless here
      items,
      hasMore: false,
      total: items.length,
    };
  }
  @ResolveField(() => SecuredFileVersion, {
    // Secured objects should actually be nullable in this `Update` object
    // as unchanged is null.
    nullable: true,
  })
  async photo(
    @Grandparent() updated: UserUpdated,
    @Parent() update: UserUpdate,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>,
  ): Promise<SecuredFileVersion | null> {
    if (update.photo === undefined) {
      return null;
    }
    const user = await users.load(updated.userId);
    // canRead/canEdit come from the live user's own secured field, so the
    // changed value is redacted per-subscriber rather than exposed outright.
    return await mapSecuredValue(
      { ...user.photo, value: update.photo },
      async ({ id }) => {
        const version = await files.load(id);
        return asFileVersion(version);
      },
    );
  }
}
