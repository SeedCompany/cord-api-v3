import {
  Args,
  ArgsType,
  Field,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import {
  AnonSession,
  ID,
  IdField,
  LoggedInSession,
  Session,
} from '../../common';
import { Powers } from '../authorization/dto/powers';
import { AuthorizationService } from './authorization.service';
import { DeletePowerOutput } from './dto';

@ArgsType()
class ModifyPowerArgs {
  @IdField()
  userId: ID;

  @Field(() => Powers)
  power: Powers;
}

@Resolver()
export class AuthorizationResolver {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @Query(() => [Powers])
  async powers(@AnonSession() session: Session): Promise<Powers[]> {
    return await this.authorizationService.readPower(session);
  }

  @Mutation(() => Boolean)
  async grantPower(
    @LoggedInSession() session: Session,
    @Args() { userId, power }: ModifyPowerArgs
  ): Promise<boolean> {
    await this.authorizationService.createPower(userId, power, session);
    return true;
  }

  @Mutation(() => DeletePowerOutput)
  async deletePower(
    @LoggedInSession() session: Session,
    @Args() { userId, power }: ModifyPowerArgs
  ): Promise<DeletePowerOutput> {
    await this.authorizationService.deletePower(userId, power, session);
    return { success: true };
  }
}
