import { Module } from '@nestjs/common';
import { CeremonyResolver } from './ceremony.resolver';
import { CeremonyService } from './ceremony.service';
import * as handlers from './handlers';

@Module({
  providers: [CeremonyResolver, CeremonyService, ...Object.values(handlers)],
  exports: [CeremonyService],
})
export class CeremonyModule {}
