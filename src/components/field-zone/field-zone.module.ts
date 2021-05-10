import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { UserModule } from '../user/user.module';
import { FieldZoneResolver } from './field-zone.resolver';
import { FieldZoneService } from './field-zone.service';
import { FieldZoneRepository } from './field-zone.repository';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    forwardRef(() => UserModule),
  ],
  providers: [FieldZoneResolver, FieldZoneService, FieldZoneRepository],
  exports: [FieldZoneService, FieldZoneRepository],
})
export class FieldZoneModule {}
