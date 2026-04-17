import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core/database';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ProjectModule } from '../project/project.module';
import { UserModule } from '../user/user.module';
import { FieldZoneGelRepository } from './field-zone.gel.repository';
import { FieldZoneKyselyRepository } from './field-zone.kysely.repository';
import { FieldZoneLoader } from './field-zone.loader';
import { FieldZoneRepository } from './field-zone.repository';
import { FieldZoneResolver } from './field-zone.resolver';
import { FieldZoneService } from './field-zone.service';
import { RestrictZoneDirectorRemovalHandler } from './handlers/restrict-zone-director-removal.handler';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    forwardRef(() => ProjectModule),
    forwardRef(() => UserModule),
  ],
  providers: [
    FieldZoneResolver,
    FieldZoneService,
    splitDb(FieldZoneRepository, {
      gel: FieldZoneGelRepository,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      postgres: FieldZoneKyselyRepository as any,
    }),
    FieldZoneKyselyRepository,
    FieldZoneLoader,
    RestrictZoneDirectorRemovalHandler,
  ],
  exports: [FieldZoneService],
})
export class FieldZoneModule {}
