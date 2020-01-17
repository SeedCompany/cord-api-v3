import {
  Resolver,
  Mutation,
  Args,
  Context,
} from '@nestjs/graphql';
import { GqlContextType } from '../../common';
import { AuthService } from './auth.service';
import {
  CreateTokenOutputDto,
  LoginUserOutputDto,
  LogoutUserOutputDto,
} from './auth.dto';

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
    @Context() { token }: GqlContextType,
    @Args('username') username: string,
    @Args('password') password: string,
  ): Promise<LoginUserOutputDto> {
    return await this.authService.login(username, password, token);
  }

  @Mutation(returns => LogoutUserOutputDto, {
    description: 'Logout a user',
  })
  async logout(
    @Context() { token }: GqlContextType,
  ): Promise<LogoutUserOutputDto> {
    return await this.authService.logout(token);
  }
}
