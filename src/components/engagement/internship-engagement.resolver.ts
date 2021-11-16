import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { mapSecuredValue } from '../../common';
import { Loader, LoaderOf } from '../../core';
import { FileNodeLoader, resolveDefinedFile, SecuredFile } from '../file';
import { LocationLoader, SecuredLocation } from '../location';
import { SecuredUser, UserLoader } from '../user';
import { InternshipEngagement } from './dto';

@Resolver(InternshipEngagement)
export class InternshipEngagementResolver {
  @ResolveField(() => SecuredFile)
  async growthPlan(
    @Parent() engagement: InternshipEngagement,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>
  ): Promise<SecuredFile> {
    return await resolveDefinedFile(files, engagement.growthPlan);
  }

  @ResolveField(() => SecuredUser)
  async intern(
    @Parent() engagement: InternshipEngagement,
    @Loader(UserLoader) users: LoaderOf<UserLoader>
  ): Promise<SecuredUser> {
    return await mapSecuredValue(engagement.intern, (id) => users.load(id));
  }

  @ResolveField(() => SecuredUser)
  async mentor(
    @Parent() engagement: InternshipEngagement,
    @Loader(UserLoader) users: LoaderOf<UserLoader>
  ): Promise<SecuredUser> {
    return await mapSecuredValue(engagement.mentor, (id) => users.load(id));
  }

  @ResolveField(() => SecuredLocation)
  async countryOfOrigin(
    @Parent() engagement: InternshipEngagement,
    @Loader(LocationLoader) locations: LoaderOf<LocationLoader>
  ): Promise<SecuredLocation> {
    return await mapSecuredValue(engagement.countryOfOrigin, (id) =>
      locations.load(id)
    );
  }
}
