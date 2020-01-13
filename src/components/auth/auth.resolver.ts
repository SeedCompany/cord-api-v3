import {
  Resolver,
  Mutation,
  GraphQLExecutionContext,
  Args,
  Context,
} from '@nestjs/graphql';
import { AuthService } from './auth.service';
import {
  CreateTokenOutputDto,
  LoginUserOutputDto,
  LogoutUserOutputDto,
} from './auth.dto';
import { Req } from '@nestjs/common';

@Resolver('Auth')
export class AuthResolver {
  constructor(private readonly authService: AuthService) {}

  @Mutation(returns => CreateTokenOutputDto, {
    description: 'Create a token',
  })
  async createToken(): Promise<CreateTokenOutputDto> {
    return await this.authService.createToken();
  }

  @Mutation(returns => LoginUserOutputDto, {
    description: 'Login a user',
  })
  async loginUser(
    @Context() context: GraphQLExecutionContext,
    @Args('username') username: string,
    @Args('password') password: string,
  ): Promise<LoginUserOutputDto> {
    const token = context['req']['headers']['token'];
    return await this.authService.login(username, password, token);
  }

  @Mutation(returns => LogoutUserOutputDto, {
    description: 'Logout a user',
  })
  async logout(
    @Context() context: GraphQLExecutionContext,
  ): Promise<LogoutUserOutputDto> {
    const token = context['req']['headers']['token'];
    return await this.authService.logout(token);
  }
}
