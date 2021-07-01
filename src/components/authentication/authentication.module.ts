import { forwardRef, Global, Module, Provider } from '@nestjs/common';
import { SESSION_PIPE_TOKEN } from '../../common/session';
import { PostgresModule } from '../../core/postgres/postgres.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { UserModule } from '../user/user.module';
import { AuthenticationRepository } from './authentication.repository';
import { AuthenticationService } from './authentication.service';
import { CryptoService } from './crypto.service';
import { LoginResolver } from './login.resolver';
import { PasswordResolver } from './password.resolver';
import { RegisterResolver } from './register.resolver';
import { SessionPipe } from './session.pipe';
import { SessionResolver } from './session.resolver';

const ProvideSessionPipe: Provider = {
  provide: SESSION_PIPE_TOKEN,
  useExisting: SessionPipe,
};

@Global()
@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => AuthorizationModule),
    PostgresModule
  ],
  providers: [
    LoginResolver,
    PasswordResolver,
    RegisterResolver,
    SessionResolver,
    AuthenticationService,
    AuthenticationRepository,
    CryptoService,
    SessionPipe,
    ProvideSessionPipe,
  ],
  exports: [
    AuthenticationService,
    CryptoService,
    SessionPipe,
    SESSION_PIPE_TOKEN,
    AuthenticationRepository,
  ],
})
export class AuthenticationModule {}
