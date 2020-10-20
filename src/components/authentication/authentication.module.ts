import { forwardRef, Global, Module, Provider } from '@nestjs/common';
import { SESSION_PIPE_TOKEN } from '../../common/session';
import { AuthorizationModule } from '../authorization/authorization.module';
import { UserModule } from '../user/user.module';
import { AuthenticationResolver } from './authentication.resolver';
import { AuthenticationService } from './authentication.service';
import { SessionPipe } from './session.pipe';

const ProvideSessionPipe: Provider = {
  provide: SESSION_PIPE_TOKEN,
  useExisting: SessionPipe,
};

@Global()
@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => AuthorizationModule),
  ],
  providers: [
    AuthenticationResolver,
    AuthenticationService,
    SessionPipe,
    ProvideSessionPipe,
  ],
  exports: [AuthenticationService, SessionPipe, SESSION_PIPE_TOKEN],
})
export class AuthenticationModule {}
