import { forwardRef, Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { splitDb } from '~/core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { UserModule } from '../user/user.module';
import { AuthenticationGelRepository } from './authentication.gel.repository';
import { AuthenticationRepository } from './authentication.repository';
import { AuthenticationService } from './authentication.service';
import { CryptoService } from './crypto.service';
import { GelCurrentUserProvider } from './current-user.provider';
import {
  LoginExtraInfoResolver,
  RegisterExtraInfoResolver,
  SessionExtraInfoResolver,
} from './extra-info.resolver';
import { LoginResolver } from './login.resolver';
import { PasswordResolver } from './password.resolver';
import { RegisterResolver } from './register.resolver';
import { SessionInterceptor } from './session.interceptor';
import { SessionResolver } from './session.resolver';

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
    AuthenticationService,
    splitDb(AuthenticationRepository, AuthenticationGelRepository),
    { provide: 'AUTHENTICATION', useExisting: AuthenticationService },
    CryptoService,
    SessionInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: SessionInterceptor },
    GelCurrentUserProvider,
    { provide: APP_INTERCEPTOR, useExisting: GelCurrentUserProvider },
  ],
  exports: [
    SessionInterceptor,
    AuthenticationService,
    'AUTHENTICATION',
    CryptoService,
    AuthenticationRepository,
  ],
})
export class AuthenticationModule {}
