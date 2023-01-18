import { forwardRef, Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { UserModule } from '../user/user.module';
import { AuthenticationRepository } from './authentication.repository';
import { AuthenticationService } from './authentication.service';
import { CryptoService } from './crypto.service';
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
    AuthenticationRepository,
    CryptoService,
    SessionInterceptor,
    { provide: APP_INTERCEPTOR, useExisting: SessionInterceptor },
  ],
  exports: [AuthenticationService, CryptoService, AuthenticationRepository],
})
export class AuthenticationModule {}
