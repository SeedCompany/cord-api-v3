import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { OrganizationModule } from '../organization/organization.module';
import { UserModule } from '../user/user.module';
import { PartnerResolver } from './partner.resolver';
import { PartnerService } from './partner.service';
import { PartnerRepository } from './partner.repository';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    forwardRef(() => OrganizationModule),
    forwardRef(() => UserModule),
  ],
  providers: [PartnerResolver, PartnerService, PartnerRepository],
  exports: [PartnerService, PartnerRepository],
})
export class PartnerModule {}
