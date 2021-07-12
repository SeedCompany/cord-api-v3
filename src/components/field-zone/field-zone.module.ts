import { forwardRef, Module } from '@nestjs/common';
import { PostgresModule } from '../../core/postgres/postgres.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { UserModule } from '../user/user.module';
import { FieldZoneRepository } from './field-zone.repository';
import { FieldZoneResolver } from './field-zone.resolver';
import { FieldZoneService } from './field-zone.service';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    forwardRef(() => UserModule),
    PostgresModule,
  ],
  providers: [FieldZoneResolver, FieldZoneService, FieldZoneRepository],
  exports: [FieldZoneService],
})
export class FieldZoneModule {}
