import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Loader, type LoaderOf } from '@seedcompany/data-loader';
import { Grandparent, mapSecuredValue } from '~/common';
import { FileNodeLoader } from '../file';
import { asFileVersion, SecuredFileVersion } from '../file/dto';
import { LocationLoader } from '../location';
import { SecuredLocation } from '../location/dto';
import { UserLoader } from '../user';
import { SecuredUser } from '../user/dto';
import {
  type InternshipEngagement,
  InternshipEngagementUpdate,
  InternshipEngagementUpdated,
  type LanguageEngagement,
  LanguageEngagementUpdate,
  LanguageEngagementUpdated,
} from './dto';
import { EngagementLoader } from './engagement.loader';

@Resolver(LanguageEngagementUpdate)
export class LanguageEngagementUpdateLinksResolver {
  @ResolveField(() => SecuredFileVersion, {
    // Secured objects should actually be nullable in this `Update` object
    // as unchanged is null.
    nullable: true,
  })
  async pnp(
    @Grandparent() updated: LanguageEngagementUpdated,
    @Parent() update: LanguageEngagementUpdate,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>,
  ): Promise<SecuredFileVersion | null> {
    if (update.pnp === undefined) {
      return null;
    }
    const engagement = (await engagements.load({
      id: updated.engagementId,
      view: { active: true },
    })) as LanguageEngagement;
    return await mapSecuredValue(
      {
        ...engagement.pnp,
        value: update.pnp,
      },
      async ({ id }) => {
        const version = await files.load(id);
        return asFileVersion(version);
      },
    );
  }
}

@Resolver(InternshipEngagementUpdate)
export class InternshipEngagementUpdateLinksResolver {
  @ResolveField(() => SecuredFileVersion, {
    // Secured objects should actually be nullable in this `Update` object
    // as unchanged is null.
    nullable: true,
  })
  async growthPlan(
    @Grandparent() updated: InternshipEngagementUpdated,
    @Parent() update: InternshipEngagementUpdate,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>,
  ): Promise<SecuredFileVersion | null> {
    if (update.growthPlan === undefined) {
      return null;
    }
    const engagement = (await engagements.load({
      id: updated.engagementId,
      view: { active: true },
    })) as InternshipEngagement;
    return await mapSecuredValue(
      {
        ...engagement.growthPlan,
        value: update.growthPlan,
      },
      async ({ id }) => {
        const version = await files.load(id);
        return asFileVersion(version);
      },
    );
  }

  @ResolveField(() => SecuredUser, {
    nullable: true,
  })
  async mentor(
    @Grandparent() updated: InternshipEngagementUpdated,
    @Parent() update: InternshipEngagementUpdate,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<SecuredUser | null> {
    if (update.mentor === undefined) {
      return null;
    }
    const engagement = (await engagements.load({
      id: updated.engagementId,
      view: { active: true },
    })) as InternshipEngagement;
    return await mapSecuredValue(
      {
        ...engagement.mentor,
        value: update.mentor,
      },
      ({ id }) => users.load(id),
    );
  }

  @ResolveField(() => SecuredLocation, {
    nullable: true,
  })
  async countryOfOrigin(
    @Grandparent() updated: InternshipEngagementUpdated,
    @Parent() update: InternshipEngagementUpdate,
    @Loader(EngagementLoader) engagements: LoaderOf<EngagementLoader>,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>,
  ): Promise<SecuredLocation | null> {
    if (update.countryOfOrigin === undefined) {
      return null;
    }
    const engagement = (await engagements.load({
      id: updated.engagementId,
      view: { active: true },
    })) as InternshipEngagement;
    return await mapSecuredValue(
      {
        ...engagement.countryOfOrigin,
        value: update.countryOfOrigin,
      },
      ({ id }) => locations.load(id),
    );
  }
}
