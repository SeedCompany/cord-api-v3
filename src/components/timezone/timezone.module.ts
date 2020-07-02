import { Module } from '@nestjs/common';
import { TimeZoneResolver } from './timezone.resolver';
import { TimeZoneService } from './timezone.service';

@Module({
  providers: [TimeZoneResolver, TimeZoneService],
  exports: [TimeZoneService],
})
export class TimeZoneModule {}
