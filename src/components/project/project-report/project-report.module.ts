import { forwardRef, Module } from '@nestjs/common';
import { AuthorizationModule } from '../../authorization/authorization.module';
import { FileModule } from '../../file/file.module';
import { UserModule } from '../../user/user.module';
import { ProjectReportResolver } from './project-report.resolver';
import { ProjectReportService } from './project-report.service';

@Module({
  imports: [
    FileModule,
    forwardRef(() => UserModule),
    forwardRef(() => AuthorizationModule),
  ],
  providers: [ProjectReportResolver, ProjectReportService],
  exports: [ProjectReportService],
})
export class ProjectReportModule {}
