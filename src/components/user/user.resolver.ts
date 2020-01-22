import {
  Resolver,
  Args,
  Query,
  Mutation,
} from '@nestjs/graphql';
import { Token } from '../../common';

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
    @Token() token: string,
    @Args('input') { user: input }: CreateUserInputDto,
  ): Promise<CreateUserOutputDto> {
    return await this.userService.create(input, token);
  }

  @Query(returns => ReadUserOutputDto, {
    description: 'Read one user by id',
  })
  async readUser(
    @Token() token: string,
    @Args('input') { user: input }: ReadUserInputDto,
  ): Promise<ReadUserOutputDto> {
    return await this.userService.readOne(input, token);
  }

  @Mutation(returns => UpdateUserOutputDto, {
    description: 'Update a user',
  })
  async updateUser(
    @Token() token: string,
    @Args('input')
    { user: input }: UpdateUserInputDto,
  ): Promise<UpdateUserOutputDto> {
    return await this.userService.update(input, token);
  }

  @Mutation(returns => DeleteUserOutputDto, {
    description: 'Delete a user',
  })
  async deleteUser(
    @Token() token: string,
    @Args('input')
    { user: input }: DeleteUserInputDto,
  ): Promise<DeleteUserOutputDto> {
    return await this.userService.delete(input, token);
  }
}
