import { forwardRef, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { splitDb } from '~/core/database';
import { UserModule } from '../../components/user/user.module';
import { AuthenticationGelRepository } from './authentication.gel.repository';
import { AuthenticationRepository } from './authentication.repository';
import { AuthenticationService } from './authentication.service';
import { CryptoService } from './crypto.service';
import { DisablingUserLogsThemOutHandler } from './handlers/disabling-user-logs-them-out.handler';
import { Identity } from './identity.service';
import { JwtService } from './jwt.service';
import { LoginResolver } from './resolvers/login.resolver';
import { PasswordResolver } from './resolvers/password.resolver';
import { RegisterResolver } from './resolvers/register.resolver';
import { SessionResolver } from './resolvers/session.resolver';
import { SessionHost } from './session/session.host';
import { SessionInitiator } from './session/session.initiator';
import { SessionInterceptor } from './session/session.interceptor';
import { SessionManager } from './session/session.manager';

@Module({
  imports: [forwardRef(() => UserModule)],
  providers: [
    LoginResolver,
    PasswordResolver,
    RegisterResolver,
    SessionResolver,

    Identity,

    { provide: APP_INTERCEPTOR, useClass: SessionInterceptor },
    SessionInitiator,
    SessionManager,
    { provide: 'SessionInitiator', useExisting: SessionInitiator },
    { provide: 'SessionManager', useExisting: SessionManager },
    SessionHost,

    AuthenticationService,
    splitDb(AuthenticationRepository, AuthenticationGelRepository),
    JwtService,
    CryptoService,

    DisablingUserLogsThemOutHandler,
  ],
  exports: [Identity],
})
export class AuthenticationModule {}
