import { Module } from '@nestjs/common';
import { BudgetModule } from '../budget';
import { FileModule } from '../file';
import { PartnershipResolver } from './partnership.resolver';
import { PartnershipService } from './partnership.service';

@Module({
  imports: [FileModule, BudgetModule],
  providers: [PartnershipResolver, PartnershipService],
  exports: [PartnershipService],
})
export class PartnershipModule {}
