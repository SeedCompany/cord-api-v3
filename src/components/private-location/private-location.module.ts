import { Module } from '@nestjs/common';
import { PrivateLocationResolver } from './private-location.resolver';
import { PrivateLocationService } from './private-location.service';

@Module({
  providers: [PrivateLocationResolver, PrivateLocationService],
  exports: [PrivateLocationService],
})
export class PrivateLocationModule {}
