import { Module } from '@nestjs/common';
import { FlagRepository } from './flag.repository';
import { FlagResolver } from './flag.resolver';
import { FlagService } from './flag.service';

@Module({
  providers: [FlagResolver, FlagService, FlagRepository],
  exports: [FlagService],
})
export class FlagModule {}
