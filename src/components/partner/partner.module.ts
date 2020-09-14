import { Module } from '@nestjs/common';
import { OrganizationModule } from '../organization/organization.module';
import { PartnerResolver } from './partner.resolver';
import { PartnerService } from './partner.service';

@Module({
  imports: [OrganizationModule],
  providers: [PartnerResolver, PartnerService],
  exports: [PartnerService],
})
export class PartnerModule {}
