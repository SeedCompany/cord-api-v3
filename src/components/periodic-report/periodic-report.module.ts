import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../authorization/authorization.module';
import { FileModule } from '../file/file.module';
import { UserModule } from '../user/user.module';
import * as handlers from './handlers';
import { PeriodicReportService } from './periodic-report.service';

@Module({
  imports: [
    FileModule,
    forwardRef(() => UserModule),
    forwardRef(() => AuthorizationModule),
  ],
  providers: [PeriodicReportService, ...Object.values(handlers)],
  exports: [PeriodicReportService],
})
export class PeriodicReportModule {}
