import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FieldZoneModule } from '../field-zone/field-zone.module';
import { UserModule } from '../user/user.module';
import { FieldRegionLoader } from './field-region.loader';
import { FieldRegionRepository } from './field-region.repository';
import { FieldRegionResolver } from './field-region.resolver';
import { FieldRegionService } from './field-region.service';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    FieldZoneModule,
    forwardRef(() => UserModule),
  ],
  providers: [
    FieldRegionResolver,
    FieldRegionService,
    FieldRegionRepository,
    FieldRegionLoader,
  ],
  exports: [FieldRegionService],
})
export class FieldRegionModule {}
