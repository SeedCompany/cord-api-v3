import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ISession, Session } from '../../common';
import { FileService, SecuredFile } from '../file';
import { LocationService } from '../location';
import { SecuredCountry } from '../location/dto';
import { SecuredUser, UserService } from '../user';
import { InternshipEngagement } from './dto';

@Resolver(InternshipEngagement)
export class InternshipEngagementResolver {
  constructor(
    private readonly files: FileService,
    private readonly users: UserService,
    private readonly locations: LocationService
  ) {}

  @ResolveField(() => SecuredFile)
  async growthPlan(
    @Parent() engagement: InternshipEngagement,
    @Session() session: ISession
  ): Promise<SecuredFile> {
    return await this.files.resolveDefinedFile(engagement.growthPlan, session);
  }

  @ResolveField(() => SecuredUser)
  async intern(
    @Parent() engagement: InternshipEngagement,
    @Session() session: ISession
  ): Promise<SecuredUser> {
    const { value: id, ...rest } = engagement.intern;
    const value = id ? await this.users.readOne(id, session) : undefined;
    return {
      value,
      ...rest,
    };
  }

  @ResolveField(() => SecuredUser)
  async mentor(
    @Parent() engagement: InternshipEngagement,
    @Session() session: ISession
  ): Promise<SecuredUser> {
    const { value: id, ...rest } = engagement.mentor;
    const value = id ? await this.users.readOne(id, session) : undefined;
    return {
      value,
      ...rest,
    };
  }

  @ResolveField(() => SecuredCountry)
  async countryOfOrigin(
    @Parent() engagement: InternshipEngagement,
    @Session() session: ISession
  ): Promise<SecuredCountry> {
    const { value: id, ...rest } = engagement.countryOfOrigin;
    const value = id
      ? await this.locations.readOneCountry(id, session)
      : undefined;
    return {
      value,
      ...rest,
    };
  }
}
