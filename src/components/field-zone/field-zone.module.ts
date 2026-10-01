import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ProjectModule } from '../project/project.module';
import { UserModule } from '../user/user.module';
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
    FieldZoneRepository,
    FieldZoneLoader,
    RestrictZoneDirectorRemovalHandler,
  ],
  exports: [FieldZoneService],
})
export class FieldZoneModule {}
