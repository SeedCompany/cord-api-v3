import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '../../core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FieldZoneModule } from '../field-zone/field-zone.module';
import { UserModule } from '../user/user.module';
import { FieldRegionLoader } from './field-region.loader';
import {
  FieldRegionRepository,
  PgFieldRegionRepository,
} from './field-region.repository';
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
    splitDb(FieldRegionRepository, PgFieldRegionRepository),
    PgFieldRegionRepository,
  ],
  exports: [FieldRegionService],
})
export class FieldRegionModule {}
