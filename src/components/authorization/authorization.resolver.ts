import {
  Args,
  ArgsType,
  Field,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { IdField, ISession, Session } from '../../common';
import { Powers } from '../authorization/dto/powers';
import { AuthorizationService } from './authorization.service';

@ArgsType()
class ModifyPowerArgs {
  @IdField()
  userId: string;

  @Field(() => Powers)
  power: Powers;
}

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
    @Args() { userId, power }: ModifyPowerArgs
  ): Promise<boolean> {
    await this.authorizationService.createPower(userId, power, session);
    return true;
  }

  @Mutation(() => Boolean)
  async deletePower(
    @Session() session: ISession,
    @Args() { userId, power }: ModifyPowerArgs
  ): Promise<boolean> {
    await this.authorizationService.deletePower(userId, power, session);
    return true;
  }
}
