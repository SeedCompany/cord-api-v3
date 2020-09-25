import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { FieldRegionResolver } from './field-region.resolver';
import { FieldRegionService } from './field-region.service';

@Module({
  imports: [UserModule],
  providers: [FieldRegionResolver, FieldRegionService],
  exports: [FieldRegionService],
})
export class FieldRegionModule {}
