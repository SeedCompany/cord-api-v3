import { forwardRef, Global, Module } from '@nestjs/common';
import { UserModule } from '../user';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { SessionPipe } from './session';

@Global()
@Module({
  imports: [forwardRef(() => UserModule)],
  providers: [AuthResolver, AuthService, SessionPipe],
  exports: [AuthService, SessionPipe],
})
export class AuthModule {}
