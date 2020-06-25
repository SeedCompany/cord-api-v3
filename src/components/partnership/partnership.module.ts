import { forwardRef, Module } from '@nestjs/common';
import { FileModule } from '../file';
import { OrganizationModule } from '../organization/organization.module';
import { ProjectModule } from '../project/project.module';
import { PartnershipResolver } from './partnership.resolver';
import { PartnershipService } from './partnership.service';

@Module({
  imports: [FileModule, forwardRef(() => ProjectModule), OrganizationModule],
  providers: [PartnershipResolver, PartnershipService],
  exports: [PartnershipService],
})
export class PartnershipModule {}
