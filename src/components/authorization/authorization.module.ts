import { Module } from '@nestjs/common';
import { AuthorizationService } from '../authorization/authorization.service';

@Module({
  providers: [AuthorizationService],
  exports: [AuthorizationService],
})
export class AuthorizationModule {}
