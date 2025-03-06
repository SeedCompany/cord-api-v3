import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '~/core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { UserModule } from '../user/user.module';
import { FieldZoneGelRepository } from './field-zone.gel.repository';
import { FieldZoneLoader } from './field-zone.loader';
import { FieldZoneRepository } from './field-zone.repository';
import { FieldZoneResolver } from './field-zone.resolver';
import { FieldZoneService } from './field-zone.service';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    forwardRef(() => UserModule),
  ],
  providers: [
    FieldZoneResolver,
    FieldZoneService,
    splitDb(FieldZoneRepository, FieldZoneGelRepository),
    FieldZoneLoader,
  ],
  exports: [FieldZoneService],
})
export class FieldZoneModule {}
