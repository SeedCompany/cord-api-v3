import { forwardRef, Global, Module, Provider } from '@nestjs/common';
import { SESSION_PIPE_TOKEN } from '../../common/session';
import { AuthorizationService } from '../authorization/authorization.service';
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
  imports: [forwardRef(() => UserModule)],
  providers: [
    AuthenticationResolver,
    AuthenticationService,
    AuthorizationService,
    SessionPipe,
    ProvideSessionPipe,
  ],
  exports: [AuthenticationService, SessionPipe, SESSION_PIPE_TOKEN],
})
export class AuthenticationModule {}
