import { forwardRef, Global, Module } from '@nestjs/common';
import { SesService } from '../../core';
import { EnvironmentService } from '../../core/config/environment.service';
import { UserModule } from '../user';
import { AuthController } from './auth.controller';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { SessionPipe } from './session';
@Global()
@Module({
  imports: [forwardRef(() => UserModule)],
  controllers: [AuthController],
  providers: [
    AuthResolver,
    AuthService,
    SessionPipe,
    SesService,
    EnvironmentService,
  ],
  exports: [AuthService, SessionPipe, SesService, EnvironmentService],
})
export class AuthModule {}
