import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { FieldZoneResolver } from './field-zone.resolver';
import { FieldZoneService } from './field-zone.service';

@Module({
  imports: [UserModule],
  providers: [FieldZoneResolver, FieldZoneService],
  exports: [FieldZoneService],
})
export class FieldZonenModule {}
