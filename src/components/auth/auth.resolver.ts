import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { RequestUser } from '../../common';
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
    @RequestUser() token: string,
    @Args('password') password: string,
  ): Promise<LoginUserOutputDto> {
    return await this.authService.login(password, token);
  }

  @Mutation(returns => LogoutUserOutputDto, {
    description: 'Logout a user',
  })
  async logout(@RequestUser() token: string): Promise<LogoutUserOutputDto> {
    return await this.authService.logout(token);
  }
}
