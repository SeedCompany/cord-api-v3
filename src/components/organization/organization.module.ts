import { Module } from '@nestjs/common';
import { OrganizationResolver } from './organization.resolver';
import { OrganizationService } from './organization.service';

@Module({
  providers: [OrganizationResolver, OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
