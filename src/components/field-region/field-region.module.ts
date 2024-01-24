import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FieldZoneModule } from '../field-zone/field-zone.module';
import { UserModule } from '../user/user.module';
import { FieldRegionEdgeDBRepository } from './field-region.edgedb.repository';
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
    splitDb(FieldRegionRepository, FieldRegionEdgeDBRepository),
    FieldRegionLoader,
  ],
  exports: [FieldRegionService],
})
export class FieldRegionModule {}
