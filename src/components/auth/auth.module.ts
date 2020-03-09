import { forwardRef, Global, Module } from '@nestjs/common';
import { UserModule } from '../user';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { SessionPipe } from './session';
import { AuthController } from './auth.controller';
import { SesService } from '../../core';
import { EnvironmentService } from '../../core/config/environment.service';
@Global()
@Module({
  imports: [forwardRef(() => UserModule)],
  controllers: [AuthController],
  providers: [AuthResolver, AuthService, SessionPipe, SesService, EnvironmentService],
  exports: [AuthService, SessionPipe],
})
export class AuthModule {}
