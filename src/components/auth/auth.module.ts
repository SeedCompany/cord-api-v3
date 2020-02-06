import { Global, Module } from '@nestjs/common';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { SessionPipe } from './session';

@Global()
@Module({
  providers: [AuthResolver, AuthService, SessionPipe],
  exports: [AuthService, SessionPipe],
})
export class AuthModule {}
