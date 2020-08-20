import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ISession, Session } from '../../common';
import { SecuredUser, UserService } from '../user';
import { Zone } from './dto';

@Resolver(Zone)
export class ZoneResolver {
  constructor(private readonly userService: UserService) {}

  @ResolveField(() => SecuredUser)
  async director(
    @Parent() zone: Zone,
    @Session() session: ISession
  ): Promise<SecuredUser> {
    const { value: id, ...rest } = zone.director;
    const value = id ? await this.userService.readOne(id, session) : undefined;
    return {
      value,
      ...rest,
    };
  }
}
