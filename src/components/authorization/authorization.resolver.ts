import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import { Powers } from '../authorization/dto/powers';
import { AuthorizationService } from './authorization.service';

@Resolver()
export class AuthorizationResolver {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @Query(() => [Powers])
  async powers(@Session() session: ISession): Promise<Powers[]> {
    return await this.authorizationService.readPower(session);
  }

  @Mutation(() => Boolean)
  async grantPower(
    @Session() session: ISession,
    @IdArg() id: string,
    @Args({ name: 'power', type: () => Powers }) power: Powers
  ): Promise<boolean> {
    return await this.authorizationService.createPower(id, power, session);
  }

  @Mutation(() => Boolean)
  async deletePower(
    @Session() session: ISession,
    @IdArg() id: string,
    @Args({ name: 'power', type: () => Powers }) power: Powers
  ): Promise<boolean> {
    return await this.authorizationService.deletePower(id, power, session);
  }
}
