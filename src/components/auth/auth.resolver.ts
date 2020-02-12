import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { UserService } from '../user';
import { AuthService } from './auth.service';
import {
  CreateSessionOutput,
  LoginInput,
  LoginOutput,
} from './auth.dto';
import { ISession, Session } from './session';

@Resolver()
export class AuthResolver {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  @Mutation(() => CreateSessionOutput, {
    description: 'Create a session',
  })
  async createSession(): Promise<CreateSessionOutput> {
    const token = await this.authService.createToken();
    return { token };
  }

  @Mutation(() => LoginOutput, {
    description: 'Login a user',
  })
  async login(
    @Session() session: ISession,
    @Args('input') input: LoginInput,
  ): Promise<LoginOutput> {
    const userId = await this.authService.login(
      input.email,
      input.password,
      session.token,
    );
    if (!userId) {
      return { success: false };
    }
    const user = await this.userService.readOne(userId, session);
    return {
      success: true,
      user,
    };
  }

  @Mutation(() => Boolean, {
    description: 'Logout a user',
  })
  async logout(@Session() session: ISession): Promise<boolean> {
    await this.authService.logout(session.token);
    return true;
  }
}
