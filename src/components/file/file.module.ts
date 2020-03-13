import { Module } from '@nestjs/common';
import { AuthService } from '../auth';
import { OrganizationService } from '../organization';
import { UserService } from '../user';
import { EducationService } from '../user/education/education.service';
import { UnavailabilityService } from '../user/unavailability/unavailability.service';
import { FileResolver } from './file.resolver';
import { FileService } from './file.service';
import { FilesBucketFactory } from './files-s3-bucket.factory';

@Module({
  providers: [
    AuthService,
    FileResolver,
    FilesBucketFactory,
    FileService,
    UserService,
    OrganizationService,
    EducationService,
    UnavailabilityService,
  ],
  exports: [FileService],
})
export class FileModule {}
