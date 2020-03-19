import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { ISession, Session } from '../../common';
import { AuthorizationService } from './authorization.service';
import {
  CreatePermissionInput,
  CreatePermissionOutput,
} from './dto/create-permission.dto';
import {
  CreateSecurityGroupInput,
  CreateSecurityGroupOutput,
} from './dto/create-security-group.dto';

@Resolver()
export class AuthorizationResolver {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @Mutation(() => CreatePermissionOutput)
  async createPermission(
    @Session() session: ISession,
    @Args('input') input: CreatePermissionInput
  ): Promise<CreatePermissionOutput> {
    return await this.authorizationService.createAuthorization(input.request);
  }

  @Mutation(() => CreateSecurityGroupOutput)
  async createSecurityGroup(
    @Session() session: ISession,
    @Args('input') input: CreateSecurityGroupInput
  ): Promise<CreateSecurityGroupOutput> {
    return await this.authorizationService.createSecurityGroup(
      session,
      input.request
    );
  }
}
