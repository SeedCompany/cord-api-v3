import { forwardRef, Module } from '@nestjs/common';
import { splitDb } from '../../core';
import { AuthorizationModule } from '../authorization/authorization.module';
import { BudgetModule } from '../budget/budget.module';
import { FileModule } from '../file/file.module';
import { PartnerModule } from '../partner/partner.module';
import { ProjectModule } from '../project/project.module';
import * as handlers from './handlers';
import { PartnershipLoader } from './partnership.loader';
import { PgPartnershipRepository } from './partnership.pg.repository';
import { PartnershipRepository } from './partnership.repository';
import { PartnershipResolver } from './partnership.resolver';
import { PartnershipService } from './partnership.service';

@Module({
  imports: [
    forwardRef(() => AuthorizationModule),
    FileModule,
    forwardRef(() => BudgetModule),
    forwardRef(() => ProjectModule),
    PartnerModule,
  ],
  providers: [
    PartnershipResolver,
    PartnershipService,
    splitDb(PartnershipRepository, PgPartnershipRepository),
    PartnershipLoader,
    ...Object.values(handlers),
  ],
  exports: [PartnershipService],
})
export class PartnershipModule {}
