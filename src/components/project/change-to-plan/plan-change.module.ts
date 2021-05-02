import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { ProjectModule } from '../project.module';
import { ChangeableResolver } from './changeable.resolver';
import * as handlers from './handlers';
import { PlanChangeResolver } from './plan-change.resolver';
import { PlanChangeService } from './plan-change.service';

@Module({
  imports: [AuthorizationModule, forwardRef(() => ProjectModule)],
  providers: [
    PlanChangeResolver,
    ChangeableResolver,
    PlanChangeService,
    ...Object.values(handlers),
  ],
  exports: [PlanChangeService],
})
export class PlanChangeModule {}
