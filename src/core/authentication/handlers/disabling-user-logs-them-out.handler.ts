import { OnHook } from '~/core';
import { UserUpdatedHook } from '../../../components/user/hooks/user-updated.hook';
import { AuthenticationService } from '../authentication.service';

@OnHook(UserUpdatedHook)
export class DisablingUserLogsThemOutHandler {
  constructor(private readonly auth: AuthenticationService) {}
  async handle({ input, updated: user }: UserUpdatedHook) {
    if (input.status === 'Disabled') {
      await this.auth.logoutByUser(user.id);
    }
  }
}
