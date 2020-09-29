import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { CeremonyResolver } from './ceremony.resolver';
import { CeremonyService } from './ceremony.service';
import * as handlers from './handlers';

@Module({
  imports: [AuthorizationModule],
  providers: [CeremonyResolver, CeremonyService, ...Object.values(handlers)],
  exports: [CeremonyService],
})
export class CeremonyModule {}
