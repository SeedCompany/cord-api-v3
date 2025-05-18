import { forwardRef, Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { splitDb } from '~/core';
import { Identity } from '~/core/authentication';
import { AuthorizationModule } from '../../components/authorization/authorization.module';
import { UserModule } from '../../components/user/user.module';
import { AuthenticationGelRepository } from './authentication.gel.repository';
import { AuthenticationRepository } from './authentication.repository';
import { AuthenticationService } from './authentication.service';
import { CryptoService } from './crypto.service';
import {
  LoginExtraInfoResolver,
  RegisterExtraInfoResolver,
  SessionExtraInfoResolver,
} from './resolvers/extra-info.resolver';
import { LoginResolver } from './resolvers/login.resolver';
import { PasswordResolver } from './resolvers/password.resolver';
import { RegisterResolver } from './resolvers/register.resolver';
import { SessionResolver } from './resolvers/session.resolver';
import { SessionHost, SessionHostImpl } from './session/session.host';
import { SessionInterceptor } from './session/session.interceptor';

@Global()
@Module({
  imports: [
    forwardRef(() => UserModule),
    forwardRef(() => AuthorizationModule),
  ],
  providers: [
    LoginResolver,
    PasswordResolver,
    RegisterResolver,
    SessionResolver,
    SessionExtraInfoResolver,
    LoginExtraInfoResolver,
    RegisterExtraInfoResolver,
    Identity,
    AuthenticationService,
    splitDb(AuthenticationRepository, AuthenticationGelRepository),
    { provide: 'AUTHENTICATION', useExisting: AuthenticationService },
    CryptoService,
    SessionInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: SessionInterceptor },
    { provide: SessionHost, useClass: SessionHostImpl },
  ],
  exports: [Identity, SessionHost, SessionInterceptor, 'AUTHENTICATION'],
})
export class AuthenticationModule {}
