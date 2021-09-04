import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, mapSecuredValue, Session } from '../../common';
import { DataLoader, Loader } from '../../core';
import { FileService, SecuredFile } from '../file';
import { LocationService, SecuredLocation } from '../location';
import { SecuredUser, User } from '../user';
import { InternshipEngagement } from './dto';

@Resolver(InternshipEngagement)
export class InternshipEngagementResolver {
  constructor(
    private readonly files: FileService,
    private readonly locations: LocationService
  ) {}

  @ResolveField(() => SecuredFile)
  async growthPlan(
    @Parent() engagement: InternshipEngagement,
    @AnonSession() session: Session
  ): Promise<SecuredFile> {
    return await this.files.resolveDefinedFile(engagement.growthPlan, session);
  }

  @ResolveField(() => SecuredUser)
  async intern(
    @Parent() engagement: InternshipEngagement,
    @Loader(User) users: DataLoader<User>
  ): Promise<SecuredUser> {
    return await mapSecuredValue(engagement.intern, (id) => users.load(id));
  }

  @ResolveField(() => SecuredUser)
  async mentor(
    @Parent() engagement: InternshipEngagement,
    @Loader(User) users: DataLoader<User>
  ): Promise<SecuredUser> {
    return await mapSecuredValue(engagement.mentor, (id) => users.load(id));
  }

  @ResolveField(() => SecuredLocation)
  async countryOfOrigin(
    @Parent() engagement: InternshipEngagement,
    @AnonSession() session: Session
  ): Promise<SecuredLocation> {
    const { value: id, ...rest } = engagement.countryOfOrigin;
    const value = id ? await this.locations.readOne(id, session) : undefined;
    return {
      value,
      ...rest,
    };
  }
}
