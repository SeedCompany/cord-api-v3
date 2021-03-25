import { Module } from '@nestjs/common';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { ChangeableResolver } from './changeable.resolver';
import { PlanChangeResolver } from './plan-change.resolver';
import { PlanChangeService } from './plan-change.service';

@Module({
  imports: [AuthorizationModule],
  providers: [PlanChangeResolver, ChangeableResolver, PlanChangeService],
  exports: [PlanChangeService],
})
export class PlanChangeModule {}
