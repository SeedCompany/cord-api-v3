import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '../../core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { OrganizationModule } from '../organization/organization.module';
import { ProjectModule } from '../project/project.module';
import { UserModule } from '../user/user.module';
import { PartnerLoader } from './partner.loader';
import { PgPartnerRepository } from './partner.pg.repository';
import { PartnerRepository } from './partner.repository';
import { PartnerResolver } from './partner.resolver';
import { PartnerService } from './partner.service';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    forwardRef(() => ProjectModule),
    forwardRef(() => OrganizationModule),
    forwardRef(() => UserModule),
  ],
  providers: [
    PartnerResolver,
    PartnerService,
    splitDb(PartnerRepository, PgPartnerRepository),
    PartnerLoader,
  ],
  exports: [PartnerService],
})
export class PartnerModule {}
