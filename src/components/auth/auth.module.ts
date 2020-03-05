import { forwardRef, Global, Module } from '@nestjs/common';
import { UserModule } from '../user';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { SessionPipe } from './session';
import { AuthController } from './auth.controller';
@Global()
@Module({
  imports: [forwardRef(() => UserModule)],
  controllers: [AuthController],
  providers: [AuthResolver, AuthService, SessionPipe],
  exports: [AuthService, SessionPipe],
})
export class AuthModule {}
