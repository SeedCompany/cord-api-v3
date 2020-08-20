import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ISession, Session } from '../../common';
import { SecuredUser, UserService } from '../user';
import { Region, SecuredZone } from './dto';
import { LocationService } from './location.service';

@Resolver(Region)
export class RegionResolver {
  constructor(
    private readonly locationService: LocationService,
    private readonly userService: UserService
  ) {}

  @ResolveField(() => SecuredUser)
  async director(
    @Parent() region: Region,
    @Session() session: ISession
  ): Promise<SecuredUser> {
    const { value: id, ...rest } = region.director;
    const value = id ? await this.userService.readOne(id, session) : undefined;
    return {
      value,
      ...rest,
    };
  }

  @ResolveField(() => SecuredZone)
  async zone(
    @Parent() region: Region,
    @Session() session: ISession
  ): Promise<SecuredZone> {
    const { value: id, ...rest } = region.zone;
    const value = id
      ? await this.locationService.readOneZone(id, session)
      : undefined;
    return {
      value,
      ...rest,
    };
  }
}
