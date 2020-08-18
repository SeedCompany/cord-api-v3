import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import { AuthorizationService } from './authorization.service';
import { AddPropertyToSecurityGroupInput } from './dto/add-property-to-security-group.dto';
import { AttachUserToSecurityGroupInput } from './dto/attach-user-to-security-group.dto';
import {
  CreatePermissionInput,
  CreatePermissionOutput,
} from './dto/create-permission.dto';
import {
  CreateSecurityGroupInput,
  CreateSecurityGroupOutput,
} from './dto/create-security-group.dto';
import {
  ListPermissionInput,
  ListPermissionOutput,
} from './dto/list-permission.dto';
import {
  ListSecurityGroupInput,
  ListSecurityGroupOutput,
} from './dto/list-security-group.dto';
import { PromoteUserToAdminOfBaseNodeInput } from './dto/promote-user-to-admin-base-node.dto';
import { PromoteUserToAdminOfSecurityGroupInput } from './dto/promote-user-to-admin-security-group.dto';
import { RemovePermissionFromSecurityGroupInput } from './dto/remove-permission-from-security-group.dto';
import { RemoveUserFromSecurityGroupInput } from './dto/remove-user-from-security-group.dto';
import {
  UpdateSecurityGroupNameInput,
  UpdateSecurityGroupNameOutput,
} from './dto/update-security-group-name.dto';

@Resolver()
export class AuthorizationResolver {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @Query(() => ListSecurityGroupOutput, {
    description: 'List security groups that user is a member of',
  })
  async securityGroupsUserIsMemberOf(
    @Session() session: ISession,
    @Args('input') input: ListSecurityGroupInput
  ): Promise<ListSecurityGroupOutput> {
    return await this.authorizationService.listSecurityGroupsUserIsMemberOf(
      input,
      session
    );
  }

  @Query(() => ListSecurityGroupOutput, {
    description: 'List security groups that user is an admin of',
  })
  async securityGroupsUserIsAdminOf(
    @Session() session: ISession,
    @Args('input') input: ListSecurityGroupInput
  ): Promise<ListSecurityGroupOutput> {
    return await this.authorizationService.listSecurityGroupsUserIsAdminOf(
      input,
      session
    );
  }

  @Query(() => ListPermissionOutput, {
    description: 'List permissions that belong to a security group',
  })
  async permissionsInSecurityGroup(
    @Session() session: ISession,
    @Args('input') input: ListPermissionInput
  ): Promise<ListPermissionOutput> {
    return await this.authorizationService.listPermissionsInSecurityGroup(
      input,
      session
    );
  }

  @Mutation(() => CreatePermissionOutput, {
    description:
      'Create a new permission between a security group and a base node',
  })
  async createPermission(
    @Session() session: ISession,
    @Args('input') input: CreatePermissionInput
  ): Promise<CreatePermissionOutput> {
    return await this.authorizationService.createPermission(
      input.request,
      session
    );
  }

  @Mutation(() => CreateSecurityGroupOutput, {
    description: 'Create a new security group',
  })
  async createSecurityGroup(
    @Session() session: ISession,
    @Args('input') input: CreateSecurityGroupInput
  ): Promise<CreateSecurityGroupOutput> {
    return await this.authorizationService.createSecurityGroup(
      input.request,
      session
    );
  }

  @Mutation(() => Boolean, {
    description: 'Attach a user to a security group (without admin privileges)',
  })
  async attachUserToSecurityGroup(
    @Session() session: ISession,
    @Args('input') input: AttachUserToSecurityGroupInput
  ): Promise<boolean> {
    return await this.authorizationService.attachUserToSecurityGroup(
      input.request,
      session
    );
  }

  @Mutation(() => Boolean, {
    description: 'Add a property to a security group',
  })
  async addPropertyToSecurityGroup(
    @Session() session: ISession,
    @Args('input') input: AddPropertyToSecurityGroupInput
  ): Promise<boolean> {
    return await this.authorizationService.addPropertyToSecurityGroup(
      input.request,
      session
    );
  }

  @Mutation(() => Boolean, {
    description: 'Remove a permission from a security group',
  })
  async removePermissionFromSecurityGroup(
    @Session() session: ISession,
    @Args('input') input: RemovePermissionFromSecurityGroupInput
  ): Promise<boolean> {
    return await this.authorizationService.removePermissionFromSecurityGroup(
      input.request,
      session
    );
  }

  @Mutation(() => Boolean, {
    description: 'Remove a user from a security group',
  })
  async removeUserFromSecurityGroup(
    @Session() session: ISession,
    @Args('input') input: RemoveUserFromSecurityGroupInput
  ): Promise<boolean> {
    return await this.authorizationService.removeUserFromSecurityGroup(
      input.request,
      session
    );
  }

  @Mutation(() => Boolean, {
    description: 'Promote a user to become an admin of a security group',
  })
  async promoteUserToAdminOfSecurityGroup(
    @Session() session: ISession,
    @Args('input') input: PromoteUserToAdminOfSecurityGroupInput
  ): Promise<boolean> {
    return await this.authorizationService.promoteUserToAdminOfSecurityGroup(
      input.request,
      session
    );
  }

  @Mutation(() => Boolean, {
    description: 'Promote a user to become an admin of a base node',
  })
  async promoteUserToAdminOfBaseNode(
    @Session() session: ISession,
    @Args('input') input: PromoteUserToAdminOfBaseNodeInput
  ): Promise<boolean> {
    return await this.authorizationService.promoteUserToAdminOfBaseNode(
      input.request,
      session
    );
  }

  @Mutation(() => Boolean, {
    description: 'Delete a security group',
  })
  async deleteSecurityGroup(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.authorizationService.deleteSecurityGroup(id, session);
    return true;
  }

  @Mutation(() => UpdateSecurityGroupNameOutput, {
    description: "Update a security group's name",
  })
  async updateSecurityGroupName(
    @Session() session: ISession,
    @Args('input') input: UpdateSecurityGroupNameInput
  ): Promise<UpdateSecurityGroupNameOutput> {
    return await this.authorizationService.updateSecurityGroupName(
      input.request,
      session
    );
  }
}
