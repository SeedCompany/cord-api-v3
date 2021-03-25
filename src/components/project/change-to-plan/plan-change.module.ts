import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { PlanChangeResolver } from './plan-change.resolver';
import { PlanChangeService } from './plan-change.service';

@Module({
  imports: [AuthorizationModule],
  providers: [PlanChangeResolver, PlanChangeService],
  exports: [PlanChangeService],
})
export class PlanChangeModule {}
