import {
  Args,
  ArgsType,
  Field,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import {
  AnonSession,
  ID,
  IdField,
  LoggedInSession,
  MutationPlaceholderOutput,
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

@ObjectType()
export abstract class ModifyPowerOutput extends MutationPlaceholderOutput {}

@Resolver()
export class AuthorizationResolver {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @Query(() => [Powers])
  async powers(@AnonSession() session: Session): Promise<Powers[]> {
    return await this.authorizationService.readPower(session);
  }

  @Mutation(() => ModifyPowerOutput)
  async grantPower(
    @LoggedInSession() session: Session,
    @Args() { userId, power }: ModifyPowerArgs
  ): Promise<ModifyPowerOutput> {
    await this.authorizationService.createPower(power, userId, session);
    return { success: true };
  }

  @Mutation(() => DeletePowerOutput)
  async deletePower(
    @LoggedInSession() session: Session,
    @Args() { userId, power }: ModifyPowerArgs
  ): Promise<DeletePowerOutput> {
    await this.authorizationService.deletePower(power, userId, session);
    return { success: true };
  }
}
