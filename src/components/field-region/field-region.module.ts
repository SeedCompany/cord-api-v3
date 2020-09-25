import { Module } from '@nestjs/common';
import { FieldZoneModule } from '../field-zone/field-zone.module';
import { UserModule } from '../user/user.module';
import { FieldRegionResolver } from './field-region.resolver';
import { FieldRegionService } from './field-region.service';

@Module({
  imports: [FieldZoneModule, UserModule],
  providers: [FieldRegionResolver, FieldRegionService],
  exports: [FieldRegionService],
})
export class FieldRegionModule {}
