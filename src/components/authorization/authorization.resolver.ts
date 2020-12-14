import {
  Args,
  ArgsType,
  Field,
  Mutation,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { AnonSession, IdField, LoggedInSession, Session } from '../../common';
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
  async powers(@AnonSession() session: Session): Promise<Powers[]> {
    return await this.authorizationService.readPower(session);
  }
}
