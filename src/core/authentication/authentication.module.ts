import { forwardRef, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { splitDb } from '~/core';
import { UserModule } from '../../components/user/user.module';
import { AuthenticationGelRepository } from './authentication.gel.repository';
import { AuthenticationRepository } from './authentication.repository';
import { AuthenticationService } from './authentication.service';
import { CryptoService } from './crypto.service';
import { Identity } from './identity.service';
import { JwtService } from './jwt.service';
import { LoginResolver } from './resolvers/login.resolver';
import { PasswordResolver } from './resolvers/password.resolver';
import { RegisterResolver } from './resolvers/register.resolver';
import { SessionResolver } from './resolvers/session.resolver';
import { SessionHost, SessionHostImpl } from './session/session.host';
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
    { provide: SessionHost, useClass: SessionHostImpl },

    AuthenticationService,
    splitDb(AuthenticationRepository, AuthenticationGelRepository),
    JwtService,
    CryptoService,
  ],
  exports: [Identity],
})
export class AuthenticationModule {}
