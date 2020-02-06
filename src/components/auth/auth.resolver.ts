import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { AuthService } from './auth.service';
import {
  CreateTokenOutputDto,
  LoginUserOutputDto,
  LogoutUserOutputDto,
} from './auth.dto';
import { ISession, Session } from './session';

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
    @Session() session: ISession,
    @Args('password') password: string,
  ): Promise<LoginUserOutputDto> {
    return await this.authService.login(password, session.token);
  }

  @Mutation(returns => LogoutUserOutputDto, {
    description: 'Logout a user',
  })
  async logout(@Session() token: ISession): Promise<LogoutUserOutputDto> {
    return await this.authService.logout(token.token);
  }
}
