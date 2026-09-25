import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FieldZoneModule } from '../field-zone/field-zone.module';
import { ProjectModule } from '../project/project.module';
import { UserModule } from '../user/user.module';
import { FieldRegionDrizzleRepository } from './field-region.drizzle.repository';
import { FieldRegionLoader } from './field-region.loader';
import { FieldRegionRepository } from './field-region.repository';
import { FieldRegionResolver } from './field-region.resolver';
import { FieldRegionService } from './field-region.service';
import { RestrictRegionDirectorRemovalHandler } from './handlers/restrict-region-director-removal.handler';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    FieldZoneModule,
    forwardRef(() => ProjectModule),
    forwardRef(() => UserModule),
  ],
  providers: [
    FieldRegionResolver,
    FieldRegionService,
    splitDb(FieldRegionRepository, {
      // migration-todo: remove `as any` once splitDb types accept drizzle repos directly
      postgres: FieldRegionDrizzleRepository as any,
    }),
    FieldRegionLoader,
    RestrictRegionDirectorRemovalHandler,
  ],
  exports: [FieldRegionService],
})
export class FieldRegionModule {}
