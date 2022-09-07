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
} from '~/common';
import { DeletePowerOutput, Powers as Power } from './dto';
import { Privileges } from './policy';

@ArgsType()
class ModifyPowerArgs {
  @IdField()
  userId: ID;

  @Field(() => Power)
  power: Power;
}

@ObjectType()
export abstract class ModifyPowerOutput extends MutationPlaceholderOutput {}

@Resolver()
export class AuthorizationResolver {
  constructor(private readonly privileges: Privileges) {}

  @Query(() => [Power])
  async powers(@AnonSession() session: Session): Promise<Power[]> {
    return [...this.privileges.forUser(session).powers];
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
