import { forwardRef, Global, Module, Provider } from '@nestjs/common';
import { SESSION_PIPE_TOKEN } from '../../common/session';
import { UserModule } from '../user';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { SessionPipe } from './session.pipe';

const ProvideSessionPipe: Provider = {
  provide: SESSION_PIPE_TOKEN,
  useExisting: SessionPipe,
};

@Global()
@Module({
  imports: [forwardRef(() => UserModule)],
  providers: [AuthResolver, AuthService, SessionPipe, ProvideSessionPipe],
  exports: [AuthService, SessionPipe, SESSION_PIPE_TOKEN],
})
export class AuthModule {}
