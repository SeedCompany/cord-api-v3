import { Query, Resolver } from '@nestjs/graphql';
import { AnonSession, Session } from '../../common';
import { Powers } from '../authorization/dto/powers';
import { AuthorizationService } from './authorization.service';

@Resolver()
export class AuthorizationResolver {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @Query(() => [Powers])
  async powers(@AnonSession() session: Session): Promise<Powers[]> {
    return await this.authorizationService.readPower(session);
  }
}
