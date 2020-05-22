import { forwardRef, Global, Module, Provider } from '@nestjs/common';
import { SESSION_PIPE_TOKEN } from '../../common/session';
import { UserModule } from '../user';
import { AuthenticationResolver } from './authentication.resolver';
import { AuthenticationService } from './authentication.service';
import { SessionPipe } from './session.pipe';
import { QueryModule } from '../../core/query/query.module';

const ProvideSessionPipe: Provider = {
  provide: SESSION_PIPE_TOKEN,
  useExisting: SessionPipe,
};

@Global()
@Module({
  imports: [forwardRef(() => UserModule), QueryModule],
  providers: [
    AuthenticationResolver,
    AuthenticationService,
    SessionPipe,
    ProvideSessionPipe,
  ],
  exports: [AuthenticationService, SessionPipe, SESSION_PIPE_TOKEN],
})
export class AuthenticationModule {}
