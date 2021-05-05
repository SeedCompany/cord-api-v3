import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { EngagementModule } from '../engagement/engagement.module';
import { FileModule } from '../file/file.module';
import { ProjectModule } from '../project/project.module';
import { UserModule } from '../user/user.module';
import * as handlers from './handlers';
import { PeriodicReportResolver } from './periodic-report.resolver';
import { PeriodicReportService } from './periodic-report.service';

@Module({
  imports: [
    FileModule,
    forwardRef(() => UserModule),
    forwardRef(() => AuthorizationModule),
    forwardRef(() => EngagementModule),
    forwardRef(() => ProjectModule),
  ],
  providers: [
    PeriodicReportService,
    PeriodicReportResolver,
    ...Object.values(handlers),
  ],
  exports: [PeriodicReportService],
})
export class PeriodicReportModule {}
