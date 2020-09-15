import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { BudgetModule } from '../budget/budget.module';
import { FileModule } from '../file/file.module';
import { OrganizationModule } from '../organization/organization.module';
import { PartnerModule } from '../partner/partner.module';
import { ProjectModule } from '../project/project.module';
import { PartnershipResolver } from './partnership.resolver';
import { PartnershipService } from './partnership.service';

@Module({
  imports: [
    AuthorizationModule,
    FileModule,
    forwardRef(() => BudgetModule),
    OrganizationModule,
    ProjectModule,
    PartnerModule,
  ],
  providers: [PartnershipResolver, PartnershipService],
  exports: [PartnershipService],
})
export class PartnershipModule {}
