import { forwardRef, Module } from '@nestjs/common';
import { BudgetModule } from '../budget/budget.module';
import { FileModule } from '../file/file.module';
import { OrganizationModule } from '../organization/organization.module';
import { ProjectModule } from '../project/project.module';
import { PartnershipResolver } from './partnership.resolver';
import { PartnershipService } from './partnership.service';

@Module({
  imports: [
    FileModule,
    forwardRef(() => BudgetModule),
    OrganizationModule,
    ProjectModule,
  ],
  providers: [PartnershipResolver, PartnershipService],
  exports: [PartnershipService],
})
export class PartnershipModule {}
