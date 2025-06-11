import { ResolveField, Resolver } from '@nestjs/graphql';
import { Role, SecuredRoles } from '~/common';
import { UserService } from './user.service';

@Resolver(SecuredRoles)
export class AssignableRolesResolver {
  constructor(private readonly service: UserService) {}

  @ResolveField(() => [Role], {
    description: 'All of the roles that _you_ have permission to assign to this user',
  })
  async assignableRoles() {
    return [...this.service.getAssignableRoles()];
  }
}
