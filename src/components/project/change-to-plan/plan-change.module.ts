import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { ProjectModule } from '../project.module';
import { ChangeableResolver } from './changeable.resolver';
import * as handlers from './handlers';
import { PlanChangeRepository } from './plan-change.repository';
import { PlanChangeResolver } from './plan-change.resolver';
import { PlanChangeService } from './plan-change.service';

@Module({
  imports: [AuthorizationModule, forwardRef(() => ProjectModule)],
  providers: [
    PlanChangeResolver,
    ChangeableResolver,
    PlanChangeService,
    PlanChangeRepository,
    ...Object.values(handlers),
  ],
  exports: [PlanChangeService, PlanChangeRepository],
})
export class PlanChangeModule {}
