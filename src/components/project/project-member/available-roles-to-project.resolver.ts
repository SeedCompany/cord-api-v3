import { ResolveField, Resolver } from '@nestjs/graphql';
import { Grandparent, Role, SecuredRoles } from '~/common';
import { type User } from '../../user/dto';
import { ProjectMemberService } from './project-member.service';

@Resolver(SecuredRoles)
export class AvailableRolesToProjectResolver {
  constructor(private readonly service: ProjectMemberService) {}

  @ResolveField(() => [Role], {
    description: 'All of the roles this user could serve in project memberships',
  })
  async availableForProjects(@Grandparent() user: User): Promise<readonly Role[]> {
    const roles = this.service.getAvailableRoles(user);
    return [...roles];
  }
}
