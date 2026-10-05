import { forwardRef, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { UserModule } from '../../components/user/user.module';
import { Auth0Service } from './auth0.service';
import { AuthenticationRepository } from './authentication.repository';
import { AuthenticationService } from './authentication.service';
import { DeletedUserLogsThemOutHandler } from './handlers/deleted-user-logs-them-out.handler';
import { DisablingUserLogsThemOutHandler } from './handlers/disabling-user-logs-them-out.handler';
import { Identity } from './identity.service';
import { JwtService } from './jwt.service';
import { LoginResolver } from './resolvers/login.resolver';
import { SessionResolver } from './resolvers/session.resolver';
import { SessionHost } from './session/session.host';
import { SessionInitiator } from './session/session.initiator';
import { SessionInterceptor } from './session/session.interceptor';
import { SessionManager } from './session/session.manager';

@Module({
  imports: [forwardRef(() => UserModule)],
  providers: [
    LoginResolver,
    SessionResolver,

    Identity,

    { provide: APP_INTERCEPTOR, useClass: SessionInterceptor },
    SessionInitiator,
    SessionManager,
    { provide: 'SessionInitiator', useExisting: SessionInitiator },
    { provide: 'SessionManager', useExisting: SessionManager },
    SessionHost,

    AuthenticationService,
    AuthenticationRepository,
    JwtService,
    Auth0Service,

    DisablingUserLogsThemOutHandler,
    DeletedUserLogsThemOutHandler,
  ],
  exports: [Identity],
})
export class AuthenticationModule {}
