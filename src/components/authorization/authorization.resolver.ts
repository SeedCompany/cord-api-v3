import { Query, Resolver } from '@nestjs/graphql';
import { Power } from './dto';
import { Privileges } from './policy';

@Resolver()
export class AuthorizationResolver {
  constructor(private readonly privileges: Privileges) {}

  @Query(() => [Power])
  async powers(): Promise<Power[]> {
    return [...this.privileges.powers];
  }
}
