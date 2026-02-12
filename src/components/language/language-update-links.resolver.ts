import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { asNonEmptyArray } from '@seedcompany/common';
import {
  CollectionMutationType,
  Grandparent,
  loadManyIgnoreMissingThrowAny,
  SecuredList,
} from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { Privileges } from '../authorization';
import { LocationLoader } from '../location';
import { SecuredLocationList } from '../location/dto';
import { Language, LanguageUpdate, LanguageUpdated } from './dto';
import { LanguageLoader } from './language.loader';

@Resolver(LanguageUpdate)
export class LanguageUpdateLinksResolver {
  constructor(private readonly privileges: Privileges) {}

  @ResolveField(() => SecuredLocationList, {
    nullable: true,
  })
  async otherLocations(
    @Args({
      name: 'mutation',
      type: () => CollectionMutationType,
      // Could be nullable in the future, to emit the entire list, but we don't
      // have that currently without going to DB to collect it.
      // We also don't really need it because
      // LanguageUpdated.language.locations gives it.
      nullable: false,
    })
    type: CollectionMutationType,
    @Grandparent() updated: LanguageUpdated,
    @Parent() update: LanguageUpdate,
    @Loader(LanguageLoader) languages: LoaderOf<LanguageLoader>,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>,
  ): Promise<SecuredLocationList | null> {
    const ids = asNonEmptyArray(update.locations?.[type] ?? []);
    if (!ids) {
      return null;
    }

    const language = await languages.load({
      id: updated.languageId,
      view: { active: true },
    });

    const perms = this.privileges.for(Language, language).forEdge('locations');
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
}
