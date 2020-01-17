import {
  Resolver,
  Args,
  Query,
  Mutation,
  Context,
} from '@nestjs/graphql';
import { GqlContextType } from '../../common';

import { UserService } from './user.service';
import {
  CreateUserInputDto,
  CreateUserOutputDto,
  ReadUserInputDto,
  ReadUserOutputDto,
  UpdateUserInputDto,
  UpdateUserOutputDto,
  DeleteUserInputDto,
  DeleteUserOutputDto,
} from './user.dto';
import { User } from './user';

@Resolver(of => User)
export class UserResolver {
  constructor(private readonly userService: UserService) {}

  @Mutation(returns => CreateUserOutputDto, {
    description: 'Create a user',
  })
  async createUser(
    @Context() { token }: GqlContextType,
    @Args('input') { user: input }: CreateUserInputDto,
  ): Promise<CreateUserOutputDto> {
    return await this.userService.create(input, token);
  }

  @Query(returns => ReadUserOutputDto, {
    description: 'Read one user by id',
  })
  async readUser(
    @Context() { token }: GqlContextType,
    @Args('input') { user: input }: ReadUserInputDto,
  ): Promise<ReadUserOutputDto> {
    return await this.userService.readOne(input, token);
  }

  @Mutation(returns => UpdateUserOutputDto, {
    description: 'Update a user',
  })
  async updateUser(
    @Context() { token }: GqlContextType,
    @Args('input')
    { user: input }: UpdateUserInputDto,
  ): Promise<UpdateUserOutputDto> {
    return await this.userService.update(input, token);
  }

  @Mutation(returns => DeleteUserOutputDto, {
    description: 'Delete a user',
  })
  async deleteUser(
    @Context() { token }: GqlContextType,
    @Args('input')
    { user: input }: DeleteUserInputDto,
  ): Promise<DeleteUserOutputDto> {
    return await this.userService.delete(input, token);
  }
}
