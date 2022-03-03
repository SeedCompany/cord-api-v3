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

  @Mutation(() => ModifyPowerOutput, {
    deprecationReason: 'Add a user role instead',
  })
  async grantPower(
    @LoggedInSession() _session: Session,
    @Args() _args: ModifyPowerArgs
  ): Promise<ModifyPowerOutput> {
    return { success: true };
  }

  @Mutation(() => DeletePowerOutput, {
    deprecationReason: 'Remove a user role instead',
  })
  async deletePower(
    @LoggedInSession() _session: Session,
    @Args() _args: ModifyPowerArgs
  ): Promise<DeletePowerOutput> {
    return { success: true };
  }
}
