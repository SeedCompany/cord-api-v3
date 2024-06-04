import { ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, Role, SecuredRoles, Session } from '~/common';
import { UserService } from './user.service';

@Resolver(SecuredRoles)
export class AssignableRolesResolver {
  constructor(private readonly service: UserService) {}

  @ResolveField(() => [Role], {
    description:
      'All of the roles that you have permission to assign to this user',
  })
  async assignableRoles(@AnonSession() session: Session) {
    return [...this.service.getAssignableRoles(session)];
  }
}
