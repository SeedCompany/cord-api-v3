import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { node } from 'cypher-query-builder';
import { IdArg, ISession, Session } from '../../common';
import { DatabaseService } from '../../core';
import { Powers } from '../authorization/dto/powers';
import { AuthorizationService } from './authorization.service';

@Resolver()
export class AuthorizationResolver {
  constructor(
    private readonly db: DatabaseService,
    private readonly authorizationService: AuthorizationService
  ) {}

  @Query(() => [Powers])
  async powers(@Session() session: ISession): Promise<Powers[]> {
    if (!session.userId) {
      return [];
    }
    const result = await this.db
      .query()
      .match([node('user', 'User', { id: session.userId })])
      .return('user.powers as powers')
      .first();

    if (!result) {
      return [];
    }
    return result.powers as Powers[];
  }

  @Mutation(() => Boolean)
  async grantPower(
    @Session() session: ISession,
    @IdArg() id: string,
    @Args({ name: 'power', type: () => Powers }) power: Powers
  ): Promise<boolean> {
    if (!session.userId) {
      return false;
    }

    const requestingUserPowers = await this.powers(session);
    if (requestingUserPowers.includes(Powers.GrantPower)) {
      return this.authorizationService.grantPower(power, id);
    }
    return false;
  }
}
