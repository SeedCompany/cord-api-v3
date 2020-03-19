import { Module } from '@nestjs/common';
import { CeremonyResolver } from './ceremony.resolver';
import { CeremonyService } from './ceremony.service';

@Module({
  providers: [CeremonyResolver, CeremonyService],
  exports: [CeremonyService],
})
export class CeremonyModule {}
