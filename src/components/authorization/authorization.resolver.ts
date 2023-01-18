import { Query, Resolver } from '@nestjs/graphql';
import { AnonSession, Session } from '~/common';
import { Powers as Power } from './dto';
import { Privileges } from './policy';

@Resolver()
export class AuthorizationResolver {
  constructor(private readonly privileges: Privileges) {}

  @Query(() => [Power])
  async powers(@AnonSession() session: Session): Promise<Power[]> {
    return [...this.privileges.forUser(session).powers];
  }
}
