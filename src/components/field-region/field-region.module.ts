import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FieldZoneModule } from '../field-zone/field-zone.module';
import { ProjectModule } from '../project/project.module';
import { UserModule } from '../user/user.module';
import { FieldRegionGelRepository } from './field-region.gel.repository';
import { FieldRegionKyselyRepository } from './field-region.kysely.repository';
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
      gel: FieldRegionGelRepository,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      postgres: FieldRegionKyselyRepository as any,
      // Note: `as any` because PublicOf<FieldRegionRepository> includes Neo4j base
      // class members (privileges, getBaseNode, etc.) that have no equivalent in
      // PostgreSQL repositories. Once we define a domain-level IFieldRegionRepository
      // interface and update splitDb() to use it, this cast goes away.
    }),
    FieldRegionKyselyRepository,
    FieldRegionLoader,
    RestrictRegionDirectorRemovalHandler,
  ],
  exports: [FieldRegionService],
})
export class FieldRegionModule {}
